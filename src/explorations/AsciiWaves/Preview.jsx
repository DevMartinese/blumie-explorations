import { useEffect, useRef } from 'react'

const CELL = 5
const TILE = 4
const RADIUS = 1
const DOT_R = 0.7

const GRAY_BG = '#C0C6D4'
const BLUE_BG = '#5566CC'
const BLUE_LIGHT = '#7080DD'
const WHITE_BG = '#E8ECF4'

const NOISE_SCALE = 0.018

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

export default function AsciiWavesPreview() {
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
    const t = 2.5

    ctx.fillStyle = '#D8DCE8'
    ctx.fillRect(0, 0, w, h)

    const offset = (CELL - TILE) / 2
    const cols = Math.ceil(w / CELL)
    const rows = Math.ceil(h / CELL)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = col * CELL
        const py = row * CELL
        const nx = px * NOISE_SCALE
        const ny = py * NOISE_SCALE

        const wave = fbm(nx * 0.7 + 10, ny * 1.8 + 10, t * 0.08, 4)
        const wave2 = fbm(nx * 0.5 + 200, ny * 1.5 + 200, t * 0.056, 3)
        const combined = wave * 0.6 + wave2 * 0.4

        const scatter = valueNoise3(nx * 4 + 500, ny * 4 + 500, t * 0.12)

        const isBlue = combined > 0.52
        const isScatter = !isBlue && combined > 0.44 && scatter > 0.72
        const edgeDist = Math.abs(combined - 0.52)
        const isEdgeWhite = edgeDist < 0.015 && scatter > 0.5

        const tx = px + offset
        const ty = py + offset
        const cx = px + CELL / 2
        const cy = py + CELL / 2

        if (isBlue) {
          ctx.globalAlpha = 1
          ctx.fillStyle = BLUE_BG
          roundRect(ctx, tx, ty, TILE, TILE, RADIUS)
          ctx.fill()

          ctx.fillStyle = BLUE_LIGHT
          ctx.beginPath()
          ctx.arc(cx, cy, DOT_R, 0, Math.PI * 2)
          ctx.fill()
        } else if (isScatter) {
          ctx.globalAlpha = 0.7 + scatter * 0.3
          ctx.fillStyle = BLUE_LIGHT
          roundRect(ctx, tx, ty, TILE, TILE, RADIUS)
          ctx.fill()
        } else if (isEdgeWhite) {
          ctx.globalAlpha = 0.9
          ctx.fillStyle = WHITE_BG
          roundRect(ctx, tx, ty, TILE, TILE, RADIUS)
          ctx.fill()
        } else {
          ctx.globalAlpha = 0.35
          ctx.fillStyle = '#9098B0'
          ctx.beginPath()
          ctx.arc(cx, cy, DOT_R * 0.8, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    ctx.globalAlpha = 1
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
