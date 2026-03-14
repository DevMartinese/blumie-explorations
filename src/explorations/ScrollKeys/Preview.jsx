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

function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Scattered tiles to suggest scroll-based reveal
function generateTiles() {
  const rand = seededRandom(99)
  const tiles = []
  for (let row = 1; row <= 8; row++) {
    const count = Math.floor(rand() * 3) + 1
    for (let j = 0; j < count; j++) {
      const col = Math.floor(rand() * 14) + 1
      const style = TILE_STYLES[Math.floor(rand() * TILE_STYLES.length)]
      tiles.push({
        col,
        row,
        ...style,
        symbol: SYMBOLS[Math.floor(rand() * SYMBOLS.length)],
        // Tiles at the bottom are more faded (suggesting they haven't been "scrolled to" yet)
        opacity: row <= 5 ? 1 : 0.15 + (8 - row) * 0.15,
      })
    }
  }
  return tiles
}

export default function ScrollKeysPreview() {
  const canvasRef = useRef(null)
  const tilesRef = useRef(null)

  if (!tilesRef.current) {
    tilesRef.current = generateTiles()
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

    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = DOT_COLOR
    for (let x = GRID; x < w; x += GRID) {
      for (let y = GRID; y < h; y += GRID) {
        ctx.beginPath()
        ctx.arc(x, y, DOT_R, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const tiles = tilesRef.current
    ctx.font = FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (const t of tiles) {
      const cx = t.col * GRID
      const cy = t.row * GRID
      const x = cx - TILE_SIZE / 2
      const y = cy - TILE_SIZE / 2

      ctx.globalAlpha = t.opacity
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
