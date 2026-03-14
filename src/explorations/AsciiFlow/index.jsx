import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import './AsciiFlow.css'

const CELL = 14
const TILE_SIZE = 12
const RADIUS = 2
const FONT = 'bold 7px monospace'

// Pastel regions — each fills fully, no empty cells
const REGIONS = [
  { bg: '#B8E8A0', color: '#4A7A30', sym: '·' },  // light green (dots)
  { bg: '#F5E6A0', color: '#8A7A30', sym: '2' },  // cream/yellow
  { bg: '#80DEB0', color: '#1A6A40', sym: '·' },  // mint green
  { bg: '#FFB8D8', color: '#8A2050', sym: '1' },  // pink
  { bg: '#A8A8FF', color: '#3030A0', sym: '1' },  // lavender/blue
]

const NOISE_SCALE = 0.006
const FLOW_SPEED = 0.12
const ADVECT_STRENGTH = 60

// --- Noise ---
function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

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

// Curl noise for fluid-like velocity field
function curlNoise(x, y, z) {
  const eps = 0.5
  const dndy = (fbm(x, y + eps, z, 3) - fbm(x, y - eps, z, 3)) / (2 * eps)
  const dndx = (fbm(x + eps, y, z, 3) - fbm(x - eps, y, z, 3)) / (2 * eps)
  // curl of 2D scalar field: (dN/dy, -dN/dx)
  return { vx: dndy, vy: -dndx }
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

export default function AsciiFlow() {
  const canvasRef = useRef(null)
  const frameRef = useRef(0)
  const timeRef = useRef(0)
  const lastTimeRef = useRef(0)

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
      timeRef.current += dt

      const w = window.innerWidth
      const h = window.innerHeight
      const t = timeRef.current
      const cols = Math.ceil(w / CELL)
      const rows = Math.ceil(h / CELL)

      // --- Render ---
      ctx.fillStyle = '#E8E0C8'
      ctx.fillRect(0, 0, w, h)

      ctx.font = FONT
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const offset = (CELL - TILE_SIZE) / 2

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const px = col * CELL
          const py = row * CELL

          // Sample position in noise space
          const nx = px * NOISE_SCALE
          const ny = py * NOISE_SCALE

          // Advect the sample point using curl noise — creates fluid flow
          const curl = curlNoise(nx * 3, ny * 3, t * FLOW_SPEED * 0.5)
          const ax = nx + curl.vx * ADVECT_STRENGTH * NOISE_SCALE
          const ay = ny + curl.vy * ADVECT_STRENGTH * NOISE_SCALE

          // Evaluate each region's noise at the advected position
          let bestIdx = 0
          let bestVal = -1

          for (let i = 0; i < REGIONS.length; i++) {
            // Each region has its own offset so they don't overlap identically
            const regOx = hash2(i * 73.1, i * 37.9) * 500
            const regOy = hash2(i * 91.3, i * 53.1) * 500
            const n = fbm(ax + regOx, ay + regOy, t * FLOW_SPEED, 4)
            if (n > bestVal) {
              bestVal = n
              bestIdx = i
            }
          }

          const region = REGIONS[bestIdx]

          // Determine symbol based on secondary noise
          const detail = valueNoise3(ax * 8 + 999, ay * 8 + 999, t * 0.15)
          const sym = detail > 0.6 ? region.sym : '·'

          // Tile size variation for organic feel at boundaries
          const secondBest = (() => {
            let sb = -1
            for (let i = 0; i < REGIONS.length; i++) {
              if (i === bestIdx) continue
              const regOx = hash2(i * 73.1, i * 37.9) * 500
              const regOy = hash2(i * 91.3, i * 53.1) * 500
              const n = fbm(ax + regOx, ay + regOy, t * FLOW_SPEED, 4)
              if (n > sb) sb = n
            }
            return sb
          })()

          const edge = bestVal - secondBest
          const tileScale = edge < 0.02 ? 0.6 + (edge / 0.02) * 0.4 : 1
          const ts = TILE_SIZE * tileScale
          const tr = RADIUS * tileScale
          const to = (CELL - ts) / 2

          ctx.globalAlpha = 1
          ctx.fillStyle = region.bg
          roundRect(ctx, px + to, py + to, ts, ts, tr)
          ctx.fill()

          if (tileScale > 0.5) {
            ctx.fillStyle = region.color
            ctx.fillText(sym, px + CELL / 2, py + CELL / 2)
          }
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
        <Link to="/" className="ascii-flow-back">&larr; Back</Link>
      </motion.div>
      <canvas ref={canvasRef} className="ascii-flow-canvas" />
    </>
  )
}
