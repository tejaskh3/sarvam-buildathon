import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { PhoneFlat } from './PhoneFlat'

/* ------------------------------------------------------------------
   The app, as an object you can pick up.

   The section above it says "coming soon", which is the weakest thing a
   landing page can say. A device you can turn over in your hands says the
   same thing and reads as a decision rather than an absence — so this is a
   real WebGL phone: drag it, spin it, look at the back.

   Three things are worth knowing before editing this file:

   1. The screen is a 2D canvas painted once and uploaded as a texture. That
      keeps the UI in the same colours, fonts and Devanagari as the DOM
      version, and it means one place decides what the screen says.
   2. Screen geometry and screen canvas share ONE coordinate mapping —
      `onScreen()`. Anything that has to sit at a spot you measured in canvas
      pixels (the orb) goes through it. Nudging SCREEN_* without re-reading
      that function is how the orb ends up off-centre.
   3. Everything back-facing is rotated PI about Y rather than given
      DoubleSide. A back face lit by its own inverted normal renders flat and
      dead, and the whole point of the back is that turning the phone over is
      worth doing.

   It loads lazily (see MobileApp) because three is ~170KB gzipped and this
   sits four screens down. Until it arrives, and on anything without WebGL,
   <PhoneFlat/> stands in.
   ------------------------------------------------------------------ */

/* ── the object, in world units ────────────────────────────────────── */

const PW = 2.46 // width
const PH = 5.16 // height
const PD = 0.2 // depth, before the bevel
const PR = 0.42 // corner radius
const BEVEL = 0.045 // the rolled edge, added to depth on both faces

const HALF_D = PD / 2 + BEVEL // 0.145 — where a flat cap face sits
const INSET = 0.115 // bezel: body edge → screen edge
const SW = PW - INSET * 2
const SH = PH - INSET * 2
const SCREEN_Z = HALF_D + 0.002
const BACK_Z = -(HALF_D + 0.002)

/* The screen canvas. Its aspect has to match SW/SH or every measurement
   below drifts. */
const CW = 512
const CH = Math.round((CW * SH) / SW)

/* Canvas pixels → world position on the screen plane. Canvas y runs down
   from the top; the world runs up from the centre. */
const onScreen = (cx: number, cy: number) => ({
  x: (cx / CW - 0.5) * SW,
  y: (0.5 - cy / CH) * SH,
})

/* Where the orb lives, measured on the canvas so it lands inside the rings
   painted there. */
const ORB_C = { x: CW / 2, y: 470 }
const ORB_R = 0.3
/* How far the dome stands out of the glass. */
const ORB_RISE = 0.18
/* And it IS a dome, not a ball. A full sphere of this radius reaches
   z = -0.27 and so punches straight through the back panel — which you see
   the moment you turn the phone over. Cut the cap wide enough that its rim
   still lands behind the screen and the opaque screen hides the opening.
   66.4° is where the rim meets the glass exactly; 78° leaves margin. */
const ORB_CAP = THREE.MathUtils.degToRad(78)

const BRAND = {
  ink: '#1e2033',
  faint: '#6b7092',
  surface: '#f5f5f3',
  hair: '#dedee0',
  ringOuter: '#c6d8ff',
  ringInner: '#d9c9ff',
  orb: 0x6d5cf0,
  orbLight: 0xa5b4fc,
}

/* ── 2D painting ───────────────────────────────────────────────────── */

const DEVA = "'Instrument Serif', 'Kohinoor Devanagari', 'Nirmala UI', serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

/* Canvas has no letter-spacing we can rely on across browsers (ctx.letterSpacing
   is recent and absent in older Safari), and the mono eyebrows are tracked
   0.18em everywhere else on the site. So space them by hand. */
function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  spacing: number,
) {
  const chars = [...text]
  const w = chars.map((c) => ctx.measureText(c).width)
  const total = w.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  let x = cx - total / 2
  const align = ctx.textAlign
  ctx.textAlign = 'left'
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y)
    x += w[i] + spacing
  })
  ctx.textAlign = align
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > max) {
      out.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) out.push(line)
  return out
}

