import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useControls } from 'leva'
import * as THREE from 'three'
import './ParticleData.css'

const SPACING = 0.05

const BLUMIE_COLORS = [
  new THREE.Color('#4A7BD4'),  // blue
  new THREE.Color('#E8764B'),  // orange/coral
  new THREE.Color('#C45CAD'),  // pink/magenta
  new THREE.Color('#7B5EA7'),  // purple
  new THREE.Color('#3A8FCC'),  // medium blue
]

const PEAK_COLOR = new THREE.Color('#B8D8F0') // light blue/white for tall peaks

// Simple layered noise using sin/cos — no dependencies needed
function noise3D(x, y, z) {
  return (
    Math.sin(x * 1.27 + y * 0.63 + z * 2.17) * 0.5 +
    Math.sin(x * 2.43 - y * 1.12 + z * 0.84 + 3.1) * 0.3 +
    Math.cos(x * 0.87 + y * 2.35 - z * 1.73 + 1.4) * 0.35 +
    Math.sin(x * 3.71 - y * 0.41 + z * 1.53 + 5.2) * 0.15
  )
}

function ridgeNoise(x, y, z) {
  const n = noise3D(x, y, z)
  return 1 - Math.abs(n)
}

function spikeNoise(x, y, z) {
  const n = noise3D(x * 1.1 + 7.3, y * 0.9 + 3.1, z * 1.3 + 11.7)
  return Math.pow(Math.abs(n), 3)
}

function colorNoise(x, z) {
  return (
    Math.sin(x * 0.8 + z * 1.2 + 3.0) * 0.35 +
    Math.sin(x * 1.7 - z * 0.6 + 7.2) * 0.25 +
    Math.cos(x * 0.5 + z * 0.9 - 2.1) * 0.2
  )
}

function computeHeight(x, z, t) {
  const broad = noise3D(x * 0.3, z * 0.3, t * 0.06) * 1.5
  const ridge = ridgeNoise(x * 0.8, z * 0.8, t * 0.03) * 2.5
  const spike = spikeNoise(x * 1.5, z * 1.5, t * 0.02) * 4
  return Math.max(0.05, broad + ridge + spike)
}

function CameraSync({ cameraX, cameraY, cameraZ, fov, targetX, targetY, targetZ, setLeva, interacting, controlsRef }) {
  const { camera } = useThree()

  // When Leva sliders change and user is NOT dragging the scene, push to camera
  useEffect(() => {
    if (interacting.current) return
    camera.position.set(cameraX, cameraY, cameraZ)
    camera.fov = fov
    camera.updateProjectionMatrix()
    if (controlsRef.current) {
      controlsRef.current.target.set(targetX, targetY, targetZ)
      controlsRef.current.update()
    }
  }, [camera, cameraX, cameraY, cameraZ, fov, targetX, targetY, targetZ, interacting, controlsRef])

  // While user drags/zooms, sync camera → Leva
  useFrame(() => {
    if (!interacting.current) return
    const t = controlsRef.current?.target
    setLeva({
      'Camera X': Math.round(camera.position.x * 100) / 100,
      'Camera Y': Math.round(camera.position.y * 100) / 100,
      'Camera Z': Math.round(camera.position.z * 100) / 100,
      'FOV': Math.round(camera.fov * 100) / 100,
      ...(t && {
        'Target X': Math.round(t.x * 100) / 100,
        'Target Y': Math.round(t.y * 100) / 100,
        'Target Z': Math.round(t.z * 100) / 100,
      }),
    })
  })

  return null
}

