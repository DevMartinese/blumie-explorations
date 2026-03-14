import { useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import './ScrollKeys.css'

const BG = '#0C2AEA'
const GRID = 60
const TILE_SIZE = 48
const RADIUS = 8
const DOT_COLOR = 'rgba(255,255,255,0.5)'
const DOT_R = 1.5
const FONT = 'bold 20px monospace'
const PAGE_HEIGHT = 6000 // total scrollable height

const TILE_STYLES = [
  { bg: '#fff', color: '#000', weight: 4 },
  { bg: '#111', color: '#fff', weight: 1 },
  { bg: '#FF6B35', color: '#000', weight: 1 },
  { bg: '#FFD700', color: '#000', weight: 1 },
  { bg: '#FF69B4', color: '#000', weight: 1 },
  { bg: 'rgba(180,190,255,0.4)', color: '#fff', weight: 1 },
]

const SYMBOLS = ['*', '0', '/', '↗', '1', '3', '8']

function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function pickWeightedSeeded(styles, rand) {
  const total = styles.reduce((s, t) => s + t.weight, 0)
  let r = rand() * total
  for (const style of styles) {
    r -= style.weight
    if (r <= 0) return { bg: style.bg, color: style.color }
  }
  return { bg: styles[0].bg, color: styles[0].color }
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

// Pre-generate all tiles distributed across the full scroll height
function generateTiles() {
  const rand = seededRandom(42)
  const tiles = []
  const cols = Math.floor(1920 / GRID)
  const totalRows = Math.floor(PAGE_HEIGHT / GRID)

  for (let row = 1; row < totalRows; row++) {
    // Each row has a random number of tiles (1-4)
    const count = Math.floor(rand() * 3) + 1
    const usedCols = new Set()

    for (let j = 0; j < count; j++) {
      let col
      do {
        col = Math.floor(rand() * (cols - 2)) + 1
      } while (usedCols.has(col))
      usedCols.add(col)

      const style = pickWeightedSeeded(TILE_STYLES, rand)
      tiles.push({
        col,
        row,
        ...style,
        symbol: SYMBOLS[Math.floor(rand() * SYMBOLS.length)],
        yWorld: row * GRID, // world-space y position
      })
    }
  }

  return tiles
}

export default function ScrollKeys() {
  const canvasRef = useRef(null)
  const frameRef = useRef(0)
  const scrollRef = useRef(0)
  const tiles = useMemo(generateTiles, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const onScroll = () => {
      scrollRef.current = window.scrollY
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    const draw = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const scrollY = scrollRef.current

      // Background
      ctx.fillStyle = BG
      ctx.fillRect(0, 0, w, h)

      // Dot grid (offset by scroll)
      ctx.fillStyle = DOT_COLOR
      const offsetY = -(scrollY % GRID)
      for (let x = GRID; x < w; x += GRID) {
        for (let y = offsetY; y < h + GRID; y += GRID) {
          ctx.beginPath()
          ctx.arc(x, y, DOT_R, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Only draw tiles in the visible range
      const viewTop = scrollY - GRID
      const viewBottom = scrollY + h + GRID
      ctx.font = FONT
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i]
        if (t.yWorld < viewTop || t.yWorld > viewBottom) continue

        // Tile appears when it enters the viewport from below
        const screenY = t.yWorld - scrollY
        // Fade/scale based on how far into viewport
        const progress = Math.min(1, Math.max(0, (h - screenY) / (h * 0.3)))

        if (progress <= 0) continue

        const cx = t.col * GRID
        const cy = screenY
        const s = 0.5 + 0.5 * progress
        const size = TILE_SIZE * s
        const x = cx - size / 2
        const y = cy - size / 2

        ctx.globalAlpha = progress
        ctx.fillStyle = t.bg
        roundRect(ctx, x, y, size, size, RADIUS * s)
        ctx.fill()

        if (progress > 0.3) {
          ctx.fillStyle = t.color
          ctx.save()
          ctx.translate(cx, cy + 1)
          ctx.scale(s, s)
          ctx.fillText(t.symbol, 0, 0)
          ctx.restore()
        }
      }

      ctx.globalAlpha = 1
      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', onScroll)
    }
  }, [tiles])

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Link to="/" className="scroll-keys-back">← Back</Link>
      </motion.div>
      <canvas ref={canvasRef} className="scroll-keys-canvas" />
      <div className="scroll-keys-scroller" style={{ height: PAGE_HEIGHT }} />
    </>
  )
}
