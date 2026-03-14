import { useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import './CursorKeys.css'

const BG = '#0C2AEA'
const GRID = 60
const TILE_SIZE = 48
const RADIUS = 8
const MAX_TRAIL = 25
const DOT_COLOR = 'rgba(255,255,255,0.5)'
const DOT_R = 1.5
const FONT = 'bold 20px monospace'

// Spring physics constants for tile pop-in
const SPRING_STIFFNESS = 300
const SPRING_DAMPING = 18

const TILE_STYLES = [
  { bg: '#fff', color: '#000', weight: 4 },
  { bg: '#111', color: '#fff', weight: 1 },
  { bg: '#FF6B35', color: '#000', weight: 1 },
  { bg: '#FFD700', color: '#000', weight: 1 },
  { bg: '#FF69B4', color: '#000', weight: 1 },
  { bg: 'rgba(180,190,255,0.4)', color: '#fff', weight: 1 },
]

const SYMBOLS = ['*', '0', '/', '↗', '1', '3', '8']

function pickWeighted(styles) {
  const total = styles.reduce((s, t) => s + t.weight, 0)
  let r = Math.random() * total
  for (const style of styles) {
    r -= style.weight
    if (r <= 0) return { bg: style.bg, color: style.color }
  }
  return { bg: styles[0].bg, color: styles[0].color }
}

function pickSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
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

// Simple spring simulation: returns current value (0→1 range)
function springStep(tile, dt) {
  if (tile.scale >= 0.999 && Math.abs(tile.scaleV) < 0.001) {
    tile.scale = 1
    tile.scaleV = 0
    return
  }
  const displacement = tile.scale - 1
  const springForce = -SPRING_STIFFNESS * displacement
  const dampingForce = -SPRING_DAMPING * tile.scaleV
  tile.scaleV += (springForce + dampingForce) * dt
  tile.scale += tile.scaleV * dt
}

export default function CursorKeys() {
  const canvasRef = useRef(null)
  const trailRef = useRef([])
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)

  const snapToGrid = (x, y) => ({
    col: Math.round(x / GRID),
    row: Math.round(y / GRID),
  })

  const handleMouseMove = useCallback((e) => {
    const { col, row } = snapToGrid(e.clientX, e.clientY)
    const trail = trailRef.current
    const last = trail[trail.length - 1]
    if (last && last.col === col && last.row === row) return

    const style = pickWeighted(TILE_STYLES)
    trail.push({
      col, row, ...style,
      symbol: pickSymbol(),
      scale: 0.01,  // start small
      scaleV: 0,    // velocity
    })
    if (trail.length > MAX_TRAIL) trail.shift()
  }, [])

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

    const draw = (now) => {
      const dt = Math.min((now - (lastTimeRef.current || now)) / 1000, 0.05)
      lastTimeRef.current = now

      const w = window.innerWidth
      const h = window.innerHeight

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

      // Trail tiles
      const trail = trailRef.current
      const len = trail.length
      ctx.font = FONT
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      for (let i = 0; i < len; i++) {
        const t = trail[i]

        // Animate spring scale
        springStep(t, dt)

        const cx = t.col * GRID
        const cy = t.row * GRID
        const s = t.scale
        const size = TILE_SIZE * s
        const x = cx - size / 2
        const y = cy - size / 2
        const opacity = 0.3 + 0.7 * (i / (len - 1 || 1))

        ctx.globalAlpha = opacity * Math.min(s / 0.3, 1)
        ctx.fillStyle = t.bg
        roundRect(ctx, x, y, size, size, RADIUS * s)
        ctx.fill()

        if (s > 0.4) {
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
    }
  }, [])

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Link to="/" className="cursor-keys-back">← Back</Link>
      </motion.div>
      <canvas
        ref={canvasRef}
        className="cursor-keys-canvas"
        onMouseMove={handleMouseMove}
      />
    </>
  )
}
