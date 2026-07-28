import { useState, useEffect, useRef, useCallback } from 'react'
import { authFetch } from '../../lib/auth'
import { API } from '../../lib/api'
import type { Photo } from '../types'

/* Photo uploads that become tomorrow's conversation. */

export function PhotosTab({ pid }: { pid: number }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ event: '', place: '', year: '', notes: '', people: '' })
  const [deceased, setDeceased] = useState('')

  const load = useCallback(() => {
    authFetch(`${API}/api/people/${pid}/photos`).then((r) => r.json()).then(setPhotos)
  }, [pid])
  useEffect(() => { setPhotos(null); load() }, [pid, load])

  const upload = async () => {
    const f = fileRef.current?.files?.[0]
    if (!f) return setMsg('Choose a photo first.')
    const names = form.people.split(',').map((x) => x.trim()).filter(Boolean)
    if (!names.length) return setMsg('List who is in the photo — Yaadein must never guess.')
    const gone = new Set(deceased.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))
    setBusy(true)
    setMsg(null)
    try {
      // FileReader, not String.fromCharCode(...bytes): spreading a multi-MB
      // photo as arguments overflows the call stack
      const b64 = await new Promise<string>((resolve, reject) => {
        const rd = new FileReader()
        rd.onload = () => resolve((rd.result as string).split(',')[1])
        rd.onerror = () => reject(rd.error ?? new Error('Could not read the photo'))
        rd.readAsDataURL(f)
      })
      const r = await authFetch(`${API}/api/people/${pid}/photos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          image_b64: b64,
          mime: f.type,
          event: form.event, place: form.place, year: form.year, notes: form.notes,
          people: names.map((n) => ({ name: n, deceased: gone.has(n.toLowerCase()) })),
        }),
      })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setMsg('Uploaded — Yaadein will bring it up in the next conversation.')
      setForm({ event: '', place: '', year: '', notes: '', people: '' })
      setDeceased('')
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const input = 'border-st-secondary text-tx w-full rounded-lg border bg-white px-3 py-2 text-[14px] outline-none focus:border-tx'

  return (
    <div className="space-y-6">
      <div className="border-st-secondary rounded-2xl border bg-white px-5 py-5">
        <h3 className="text-tx text-[15px] font-semibold">Add a photo for their next conversation</h3>
        <p className="text-tx-tertiary mt-1 text-[13px]">
          Yaadein shows it on screen, describes it aloud, and asks gentle questions with no wrong answer — using only what you write here.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" className={input + ' sm:col-span-2'} />
          <input placeholder="What is happening? (e.g. Meena's wedding)" value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} className={input} />
          <input placeholder="Where? (e.g. Kolhapur)" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} className={input} />
          <input placeholder="Year (e.g. 1994)" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className={input} />
          <input placeholder="Who is in it? (comma-separated names)" value={form.people} onChange={(e) => setForm({ ...form, people: e.target.value })} className={input} />
          <input placeholder="Of those — who has passed away? (names, or leave empty)" value={deceased} onChange={(e) => setDeceased(e.target.value)} className={input + ' sm:col-span-2'} />
          <textarea placeholder="Anything else the family remembers about this moment" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={input + ' sm:col-span-2'} rows={2} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={upload} disabled={busy} className="pill pill-primary !py-2 !text-[13px]">
            {busy ? 'Uploading…' : 'Add photo'}
          </button>
          {msg && <span className="text-tx-secondary text-[13px]">{msg}</span>}
        </div>
        <p className="text-tx-tertiary mt-3 text-[11px]">
          The passed-away question is required so Yaadein never cheerfully asks about someone who is gone.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(photos ?? []).map((p) => (
          <div key={p.id} className="border-st-secondary overflow-hidden rounded-2xl border bg-white">
            <img src={`${API}${p.url}`} alt={p.event} className="aspect-[4/3] w-full object-cover" />
            <div className="px-4 py-3">
              <p className="text-tx text-[14px] font-medium">{p.event || 'Untitled'} {p.year && <span className="text-tx-tertiary">· {p.year}</span>}</p>
              <p className="text-tx-tertiary mt-0.5 text-[12px]">
                {p.people.map((x) => x.name + (x.deceased ? ' †' : '')).join(', ')}
              </p>
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] ${p.status === 'NEW' ? 'bg-sr-indigo-700/10 text-sr-indigo-700' : 'bg-sf-secondary text-tx-tertiary'}`}>
                {p.status === 'NEW' ? 'WILL COME UP NEXT SESSION' : 'DISCUSSED'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