function capsule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/* The one screen the elder ever sees. Deliberately the same content as the
   CSS phone — if you change one, change both. */
function paintScreen(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, CW, CH)
  ctx.fillStyle = BRAND.surface
  ctx.fillRect(0, 0, CW, CH)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = BRAND.faint
  ctx.font = `500 17px ${MONO}`
  tracked(ctx, 'AAJ KI BAITHAK', CW / 2, 132, 3.2)

  ctx.fillStyle = BRAND.ink
  ctx.font = `46px ${DEVA}`
  ctx.fillText('यादें', CW / 2, 190)

  /* the rings the 3D orb rises through */
  ctx.lineWidth = 3
  ctx.strokeStyle = BRAND.ringOuter
  ctx.beginPath()
  ctx.arc(ORB_C.x, ORB_C.y, 118, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = BRAND.ringInner
  ctx.beginPath()
  ctx.arc(ORB_C.x, ORB_C.y, 92, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = BRAND.ink
  ctx.font = `36px ${DEVA}`
  const lines = wrap(ctx, '“आपने पुणे का ज़िक्र किया था…”', CW - 96)
  lines.forEach((l, i) => ctx.fillText(l, CW / 2, 700 + i * 46))

  /* the mic — the only control, exactly as on the web page */
  const mx = CW / 2
  const my = 920
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(mx, my, 54, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = BRAND.hair
  ctx.stroke()

  ctx.strokeStyle = BRAND.ink
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  capsule(ctx, mx - 9, my - 25, 18, 27, 9)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(mx, my - 6, 17, 0.16 * Math.PI, 0.84 * Math.PI)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(mx, my + 12)
  ctx.lineTo(mx, my + 22)
  ctx.stroke()

  /* home indicator */
  ctx.fillStyle = 'rgba(30,32,51,0.22)'
  capsule(ctx, CW / 2 - 58, CH - 46, 116, 8, 4)
  ctx.fill()
}

/* The back. Etched, not printed — a wordmark at low contrast reads as
   material rather than as a sticker.

   Mirrored horizontally because the mesh it lands on is rotated PI about Y
   to face the camera properly. Draw it un-mirrored and the wordmark comes
   out backwards. */
function paintBack(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  ctx.translate(w, 0)
  ctx.scale(-1, 1)

  ctx.fillStyle = '#191b2c'
  ctx.fillRect(0, 0, w, h)

  const wash = ctx.createLinearGradient(0, 0, w, h)
  wash.addColorStop(0, 'rgba(109,92,240,0.20)')
  wash.addColorStop(0.5, 'rgba(255,255,255,0.03)')
  wash.addColorStop(1, 'rgba(66,80,213,0.16)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, w, h)

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.52)'
  ctx.font = `${Math.round(w * 0.20)}px ${DEVA}`
  ctx.fillText('यादें', w / 2, h * 0.54)

  ctx.fillStyle = 'rgba(255,255,255,0.34)'
  ctx.font = `500 ${Math.round(w * 0.045)}px ${MONO}`
  tracked(ctx, 'YAADEIN', w / 2, h * 0.60, w * 0.02)

  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.font = `500 ${Math.round(w * 0.03)}px ${MONO}`
  tracked(ctx, 'MADE IN INDIA', w / 2, h * 0.93, w * 0.012)

  ctx.restore()
}

function textureFrom(w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) paint(ctx)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return { tex, ctx }
}

/* ── geometry helpers ──────────────────────────────────────────────── */

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = w / 2
  const y = h / 2
  s.moveTo(-x + r, -y)
  s.lineTo(x - r, -y)
  s.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x, y - r)
  s.absarc(x - r, y - r, r, 0, Math.PI / 2, false)
  s.lineTo(-x + r, y)
  s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-x, -y + r)
  s.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

