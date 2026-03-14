import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import './AsciiTextures.css'

const BG = '#0C2AEA'
const CELL = 18
const TILE_SIZE = 16
const RADIUS = 3
const FONT = 'bold 7px monospace'

const REGIONS = [
  { bg: '#FF8866', color: '#7A2200', ox: 0, oy: 0, speed: 0.02, threshold: 0.48 },
  { bg: '#4AE8A5', color: '#0A5533', ox: 137.7, oy: 259.3, speed: 0.015, threshold: 0.52 },
  { bg: '#FFE04D', color: '#6B5A00', ox: 283.1, oy: 107.9, speed: 0.025, threshold: 0.50 },
  { bg: '#FF69B4', color: '#7A0040', ox: 419.3, oy: 373.7, speed: 0.018, threshold: 0.53 },
  { bg: '#fff', color: '#000', ox: 571.9, oy: 491.1, speed: 0.022, threshold: 0.51 },
]

const NOISE_SCALE = 0.004
const DETAIL_SCALE = 0.02

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

// --- Noise ---
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

export default function AsciiTextures() {
  const canvasRef = useRef(null)
  const frameRef = useRef(0)
  const timeRef = useRef(0)
  const lastTimeRef = useRef(0)
  const gridRef = useRef(null)
  const gridTimeRef = useRef(-1)

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
      gridRef.current = null
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = (now) => {
      const dt = Math.min((now - (lastTimeRef.current || now)) / 1000, 0.05)
      lastTimeRef.current = now
      timeRef.current += dt

      const w = window.innerWidth
      const h = window.innerHeight
      const t = timeRef.current
      const cols = Math.ceil(w / CELL)
      const rows = Math.ceil(h / CELL)

      // Recompute grid every ~40ms for smoother morphing
      if (!gridRef.current || t - gridTimeRef.current > 0.04) {
        gridTimeRef.current = t
        const grid = new Array(rows * cols)

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const px = col * CELL
            const py = row * CELL
            const nx = px * NOISE_SCALE
            const ny = py * NOISE_SCALE

            let bestIdx = -1
            let bestStrength = 0

            for (let i = 0; i < REGIONS.length; i++) {
              const region = REGIONS[i]
              const n = fbm(
                nx + region.ox,
                ny + region.oy,
                t * region.speed,
                3
              )
              const strength = n - region.threshold
              if (strength > 0 && strength > bestStrength) {
                bestIdx = i
                bestStrength = strength
              }
            }

            if (bestIdx < 0) {
              grid[row * cols + col] = null
              continue
            }

            // Detail noise for internal texture variation
            const detail = valueNoise3(
              px * DETAIL_SCALE + 999,
              py * DETAIL_SCALE + 999,
              t * 0.08
            )

            const density = bestStrength * 3.5 * (0.3 + 0.7 * detail)

            if (density < 0.04 && detail < 0.55) {
              grid[row * cols + col] = null
              continue
            }

            const charIdx = Math.min(
              SYMBOLS.length - 1,
              Math.floor(density * SYMBOLS.length)
            )

            grid[row * cols + col] = {
              char: SYMBOLS[charIdx],
              colorIdx: bestIdx,
              alpha: Math.min(1, 0.3 + density * 2.5),
            }
          }
        }

        gridRef.current = { data: grid, cols, rows }
      }

      // --- Render ---
      ctx.fillStyle = BG
      ctx.fillRect(0, 0, w, h)

      // Tiles
      if (gridRef.current) {
        const g = gridRef.current
        ctx.font = FONT
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const offset = (CELL - TILE_SIZE) / 2

        for (let row = 0; row < g.rows; row++) {
          for (let col = 0; col < g.cols; col++) {
            const cell = g.data[row * g.cols + col]
            if (!cell) continue

            const x = col * CELL + offset
            const y = row * CELL + offset
            const region = REGIONS[cell.colorIdx]

            ctx.globalAlpha = cell.alpha
            ctx.fillStyle = region.bg
            roundRect(ctx, x, y, TILE_SIZE, TILE_SIZE, RADIUS)
            ctx.fill()

            ctx.fillStyle = region.color
            ctx.fillText(cell.char, col * CELL + CELL / 2, row * CELL + CELL / 2)
          }
        }

        ctx.globalAlpha = 1
      }

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
        <Link to="/" className="ascii-textures-back">← Back</Link>
      </motion.div>
      <canvas ref={canvasRef} className="ascii-textures-canvas" />
    </>
  )
}
