FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY bot.py ./

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 7860

CMD ["sh", "-c", "exec python bot.py -t websocket --host 0.0.0.0 --port \"${PORT:-7860}\""]
