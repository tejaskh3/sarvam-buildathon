"""Realtime voice transport for Yaadein.

Pipecat owns WebSocket audio, streaming Sarvam STT/TTS, VAD, and interruptions.
The Node app remains the single source of truth for conversation, memory,
safety, and session behavior.
"""

from __future__ import annotations

import asyncio
import base64
import io
import os
import time
import wave
from pathlib import Path
from typing import Any

import aiohttp
from dotenv import load_dotenv
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import (
    BotStoppedSpeakingFrame,
    Frame,
    LLMContextFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    TranscriptionFrame,
    TTSSpeakFrame,
    TTSUpdateSettingsFrame,
    UserStartedSpeakingFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.audio.audio_buffer_processor import AudioBufferProcessor
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.processors.frameworks.rtvi.observer import RTVIObserver
from pipecat.processors.frameworks.rtvi.processor import RTVIProcessor
from pipecat.runner.types import WebSocketRunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.serializers.protobuf import ProtobufFrameSerializer
from pipecat.services.llm_service import LLMService, LLMSettings
from pipecat.services.sarvam.stt import SarvamSTTService
from pipecat.services.sarvam.tts import SarvamTTSService
from pipecat.services.tts_service import TextAggregationMode
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams
from pipecat.workers.runner import WorkerRunner


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "app" / ".env")

NODE_API = os.getenv("YAADEIN_API_BASE", "http://127.0.0.1:3000")
SARVAM_KEY = os.getenv("SARVAM_API_KEY")
DEFAULT_LANGUAGE = "hi-IN"
VALID_LANGUAGES = {
    "bn-IN",
    "en-IN",
    "gu-IN",
    "hi-IN",
    "kn-IN",
    "ml-IN",
    "mr-IN",
    "od-IN",
    "pa-IN",
    "ta-IN",
    "te-IN",
}


class TurnState:
    """Small per-call bridge for transcript metadata and source audio."""

    def __init__(self) -> None:
        self.audio: bytes | None = None
        self.audio_sample_rate = 16000
        self.audio_channels = 1
        self.language = DEFAULT_LANGUAGE
        self.last_bot_stopped_at: float | None = None
        self.delay_ms: int | None = None

    def store_audio(self, audio: bytes | bytearray, sample_rate: int, channels: int) -> None:
        self.audio = bytes(audio)
        self.audio_sample_rate = sample_rate
        self.audio_channels = channels

    def take_wav_base64(self) -> str | None:
        if not self.audio:
            return None
        with io.BytesIO() as out:
            with wave.open(out, "wb") as wav:
                wav.setnchannels(self.audio_channels)
                wav.setsampwidth(2)
                wav.setframerate(self.audio_sample_rate)
                wav.writeframes(self.audio)
            encoded = base64.b64encode(out.getvalue()).decode("ascii")
        self.audio = None
        return encoded


def _language_code(value: Any) -> str | None:
    if value is None:
        return None
    code = getattr(value, "value", value)
    code = str(code)
    return code if code in VALID_LANGUAGES else None


async def _load_session(session_id: str) -> tuple[str, str]:
    """Load private session state without putting generated text in the WS URL."""

    async with aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=15)
    ) as http:
        async with http.get(
            f"{NODE_API}/api/realtime/session",
            headers={"x-session-id": session_id},
        ) as response:
            data = await response.json(content_type=None)
            if response.status >= 400 or data.get("error"):
                raise RuntimeError(
                    data.get("message") or data.get("error") or "Session lookup failed"
                )

    opener = str(data.get("text") or "").strip()
    language = _language_code(data.get("language")) or DEFAULT_LANGUAGE
    if not opener:
        raise RuntimeError("Realtime session has no opener")
    return opener, language


class TranscriptMetadataProcessor(FrameProcessor):
    def __init__(self, state: TurnState) -> None:
        super().__init__()
        self._state = state

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, TranscriptionFrame):
            self._state.language = _language_code(frame.language) or self._state.language
        await self.push_frame(frame, direction)


class ConversationTimingProcessor(FrameProcessor):
    def __init__(self, state: TurnState) -> None:
        super().__init__()
        self._state = state

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, BotStoppedSpeakingFrame):
            self._state.last_bot_stopped_at = time.monotonic()
        elif isinstance(frame, UserStartedSpeakingFrame):
            if self._state.last_bot_stopped_at is not None:
                self._state.delay_ms = max(
                    0,
                    round((time.monotonic() - self._state.last_bot_stopped_at) * 1000),
                )
        await self.push_frame(frame, direction)


