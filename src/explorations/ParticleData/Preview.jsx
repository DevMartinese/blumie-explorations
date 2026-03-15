import { useEffect, useRef } from 'react'

const COLORS = ['#F5C842', '#E85CAD', '#E8764B', '#4CAF50', '#81C784']

function noise2D(x, z) {
  return (
    Math.sin(x * 1.2 + z * 0.8) * 0.3 +
    Math.sin(x * 2.5 - z * 1.7 + 2.1) * 0.2 +
    Math.cos(x * 0.7 + z * 2.3 - 1.4) * 0.25 +
    Math.sin(x * 3.8 + z * 3.1) * 0.1
  )
}

export default function ParticleDataPreview() {
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

    ctx.fillStyle = '#111111'
    ctx.fillRect(0, 0, w, h)

    // Draw isometric-ish colored blocks
    const cols = 20
    const rows = 16
    const cellW = w / cols
    const cellH = h / rows * 0.6
    const offsetY = h * 0.55

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const nx = c / cols * 4
        const nz = r / rows * 4
        const n = noise2D(nx, nz)
        const height = Math.max(2, Math.pow(Math.abs(n), 1.5) * 60 + 3)

        // Color from noise
        const cn = Math.sin(nx * 0.8 + nz * 1.2 + 3.0) * 0.5 + 0.5
        const ci = Math.floor(cn * COLORS.length) % COLORS.length
        const color = COLORS[ci]

        const x = c * cellW
        const y = offsetY + r * cellH - height

        // Depth fade
        const alpha = 0.4 + (r / rows) * 0.5

        ctx.globalAlpha = alpha
        ctx.fillStyle = color
        ctx.fillRect(x, y, cellW - 1, height)

        // Top face (lighter)
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.fillRect(x, y, cellW - 1, 2)
      }
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
