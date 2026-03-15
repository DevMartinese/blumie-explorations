import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as THREE from 'three'
import './KeyCubes.css'

const SYMBOLS = ['*', '0', '/', '↗', '1', '3', '8']

const TILE_STYLES = [
  { bg: '#fff', color: '#000' },
  { bg: '#111', color: '#fff' },
  { bg: '#FF6B35', color: '#000' },
  { bg: '#FFD700', color: '#000' },
  { bg: '#FF69B4', color: '#000' },
  { bg: 'rgba(180,190,255,0.8)', color: '#fff' },
]

// Seeded random for deterministic textures
function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
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

function createFaceTexture(baseColor, keys, size = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // Fill base color
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, size, size)

  if (!keys) {
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  const { grid, seed } = keys
  const rng = seededRandom(seed)
  const cols = grid
  const rows = grid
  const padding = size * 0.08
  const gap = size * 0.02
  const cellW = (size - padding * 2 - gap * (cols - 1)) / cols
  const cellH = (size - padding * 2 - gap * (rows - 1)) / rows
  const radius = cellW * 0.15

  ctx.font = `bold ${Math.floor(cellW * 0.5)}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.3) continue // skip some cells for variety

      const style = TILE_STYLES[Math.floor(rng() * TILE_STYLES.length)]
      const symbol = SYMBOLS[Math.floor(rng() * SYMBOLS.length)]
      const x = padding + c * (cellW + gap)
      const y = padding + r * (cellH + gap)

      ctx.fillStyle = style.bg
      roundRect(ctx, x, y, cellW, cellH, radius)
      ctx.fill()

      ctx.fillStyle = style.color
      ctx.fillText(symbol, x + cellW / 2, y + cellH / 2 + 1)
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function KeyCube({ position, baseColor, faces }) {
  const materials = useMemo(() => {
    // 6 faces: +x, -x, +y, -y, +z, -z
    return faces.map((faceKeys) => {
      const texture = createFaceTexture(baseColor, faceKeys)
      return new THREE.MeshPhysicalMaterial({
        map: texture,
        roughness: 0.25,
        clearcoat: 0.4,
        clearcoatRoughness: 0.1,
      })
    })
  }, [baseColor, faces])

  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      {materials.map((mat, i) => (
        <primitive key={i} object={mat} attach={`material-${i}`} />
      ))}
    </mesh>
  )
}

function Pedestal() {
  return (
    <mesh position={[0, -0.55, 0]} receiveShadow>
      <cylinderGeometry args={[0.6, 0.7, 0.1, 32]} />
      <meshPhysicalMaterial color="#111" roughness={0.3} clearcoat={0.5} />
    </mesh>
  )
}

function Scene() {
  // Define face configs: null = solid, { grid, seed } = keycap grid
  const cubes = useMemo(() => [
    {
      position: [0, 0, 0],
      baseColor: '#2D8B46',
      faces: [
        { grid: 4, seed: 101 }, // +x
        null,                    // -x
        { grid: 3, seed: 102 }, // +y
        null,                    // -y
        { grid: 4, seed: 103 }, // +z
        null,                    // -z
      ],
    },
    {
      position: [0.15, 1.05, -0.1],
      baseColor: '#FF6B35',
      faces: [
        null,
        { grid: 3, seed: 201 },
        null,
        null,
        null,
        { grid: 4, seed: 202 },
      ],
    },
    {
      position: [-0.1, 2.1, 0.05],
      baseColor: '#0C2AEA',
      faces: [
        null,
        null,
        { grid: 3, seed: 301 },
        null,
        { grid: 2, seed: 302 },
        null,
      ],
    },
  ], [])

  return (
    <>
      <color attach="background" args={['#d4cfc9']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 4]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 4, -2]} intensity={0.4} />
      <Environment preset="city" />

      <group position={[0, -1, 0]}>
        {cubes.map((cube, i) => (
          <KeyCube key={i} {...cube} />
        ))}
        <Pedestal />
      </group>

      <OrbitControls
        autoRotate
        autoRotateSpeed={0.5}
        enablePan={false}
        minDistance={3}
        maxDistance={10}
      />
    </>
  )
}

export default function KeyCubes() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Link to="/" className="key-cubes-back">← Back</Link>
      </motion.div>
      <Canvas
        className="key-cubes-canvas"
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
        camera={{ position: [3, 3, 4], fov: 40 }}
        shadows
      >
        <Scene />
      </Canvas>
    </>
  )
}
