import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { OrbitControls, Environment } from '@react-three/drei'
import { toCreasedNormals } from 'three-stdlib'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useControls } from 'leva'
import * as THREE from 'three'
import './WaveGeometry.css'

const GRID = 30
const BASE_SIZE = 0.35
const MAX_HEIGHT = 3.5

const tmpObj = new THREE.Object3D()
const tmpColor = new THREE.Color()

function createRoundedBoxGeo(size, radius, smoothness) {
  const eps = 0.00001
  const r = radius - eps
  const shape = new THREE.Shape()
  shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true)
  shape.absarc(eps, size - r * 2, eps, Math.PI, Math.PI / 2, true)
  shape.absarc(size - r * 2, size - r * 2, eps, Math.PI / 2, 0, true)
  shape.absarc(size - r * 2, eps, eps, 0, -Math.PI / 2, true)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: size - radius * 2,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: radius - eps,
    bevelThickness: radius,
    curveSegments: smoothness,
  })
  geo.center()
  toCreasedNormals(geo, 0.4)
  return geo
}

function WaveGrid() {
  const meshRef = useRef()
  const flattenStartRef = useRef(null)
  const count = GRID * GRID

  const { speed, amplitude, frequency, colorShift, shape, gap } = useControls({
    shape: { value: 'box', options: ['box', 'roundedBox'], label: 'Shape' },
    gap: { value: 0.08, min: 0, max: 0.3, step: 0.01, label: 'Gap' },
    speed: { value: 1.2, min: 0.1, max: 5, step: 0.1, label: 'Speed' },
    amplitude: { value: 1.0, min: 0.1, max: 2, step: 0.05, label: 'Amplitude' },
    frequency: { value: 0.8, min: 0.2, max: 3, step: 0.1, label: 'Frequency' },
    colorShift: { value: 0.27, min: 0, max: 1, step: 0.01, label: 'Color Shift' },
  })

  const { flatten, flattenSpeed, flattenHeight, flattenDirection } = useControls('Flatten', {
    flatten: { value: false, label: 'Enable' },
    flattenDirection: { value: 'radial', options: ['radial', 'left', 'right', 'front', 'back'], label: 'Direction' },
    flattenSpeed: { value: 0.5, min: 0.1, max: 2, step: 0.05, label: 'Speed' },
    flattenHeight: { value: 0.5, min: 0.2, max: 2, step: 0.1, label: 'Height' },
  })

  // Track when flatten is toggled on/off
  useEffect(() => {
    if (flatten) {
      flattenStartRef.current = null // will be set on first frame
    } else {
      flattenStartRef.current = null
    }
  }, [flatten])

  const spacing = BASE_SIZE + gap

  const geometry = useMemo(() => {
    if (shape === 'roundedBox') {
      return createRoundedBoxGeo(BASE_SIZE, 0.06, 4)
    }
    return new THREE.BoxGeometry(BASE_SIZE, BASE_SIZE, BASE_SIZE)
  }, [shape])

  const colorArray = useMemo(() => {
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      tmpColor.set('#3366ff')
      colors[i * 3] = tmpColor.r
      colors[i * 3 + 1] = tmpColor.g
      colors[i * 3 + 2] = tmpColor.b
    }
    return colors
  }, [count])

  useFrame(({ clock }) => {
    const mesh = meshRef.current
    if (!mesh) return

    const t = clock.getElapsedTime() * speed
    const offsetX = ((GRID - 1) * spacing) / 2
    const offsetZ = ((GRID - 1) * spacing) / 2
    const maxExtent = flattenDirection === 'radial'
      ? Math.sqrt(offsetX * offsetX + offsetZ * offsetZ)
      : (flattenDirection === 'left' || flattenDirection === 'right') ? offsetX * 2 : offsetZ * 2

    // Flatten progress
    let flattenProgress = 0
    if (flatten) {
      if (flattenStartRef.current === null) flattenStartRef.current = clock.getElapsedTime()
      const elapsed = clock.getElapsedTime() - flattenStartRef.current
      flattenProgress = elapsed * flattenSpeed * maxExtent * 0.5
    }

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const i = row * GRID + col
        const x = col * spacing - offsetX
        const z = row * spacing - offsetZ

        const wave1 = Math.sin(frequency * (x * 0.8 + z * 0.6) + t)
        const wave2 = Math.sin(frequency * 0.7 * (x * 0.5 - z * 0.9) + t * 0.8 + 1.5)
        const wave3 = Math.cos(frequency * 0.5 * (x + z) + t * 0.6)

        let height = (amplitude * (wave1 + wave2 * 0.6 + wave3 * 0.4) / 2 + 0.5) * MAX_HEIGHT + 0.2

        // Apply flatten based on direction
        if (flatten && flattenProgress > 0) {
          let dist
          if (flattenDirection === 'radial') dist = Math.sqrt(x * x + z * z)
          else if (flattenDirection === 'left') dist = x + offsetX          // from -X edge
          else if (flattenDirection === 'right') dist = offsetX - x         // from +X edge
          else if (flattenDirection === 'front') dist = z + offsetZ         // from -Z edge
          else dist = offsetZ - z                                           // from +Z edge (back)

          const edge = 1.5
          const blend = Math.min(1, Math.max(0, (flattenProgress - dist) / edge))
          const s = blend * blend * (3 - 2 * blend)
          height = height * (1 - s) + flattenHeight * s
        }

        const clampedH = Math.max(0.2, height)

        tmpObj.position.set(x, clampedH / 2, z)
        tmpObj.scale.set(1, clampedH / BASE_SIZE, 1)
        tmpObj.updateMatrix()
        mesh.setMatrixAt(i, tmpObj.matrix)

        const norm = (clampedH - 0.2) / MAX_HEIGHT
        const hue = 0.58 + colorShift * 0.15 + norm * 0.08
        const saturation = 0.7 + norm * 0.2
        const lightness = 0.25 + norm * 0.45
        tmpColor.setHSL(hue, saturation, lightness)

        colorArray[i * 3] = tmpColor.r
        colorArray[i * 3 + 1] = tmpColor.g
        colorArray[i * 3 + 2] = tmpColor.b
      }
    }

    mesh.instanceMatrix.needsUpdate = true
    mesh.geometry.attributes.color.needsUpdate = true
  })

  return (
    <instancedMesh key={shape} ref={meshRef} args={[geometry, null, count]} castShadow receiveShadow>
      <instancedBufferAttribute attach="geometry-attributes-color" args={[colorArray, 3]} />
      <meshStandardMaterial
        vertexColors
        roughness={0.35}
        metalness={0.15}
      />
    </instancedMesh>
  )
}

