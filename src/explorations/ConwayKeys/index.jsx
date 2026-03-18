import { useRef, useMemo, useCallback, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { toCreasedNormals } from 'three-stdlib'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useControls, button } from 'leva'
import * as THREE from 'three'
import './ConwayKeys.css'

const COLS = 25
const ROWS = 18
const SPACING = 0.88
const KEY_W = 0.8
const KEY_H = 0.8
const KEY_D = 0.8
const PRESS_DEPTH = 0.6
const SPRING_STIFFNESS = 300
const SPRING_DAMPING = 20
const TEX_SIZE = 128

const SYMBOLS = ['*', '0', '/', '\u2197', '1', '3', '8']

const TILE_STYLES = [
  { bg: '#ffffff', color: '#222' },
  { bg: '#333333', color: '#fff' },
  { bg: '#FF6B35', color: '#222' },
  { bg: '#FFD700', color: '#222' },
  { bg: '#FF69B4', color: '#222' },
  { bg: '#B4BEFF', color: '#222' },
]

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

function createKeycapTexture(bg, color, symbol) {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_SIZE
  canvas.height = TEX_SIZE
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)

  ctx.fillStyle = color
  ctx.font = `bold ${Math.floor(TEX_SIZE * 0.4)}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(symbol, TEX_SIZE / 2, TEX_SIZE / 2 + 1)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function randomizeGrid(density) {
  const count = COLS * ROWS
  const grid = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    grid[i] = Math.random() < density ? 1 : 0
  }
  return grid
}

function stepConway(grid, cols, rows) {
  const next = new Uint8Array(cols * rows)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let neighbors = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = (row + dr + rows) % rows
          const nc = (col + dc + cols) % cols
          neighbors += grid[nr * cols + nc]
        }
      }
      const idx = row * cols + col
      if (grid[idx]) {
        next[idx] = (neighbors === 2 || neighbors === 3) ? 1 : 0
      } else {
        next[idx] = neighbors === 3 ? 1 : 0
      }
    }
  }
  return next
}

function KeyGrid({ resetKey }) {
  const count = COLS * ROWS
  const meshRefs = useRef([])
  const gridRef = useRef(randomizeGrid(0.3))
  const lastTickRef = useRef(0)

  const { tickSpeed } = useControls({
    tickSpeed: { value: 300, min: 50, max: 1000, step: 10, label: 'Tick (ms)' },
  })

  // Spring state: [currentY, velocityY] per key
  const springState = useMemo(() => new Float32Array(count * 2), [count])

  // Reset grid when resetKey changes
  useMemo(() => {
    gridRef.current = randomizeGrid(0.3)
  }, [resetKey])

  const { keyData, geometry } = useMemo(() => {
    const texCache = new Map()
    const getTexture = (styleIdx, symIdx) => {
      const key = `${styleIdx}_${symIdx}`
      if (!texCache.has(key)) {
        const style = TILE_STYLES[styleIdx]
        texCache.set(key, createKeycapTexture(style.bg, style.color, SYMBOLS[symIdx]))
      }
      return texCache.get(key)
    }

    const keys = []
    const offsetX = ((COLS - 1) * SPACING) / 2
    const offsetZ = ((ROWS - 1) * SPACING) / 2

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const styleIdx = Math.floor(Math.random() * TILE_STYLES.length)
        const symIdx = Math.floor(Math.random() * SYMBOLS.length)
        const topTex = getTexture(styleIdx, symIdx)

        const sideMat = new THREE.MeshStandardMaterial({
          color: '#777',
          roughness: 0.9,
        })

        const topMat = new THREE.MeshStandardMaterial({
          map: topTex,
          roughness: 0.9,
        })

        const mats = [topMat, sideMat]

        keys.push({
          x: col * SPACING - offsetX,
          z: row * SPACING - offsetZ,
          materials: mats,
        })
      }
    }

    const radius = 0.1
    const shape = new THREE.Shape()
    shape.absarc(radius, radius, radius, Math.PI, Math.PI * 1.5, false)
    shape.absarc(KEY_W - radius, radius, radius, Math.PI * 1.5, Math.PI * 2, false)
    shape.absarc(KEY_W - radius, KEY_H - radius, radius, 0, Math.PI * 0.5, false)
    shape.absarc(radius, KEY_H - radius, radius, Math.PI * 0.5, Math.PI, false)
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: KEY_D - 0.04,
      bevelEnabled: true,
      bevelSegments: 8,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      curveSegments: 4,
    })
    geo.center()
    geo.rotateX(-Math.PI / 2)
    toCreasedNormals(geo, 0.4)

    return { keyData: keys, geometry: geo }
  }, [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const now = state.clock.elapsedTime * 1000

    // Step Conway's Game of Life
    if (now - lastTickRef.current > tickSpeed) {
      lastTickRef.current = now
      gridRef.current = stepConway(gridRef.current, COLS, ROWS)
    }

    const grid = gridRef.current

    for (let i = 0; i < count; i++) {
      const mesh = meshRefs.current[i]
      if (!mesh) continue

      // Alive = raised (0), Dead = pressed down (-PRESS_DEPTH)
      const targetY = grid[i] ? 0 : -PRESS_DEPTH

      const si = i * 2
      const currentY = springState[si]
      const velocity = springState[si + 1]

      const force = SPRING_STIFFNESS * (targetY - currentY)
      const damping = -SPRING_DAMPING * velocity
      const newVelocity = velocity + (force + damping) * dt
      const newY = currentY + newVelocity * dt

      springState[si] = newY
      springState[si + 1] = newVelocity

      mesh.position.y = newY
    }
  })

  return (
    <>
      {keyData.map((key, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el }}
          geometry={geometry}
          position={[key.x, 0, key.z]}
          castShadow
          receiveShadow
        >
          {key.materials.map((mat, mi) => (
            <primitive key={mi} object={mat} attach={`material-${mi}`} />
          ))}
        </mesh>
      ))}
    </>
  )
}

function Scene({ resetKey }) {
  return (
    <>
      <color attach="background" args={['#2a2a30']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[0, 15, 3]} intensity={0.8} />
      <directionalLight position={[-3, 10, -2]} intensity={0.4} />
      <KeyGrid resetKey={resetKey} />
      <EffectComposer>
        <Bloom
          intensity={0.6}
          luminanceThreshold={0.3}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  )
}

export default function ConwayKeys() {
  const [resetKey, setResetKey] = useState(0)

  useControls({
    randomize: button(() => setResetKey((k) => k + 1)),
  })

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Link to="/" className="conway-keys-back">&larr; Back</Link>
      </motion.div>
      <Canvas
        className="conway-keys-canvas"
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
        camera={{ position: [0, 18, 3], fov: 35 }}
        shadows
      >
        <Scene resetKey={resetKey} />
      </Canvas>
    </>
  )
}
