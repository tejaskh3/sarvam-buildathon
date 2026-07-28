/* Raw PCM chunks → a WAV the server accepts. Separate from the tab that uses
   it because it is arithmetic with no React in it. */

/* 16kHz mono PCM16 WAV — same encoder the voice page uses */
export function encodeWavPcm(chunks: Float32Array[], rate: number) {
  let len = 0
  for (const c of chunks) len += c.length
  const pcm = new Int16Array(len)
  let o = 0
  for (const c of chunks)
    for (let i = 0; i < c.length; i++) {
      const v = Math.max(-1, Math.min(1, c[i]))
      pcm[o++] = v < 0 ? v * 0x8000 : v * 0x7fff
    }
  const buf = new ArrayBuffer(44 + pcm.length * 2)
  const dv = new DataView(buf)
  const W = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i))
  }
  W(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); W(8, 'WAVE'); W(12, 'fmt ')
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true)
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
  W(36, 'data'); dv.setUint32(40, pcm.length * 2, true)
  new Int16Array(buf, 44).set(pcm)
  return new Blob([buf], { type: 'audio/wav' })
}
