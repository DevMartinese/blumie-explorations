import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import './ConwayAscii.css'

const BG = '#0C2AEA'
const CELL = 18
const TILE_SIZE = 16
const RADIUS = 3
const FONT = 'bold 7px monospace'
const TICK_MS = 200
const SEED_WARMUP = 30
const SEED_INTERVAL = 4
const SEED_INTENSITY = 0.03

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

function seedFrontier(s, intensity) {
  const { grid, cols, rows, colorIdx, symbolIdx } = s
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col
      if (grid[idx]) continue
      // Check if any neighbor is alive
      let hasAliveNeighbor = false
      for (let dr = -1; dr <= 1 && !hasAliveNeighbor; dr++) {
        for (let dc = -1; dc <= 1 && !hasAliveNeighbor; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = (row + dr + rows) % rows
          const nc = (col + dc + cols) % cols
          if (grid[nr * cols + nc]) hasAliveNeighbor = true
        }
      }
      if (hasAliveNeighbor && Math.random() < intensity) {
        grid[idx] = 1
        colorIdx[idx] = Math.floor(Math.random() * REGIONS.length)
        symbolIdx[idx] = Math.floor(Math.random() * SYMBOLS.length)
      }
    }
  }
}

function stepConway(grid, cols, rows) {
  const next = new Uint8Array(cols * rows)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let neighbors = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = (row + dr + rows) % rows
          const nc = (col + dc + cols) % cols
          neighbors += grid[nr * cols + nc]
        }
      }
      const idx = row * cols + col
      if (grid[idx]) {
        next[idx] = (neighbors === 2 || neighbors === 3) ? 1 : 0
      } else {
        next[idx] = neighbors === 3 ? 1 : 0
      }
    }
  }
  return next
}

export default function ConwayAscii() {
  const canvasRef = useRef(null)
  const frameRef = useRef(0)
  const stateRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    let cols, rows

    const init = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      cols = Math.ceil(window.innerWidth / CELL)
      rows = Math.ceil(window.innerHeight / CELL)
      const count = cols * rows

      const grid = new Uint8Array(count)
      const alpha = new Float32Array(count)
      const colorIdx = new Uint8Array(count)
      const symbolIdx = new Uint8Array(count)

      // Start all dead
      for (let i = 0; i < count; i++) {
        colorIdx[i] = Math.floor(Math.random() * REGIONS.length)
        symbolIdx[i] = Math.floor(Math.random() * SYMBOLS.length)
      }

      // Place R-pentomino in center
      //  .##
      //  ##.
      //  .#.
      const cx = Math.floor(cols / 2)
      const cy = Math.floor(rows / 2)
      const rPentomino = [
        [0, 1], [0, 2],
        [1, 0], [1, 1],
        [2, 1],
      ]
      for (const [dr, dc] of rPentomino) {
        const idx = (cy + dr) * cols + (cx + dc)
        grid[idx] = 1
        alpha[idx] = 1
      }

      stateRef.current = { grid, alpha, colorIdx, symbolIdx, cols, rows, lastTick: 0, generation: 0 }
    }

    init()
    window.addEventListener('resize', init)

    const draw = (now) => {
      const s = stateRef.current
      if (!s) { frameRef.current = requestAnimationFrame(draw); return }

      // Step simulation
      if (now - s.lastTick > TICK_MS) {
        s.lastTick = now
        s.generation++
        const prevGrid = s.grid
        s.grid = stepConway(s.grid, s.cols, s.rows)

        // Frontier seeding after warmup
        if (s.generation > SEED_WARMUP && s.generation % SEED_INTERVAL === 0) {
          seedFrontier(s, SEED_INTENSITY)
        }

        // Assign colors to newly born cells
        for (let i = 0; i < s.grid.length; i++) {
          if (s.grid[i] && !prevGrid[i]) {
            // Pick color from majority of alive neighbors, or random
            const row = Math.floor(i / s.cols)
            const col = i % s.cols
            const counts = new Uint8Array(REGIONS.length)
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue
                const nr = (row + dr + s.rows) % s.rows
                const nc = (col + dc + s.cols) % s.cols
                const ni = nr * s.cols + nc
                if (prevGrid[ni]) counts[s.colorIdx[ni]]++
              }
            }
            let bestCount = 0, bestColor = Math.floor(Math.random() * REGIONS.length)
            for (let c = 0; c < counts.length; c++) {
              if (counts[c] > bestCount) { bestCount = counts[c]; bestColor = c }
            }
            s.colorIdx[i] = bestColor
            s.symbolIdx[i] = Math.floor(Math.random() * SYMBOLS.length)
          }
        }
      }

      // Lerp alpha
      for (let i = 0; i < s.grid.length; i++) {
        const target = s.grid[i] ? 1 : 0
        s.alpha[i] += (target - s.alpha[i]) * 0.12
      }

      // Render
      const w = window.innerWidth
      const h = window.innerHeight

      ctx.fillStyle = BG
      ctx.fillRect(0, 0, w, h)

      ctx.font = FONT
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const offset = (CELL - TILE_SIZE) / 2

      for (let row = 0; row < s.rows; row++) {
        for (let col = 0; col < s.cols; col++) {
          const idx = row * s.cols + col
          const a = s.alpha[idx]
          if (a < 0.01) continue

          const x = col * CELL + offset
          const y = row * CELL + offset
          const region = REGIONS[s.colorIdx[idx]]

          ctx.globalAlpha = a
          ctx.fillStyle = region.bg
          roundRect(ctx, x, y, TILE_SIZE, TILE_SIZE, RADIUS)
          ctx.fill()

          ctx.fillStyle = region.color
          ctx.fillText(SYMBOLS[s.symbolIdx[idx]], col * CELL + CELL / 2, row * CELL + CELL / 2)
        }
      }

      ctx.globalAlpha = 1
      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('resize', init)
    }
  }, [])

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Link to="/" className="conway-ascii-back">&larr; Back</Link>
      </motion.div>
      <canvas ref={canvasRef} className="conway-ascii-canvas" />
    </>
  )
}
