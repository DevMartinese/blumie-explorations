import { useEffect, useRef } from 'react'

const COLORS = {
  bg: '#111111',
  yellow: '#F5C842',
  pink: '#E85CAD',
  orange: '#E8764B',
  green1: '#4CAF50',
  green2: '#81C784',
  textBright: '#FFFFFF',
}

function roundedBar(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, Math.abs(h) / 2)
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

export default function GraficosMetricasPreview() {
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
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, w, h)

    // Subtle grid dots
    ctx.fillStyle = 'rgba(60, 60, 60, 0.3)'
    const spacing = 18
    for (let gx = spacing; gx < w; gx += spacing) {
      for (let gy = spacing; gy < h; gy += spacing) {
        ctx.fillRect(gx - 0.5, gy - 0.5, 1, 1)
      }
    }

    // Floating bars at different positions and angles
    const bars = [
      { x: w * 0.08, y: h * 0.75, bw: 14, bh: h * 0.45, color: COLORS.yellow },
      { x: w * 0.2, y: h * 0.8, bw: 18, bh: h * 0.55, color: COLORS.pink },
      { x: w * 0.34, y: h * 0.85, bw: 12, bh: h * 0.3, color: COLORS.orange },
      { x: w * 0.7, y: h * 0.7, bw: 10, bh: h * 0.25, color: COLORS.green1, alpha: 0.5 },
      { x: w * 0.8, y: h * 0.75, bw: 10, bh: h * 0.35, color: COLORS.green2, alpha: 0.5 },
    ]

    for (const bar of bars) {
      ctx.globalAlpha = bar.alpha || 0.85
      ctx.fillStyle = bar.color
      ctx.shadowColor = bar.color
      ctx.shadowBlur = 8
      roundedBar(ctx, bar.x, bar.y - bar.bh, bar.bw, bar.bh, bar.bw / 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0

    // Line chart across the middle
    const lineY = h * 0.4
    const points = 25
    ctx.globalAlpha = 0.7
    ctx.beginPath()
    for (let i = 0; i <= points; i++) {
      const t = i / points
      const val = Math.sin(t * Math.PI * 2.5) * h * 0.12 + Math.sin(t * Math.PI * 5 + 1) * h * 0.05
      const px = t * w
      const py = lineY + val
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.strokeStyle = COLORS.pink
    ctx.lineWidth = 1.5
    ctx.shadowColor = COLORS.pink
    ctx.shadowBlur = 6
    ctx.stroke()
    ctx.shadowBlur = 0

    // Area under line
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, lineY - 20, 0, h)
    grad.addColorStop(0, 'rgba(232, 92, 173, 0.15)')
    grad.addColorStop(1, 'rgba(232, 92, 173, 0)')
    ctx.fillStyle = grad
    ctx.fill()

    // Floating metric
    ctx.globalAlpha = 0.35
    ctx.fillStyle = COLORS.textBright
    ctx.font = 'bold 28px monospace'
    ctx.textAlign = 'right'
    ctx.fillText('+90%', w * 0.92, h * 0.3)

    ctx.globalAlpha = 0.2
    ctx.font = 'bold 14px monospace'
    ctx.fillText('~42K', w * 0.5, h * 0.2)

    ctx.globalAlpha = 1
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
