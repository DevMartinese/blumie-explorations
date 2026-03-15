import { useEffect, useRef } from 'react'

const CELL = 5
const RADIUS = 1

function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return n - Math.floor(n)
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10) }
function lerp(a, b, t) { return a + (b - a) * t }

function valueNoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz)
  return lerp(
    lerp(
      lerp(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), fx),
      lerp(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), fx),
      fy
    ),
    lerp(
      lerp(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), fx),
      lerp(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), fx),
      fy
    ),
    fz
  )
}

function fbm(x, y, z, octaves) {
  let v = 0, a = 0.5
  for (let i = 0; i < octaves; i++) {
    v += a * valueNoise3(x, y, z)
    x *= 2; y *= 2; z *= 2; a *= 0.5
  }
  return v
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// Draw a simple Blumie logo silhouette (rounded "B" shape)
function drawLogoSilhouette(ctx, cx, cy, size) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
  // Simple block letter shape
  const s = size * 0.4
  roundRect(ctx, cx - s, cy - s * 1.2, s * 2, s * 2.4, s * 0.3)
  ctx.fill()
}

// Draw ASCII pattern tiles inside a clipped circle
function drawPatternInCircle(ctx, cx, cy, radius, patternFn) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.clip()

  const x0 = cx - radius
  const y0 = cy - radius
  const x1 = cx + radius
  const y1 = cy + radius
  const cols = Math.ceil((x1 - x0) / CELL)
  const rows = Math.ceil((y1 - y0) / CELL)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      patternFn(ctx, x0 + col * CELL, y0 + row * CELL, col, row)
    }
  }
  ctx.restore()
}

export default function AsciiMaskPreview() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const w = rect.width
    const h = rect.height

    // Blue background
    ctx.fillStyle = '#0C2AEA'
    ctx.fillRect(0, 0, w, h)

    // Logo silhouette
    drawLogoSilhouette(ctx, w * 0.5, h * 0.5, Math.min(w, h) * 0.6)

    const r = Math.min(w, h) * 0.18

    // Mask 1: Waves (top-left)
    const m0x = w * 0.3, m0y = h * 0.35
    drawPatternInCircle(ctx, m0x, m0y, r, (ctx, px, py, col, row) => {
      const nx = col * 0.15, ny = row * 0.15
      const wave = fbm(nx * 0.7 + 10, ny * 1.8 + 10, 2.5 * 0.08, 3)
      const isBlue = wave > 0.5
      ctx.fillStyle = isBlue ? '#5566CC' : '#C0C6D4'
      roundRect(ctx, px, py, CELL - 1, CELL - 1, RADIUS)
      ctx.fill()
    })
    // Border
    ctx.strokeStyle = 'rgba(85, 102, 204, 0.7)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(m0x, m0y, r, 0, Math.PI * 2)
    ctx.stroke()

    // Mask 2: Terrain (center-right)
    const m1x = w * 0.65, m1y = h * 0.45
    drawPatternInCircle(ctx, m1x, m1y, r, (ctx, px, py, col, row) => {
      const elev = fbm(col * 0.2 + row * 0.1 + 100, row * 0.2 - col * 0.1 + 100, 0.1, 3)
      ctx.fillStyle = elev > 0.5 ? '#E07850' : '#F5DDD0'
      roundRect(ctx, px, py, CELL - 1, CELL - 1, RADIUS)
      ctx.fill()
    })
    ctx.strokeStyle = 'rgba(224, 120, 80, 0.7)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(m1x, m1y, r, 0, Math.PI * 2)
    ctx.stroke()

    // Mask 3: Flow (bottom)
    const m2x = w * 0.45, m2y = h * 0.7
    const flowColors = ['#B8E8A0', '#F5E6A0', '#80DEB0', '#FFB8D8', '#A8A8FF']
    drawPatternInCircle(ctx, m2x, m2y, r, (ctx, px, py, col, row) => {
      const n = fbm(col * 0.2 + 50, row * 0.2 + 50, 0.1, 3)
      const idx = Math.min(Math.floor(n * 5), 4)
      ctx.fillStyle = flowColors[idx]
      roundRect(ctx, px, py, CELL - 1, CELL - 1, RADIUS)
      ctx.fill()
    })
    ctx.strokeStyle = 'rgba(184, 232, 160, 0.7)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(m2x, m2y, r, 0, Math.PI * 2)
    ctx.stroke()

    ctx.globalAlpha = 1
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
