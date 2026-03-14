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

// Generate multiple wandering trails (like invisible cursors left their paths)
function generateTrails() {
  const rand = seededRandom(55)
  const tiles = []

  // Trail 1: horizontal then diagonal down-right
  let col = 2, row = 2
  for (let i = 0; i < 5; i++) { tiles.push({ col: col + i, row, i }); }
  for (let i = 0; i < 4; i++) { tiles.push({ col: col + 5 + i, row: row + 1 + i, i: 5 + i }); }

  // Trail 2: diagonal down-left, starting from right side
  col = 14; row = 3
  for (let i = 0; i < 3; i++) { tiles.push({ col: col, row: row + i, i, trail: 2 }); }
  for (let i = 0; i < 4; i++) { tiles.push({ col: col - 1 - i, row: row + 3 + i, i: 3 + i, trail: 2 }); }

  // Trail 3: short horizontal near bottom, fading
  col = 4; row = 7
  for (let i = 0; i < 6; i++) { tiles.push({ col: col + i, row, i, trail: 3 }); }

  return tiles.map((t, idx) => {
    const style = TILE_STYLES[Math.floor(rand() * TILE_STYLES.length)]
    const totalInTrail = t.trail === 2 ? 7 : t.trail === 3 ? 6 : 9
    // Newer tiles (higher i) are brighter, older fade — but trail 3 is fading out
    let opacity = 0.3 + 0.7 * (t.i / (totalInTrail - 1))
    if (t.trail === 3) opacity *= 0.5 // this trail is fading away
    return {
      col: t.col,
      row: t.row,
      ...style,
      symbol: SYMBOLS[Math.floor(rand() * SYMBOLS.length)],
      opacity,
    }
  })
}

export default function GridWalkersPreview() {
  const canvasRef = useRef(null)
  const tilesRef = useRef(null)

  if (!tilesRef.current) {
    tilesRef.current = generateTrails()
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
