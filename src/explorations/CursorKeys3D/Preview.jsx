import { useEffect, useRef } from 'react'

const BG = '#0C2AEA'
const TILE_SIZE = 14
const GAP = 2
const RADIUS = 2.5
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

export default function CursorKeys3DPreview() {
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

    // Background
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)

    // Draw grid of keycaps in perspective-like layout
    const cols = Math.floor((w - 20) / (TILE_SIZE + GAP))
    const rows = Math.floor((h - 20) / (TILE_SIZE + GAP))
    const startX = (w - cols * (TILE_SIZE + GAP) + GAP) / 2
    const startY = (h - rows * (TILE_SIZE + GAP) + GAP) / 2

    // "Pressed" area - simulate cursor hover
    const pressCX = w * 0.4
    const pressCY = h * 0.45
    const pressRadius = 40

    ctx.font = FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (TILE_SIZE + GAP)
        const y = startY + r * (TILE_SIZE + GAP)
        const cx = x + TILE_SIZE / 2
        const cy = y + TILE_SIZE / 2

        const dist = Math.sqrt((cx - pressCX) ** 2 + (cy - pressCY) ** 2)
        const pressed = dist < pressRadius

        const style = TILE_STYLES[((r * 7 + c * 3) % TILE_STYLES.length)]
        const symbol = SYMBOLS[((r * 3 + c * 5) % SYMBOLS.length)]

        // Draw shadow for depth effect
        if (pressed) {
          const depth = 1 - dist / pressRadius
          ctx.globalAlpha = 0.3 * depth
          ctx.fillStyle = '#000'
          roundRect(ctx, x + 1, y + 1 + depth * 2, TILE_SIZE, TILE_SIZE, RADIUS)
          ctx.fill()
          ctx.globalAlpha = 0.7 + 0.3 * (1 - depth)
        } else {
          // Slight shadow for unpressed keys
          ctx.globalAlpha = 0.15
          ctx.fillStyle = '#000'
          roundRect(ctx, x + 1, y + 2, TILE_SIZE, TILE_SIZE, RADIUS)
          ctx.fill()
          ctx.globalAlpha = 1
        }

        // Keycap
        ctx.fillStyle = style.bg
        roundRect(ctx, x, y + (pressed ? (1 - dist / pressRadius) * 2 : 0), TILE_SIZE, TILE_SIZE, RADIUS)
        ctx.fill()

        // Symbol
        ctx.fillStyle = style.color
        ctx.fillText(symbol, cx, cy + (pressed ? (1 - dist / pressRadius) * 2 : 0) + 0.5)

        ctx.globalAlpha = 1
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
