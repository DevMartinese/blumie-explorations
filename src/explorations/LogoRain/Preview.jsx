import { useEffect, useRef } from 'react'

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

function drawLogoShape(ctx, cx, cy, size, alpha) {
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#E8764B'
  const s = size * 0.35
  roundRect(ctx, cx - s, cy - s * 1.2, s * 2, s * 2.4, s * 0.35)
  ctx.fill()
  // Inner detail
  ctx.fillStyle = '#F5A878'
  ctx.globalAlpha = alpha * 0.6
  roundRect(ctx, cx - s * 0.5, cy - s * 0.6, s * 1, s * 0.8, s * 0.2)
  ctx.fill()
  ctx.globalAlpha = 1
}

export default function LogoRainPreview() {
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

    // Dark background
    ctx.fillStyle = '#0a1628'
    ctx.fillRect(0, 0, w, h)

    // Rain-like grid lines (subtle)
    ctx.strokeStyle = 'rgba(74, 123, 212, 0.08)'
    ctx.lineWidth = 0.5
    for (let x = 0; x < w; x += 12) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }

    // Falling logo silhouettes at staggered positions
    const logos = [
      { x: w * 0.2, y: h * 0.15, size: 18, alpha: 0.4 },
      { x: w * 0.5, y: h * 0.3, size: 22, alpha: 0.7 },
      { x: w * 0.75, y: h * 0.1, size: 16, alpha: 0.35 },
      { x: w * 0.35, y: h * 0.55, size: 20, alpha: 0.6 },
      { x: w * 0.65, y: h * 0.45, size: 24, alpha: 0.8 },
      { x: w * 0.15, y: h * 0.7, size: 14, alpha: 0.3 },
      { x: w * 0.85, y: h * 0.65, size: 18, alpha: 0.5 },
      { x: w * 0.45, y: h * 0.8, size: 20, alpha: 0.65 },
    ]

    logos.forEach(({ x, y, size, alpha }) => {
      drawLogoShape(ctx, x, y, size, alpha)
    })

    // Floor line
    ctx.strokeStyle = 'rgba(232, 118, 75, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, h * 0.92)
    ctx.lineTo(w, h * 0.92)
    ctx.stroke()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
