import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const GRID = 14
const SPACING = 0.5
const CUBE_SIZE = 0.4
const MAX_HEIGHT = 2.5

const tmpObj = new THREE.Object3D()
const tmpColor = new THREE.Color()

function MiniWaveGrid() {
  const meshRef = useRef()
  const count = GRID * GRID

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

    const t = clock.getElapsedTime() * 1.2
    const offset = ((GRID - 1) * SPACING) / 2

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const i = row * GRID + col
        const x = col * SPACING - offset
        const z = row * SPACING - offset

        const wave1 = Math.sin(0.8 * (x * 0.8 + z * 0.6) + t)
        const wave2 = Math.sin(0.56 * (x * 0.5 - z * 0.9) + t * 0.8 + 1.5)
        const height = ((wave1 + wave2 * 0.6) / 2 + 0.5) * MAX_HEIGHT + 0.2
        const clampedH = Math.max(0.2, height)

        tmpObj.position.set(x, clampedH / 2, z)
        tmpObj.scale.set(1, clampedH / CUBE_SIZE, 1)
        tmpObj.updateMatrix()
        mesh.setMatrixAt(i, tmpObj.matrix)

        const norm = (clampedH - 0.2) / MAX_HEIGHT
        tmpColor.setHSL(0.58 + norm * 0.08, 0.7 + norm * 0.2, 0.25 + norm * 0.45)
        colorArray[i * 3] = tmpColor.r
        colorArray[i * 3 + 1] = tmpColor.g
        colorArray[i * 3 + 2] = tmpColor.b
      }
    }

    mesh.instanceMatrix.needsUpdate = true
    mesh.geometry.attributes.color.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <boxGeometry args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]}>
        <instancedBufferAttribute attach="attributes-color" args={[colorArray, 3]} />
      </boxGeometry>
      <meshStandardMaterial vertexColors roughness={0.35} metalness={0.15} />
    </instancedMesh>
  )
}

export default function WaveGeometryPreview() {
  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      camera={{ position: [6, 5, 6], fov: 30 }}
      gl={{ antialias: false }}
    >
      <color attach="background" args={['#0a0a1a']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 3]} intensity={1} color="#aaccff" />
      <MiniWaveGrid />
    </Canvas>
  )
}
