import { useEffect, useRef } from 'react'

const BG = '#d4cfc9'

const CUBE_COLORS = ['#2D8B46', '#FF6B35', '#0C2AEA']
const KEY_STYLES = [
  { bg: '#fff', color: '#000' },
  { bg: '#111', color: '#fff' },
  { bg: '#FFD700', color: '#000' },
  { bg: '#FF69B4', color: '#000' },
]
const SYMBOLS = ['*', '0', '/', '↗', '1', '3']

function drawIsoCube(ctx, cx, cy, size, color, keys) {
  const h = size * 0.5
  const w = size * 0.86

  // Top face
  ctx.fillStyle = color
  ctx.globalAlpha = 0.95
  ctx.beginPath()
  ctx.moveTo(cx, cy - h)
  ctx.lineTo(cx + w / 2, cy - h / 2)
  ctx.lineTo(cx, cy)
  ctx.lineTo(cx - w / 2, cy - h / 2)
  ctx.closePath()
  ctx.fill()

  // Left face
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, cy - h / 2)
  ctx.lineTo(cx, cy)
  ctx.lineTo(cx, cy + h)
  ctx.lineTo(cx - w / 2, cy + h / 2)
  ctx.closePath()
  ctx.fill()

  // Right face
  ctx.globalAlpha = 0.5
  ctx.beginPath()
  ctx.moveTo(cx + w / 2, cy - h / 2)
  ctx.lineTo(cx, cy)
  ctx.lineTo(cx, cy + h)
  ctx.lineTo(cx + w / 2, cy + h / 2)
  ctx.closePath()
  ctx.fill()

  ctx.globalAlpha = 1

  // Draw some keycaps on the top face
  if (keys) {
    const keySize = size * 0.12
    const offsets = [
      [-w * 0.15, -h * 0.6],
      [w * 0.05, -h * 0.45],
      [-w * 0.05, -h * 0.3],
      [w * 0.15, -h * 0.7],
    ]
    ctx.font = `bold ${Math.floor(keySize * 0.7)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    offsets.forEach(([ox, oy], i) => {
      const style = KEY_STYLES[i % KEY_STYLES.length]
      const sym = SYMBOLS[i % SYMBOLS.length]
      const kx = cx + ox - keySize / 2
      const ky = cy + oy - keySize / 2

      ctx.fillStyle = style.bg
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      ctx.roundRect(kx, ky, keySize, keySize, 2)
      ctx.fill()

      ctx.fillStyle = style.color
      ctx.globalAlpha = 1
      ctx.fillText(sym, cx + ox, cy + oy + 1)
    })
  }
}

export default function KeyCubesPreview() {
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

    const size = Math.min(w, h) * 0.35
    const cx = w * 0.5
    const baseY = h * 0.75

    // Draw 3 stacked cubes bottom to top
    const cubeH = size * 0.5
    drawIsoCube(ctx, cx, baseY, size, CUBE_COLORS[0], true)
    drawIsoCube(ctx, cx + 3, baseY - cubeH * 1.9, size * 0.95, CUBE_COLORS[1], false)
    drawIsoCube(ctx, cx - 2, baseY - cubeH * 3.7, size * 0.9, CUBE_COLORS[2], true)

    // Small pedestal
    ctx.fillStyle = '#111'
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    ctx.ellipse(cx, baseY + size * 0.52, size * 0.4, size * 0.08, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
