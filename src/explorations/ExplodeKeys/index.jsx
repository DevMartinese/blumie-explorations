import { useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import './ExplodeKeys.css'

const BG = '#0C2AEA'
const GRID = 60
const TILE_SIZE = 48
const RADIUS = 8
const DOT_COLOR = 'rgba(255,255,255,0.5)'
const DOT_R = 1.5
const FONT = 'bold 20px monospace'
const GRAVITY = 120
const FRICTION = 0.98
const MAX_PARTICLES = 200
const BURST_COUNT = 12
const BURST_SPEED = 500
const LIFETIME = 4 // seconds before full fade

const TILE_STYLES = [
  { bg: '#fff', color: '#000', weight: 4 },
  { bg: '#111', color: '#fff', weight: 1 },
  { bg: '#FF6B35', color: '#000', weight: 1 },
  { bg: '#FFD700', color: '#000', weight: 1 },
  { bg: '#FF69B4', color: '#000', weight: 1 },
  { bg: 'rgba(180,190,255,0.4)', color: '#fff', weight: 1 },
]

const SYMBOLS = ['*', '0', '/', '↗', '1', '3', '8']

function pickWeighted(styles) {
  const total = styles.reduce((s, t) => s + t.weight, 0)
  let r = Math.random() * total
  for (const style of styles) {
    r -= style.weight
    if (r <= 0) return { bg: style.bg, color: style.color }
  }
  return { bg: styles[0].bg, color: styles[0].color }
}

function pickSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
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

function createBurst(cx, cy) {
  const particles = []
  for (let i = 0; i < BURST_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / BURST_COUNT + (Math.random() - 0.5) * 0.4
    const speed = BURST_SPEED * (0.5 + Math.random() * 0.8)
    const style = pickWeighted(TILE_STYLES)
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: (Math.random() - 0.5) * 2,
      rotationV: (Math.random() - 0.5) * 8,
      scale: 0.01,
      scaleTarget: 0.6 + Math.random() * 0.5,
      age: 0,
      ...style,
      symbol: pickSymbol(),
    })
  }
  return particles
}

export default function ExplodeKeys() {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)
  const [hasClicked, setHasClicked] = useState(false)

  const handleClick = useCallback((e) => {
    setHasClicked(true)
    const burst = createBurst(e.clientX, e.clientY)
    const particles = particlesRef.current
    particles.push(...burst)
    // Trim old particles if over limit
    if (particles.length > MAX_PARTICLES) {
      particlesRef.current = particles.slice(particles.length - MAX_PARTICLES)
    }
  }, [])

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

      const w = window.innerWidth
      const h = window.innerHeight

      // Background
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

      // Update & draw particles
      const particles = particlesRef.current
      ctx.font = FONT
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      let alive = 0
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.age += dt

        if (p.age > LIFETIME) continue

        // Physics
        p.vy += GRAVITY * dt
        p.vx *= FRICTION
        p.vy *= FRICTION
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.rotation += p.rotationV * dt
        p.rotationV *= 0.97

        // Scale spring toward target
        const scaleDiff = p.scaleTarget - p.scale
        p.scale += scaleDiff * Math.min(dt * 12, 1)

        // Fade out in the last second
        const fadeStart = LIFETIME - 1.2
        const opacity = p.age > fadeStart
          ? Math.max(0, 1 - (p.age - fadeStart) / 1.2)
          : 1

        const s = p.scale
        const size = TILE_SIZE * s

        ctx.save()
        ctx.globalAlpha = opacity
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)

        ctx.fillStyle = p.bg
        roundRect(ctx, -size / 2, -size / 2, size, size, RADIUS * s)
        ctx.fill()

        if (s > 0.3) {
          ctx.fillStyle = p.color
          ctx.save()
          ctx.scale(s, s)
          ctx.fillText(p.symbol, 0, 1)
          ctx.restore()
        }

        ctx.restore()

        particles[alive] = p
        alive++
      }

      particles.length = alive
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
        <Link to="/" className="explode-keys-back">← Back</Link>
      </motion.div>
      <canvas
        ref={canvasRef}
        className="explode-keys-canvas"
        onClick={handleClick}
      />
      <AnimatePresence>
        {!hasClicked && (
          <motion.div
            className="explode-keys-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            Click anywhere to explode
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