function BlockTerrain({ grid }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const count = grid * grid
  const half = (grid * SPACING) / 2

  const heightsArray = useMemo(() => new Float32Array(count), [count])

  const geometry = useMemo(() => new THREE.BoxGeometry(0.04, 1, 0.04), [])
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0.1,
      vertexColors: true,
    })
  }, [])

  // Initialize instance matrices
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < count; i++) {
      const col = i % grid
      const row = Math.floor(i / grid)
      const x = col * SPACING - half
      const z = row * SPACING - half
      dummy.position.set(x, 0, z)
      dummy.scale.set(1, 0.05, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [dummy, count, grid, half])

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (!mesh) return

    const t = clock.getElapsedTime()

    for (let i = 0; i < count; i++) {
      const col = i % grid
      const row = Math.floor(i / grid)
      const x = col * SPACING - half
      const z = row * SPACING - half

      const h = computeHeight(col * 0.15, row * 0.15, t)

      // Update matrix
      dummy.position.set(x, h * 0.5, z)
      dummy.scale.set(1, h, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      // Height for emission
      heightsArray[i] = h

      // Color based on zone noise
      const cn = colorNoise(col * 0.15, row * 0.15)
      const normalizedCn = cn * 0.5 + 0.5 // 0-1
      const ci = Math.floor(normalizedCn * BLUMIE_COLORS.length) % BLUMIE_COLORS.length
      const baseColor = BLUMIE_COLORS[ci]

      // Only the tallest peaks blend toward light blue/white
      const peakBlend = Math.min(0.6, Math.max(0, (h - 5) / 4))
      const r = baseColor.r + (PEAK_COLOR.r - baseColor.r) * peakBlend
      const g = baseColor.g + (PEAK_COLOR.g - baseColor.g) * peakBlend
      const b = baseColor.b + (PEAK_COLOR.b - baseColor.b) * peakBlend

      mesh.setColorAt(i, new THREE.Color(r, g, b))
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      castShadow
      receiveShadow
    />
  )
}

function Scene({ grid, cameraX, cameraY, cameraZ, fov, targetX, targetY, targetZ, setLeva }) {
  const interacting = useRef(false)
  const controlsRef = useRef()

  return (
    <>
      <color attach="background" args={['#0a1628']} />
      <fog attach="fog" args={['#0a1628', 4, 16]} />

      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, 5]} intensity={1.5} castShadow />
      <hemisphereLight
        args={['#B8D8F0', '#E8764B', 0.2]}
      />
      <CameraSync cameraX={cameraX} cameraY={cameraY} cameraZ={cameraZ} fov={fov} targetX={targetX} targetY={targetY} targetZ={targetZ} setLeva={setLeva} interacting={interacting} controlsRef={controlsRef} />
      <BlockTerrain grid={grid} />
      {/* <OrbitControls
        ref={controlsRef}
        target={[targetX, targetY, targetZ]}
        enableZoom={true}
        enablePan={true}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 4}
        onStart={() => { interacting.current = true }}
        onEnd={() => { interacting.current = false }}
      /> */}
    </>
  )
}

export default function ParticleData() {
  const [useWebGPU, setUseWebGPU] = useState(true)
  const [fallback, setFallback] = useState(false)

  const [{ 'Grid Size': grid, 'Camera X': cameraX, 'Camera Y': cameraY, 'Camera Z': cameraZ, FOV: fov, 'Target X': targetX, 'Target Y': targetY, 'Target Z': targetZ }, setLeva] = useControls(() => ({
    'Grid Size': { value: 300, min: 50, max: 400, step: 10 },
    'Camera X': { value: 4.3, min: -20, max: 20 },
    'Camera Y': { value: 12.5, min: 1, max: 20 },
    'Camera Z': { value: 3.7, min: -20, max: 20 },
    'FOV': { value: 75, min: 20, max: 120 },
    'Target X': { value: -1.5, min: -20, max: 20 },
    'Target Y': { value: 5.1, min: -20, max: 20 },
    'Target Z': { value: -1.0, min: -20, max: 20 },
  }))

  const glProp = useMemo(() => {
    if (!useWebGPU) return undefined
    return async (props) => {
      try {
        const { WebGPURenderer } = await import('three/webgpu')
        const renderer = new WebGPURenderer(props)
        await renderer.init()
        return renderer
      } catch (e) {
        console.warn('WebGPU not available, falling back to WebGL:', e)
        setUseWebGPU(false)
        setFallback(true)
        return undefined
      }
    }
  }, [useWebGPU])

  const sceneProps = { grid, cameraX, cameraY, cameraZ, fov, targetX, targetY, targetZ, setLeva }

  // If WebGPU init failed, re-render with default WebGL
  if (fallback) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Link to="/" className="particle-data-back">← Back</Link>
        </motion.div>
        <Canvas
          className="particle-data-canvas"
          camera={{ position: [cameraX, cameraY, cameraZ], fov }}
          style={{ background: '#0a1628', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
        >
          <Scene {...sceneProps} />
        </Canvas>
      </>
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Link to="/" className="particle-data-back">← Back</Link>
      </motion.div>
      <Canvas
        className="particle-data-canvas"
        gl={glProp}
        camera={{ position: [cameraX, cameraY, cameraZ], fov }}
        style={{ background: '#0a1628', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
      >
        <Scene {...sceneProps} />
      </Canvas>
    </>
  )
}
