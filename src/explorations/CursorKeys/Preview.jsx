import { useEffect, useRef } from 'react'

const BG = '#0C2AEA'
const GRID = 20
const DOT_COLOR = 'rgba(255,255,255,0.5)'
const DOT_R = 0.8
const TILE_SIZE = 16
const RADIUS = 3
const FONT = 'bold 7px monospace'

const TILE_STYLES = [
  { bg: '#fff', color: '#000' },
  { bg: '#fff', color: '#000' },
  { bg: '#fff', color: '#000' },
  { bg: '#111', color: '#fff' },
  { bg: '#FF6B35', color: '#000' },
  { bg: '#FFD700', color: '#000' },
  { bg: '#FF69B4', color: '#000' },
  { bg: 'rgba(180,190,255,0.4)', color: '#fff' },
]

const SYMBOLS = ['*', '0', '/', '↗', '1', '3', '8']

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

// Generate a fixed trail path that looks like a staircase
function generateTrail() {
  const tiles = []
  // Horizontal segment
  const startCol = 3
  const startRow = 4
  for (let i = 0; i < 6; i++) {
    tiles.push({ col: startCol + i, row: startRow })
  }
  // Diagonal descent
  for (let i = 1; i <= 5; i++) {
    tiles.push({ col: startCol + 5 + i, row: startRow + i })
  }
  // Another horizontal
  for (let i = 1; i <= 3; i++) {
    tiles.push({ col: startCol + 10 + i, row: startRow + 5 })
  }

  return tiles.map((t, i) => ({
    ...t,
    ...TILE_STYLES[Math.floor(Math.random() * TILE_STYLES.length)],
    symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    index: i,
  }))
}

export default function CursorKeysPreview() {
  const canvasRef = useRef(null)
  const trailRef = useRef(null)

  if (!trailRef.current) {
    trailRef.current = generateTrail()
  }

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

    // Background
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)

    // Dot grid
    ctx.fillStyle = DOT_COLOR
    for (let x = GRID; x < w; x += GRID) {
      for (let y = GRID; y < h; y += GRID) {
        ctx.beginPath()
        ctx.arc(x, y, DOT_R, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Tiles
    const trail = trailRef.current
    const len = trail.length
    ctx.font = FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let i = 0; i < len; i++) {
      const t = trail[i]
      const cx = t.col * GRID
      const cy = t.row * GRID
      const x = cx - TILE_SIZE / 2
      const y = cy - TILE_SIZE / 2
      const opacity = 0.3 + 0.7 * (i / (len - 1 || 1))

      ctx.globalAlpha = opacity
      ctx.fillStyle = t.bg
      roundRect(ctx, x, y, TILE_SIZE, TILE_SIZE, RADIUS)
      ctx.fill()

      ctx.fillStyle = t.color
      ctx.fillText(t.symbol, cx, cy + 0.5)
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
