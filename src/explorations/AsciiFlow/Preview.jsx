import { useEffect, useRef } from 'react'

const CELL = 5
const TILE_SIZE = 4
const RADIUS = 1
const FONT = 'bold 3px monospace'

const REGIONS = [
  { bg: '#B8E8A0', color: '#4A7A30', sym: '·' },
  { bg: '#F5E6A0', color: '#8A7A30', sym: '2' },
  { bg: '#80DEB0', color: '#1A6A40', sym: '·' },
  { bg: '#FFB8D8', color: '#8A2050', sym: '1' },
  { bg: '#A8A8FF', color: '#3030A0', sym: '1' },
]

const NOISE_SCALE = 0.015
const ADVECT_STRENGTH = 60

function hash2(x, y) {
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

function curlNoise(x, y, z) {
  const eps = 0.5
  const dndy = (fbm(x, y + eps, z, 3) - fbm(x, y - eps, z, 3)) / (2 * eps)
  const dndx = (fbm(x + eps, y, z, 3) - fbm(x - eps, y, z, 3)) / (2 * eps)
  return { vx: dndy, vy: -dndx }
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

export default function AsciiFlowPreview() {
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
    const t = 3.0

    ctx.fillStyle = '#E8E0C8'
    ctx.fillRect(0, 0, w, h)

    ctx.font = FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const cols = Math.ceil(w / CELL)
    const rows = Math.ceil(h / CELL)
    const tileOffset = (CELL - TILE_SIZE) / 2

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = col * CELL
        const py = row * CELL
        const nx = px * NOISE_SCALE
        const ny = py * NOISE_SCALE

        const curl = curlNoise(nx * 3, ny * 3, t * 0.06)
        const ax = nx + curl.vx * ADVECT_STRENGTH * NOISE_SCALE
        const ay = ny + curl.vy * ADVECT_STRENGTH * NOISE_SCALE

        let bestIdx = 0
        let bestVal = -1

        for (let i = 0; i < REGIONS.length; i++) {
          const regOx = hash2(i * 73.1, i * 37.9) * 500
          const regOy = hash2(i * 91.3, i * 53.1) * 500
          const n = fbm(ax + regOx, ay + regOy, t * 0.12, 4)
          if (n > bestVal) {
            bestVal = n
            bestIdx = i
          }
        }

        const region = REGIONS[bestIdx]
        const detail = valueNoise3(ax * 8 + 999, ay * 8 + 999, t * 0.15)
        const sym = detail > 0.6 ? region.sym : '·'

        ctx.globalAlpha = 1
        ctx.fillStyle = region.bg
        roundRect(ctx, px + tileOffset, py + tileOffset, TILE_SIZE, TILE_SIZE, RADIUS)
        ctx.fill()

        ctx.fillStyle = region.color
        ctx.fillText(sym, px + CELL / 2, py + CELL / 2)
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
