import { useEffect, useRef } from 'react'

const BG = '#0C2AEA'
const GRID = 20
const DOT_COLOR = 'rgba(255,255,255,0.5)'
const DOT_R = 0.8
const TILE_SIZE = 14
const RADIUS = 3
const FONT = 'bold 6px monospace'

const TILE_STYLES = [
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

// Generate particles in an explosion pattern from a center point
function generateParticles(cx, cy) {
  const rand = seededRandom(77)
  const particles = []
  const count = 14

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (rand() - 0.5) * 0.3
    const dist = 20 + rand() * 50
    const x = cx + Math.cos(angle) * dist
    const y = cy + Math.sin(angle) * dist + dist * 0.15 // slight gravity droop
    const style = TILE_STYLES[Math.floor(rand() * TILE_STYLES.length)]
    const rotation = (rand() - 0.5) * 0.6
    const scale = 0.6 + rand() * 0.4
    // Farther particles are more faded
    const opacity = Math.max(0.3, 1 - dist / 80)

    particles.push({ x, y, rotation, scale, opacity, ...style, symbol: SYMBOLS[Math.floor(rand() * SYMBOLS.length)] })
  }
  return particles
}

export default function ExplodeKeysPreview() {
  const canvasRef = useRef(null)

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

    // Dot grid
    ctx.fillStyle = DOT_COLOR
    for (let x = GRID; x < w; x += GRID) {
      for (let y = GRID; y < h; y += GRID) {
        ctx.beginPath()
        ctx.arc(x, y, DOT_R, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Two explosion bursts
    const bursts = [
      ...generateParticles(w * 0.35, h * 0.4),
      ...generateParticles(w * 0.7, h * 0.55),
    ]

    ctx.font = FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (const p of bursts) {
      const size = TILE_SIZE * p.scale
      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)

      ctx.fillStyle = p.bg
      roundRect(ctx, -size / 2, -size / 2, size, size, RADIUS * p.scale)
      ctx.fill()

      ctx.fillStyle = p.color
      ctx.scale(p.scale, p.scale)
      ctx.fillText(p.symbol, 0, 0.5)
      ctx.restore()
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
