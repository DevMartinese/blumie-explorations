import { useEffect, useRef } from 'react'

const BG = '#0C2AEA'
const CELL = 7
const TILE_SIZE = 5
const RADIUS = 1
const FONT = 'bold 3px monospace'

const REGIONS = [
  { bg: '#FF8866', color: '#7A2200', ox: 0, oy: 0, threshold: 0.48 },
  { bg: '#4AE8A5', color: '#0A5533', ox: 137.7, oy: 259.3, threshold: 0.52 },
  { bg: '#FFE04D', color: '#6B5A00', ox: 283.1, oy: 107.9, threshold: 0.50 },
  { bg: '#FF69B4', color: '#7A0040', ox: 419.3, oy: 373.7, threshold: 0.53 },
  { bg: '#fff', color: '#000', ox: 571.9, oy: 491.1, threshold: 0.51 },
]

const NOISE_SCALE = 0.01
const DETAIL_SCALE = 0.05

const SYMBOLS = ['*', '0', '/', '↗', '1', '3', '8']

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

export default function AsciiTexturesPreview() {
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
    const t = 2.5 // fixed time for consistent preview

    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)

    // Tiles
    ctx.font = FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const cols = Math.ceil(w / CELL)
    const rows = Math.ceil(h / CELL)
    const offset = (CELL - TILE_SIZE) / 2

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = col * CELL
        const py = row * CELL
        const nx = px * NOISE_SCALE
        const ny = py * NOISE_SCALE

        let bestIdx = -1
        let bestStrength = 0

        for (let i = 0; i < REGIONS.length; i++) {
          const region = REGIONS[i]
          const n = fbm(nx + region.ox, ny + region.oy, t * 0.02, 3)
          const strength = n - region.threshold
          if (strength > 0 && strength > bestStrength) {
            bestIdx = i
            bestStrength = strength
          }
        }

        if (bestIdx < 0) continue

        const detail = valueNoise3(px * DETAIL_SCALE + 999, py * DETAIL_SCALE + 999, t * 0.08)
        const density = bestStrength * 3.5 * (0.3 + 0.7 * detail)

        if (density < 0.04 && detail < 0.55) continue

        const charIdx = Math.min(
          SYMBOLS.length - 1,
          Math.floor(density * SYMBOLS.length)
        )

        const x = px + offset
        const y = py + offset
        const region = REGIONS[bestIdx]

        ctx.globalAlpha = Math.min(1, 0.3 + density * 2.5)
        ctx.fillStyle = region.bg
        roundRect(ctx, x, y, TILE_SIZE, TILE_SIZE, RADIUS)
        ctx.fill()

        ctx.fillStyle = region.color
        ctx.fillText(SYMBOLS[charIdx], px + CELL / 2, py + CELL / 2)
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