function CameraController() {
  const { camera } = useThree()
  const orbitRef = useRef()

  const [{ orbit, camX, camY, camZ, targetX, targetY, targetZ }, set] = useControls('Camera', () => ({
    orbit: { value: true, label: 'Orbit Controls' },
    camX: { value: 11, min: -30, max: 30, step: 0.5, label: 'Pos X' },
    camY: { value: 30, min: 0, max: 30, step: 0.5, label: 'Pos Y' },
    camZ: { value: 10.5, min: -30, max: 30, step: 0.5, label: 'Pos Z' },
    targetX: { value: 0.5, min: -15, max: 15, step: 0.5, label: 'Target X' },
    targetY: { value: 0.5, min: -5, max: 10, step: 0.5, label: 'Target Y' },
    targetZ: { value: -0.5, min: -15, max: 15, step: 0.5, label: 'Target Z' },
  }))

  // When switching from orbit back to manual, apply current slider values
  useEffect(() => {
    if (!orbit) {
      camera.position.set(camX, camY, camZ)
      camera.lookAt(targetX, targetY, targetZ)
    }
  }, [orbit])

  useFrame(() => {
    if (orbit) {
      // Sync Leva sliders with current orbit camera state
      const p = camera.position
      const t = orbitRef.current?.target
      set({
        camX: Math.round(p.x * 2) / 2,
        camY: Math.round(p.y * 2) / 2,
        camZ: Math.round(p.z * 2) / 2,
        targetX: t ? Math.round(t.x * 2) / 2 : 0,
        targetY: t ? Math.round(t.y * 2) / 2 : 0,
        targetZ: t ? Math.round(t.z * 2) / 2 : 0,
      })
    } else {
      camera.position.set(camX, camY, camZ)
      camera.lookAt(targetX, targetY, targetZ)
    }
  })

  return orbit ? (
    <OrbitControls
      ref={orbitRef}
      target={[targetX, targetY, targetZ]}
      makeDefault
    />
  ) : null
}

const ENV_PRESETS = ['apartment', 'city', 'dawn', 'forest', 'lobby', 'night', 'park', 'studio', 'sunset', 'warehouse']

function Scene() {
  const { environment, envIntensity, background, bgBlur } = useControls('Environment', {
    environment: { value: 'lobby', options: ['none', ...ENV_PRESETS], label: 'Preset' },
    envIntensity: { value: 1.0, min: 0, max: 3, step: 0.1, label: 'Intensity' },
    background: { value: true, label: 'Show Background' },
    bgBlur: { value: 1.0, min: 0, max: 1, step: 0.05, label: 'BG Blur' },
  })

  const { bloomIntensity, bloomThreshold, bloomSmoothing } = useControls('Bloom', {
    bloomIntensity: { value: 0.5, min: 0, max: 2, step: 0.05, label: 'Intensity' },
    bloomThreshold: { value: 0.4, min: 0, max: 1, step: 0.05, label: 'Threshold' },
    bloomSmoothing: { value: 0.9, min: 0, max: 1, step: 0.05, label: 'Smoothing' },
  })

  return (
    <>
      <CameraController />
      {!background && <color attach="background" args={['#0a0a1a']} />}
      {!background && <fog attach="fog" args={['#0a0a1a', 12, 25]} />}
      {environment !== 'none' && (
        <Environment
          preset={environment}
          background={background}
          backgroundBlurriness={bgBlur}
          environmentIntensity={envIntensity}
        />
      )}
      <directionalLight position={[8, 12, 5]} intensity={0.6} color="#ffffff" castShadow />
      <WaveGrid />
      <EffectComposer>
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={bloomThreshold}
          luminanceSmoothing={bloomSmoothing}
          mipmapBlur
        />
      </EffectComposer>
    </>
  )
}

export default function WaveGeometry() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Link to="/" className="wave-geometry-back">&larr; Back</Link>
      </motion.div>
      <Canvas
        className="wave-geometry-canvas"
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
        camera={{
          position: [11, 30, 10.5],
          fov: 30,
          near: 0.1,
          far: 100,
        }}
        shadows
      >
        <Scene />
      </Canvas>
    </>
  )
}
