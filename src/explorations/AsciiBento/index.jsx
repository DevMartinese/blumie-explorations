import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import './AsciiBento.css'

// ─── Shared noise functions ───

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

function curlNoise(x, y, z) {
  const eps = 0.5
  const dndy = (fbm(x, y + eps, z, 3) - fbm(x, y - eps, z, 3)) / (2 * eps)
  const dndx = (fbm(x + eps, y, z, 3) - fbm(x - eps, y, z, 3)) / (2 * eps)
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

function drawShape(ctx, shape, cx, cy, size) {
  const half = size / 2
  switch (shape) {
    case 1:
      ctx.beginPath()
      ctx.arc(cx, cy, size * 0.15, 0, Math.PI * 2)
      ctx.fill()
      break
    case 2:
      ctx.beginPath()
      ctx.arc(cx, cy, size * 0.28, 0, Math.PI * 2)
      ctx.fill()
      break
    case 3:
      ctx.fillRect(cx - half * 0.55, cy - size * 0.08, size * 0.55, size * 0.16)
      break
    case 4:
      ctx.fillRect(cx - half * 0.35, cy - half * 0.35, size * 0.35, size * 0.35)
      break
    case 5:
      ctx.strokeRect(cx - half * 0.45, cy - half * 0.45, size * 0.45, size * 0.45)
      break
    case 6:
      ctx.fillRect(cx - half * 0.6, cy - half * 0.6, size * 0.6, size * 0.6)
      break
  }
}

// ─── Terrain drawing ───

const TERRAIN_CELL = 10
const TERRAIN_BG = '#F5DDD0'
const TERRAIN_FG = '#E07850'
const TERRAIN_NOISE_SCALE = 0.008
const TERRAIN_SPEED = 0.06

function drawTerrain(ctx, w, h, t) {
  const cols = Math.ceil(w / TERRAIN_CELL)
  const rows = Math.ceil(h / TERRAIN_CELL)

  ctx.fillStyle = TERRAIN_BG
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = TERRAIN_FG
  ctx.strokeStyle = TERRAIN_FG
  ctx.lineWidth = 1

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = col * TERRAIN_CELL
      const py = row * TERRAIN_CELL
      const nx = px * TERRAIN_NOISE_SCALE
      const ny = py * TERRAIN_NOISE_SCALE

      const gradient = (px + py) / (w + h)
      const n = fbm(nx + 50, ny + 50, t * TERRAIN_SPEED, 4)
      const elevation = gradient * 0.55 + n * 0.45
      const detail = valueNoise3(nx * 5 + 333, ny * 5 + 333, t * 0.1)

      let shape = 0
      if (elevation < 0.25) {
        shape = 0
      } else if (elevation < 0.35) {
        shape = detail > 0.5 ? 1 : 0
      } else if (elevation < 0.42) {
        shape = detail > 0.4 ? 1 : 2
      } else if (elevation < 0.50) {
        shape = detail > 0.5 ? 2 : 3
      } else if (elevation < 0.58) {
        shape = detail > 0.6 ? 3 : 4
      } else if (elevation < 0.66) {
        shape = detail > 0.5 ? 4 : 5
      } else if (elevation < 0.75) {
        shape = detail > 0.55 ? 5 : 6
      } else {
        shape = detail > 0.5 ? 6 : (detail > 0.3 ? 5 : 4)
      }

      if (shape === 0) continue

      const cx = px + TERRAIN_CELL / 2
      const cy = py + TERRAIN_CELL / 2

      ctx.globalAlpha = 0.5 + elevation * 0.5
      drawShape(ctx, shape, cx, cy, TERRAIN_CELL)
    }
  }

  ctx.globalAlpha = 1
}

// ─── Flow drawing ───

const FLOW_CELL = 14
const FLOW_TILE_SIZE = 12
const FLOW_RADIUS = 2
const FLOW_FONT = 'bold 7px monospace'
const FLOW_NOISE_SCALE = 0.006
const FLOW_SPEED = 0.12
const FLOW_ADVECT_STRENGTH = 60

const FLOW_REGIONS = [
  { bg: '#B8E8A0', color: '#4A7A30', sym: '·' },
  { bg: '#F5E6A0', color: '#8A7A30', sym: '2' },
  { bg: '#80DEB0', color: '#1A6A40', sym: '·' },
  { bg: '#FFB8D8', color: '#8A2050', sym: '1' },
  { bg: '#A8A8FF', color: '#3030A0', sym: '1' },
]