/* ShapeGeometry hands back UVs that are just the vertex x/y in world units,
   so a texture on it lands at some arbitrary scale. Remap to 0..1 across the
   bounding box. */
function normalizeUV(geo: THREE.BufferGeometry) {
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  if (!bb) return geo
  const w = bb.max.x - bb.min.x
  const h = bb.max.y - bb.min.y
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - bb.min.x) / w, (pos.getY(i) - bb.min.y) / h)
  }
  uv.needsUpdate = true
  return geo
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ── the component ─────────────────────────────────────────────────── */

export default function Phone3D() {
  const host = useRef<HTMLDivElement>(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    const mount = host.current
    if (!mount) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch (e) {
      /* Said out loud, because a silent fall back to the flat phone looks
         exactly like the 3D one never being wired up. */
      console.warn('[Phone3D] no WebGL context, showing the flat phone', e)
      setBroken(true)
      return
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    /* No tone mapping on purpose: the screen is a UI mock, and the whole
       value of painting it ourselves is that #f5f5f3 arrives as #f5f5f3. */
    renderer.toneMapping = THREE.NoToneMapping
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    /* pan-y, not none: a horizontal drag turns the phone, a vertical one
       still scrolls the page. Trapping scroll inside a mock on a phone is
       the fastest way to lose a mobile visitor. */
    renderer.domElement.style.touchAction = 'pan-y'
    renderer.domElement.style.cursor = 'grab'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)

    /* A room gives the metal rails and the glass something to reflect, which
       is most of what makes this read as a physical object rather than a
       shaded rectangle. Generated once, in-process — no asset to load. */
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04).texture
    scene.environment = env
    room.dispose?.()
    pmrem.dispose()

    const key = new THREE.DirectionalLight(0xffffff, 1.7)
    key.position.set(3, 5, 6)
    const fill = new THREE.DirectionalLight(0xd5e2ff, 0.7)
    fill.position.set(-4.5, 1.5, 3)
    /* Behind and to the side, so the silhouette stays legible while it spins
       edge-on. */
    const rim = new THREE.DirectionalLight(0xffffff, 1.1)
    rim.position.set(-2.5, -1, -4.5)
    scene.add(key, fill, rim)

    const phone = new THREE.Group()
    scene.add(phone)

    const trash: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [env]
    const keep = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(x: T) => {
      trash.push(x)
      return x
    }

    /* body — the caps get a soft graphite, the extruded walls a polished
       rail. ExtrudeGeometry groups them for us: 0 is the two faces, 1 is the
       side wall. */
    const bodyGeo = keep(
      new THREE.ExtrudeGeometry(roundedRect(PW, PH, PR), {
        depth: PD,
        bevelEnabled: true,
        bevelThickness: BEVEL,
        bevelSize: BEVEL,
        bevelSegments: 4,
        curveSegments: 18,
      }),
    )
    bodyGeo.center()
    const caps = keep(
      new THREE.MeshPhysicalMaterial({
        color: 0x1e2033,
        roughness: 0.45,
        metalness: 0.35,
        clearcoat: 0.6,
        clearcoatRoughness: 0.3,
      }),
    )
    const rail = keep(
      new THREE.MeshStandardMaterial({
        color: 0x33375a,
        roughness: 0.24,
        metalness: 0.95,
        envMapIntensity: 1.3,
      }),
    )
    phone.add(new THREE.Mesh(bodyGeo, [caps, rail]))

    /* screen */
    const screenSkin = textureFrom(CW, CH, paintScreen)
    keep(screenSkin.tex)
    screenSkin.tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
    const screenGeo = keep(
      normalizeUV(new THREE.ShapeGeometry(roundedRect(SW, SH, PR - INSET), 18)),
    )
    const screen = new THREE.Mesh(
      screenGeo,
      keep(
        /* The UI is emissive, not diffuse. A screen makes its own light, and
           lighting the texture instead turned #f5f5f3 into white and washed
           the pale orb rings out of existence. Black base + emissiveMap
           delivers the authored colours exactly; clearcoat still catches the
           room, so it reads as glass rather than as a sticker. */
        new THREE.MeshPhysicalMaterial({
          color: 0x000000,
          emissive: 0xffffff,
          emissiveMap: screenSkin.tex,
          emissiveIntensity: 1,
          roughness: 0.16,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.06,
          envMapIntensity: 0.5,
        }),
      ),
    )
    screen.position.z = SCREEN_Z
    phone.add(screen)

    /* Webfonts land after first paint, so the first upload can be Georgia.
       Repaint once they're in. */
    void document.fonts?.ready.then(() => {
      if (!screenSkin.ctx) return
      paintScreen(screenSkin.ctx)
      screenSkin.tex.needsUpdate = true
    })

    /* dynamic island */
    const island = new THREE.Mesh(
      keep(new RoundedBoxGeometry(0.62, 0.17, 0.05, 3, 0.075)),
      keep(new THREE.MeshPhysicalMaterial({ color: 0x0c0d16, roughness: 0.1, clearcoat: 1 })),
    )
    island.position.set(0, onScreen(CW / 2, 62).y, SCREEN_Z + 0.008)
    phone.add(island)

    /* the orb — a real sphere rising out of the glass. It is the product's
       whole identity, so it is geometry and not paint. */
    const orbPos = onScreen(ORB_C.x, ORB_C.y)
    const orb = new THREE.Mesh(
      keep(new THREE.SphereGeometry(ORB_R, 64, 40, 0, Math.PI * 2, 0, ORB_CAP)),
      keep(
        new THREE.MeshPhysicalMaterial({
          color: BRAND.orb,
          roughness: 0.14,
          metalness: 0.1,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
          emissive: BRAND.orbLight,
          emissiveIntensity: 0.14,
        }),
      ),
    )
    orb.position.set(orbPos.x, orbPos.y, SCREEN_Z - (ORB_R - ORB_RISE))
    /* SphereGeometry cuts its cap around +Y, and the dome has to face the
       viewer: rotating +PI/2 about X sends +Y to +Z. The other sign sends it
       to -Z, which puts the dome on the back of the phone. */
    orb.rotation.x = Math.PI / 2
    phone.add(orb)

    /* back plate */
    const backSkin = textureFrom(384, Math.round((384 * PH) / PW), (c) =>
      paintBack(c, 384, Math.round((384 * PH) / PW)),
    )
    keep(backSkin.tex)
    const back = new THREE.Mesh(
      keep(
        normalizeUV(
          new THREE.ShapeGeometry(roundedRect(PW - BEVEL * 2, PH - BEVEL * 2, PR - BEVEL), 18),
        ),
      ),
      keep(
        /* Restrained on purpose. At metalness 0.4 with a full-strength room
           the panel mirrored the environment into a bright grey sheet and the
           etched wordmark disappeared under it. Matte glass with a light
           clearcoat keeps the mark legible from every angle. */
        new THREE.MeshPhysicalMaterial({
          map: backSkin.tex,
          roughness: 0.55,
          metalness: 0.1,
          clearcoat: 0.5,
          clearcoatRoughness: 0.35,
          envMapIntensity: 0.35,
        }),
      ),
    )
    back.position.z = BACK_Z
    back.rotation.y = Math.PI
    phone.add(back)
    void document.fonts?.ready.then(() => {
      if (!backSkin.ctx) return
      paintBack(backSkin.ctx, 384, Math.round((384 * PH) / PW))
      backSkin.tex.needsUpdate = true
    })

    /* camera module — the reason turning it over is worth the drag */
    const MOD = { x: 0.62, y: 1.6 }
    const modGeo = keep(
      new THREE.ExtrudeGeometry(roundedRect(0.88, 0.88, 0.3), {
        depth: 0.05,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.012,
        bevelSegments: 2,
        curveSegments: 12,
      }),
    )
    modGeo.center()
    const module = new THREE.Mesh(
      modGeo,
      keep(
        new THREE.MeshPhysicalMaterial({
          color: 0x21243a,
          roughness: 0.3,
          metalness: 0.7,
          clearcoat: 0.8,
        }),
      ),
    )
    module.position.set(MOD.x, MOD.y, BACK_Z - 0.037)
    phone.add(module)

    const lensGlass = keep(
      new THREE.MeshPhysicalMaterial({
        color: 0x05060c,
        roughness: 0.04,
        metalness: 0.2,
        clearcoat: 1,
        envMapIntensity: 1.6,
      }),
    )
    const lensRing = keep(
      new THREE.MeshStandardMaterial({ color: 0x4a4f78, roughness: 0.22, metalness: 1 }),
    )
    const lensGeo = keep(new THREE.CircleGeometry(0.17, 48))
    const ringGeo = keep(new THREE.TorusGeometry(0.182, 0.022, 10, 40))
    for (const [dx, dy] of [
      [-0.18, 0.18],
      [0.18, -0.18],
    ]) {
      const glass = new THREE.Mesh(lensGeo, lensGlass)
      glass.position.set(MOD.x + dx, MOD.y + dy, BACK_Z - 0.078)
      /* faces the viewer standing behind the phone */
      glass.rotation.y = Math.PI
      const ring = new THREE.Mesh(ringGeo, lensRing)
      ring.position.set(MOD.x + dx, MOD.y + dy, BACK_Z - 0.08)
      phone.add(glass, ring)
    }
    const flash = new THREE.Mesh(
      keep(new THREE.CircleGeometry(0.06, 32)),
      keep(
        new THREE.MeshStandardMaterial({
          color: 0xf6ecd2,
          emissive: 0xf6ecd2,
          emissiveIntensity: 0.25,
          roughness: 0.5,
        }),
      ),
    )
    flash.position.set(MOD.x + 0.18, MOD.y + 0.18, BACK_Z - 0.076)
    flash.rotation.y = Math.PI
    phone.add(flash)

    /* side buttons */
    const btnMat = keep(
      new THREE.MeshStandardMaterial({ color: 0x3a3f5c, roughness: 0.28, metalness: 0.9 }),
    )
    const btn = (h: number, x: number, y: number) => {
      const g = keep(new RoundedBoxGeometry(0.055, h, 0.13, 2, 0.024))
      const m = new THREE.Mesh(g, btnMat)
      m.position.set(x, y, 0)
      phone.add(m)
    }
    btn(0.72, PW / 2 + 0.026, 0.5) // power
    btn(0.4, -PW / 2 - 0.026, 1.0) // volume up
    btn(0.4, -PW / 2 - 0.026, 0.52) // volume down

    /* ── framing ─────────────────────────────────────────────────── */

    /* Fit by the worst case, which is the phone stood on end mid-spin: the
       height never changes, the width does. Computed rather than guessed so
       a narrow column can't clip a corner off. */
    const NEED_H = PH + 0.5
    const NEED_W = PW + 0.6
    const fit = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      camera.position.z = Math.max(NEED_H / 2 / half, NEED_W / 2 / (half * camera.aspect))
      camera.updateProjectionMatrix()
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(mount)

    /* ── interaction ─────────────────────────────────────────────── */

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    /* Resting pose: turned enough to read as an object at a glance. A phone
       rendered dead-on is indistinguishable from a rectangle. */
    const REST = { x: 0.1, y: -0.36 }
    const target = { ...REST }
    const cur = { ...REST }
    const vel = { x: 0, y: 0 }
    let dragging = false
    let touched = false
    let last = { x: 0, y: 0 }

    const el = renderer.domElement
    const down = (e: PointerEvent) => {
      dragging = true
      touched = true
      last = { x: e.clientX, y: e.clientY }
      vel.x = 0
      vel.y = 0
      el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      last = { x: e.clientX, y: e.clientY }
      target.y += dx * 0.011
      /* The throw is clamped, the drag isn't: one coalesced move event from a
         fast trackpad flick would otherwise hand the spin a velocity it takes
         several seconds to bleed off. */
      vel.y = clamp(dx * 0.011, -0.14, 0.14)
      /* Touch only turns it sideways — vertical belongs to the page. */
      if (e.pointerType !== 'touch') {
        target.x = clamp(target.x + dy * 0.008, -0.55, 0.55)
        vel.x = clamp(dy * 0.008, -0.1, 0.1)
      }
    }
    const up = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      el.style.cursor = 'grab'
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    /* The browser stealing the gesture for a scroll arrives as a cancel, not
       an up. */
    el.addEventListener('pointercancel', up)

    /* Keyboard, because a drag-only control is a control some people don't
       have. */
    el.tabIndex = 0
    const keydown = (e: KeyboardEvent) => {
      const step = 0.35
      if (e.key === 'ArrowLeft') target.y -= step
      else if (e.key === 'ArrowRight') target.y += step
      else if (e.key === 'ArrowUp') target.x = clamp(target.x - 0.2, -0.55, 0.55)
      else if (e.key === 'ArrowDown') target.x = clamp(target.x + 0.2, -0.55, 0.55)
      else if (e.key === 'Home') {
        target.x = REST.x
        target.y = REST.y
      } else return
      touched = true
      e.preventDefault()
    }
    el.addEventListener('keydown', keydown)

    /* ── loop ────────────────────────────────────────────────────── */

    let onScreenNow = true
    const io = new IntersectionObserver(([e]) => (onScreenNow = e.isIntersecting), {
      threshold: 0.01,
    })
    io.observe(mount)

    let raf = 0
    const t0 = performance.now()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!onScreenNow || document.hidden) return
      const t = (performance.now() - t0) / 1000

      if (!touched && !reduced) {
        /* Before anyone touches it, turn slowly on its own — that is the
           only hint that it can be turned at all. */
        target.y = REST.y + Math.sin(t * 0.42) * 0.44
        target.x = REST.x + Math.sin(t * 0.29) * 0.05
      } else if (!dragging) {
        target.y += vel.y
        target.x = clamp(target.x + vel.x, -0.55, 0.55)
        vel.y *= 0.94
        vel.x *= 0.9
        /* Level out over a few seconds. Y keeps whatever face you left
           showing — spinning it back would undo the visitor's choice. */
        target.x += (REST.x - target.x) * 0.01
      }

      cur.y += (target.y - cur.y) * 0.16
      cur.x += (target.x - cur.x) * 0.16
      phone.rotation.y = cur.y
      phone.rotation.x = cur.x

      if (!reduced) {
        orb.scale.setScalar(1 + Math.sin(t * 1.7) * 0.022)
        phone.position.y = Math.sin(t * 0.6) * 0.035
      }

      renderer.render(scene, camera)
    }
    tick()

    /* Tearing down deliberately loses the context too, and that must not be
       mistaken for the GPU dropping us. */
    let torn = false
    const lost = (e: Event) => {
      if (torn) return
      e.preventDefault()
      console.warn('[Phone3D] WebGL context lost, showing the flat phone')
      setBroken(true)
    }
    el.addEventListener('webglcontextlost', lost)

    return () => {
      torn = true
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('keydown', keydown)
      el.removeEventListener('webglcontextlost', lost)
      for (const r of trash) r.dispose()
      renderer.dispose()
      /* dispose() frees three's own objects but leaves the GL context alive.
         React's dev double-mount plus a few hot reloads is enough to hit
         Chrome's per-page context ceiling, and then the NEXT mount gets no
         context at all and quietly serves the flat phone. */
      renderer.forceContextLoss()
      el.remove()
    }
  }, [])

  if (broken) return <PhoneFlat />

  return (
    <div
      ref={host}
      /* Taller and wider than the device so a corner never clips at 90°. */
      className="h-[520px] w-[300px] sm:h-[560px] sm:w-[330px]"
      role="img"
      aria-label="A 3D model of the Yaadein app on a phone, showing the single screen the elder sees: the orb and a microphone. Drag it to turn it around."
    />
  )
}
