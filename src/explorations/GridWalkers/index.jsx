import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import './GridWalkers.css'

const BG = '#0C2AEA'
const GRID = 60
const TILE_SIZE = 48
const RADIUS = 8
const DOT_COLOR = 'rgba(255,255,255,0.5)'
const DOT_R = 1.5
const FONT = 'bold 20px monospace'

const SPRING_STIFFNESS = 300
const SPRING_DAMPING = 18

const MAX_WALKERS = 5
const WALKER_SPAWN_INTERVAL = 1.5 // seconds between new walkers
const STEP_INTERVAL = 0.12 // seconds between steps
const TRAIL_MAX = 25
const TILE_LIFETIME = 3.5 // seconds before tile fades out completely

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

// A walker is an invisible cursor that wanders the grid leaving a trail
function createWalker(cols, rows) {
  // Start from a random edge
  const side = Math.floor(Math.random() * 4)
  let col, row
  if (side === 0) { col = 1; row = Math.floor(Math.random() * rows) + 1 } // left
  else if (side === 1) { col = cols; row = Math.floor(Math.random() * rows) + 1 } // right
  else if (side === 2) { col = Math.floor(Math.random() * cols) + 1; row = 1 } // top
  else { col = Math.floor(Math.random() * cols) + 1; row = rows } // bottom

  // Pick a general direction bias (mostly horizontal + slightly down, or diagonal, etc)
  const patterns = [
    { dx: 1, dy: 0 },   // right
    { dx: -1, dy: 0 },  // left
    { dx: 1, dy: 1 },   // diagonal down-right
    { dx: -1, dy: 1 },  // diagonal down-left
    { dx: 0, dy: 1 },   // down
    { dx: 1, dy: -1 },  // diagonal up-right
  ]
  const pattern = patterns[Math.floor(Math.random() * patterns.length)]

  return {
    col,
    row,
    dx: pattern.dx,
    dy: pattern.dy,
    stepTimer: 0,
    stepsLeft: TRAIL_MAX + Math.floor(Math.random() * 15),
    dead: false,
  }
}

function getDirection(walker) {
  const r = Math.random()
  let dx, dy

  if (r < 0.6) {
    dx = walker.dx
    dy = walker.dy
  } else if (r < 0.8) {
    dx = walker.dy !== 0 ? (Math.random() < 0.5 ? 1 : -1) : 0
    dy = walker.dx !== 0 ? (Math.random() < 0.5 ? 1 : -1) : 0
  } else {
    dx = walker.dx + (Math.random() < 0.5 ? 1 : -1)
    dy = walker.dy
  }

  dx = Math.max(-1, Math.min(1, dx))
  dy = Math.max(-1, Math.min(1, dy))
  if (dx === 0 && dy === 0) dx = walker.dx || 1

  return { dx, dy }
}

function stepWalker(walker, cols, rows, occupied) {
  // Try up to 3 directions to find an unoccupied cell
  let bestDx, bestDy
  for (let attempt = 0; attempt < 3; attempt++) {
    const { dx, dy } = getDirection(walker)
    const newCol = Math.max(1, Math.min(cols, walker.col + dx))
    const newRow = Math.max(1, Math.min(rows, walker.row + dy))
    bestDx = dx
    bestDy = dy
    if (!occupied.has(`${newCol},${newRow}`)) break
  }

  walker.col += bestDx
  walker.row += bestDy

  // Clamp to grid
  walker.col = Math.max(1, Math.min(cols, walker.col))
  walker.row = Math.max(1, Math.min(rows, walker.row))

  walker.stepsLeft--
  if (walker.stepsLeft <= 0) walker.dead = true
}

export default function GridWalkers() {
  const canvasRef = useRef(null)
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)
  const walkersRef = useRef([])
  const tilesRef = useRef([]) // all tiles on screen with age
  const occupiedRef = useRef(new Set()) // "col,row" strings for cells with active tiles
  const walkerSpawnRef = useRef(0)

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
      const cols = Math.floor(w / GRID)
      const rows = Math.floor(h / GRID)

      // Spawn new walkers periodically
      walkerSpawnRef.current += dt
      if (walkerSpawnRef.current >= WALKER_SPAWN_INTERVAL && walkersRef.current.length < MAX_WALKERS) {
        walkerSpawnRef.current = 0
        walkersRef.current.push(createWalker(cols, rows))
      }

      // Step walkers and spawn tiles
      const walkers = walkersRef.current
      let walkersAlive = 0
      for (let i = 0; i < walkers.length; i++) {
        const walker = walkers[i]
        walker.stepTimer += dt

        const occupied = occupiedRef.current
        while (walker.stepTimer >= STEP_INTERVAL && !walker.dead) {
          walker.stepTimer -= STEP_INTERVAL
          stepWalker(walker, cols, rows, occupied)

          if (!walker.dead) {
            const key = `${walker.col},${walker.row}`
            if (!occupied.has(key)) {
              occupied.add(key)
              const style = pickWeighted(TILE_STYLES)
              tilesRef.current.push({
                col: walker.col,
                row: walker.row,
                ...style,
                symbol: pickSymbol(),
                scale: 0.01,
                scaleV: 0,
                age: 0,
              })
            }
          }
        }

        if (!walker.dead) {
          walkers[walkersAlive] = walker
          walkersAlive++
        }
      }
      walkers.length = walkersAlive

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

      // Update and draw tiles
      const tiles = tilesRef.current
      ctx.font = FONT
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      let tilesAlive = 0
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i]
        t.age += dt
        if (t.age > TILE_LIFETIME) {
          occupiedRef.current.delete(`${t.col},${t.row}`)
          continue
        }

        springStep(t, dt)

        const cx = t.col * GRID
        const cy = t.row * GRID
        const s = t.scale
        const size = TILE_SIZE * s
        const x = cx - size / 2
        const y = cy - size / 2

        // Fade out in the last 1.2 seconds
        const fadeStart = TILE_LIFETIME - 1.2
        const opacity = t.age > fadeStart
          ? Math.max(0, 1 - (t.age - fadeStart) / 1.2)
          : 1

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

        tiles[tilesAlive] = t
        tilesAlive++
      }
      tiles.length = tilesAlive

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
        <Link to="/" className="grid-walkers-back">← Back</Link>
      </motion.div>
      <canvas ref={canvasRef} className="grid-walkers-canvas" />
    </>
  )
}
