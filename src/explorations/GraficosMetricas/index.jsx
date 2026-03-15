import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import './GraficosMetricas.css'

const COLORS = {
  bg: '#111111',
  grid: '#1a1a1a',
  yellow: '#F5C842',
  pink: '#E85CAD',
  orange: '#E8764B',
  green1: '#4CAF50',
  green2: '#81C784',
  text: '#444444',
  textBright: '#FFFFFF',
}

const BAR_COLORS = [COLORS.yellow, COLORS.pink, COLORS.orange, COLORS.green1, COLORS.green2]
const SPRING_STIFFNESS = 200
const SPRING_DAMPING = 14
const SAMPLE_INTERVAL = 1 / 30
const BAR_INTERVAL_MIN = 1.5
const BAR_INTERVAL_MAX = 4

export default function GraficosMetricas() {
  const canvasRef = useRef(null)
  const frameRef = useRef(0)
  const startTimeRef = useRef(null)
  const stateRef = useRef({
    lineData: [],
    maxPoints: 600,
    sampleTimer: 0,
    totalSampled: 0,
    // Auto-generated line value
    lineValue: 0.5,
    lineVelocity: 0,
    // Bars
    bars: [],
    barColorIndex: 0,
    barTimer: 2, // seconds until next bar
    // Particles
    particles: [],
    // Metric
    barCount: 0,
    displayCount: 0,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const state = stateRef.current

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

    const sampleToX = (sampleIndex, chartX, chartW) => {
      const dropped = state.totalSampled - state.lineData.length
      const relIndex = sampleIndex - dropped
      return chartX + (relIndex / (state.maxPoints - 1)) * chartW
    }

    const spawnBar = (chartX, chartW, chartY, chartH) => {
      // Bar height: random between 25% and 85% of chart
      const barVal = 0.25 + Math.random() * 0.6
      const barH = barVal * chartH
      const barW = 25 + Math.random() * 30
      const color = BAR_COLORS[state.barColorIndex % BAR_COLORS.length]
      state.barColorIndex++

      // Force the line to match the bar top so it traces the contour
      state.lineValue = barVal
      state.lineVelocity = 0

      state.bars.push({
        sampleIndex: state.totalSampled - 1,
        targetH: barH,
        currentH: 0,
        velocity: 0,
        w: barW,
        color,
        radius: barW / 2,
      })
      state.barCount++

      // Particles
      const headX = sampleToX(state.totalSampled - 1, chartX, chartW)
      const candleY = chartY + chartH - barH

      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 2 + Math.random() * 5
        state.particles.push({
          x: headX,
          y: candleY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3,
          color,
          size: 2 + Math.random() * 4,
          life: 1,
          decay: 0.015 + Math.random() * 0.02,
        })
      }

      // Next bar timer
      state.barTimer = BAR_INTERVAL_MIN + Math.random() * (BAR_INTERVAL_MAX - BAR_INTERVAL_MIN)
    }

    const draw = (now) => {
      if (!startTimeRef.current) startTimeRef.current = now
      const elapsed = (now - startTimeRef.current) / 1000
      const dt = 1 / 60

      const w = window.innerWidth
      const h = window.innerHeight

      // Generate line data automatically
      state.sampleTimer += dt
      while (state.sampleTimer >= SAMPLE_INTERVAL) {
        state.sampleTimer -= SAMPLE_INTERVAL

        // Organic noise-driven movement
        const t = state.totalSampled * 0.02
        const target =
          0.5 +
          0.2 * Math.sin(t * 0.7 + 1.3) +
          0.1 * Math.sin(t * 1.9 + 0.5) +
          0.08 * Math.sin(t * 3.1 + 2.7) +
          0.05 * Math.cos(t * 5.3 + 4.1)

        // Spring-like smoothing toward target
        const accel = (target - state.lineValue) * 8 - state.lineVelocity * 3
        state.lineVelocity += accel * SAMPLE_INTERVAL
        state.lineValue += state.lineVelocity * SAMPLE_INTERVAL
        state.lineValue = Math.max(0.05, Math.min(0.95, state.lineValue))

        state.lineData.push(state.lineValue)
        state.totalSampled++
        if (state.lineData.length > state.maxPoints) {
          state.lineData.shift()
        }
      }

      // Auto-spawn bars
      state.barTimer -= dt
      const chartMargin = 60
      const chartX = chartMargin
      const chartY = 40
      const chartW = w - chartMargin * 2
      const chartH = h - 100

      if (state.barTimer <= 0) {
        spawnBar(chartX, chartW, chartY, chartH)
      }

      // Remove bars that scrolled off
      const dropped = state.totalSampled - state.lineData.length
      state.bars = state.bars.filter(bar => bar.sampleIndex >= dropped)

      // Clear
      ctx.fillStyle = COLORS.bg
      ctx.fillRect(0, 0, w, h)

      // Grid
      ctx.fillStyle = COLORS.grid
      const spacing = 50
      for (let gx = spacing; gx < w; gx += spacing) {
        ctx.fillRect(gx, 0, 0.5, h)
      }
      for (let gy = spacing; gy < h; gy += spacing) {
        ctx.fillRect(0, gy, w, 0.5)
      }

      // Y-axis labels
      ctx.fillStyle = COLORS.text
      ctx.font = '10px monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (let i = 0; i <= 4; i++) {
        const val = i * 25
        const yy = chartY + chartH - (i / 4) * chartH
        ctx.globalAlpha = 0.3
        ctx.fillText(`${val}%`, chartX - 10, yy)
        ctx.strokeStyle = COLORS.grid
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(chartX, yy)
        ctx.lineTo(chartX + chartW, yy)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // === LINE CHART ===
      const data = state.lineData
      if (data.length > 1) {
        const pointCount = data.length

        const getX = (i) => chartX + (i / (state.maxPoints - 1)) * chartW
        const getY = (val) => chartY + chartH - val * chartH

        // Area fill
        const areaGrad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH)
        areaGrad.addColorStop(0, 'rgba(232, 92, 173, 0.3)')
        areaGrad.addColorStop(1, 'rgba(232, 92, 173, 0.01)')

        ctx.beginPath()
        ctx.moveTo(getX(0), chartY + chartH)
        for (let i = 0; i < pointCount; i++) {
          ctx.lineTo(getX(i), getY(data[i]))
        }
        ctx.lineTo(getX(pointCount - 1), chartY + chartH)
        ctx.closePath()
        ctx.fillStyle = areaGrad
        ctx.fill()

        // Line with fade
        for (let i = 1; i < pointCount; i++) {
          const age = (pointCount - i) / pointCount
          const alpha = Math.pow(1 - age, 0.3)
          ctx.beginPath()
          ctx.moveTo(getX(i - 1), getY(data[i - 1]))
          ctx.lineTo(getX(i), getY(data[i]))
          ctx.strokeStyle = COLORS.pink
          ctx.lineWidth = 2 + alpha * 1
          ctx.globalAlpha = 0.3 + alpha * 0.7
          ctx.stroke()
        }
        ctx.globalAlpha = 1

        // Head dot
        const headX = getX(pointCount - 1)
        const headY = getY(data[pointCount - 1])

        ctx.beginPath()
        ctx.arc(headX, headY, 6, 0, Math.PI * 2)
        ctx.fillStyle = COLORS.pink
        ctx.shadowColor = COLORS.pink
        ctx.shadowBlur = 20
        ctx.fill()
        ctx.beginPath()
        ctx.arc(headX, headY, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
        ctx.shadowBlur = 0

        // Value label
        const pct = Math.round(data[pointCount - 1] * 100)
        ctx.fillStyle = COLORS.textBright
        ctx.font = 'bold 13px monospace'
        ctx.textAlign = 'left'
        ctx.globalAlpha = 0.7
        ctx.fillText(`${pct}%`, headX + 14, headY - 4)
        ctx.globalAlpha = 1

        // Horizontal guide
        ctx.strokeStyle = COLORS.pink
        ctx.lineWidth = 0.5
        ctx.globalAlpha = 0.15
        ctx.setLineDash([4, 6])
        ctx.beginPath()
        ctx.moveTo(chartX, headY)
        ctx.lineTo(chartX + chartW, headY)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1
      }

      // === BARS ===
      for (let i = 0; i < state.bars.length; i++) {
        const bar = state.bars[i]

        // Spring physics
        const displacement = bar.currentH - bar.targetH
        const springForce = -SPRING_STIFFNESS * displacement
        const dampingForce = -SPRING_DAMPING * bar.velocity
        bar.velocity += (springForce + dampingForce) * dt
        bar.currentH += bar.velocity * dt
        if (bar.currentH < 0) bar.currentH = 0

        const screenX = sampleToX(bar.sampleIndex, chartX, chartW)

        const bw = bar.w
        const bx = screenX - bw / 2
        const bh = bar.currentH
        const byBottom = chartY + chartH
        const byTop = byBottom - bh
        const r = Math.min(bar.radius, bh / 2)

        if (bh < 1) continue

        // Fade near left edge
        const fadeZone = chartX + 60
        const barAlpha = screenX < fadeZone
          ? Math.max(0, (screenX - chartX) / 60)
          : 1

        ctx.shadowColor = bar.color
        ctx.shadowBlur = 12
        ctx.globalAlpha = barAlpha

        // Rounded top, flat bottom
        ctx.beginPath()
        if (bh > r * 2) {
          ctx.moveTo(bx + r, byTop)
          ctx.lineTo(bx + bw - r, byTop)
          ctx.quadraticCurveTo(bx + bw, byTop, bx + bw, byTop + r)
          ctx.lineTo(bx + bw, byBottom)
          ctx.lineTo(bx, byBottom)
          ctx.lineTo(bx, byTop + r)
          ctx.quadraticCurveTo(bx, byTop, bx + r, byTop)
        } else {
          ctx.rect(bx, byTop, bw, bh)
        }
        ctx.closePath()
        ctx.fillStyle = bar.color
        ctx.fill()

        ctx.shadowBlur = 0
        ctx.globalAlpha = 1

        // Value label
        const valPct = Math.round((bar.targetH / chartH) * 100)
        if (Math.abs(bar.currentH - bar.targetH) < 5 && barAlpha > 0.5) {
          ctx.fillStyle = COLORS.textBright
          ctx.font = 'bold 11px monospace'
          ctx.textAlign = 'center'
          ctx.globalAlpha = 0.6 * barAlpha
          ctx.fillText(`${valPct}`, screenX, byTop - 8)
          ctx.globalAlpha = 1
        }
      }

      // === PARTICLES ===
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.1
        p.life -= p.decay

        if (p.life <= 0) {
          state.particles.splice(i, 1)
          continue
        }

        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 4
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1

      // === METRIC ===
      if (state.displayCount < state.barCount) {
        state.displayCount += (state.barCount - state.displayCount) * 0.1
        if (state.barCount - state.displayCount < 0.5) state.displayCount = state.barCount
      }

      ctx.fillStyle = COLORS.textBright
      ctx.font = 'bold 48px monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = 0.15
      ctx.fillText(`+${Math.round(state.displayCount)}`, w - 30, 25)
      ctx.font = '13px monospace'
      ctx.globalAlpha = 0.1
      ctx.fillText('BARS PLACED', w - 30, 80)
      ctx.globalAlpha = 1

      // === TAGLINE ===
      ctx.fillStyle = COLORS.text
      ctx.font = '11px monospace'
      ctx.textAlign = 'center'
      ctx.globalAlpha = 0.2
      ctx.fillText('W E   T U R N   D A T A   I N T O   D E C I S I O N S', w / 2, h - 20)
      ctx.globalAlpha = 1

      // Title
      ctx.fillStyle = COLORS.textBright
      ctx.font = 'bold 13px monospace'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      ctx.globalAlpha = 0.4
      ctx.fillText('GRÁFICOS Y MÉTRICAS', 20, h - 16)
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
        <Link to="/" className="graficos-metricas-back">← Back</Link>
      </motion.div>
      <canvas ref={canvasRef} className="graficos-metricas-canvas" />
    </>
  )
}
