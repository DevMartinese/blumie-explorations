import { useEffect, useRef } from 'react'

const BG = '#F5DDD0'
const FG = '#E07850'
const CELL = 4
const NOISE_SCALE = 0.02

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

function drawShape(ctx, shape, cx, cy, size) {
  const half = size / 2
  switch (shape) {
    case 1:
      ctx.beginPath()
      ctx.arc(cx, cy, size * 0.15, 0, Math.PI * 2)
      ctx.fill()
      break
    case 2:
      ctx.beginPath()
      ctx.arc(cx, cy, size * 0.28, 0, Math.PI * 2)
      ctx.fill()
      break
    case 3:
      ctx.fillRect(cx - half * 0.55, cy - size * 0.08, size * 0.55, size * 0.16)
      break
    case 4:
      ctx.fillRect(cx - half * 0.35, cy - half * 0.35, size * 0.35, size * 0.35)
      break
    case 5:
      ctx.strokeRect(cx - half * 0.45, cy - half * 0.45, size * 0.45, size * 0.45)
      break
    case 6:
      ctx.fillRect(cx - half * 0.6, cy - half * 0.6, size * 0.6, size * 0.6)
      break
  }
}

export default function AsciiTerrainPreview() {
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
    const t = 2.0

    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = FG
    ctx.strokeStyle = FG
    ctx.lineWidth = 0.5

    const cols = Math.ceil(w / CELL)
    const rows = Math.ceil(h / CELL)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const px = col * CELL
        const py = row * CELL
        const nx = px * NOISE_SCALE
        const ny = py * NOISE_SCALE

        const gradient = (px + py) / (w + h)
        const n = fbm(nx + 50, ny + 50, t * 0.06, 4)
        const elevation = gradient * 0.55 + n * 0.45

        const detail = valueNoise3(nx * 5 + 333, ny * 5 + 333, t * 0.1)

        let shape = 0
        if (elevation < 0.25) {
          shape = 0
        } else if (elevation < 0.35) {
          shape = detail > 0.5 ? 1 : 0
        } else if (elevation < 0.42) {
          shape = detail > 0.4 ? 1 : 2
        } else if (elevation < 0.50) {
          shape = detail > 0.5 ? 2 : 3
        } else if (elevation < 0.58) {
          shape = detail > 0.6 ? 3 : 4
        } else if (elevation < 0.66) {
          shape = detail > 0.5 ? 4 : 5
        } else if (elevation < 0.75) {
          shape = detail > 0.55 ? 5 : 6
        } else {
          shape = detail > 0.5 ? 6 : (detail > 0.3 ? 5 : 4)
        }

        if (shape === 0) continue

        const cx = px + CELL / 2
        const cy = py + CELL / 2

        ctx.globalAlpha = 0.5 + elevation * 0.5
        drawShape(ctx, shape, cx, cy, CELL)
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
