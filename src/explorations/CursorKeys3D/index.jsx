import { useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { toCreasedNormals } from 'three-stdlib'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useControls } from 'leva'
import * as THREE from 'three'
import './CursorKeys3D.css'

const COLS = 25
const ROWS = 18
const SPACING = 0.88
const KEY_W = 0.8
const KEY_H = 0.8
const KEY_D = 0.8
const PRESS_RADIUS = 2.5
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

  // Fill entire canvas with keycap color
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)

  // Symbol
  ctx.fillStyle = color
  ctx.font = `bold ${Math.floor(TEX_SIZE * 0.4)}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(symbol, TEX_SIZE / 2, TEX_SIZE / 2 + 1)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function KeyGrid() {
  const count = COLS * ROWS
  const meshRefs = useRef([])
  const cursorPos = useRef(new THREE.Vector3(0, 0, -1000))
  const planeRef = useRef()
  const timeRef = useRef(0)

  const { animation, waveSpeed, waveAmplitude, waveFrequency } = useControls({
    animation: { value: 'cursor', options: ['cursor', 'wave'], label: 'Animation' },
    waveSpeed: { value: 2, min: 0.1, max: 10, step: 0.1, label: 'Wave Speed', render: (get) => get('animation') === 'wave' },
    waveAmplitude: { value: 0.5, min: 0.1, max: 2, step: 0.05, label: 'Wave Amplitude', render: (get) => get('animation') === 'wave' },
    waveFrequency: { value: 1.5, min: 0.1, max: 5, step: 0.1, label: 'Wave Frequency', render: (get) => get('animation') === 'wave' },
  })

  // Spring state: [currentY, velocityY] per key
  const springState = useMemo(() => new Float32Array(count * 2), [count])

  // Generate key data and create shared textures
  const { keyData, geometry, materials } = useMemo(() => {
    // Build unique texture cache
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

        // ExtrudeGeometry groups: 0 = front/back caps, 1 = sides/bevel
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

    return { keyData: keys, geometry: geo, materials: null }
  }, [])

  const handlePointerMove = useCallback((e) => {
    e.stopPropagation()
    cursorPos.current.copy(e.point)
  }, [])

  const handlePointerLeave = useCallback(() => {
    cursorPos.current.set(0, 0, -1000)
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    timeRef.current += dt

    for (let i = 0; i < count; i++) {
      const key = keyData[i]
      const mesh = meshRefs.current[i]
      if (!mesh) continue

      let targetY = 0

      if (animation === 'wave') {
        targetY = waveAmplitude * Math.sin(waveFrequency * (key.x + key.z) + timeRef.current * waveSpeed)
      } else {
        const cx = cursorPos.current.x
        const cz = cursorPos.current.z
        const dx = key.x - cx
        const dz = key.z - cz
        const dist = Math.sqrt(dx * dx + dz * dz)

        if (dist < PRESS_RADIUS) {
          targetY = -PRESS_DEPTH * (1 - dist / PRESS_RADIUS)
        }
      }

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
      {/* Invisible plane for raycasting */}
      <mesh
        ref={planeRef}
        position={[0, 0.2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <planeGeometry args={[COLS * SPACING + 4, ROWS * SPACING + 4]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

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

function Scene() {
  return (
    <>
      <color attach="background" args={['#2a2a30']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[0, 15, 3]} intensity={0.8} />
      <directionalLight position={[-3, 10, -2]} intensity={0.4} />
      <KeyGrid />
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

export default function CursorKeys3D() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Link to="/" className="cursor-keys-3d-back">&larr; Back</Link>
      </motion.div>
      <Canvas
        className="cursor-keys-3d-canvas"
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
        camera={{ position: [0, 18, 3], fov: 35 }}
        shadows
      >
        <Scene />
      </Canvas>
    </>
  )
}