class YaadeinConversationService(LLMService):
    """Adapts Pipecat's final transcript to the existing Node conversation API."""

    def __init__(
        self,
        *,
        session_id: str,
        state: TurnState,
        rtvi: RTVIProcessor,
        tts: SarvamTTSService,
    ) -> None:
        super().__init__(
            settings=LLMSettings(
                model=None,
                system_instruction=None,
                temperature=None,
                max_tokens=None,
                top_p=None,
                top_k=None,
                frequency_penalty=None,
                presence_penalty=None,
                seed=None,
                filter_incomplete_user_turns=None,
                user_turn_completion_config=None,
            )
        )
        self._session_id = session_id
        self._state = state
        self._rtvi = rtvi
        self._tts = tts
        self._http: aiohttp.ClientSession | None = None

    async def cleanup(self):
        if self._http is not None:
            await self._http.close()
            self._http = None
        await super().cleanup()

    @staticmethod
    def _latest_user_text(frame: LLMContextFrame) -> str:
        for message in reversed(frame.context.get_messages()):
            if message.get("role") != "user":
                continue
            content = message.get("content", "")
            if isinstance(content, str):
                return content.strip()
        return ""

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if not isinstance(frame, LLMContextFrame):
            await self.push_frame(frame, direction)
            return

        transcript = self._latest_user_text(frame)
        if not transcript:
            return

        await self.push_frame(LLMFullResponseStartFrame())
        try:
            if self._http is None:
                self._http = aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=45)
                )
            payload = {
                "transcript": transcript,
                "language": self._state.language,
                "audio": self._state.take_wav_base64(),
                "delayMs": self._state.delay_ms,
            }
            self._state.delay_ms = None
            async with self._http.post(
                f"{NODE_API}/api/realtime/turn",
                headers={"x-session-id": self._session_id},
                json=payload,
            ) as response:
                data = await response.json(content_type=None)
                if response.status >= 400 or data.get("error"):
                    raise RuntimeError(data.get("message") or data.get("error") or "Turn failed")

            reply = str(data.get("text") or "").strip()
            if not reply:
                return
            language = _language_code(data.get("language")) or self._state.language
            self._state.language = language
            await self._rtvi.send_server_message(
                {
                    "type": "turn",
                    "transcript": transcript,
                    "text": reply,
                    "person": data.get("person"),
                    "contract": data.get("contract"),
                }
            )
            await self.push_frame(
                TTSUpdateSettingsFrame(
                    delta=SarvamTTSService.Settings(language=language),
                    service=self._tts,
                )
            )
            await self.push_frame(LLMTextFrame(reply))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Realtime conversation turn failed")
            await self._rtvi.send_server_message(
                {"type": "error", "message": "Yaadein could not answer that turn. Please try again."}
            )
            await self.push_error("Realtime conversation turn failed", exception=exc)
        finally:
            await self.push_frame(LLMFullResponseEndFrame())


async def bot(runner_args: WebSocketRunnerArguments):
    if not isinstance(runner_args, WebSocketRunnerArguments):
        raise TypeError("Yaadein realtime supports the WebSocket transport only")
    if runner_args.transport_type != "websocket":
        raise TypeError("Telephony WebSocket connections are not supported here")
    if not SARVAM_KEY:
        raise RuntimeError("SARVAM_API_KEY is missing from app/.env")

    session_id = str(runner_args.websocket.query_params.get("sessionId") or "").strip()
    if not session_id:
        logger.warning("Ignoring a WebSocket connection without a Yaadein session ID")
        return
    opener, language = await _load_session(session_id)

    transport = await create_transport(
        runner_args,
        {
            "websocket": lambda: FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_in_sample_rate=16000,
                audio_out_enabled=True,
                audio_out_sample_rate=24000,
                serializer=ProtobufFrameSerializer(),
            )
        },
    )
    rtvi = RTVIProcessor()
    state = TurnState()
    state.language = language

    # A longer stop window respects an elder's natural pauses while still
    # reacting immediately when speech begins.
    vad = SileroVADAnalyzer(
        params=VADParams(
            confidence=0.55,
            start_secs=0.15,
            stop_secs=1.0,
            min_volume=0.45,
        )
    )
    stt = SarvamSTTService(
        api_key=SARVAM_KEY,
        mode="codemix",
        sample_rate=16000,
        settings=SarvamSTTService.Settings(
            model="saaras:v3",
            language=language,
            vad_signals=True,
            high_vad_sensitivity=False,
        ),
    )
    tts = SarvamTTSService(
        api_key=SARVAM_KEY,
        text_aggregation_mode=TextAggregationMode.SENTENCE,
        sample_rate=24000,
        settings=SarvamTTSService.Settings(
            model="bulbul:v3",
            voice="simran",
            language=language,
            pace=0.85,
            temperature=0.4,
            min_buffer_size=30,
            max_chunk_length=160,
        ),
    )

    context = LLMContext()
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=vad,
            audio_idle_timeout=1.0,
            user_turn_stop_timeout=5.0,
        ),
    )
    metadata = TranscriptMetadataProcessor(state)
    audio_buffer = AudioBufferProcessor(
        sample_rate=16000,
        enable_turn_audio=True,
        auto_start_recording=True,
    )

    @audio_buffer.event_handler("on_user_turn_audio_data")
    async def on_user_turn_audio_data(
        processor: AudioBufferProcessor,
        audio: bytes,
        sample_rate: int,
        channels: int,
    ):
        del processor
        state.store_audio(audio, sample_rate, channels)

    conversation = YaadeinConversationService(
        session_id=session_id,
        state=state,
        rtvi=rtvi,
        tts=tts,
    )
    timing = ConversationTimingProcessor(state)

    pipeline = Pipeline(
        [
            transport.input(),
            rtvi,
            stt,
            metadata,
            user_aggregator,
            audio_buffer,
            conversation,
            tts,
            transport.output(),
            assistant_aggregator,
            timing,
        ]
    )
    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=16000,
            audio_out_sample_rate=24000,
        ),
        observers=[RTVIObserver(rtvi)],
        rtvi_processor=rtvi,
        enable_rtvi=True,
    )

    @rtvi.event_handler("on_client_ready")
    async def on_client_ready(processor: RTVIProcessor):
        await processor.set_bot_ready({"name": "Yaadein", "version": "realtime"})
        await worker.queue_frame(TTSSpeakFrame(opener))

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        del transport, client
        await worker.cancel()

    runner = WorkerRunner(handle_sigint=runner_args.handle_sigint)
    await runner.add_workers(worker)
    await runner.run()


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