function drawFlow(ctx, w, h, t) {
  const cols = Math.ceil(w / FLOW_CELL)
  const rows = Math.ceil(h / FLOW_CELL)

  ctx.fillStyle = '#E8E0C8'
  ctx.fillRect(0, 0, w, h)

  ctx.font = FLOW_FONT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = col * FLOW_CELL
      const py = row * FLOW_CELL
      const nx = px * FLOW_NOISE_SCALE
      const ny = py * FLOW_NOISE_SCALE

      const curl = curlNoise(nx * 3, ny * 3, t * FLOW_SPEED * 0.5)
      const ax = nx + curl.vx * FLOW_ADVECT_STRENGTH * FLOW_NOISE_SCALE
      const ay = ny + curl.vy * FLOW_ADVECT_STRENGTH * FLOW_NOISE_SCALE

      let bestIdx = 0
      let bestVal = -1

      for (let i = 0; i < FLOW_REGIONS.length; i++) {
        const regOx = hash2(i * 73.1, i * 37.9) * 500
        const regOy = hash2(i * 91.3, i * 53.1) * 500
        const n = fbm(ax + regOx, ay + regOy, t * FLOW_SPEED, 4)
        if (n > bestVal) {
          bestVal = n
          bestIdx = i
        }
      }

      const region = FLOW_REGIONS[bestIdx]
      const detail = valueNoise3(ax * 8 + 999, ay * 8 + 999, t * 0.15)
      const sym = detail > 0.6 ? region.sym : '·'

      const secondBest = (() => {
        let sb = -1
        for (let i = 0; i < FLOW_REGIONS.length; i++) {
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
      const ts = FLOW_TILE_SIZE * tileScale
      const tr = FLOW_RADIUS * tileScale
      const to = (FLOW_CELL - ts) / 2

      ctx.globalAlpha = 1
      ctx.fillStyle = region.bg
      roundRect(ctx, px + to, py + to, ts, ts, tr)
      ctx.fill()

      if (tileScale > 0.5) {
        ctx.fillStyle = region.color
        ctx.fillText(sym, px + FLOW_CELL / 2, py + FLOW_CELL / 2)
      }
    }
  }

  ctx.globalAlpha = 1
}

// ─── Waves drawing ───

const WAVES_CELL = 14
const WAVES_TILE = 12
const WAVES_RADIUS = 2
const WAVES_DOT_R = 1.5
const WAVES_NOISE_SCALE = 0.007
const WAVES_SPEED = 0.08

const WAVES_BLUE_BG = '#5566CC'
const WAVES_BLUE_LIGHT = '#7080DD'
const WAVES_WHITE_BG = '#E8ECF4'

function drawWaves(ctx, w, h, t) {
  const cols = Math.ceil(w / WAVES_CELL)
  const rows = Math.ceil(h / WAVES_CELL)
  const offset = (WAVES_CELL - WAVES_TILE) / 2

  ctx.fillStyle = '#D8DCE8'
  ctx.fillRect(0, 0, w, h)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = col * WAVES_CELL
      const py = row * WAVES_CELL
      const nx = px * WAVES_NOISE_SCALE
      const ny = py * WAVES_NOISE_SCALE

      const wave = fbm(nx * 0.7 + 10, ny * 1.8 + 10, t * WAVES_SPEED, 4)
      const wave2 = fbm(nx * 0.5 + 200, ny * 1.5 + 200, t * WAVES_SPEED * 0.7, 3)
      const combined = wave * 0.6 + wave2 * 0.4
      const scatter = valueNoise3(nx * 4 + 500, ny * 4 + 500, t * 0.12)

      const isBlue = combined > 0.52
      const isScatter = !isBlue && combined > 0.44 && scatter > 0.72
      const edgeDist = Math.abs(combined - 0.52)
      const isEdgeWhite = edgeDist < 0.015 && scatter > 0.5

      const tx = px + offset
      const ty = py + offset
      const cx = px + WAVES_CELL / 2
      const cy = py + WAVES_CELL / 2

      if (isBlue) {
        ctx.globalAlpha = 1
        ctx.fillStyle = WAVES_BLUE_BG
        roundRect(ctx, tx, ty, WAVES_TILE, WAVES_TILE, WAVES_RADIUS)
        ctx.fill()

        ctx.fillStyle = WAVES_BLUE_LIGHT
        ctx.beginPath()
        ctx.arc(cx, cy, WAVES_DOT_R, 0, Math.PI * 2)
        ctx.fill()
      } else if (isScatter) {
        ctx.globalAlpha = 0.7 + scatter * 0.3
        ctx.fillStyle = WAVES_BLUE_LIGHT
        roundRect(ctx, tx, ty, WAVES_TILE, WAVES_TILE, WAVES_RADIUS)
        ctx.fill()

        ctx.fillStyle = '#9AA0DD'
        ctx.beginPath()
        ctx.arc(cx, cy, WAVES_DOT_R, 0, Math.PI * 2)
        ctx.fill()
      } else if (isEdgeWhite) {
        ctx.globalAlpha = 0.9
        ctx.fillStyle = WAVES_WHITE_BG
        roundRect(ctx, tx, ty, WAVES_TILE, WAVES_TILE, WAVES_RADIUS)
        ctx.fill()
      } else {
        ctx.globalAlpha = 0.35
        ctx.fillStyle = '#9098B0'
        ctx.beginPath()
        ctx.arc(cx, cy, WAVES_DOT_R * 0.8, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  ctx.globalAlpha = 1
}

// ─── Main component ───

export default function AsciiBento() {
  const terrainCanvasRef = useRef(null)
  const flowCanvasRef = useRef(null)
  const wavesCanvasRef = useRef(null)
  const terrainFrameRef = useRef(0)
  const flowFrameRef = useRef(0)
  const wavesFrameRef = useRef(0)
  const timeRef = useRef(0)
  const lastTimeRef = useRef(0)

  useEffect(() => {
    const terrainCanvas = terrainCanvasRef.current
    const flowCanvas = flowCanvasRef.current
    const wavesCanvas = wavesCanvasRef.current
    const terrainCtx = terrainCanvas.getContext('2d')
    const flowCtx = flowCanvas.getContext('2d')
    const wavesCtx = wavesCanvas.getContext('2d')

    const canvases = [
      { canvas: terrainCanvas, ctx: terrainCtx },
      { canvas: flowCanvas, ctx: flowCtx },
      { canvas: wavesCanvas, ctx: wavesCtx },
    ]

    function resizeCanvas({ canvas, ctx }) {
      const parent = canvas.parentElement
      const dpr = window.devicePixelRatio || 1
      const w = parent.clientWidth
      const h = parent.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    canvases.forEach(resizeCanvas)

    const observer = new ResizeObserver(() => {
      canvases.forEach(resizeCanvas)
    })
    canvases.forEach(({ canvas }) => observer.observe(canvas.parentElement))

    function loop(now) {
      const dt = Math.min((now - (lastTimeRef.current || now)) / 1000, 0.05)
      lastTimeRef.current = now
      timeRef.current += dt
      const t = timeRef.current

      const tw = terrainCanvas.parentElement.clientWidth
      const th = terrainCanvas.parentElement.clientHeight
      drawTerrain(terrainCtx, tw, th, t)

      const fw = flowCanvas.parentElement.clientWidth
      const fh = flowCanvas.parentElement.clientHeight
      drawFlow(flowCtx, fw, fh, t)

      const ww = wavesCanvas.parentElement.clientWidth
      const wh = wavesCanvas.parentElement.clientHeight
      drawWaves(wavesCtx, ww, wh, t)

      terrainFrameRef.current = requestAnimationFrame(loop)
    }

    terrainFrameRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(terrainFrameRef.current)
      observer.disconnect()
    }
  }, [])

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Link to="/" className="ascii-bento-back">&larr; Back</Link>
      </motion.div>
      <div className="ascii-bento-container">
        <div className="ascii-bento-cell">
          <canvas ref={terrainCanvasRef} />
        </div>
        <div className="ascii-bento-cell">
          <canvas ref={flowCanvasRef} />
        </div>
        <div className="ascii-bento-cell ascii-bento-cell--waves">
          <canvas ref={wavesCanvasRef} />
        </div>
      </div>
    </>
  )
}
