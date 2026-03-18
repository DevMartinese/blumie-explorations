import { useEffect, useRef } from 'react'

const BG = '#0C2AEA'
const CELL = 7
const TILE_SIZE = 5
const RADIUS = 1
const FONT = 'bold 3px monospace'

const REGIONS = [
  { bg: '#FF8866', color: '#7A2200' },
  { bg: '#4AE8A5', color: '#0A5533' },
  { bg: '#FFE04D', color: '#6B5A00' },
  { bg: '#FF69B4', color: '#7A0040' },
  { bg: '#fff', color: '#000' },
]

const SYMBOLS = ['*', '0', '/', '\u2197', '1', '3', '8']

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

export default function ConwayAsciiPreview() {
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

    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)

    const cols = Math.ceil(w / CELL)
    const rows = Math.ceil(h / CELL)
    const offset = (CELL - TILE_SIZE) / 2

    // Generate a deterministic Conway-like pattern
    const alive = new Set()
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.sin(r * 5.7 + c * 11.3 + 42) * 0.5 + 0.5 > 0.65) {
          alive.add(`${r},${c}`)
        }
      }
    }

    ctx.font = FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!alive.has(`${row},${col}`)) continue

        const x = col * CELL + offset
        const y = row * CELL + offset
        const regionIdx = (row * 3 + col * 7) % REGIONS.length
        const region = REGIONS[regionIdx]
        const symbol = SYMBOLS[(row * 5 + col * 3) % SYMBOLS.length]

        ctx.globalAlpha = 0.7 + Math.sin(row * 2.1 + col * 3.7) * 0.3
        ctx.fillStyle = region.bg
        roundRect(ctx, x, y, TILE_SIZE, TILE_SIZE, RADIUS)
        ctx.fill()

        ctx.fillStyle = region.color
        ctx.fillText(symbol, col * CELL + CELL / 2, row * CELL + CELL / 2)
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
