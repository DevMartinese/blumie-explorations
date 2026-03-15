import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { vertexShader, fragmentShader } from './shaders'
import modelUrl from '../../assets/Blumie-3D-Logo.glb?url'
import './AsciiMask.css'

const HANDLE_SIZE = 220

function BlumieModel({ masks }) {
  const { scene } = useGLTF(modelUrl)
  const groupRef = useRef()
  const materialsRef = useRef([])
  const { size } = useThree()

  useEffect(() => {
    const mats = []
    scene.traverse((child) => {
      if (child.isMesh) {
        const origColor = new THREE.Color(1, 1, 1)

        const mat = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            uMask0: { value: new THREE.Vector2(0.2, 0.5) },
            uMask1: { value: new THREE.Vector2(0.5, 0.5) },
            uMask2: { value: new THREE.Vector2(0.8, 0.5) },
            uMaskRadius: { value: (HANDLE_SIZE / 2) / size.height },
            uTime: { value: 0 },
            uAspect: { value: size.width / size.height },
            uModelColor: { value: new THREE.Vector3(origColor.r, origColor.g, origColor.b) },
          },
        })
        child.material = mat
        mats.push(mat)
      }
    })
    materialsRef.current = mats
  }, [scene, size.width, size.height])

  useFrame((state) => {
    const aspect = state.size.width / state.size.height
    const maskRadius = (HANDLE_SIZE / 2) / state.size.height
    materialsRef.current.forEach((mat) => {
      mat.uniforms.uTime.value = state.clock.elapsedTime
      mat.uniforms.uAspect.value = aspect
      mat.uniforms.uMaskRadius.value = maskRadius
      mat.uniforms.uMask0.value.set(masks[0].x, masks[0].y)
      mat.uniforms.uMask1.value.set(masks[1].x, masks[1].y)
      mat.uniforms.uMask2.value.set(masks[2].x, masks[2].y)
    })
  })

  return (
    <group ref={groupRef}>
      <primitive object={scene} scale={1} />
    </group>
  )
}

export default function AsciiMask() {
  const [positions, setPositions] = useState(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    return [
      { x: w * 0.48, y: h * 0.72 },  // waves: bottom-center
      { x: w * 0.38, y: h * 0.38 },  // terrain: center-left
      { x: w * 0.62, y: h * 0.25 },  // flow: top-right
    ]
  })
  const dragging = useRef(null)

  const getMaskUniforms = useCallback(() => {
    return positions.map((p) => ({
      x: p.x / window.innerWidth,
      y: 1 - p.y / window.innerHeight,
    }))
  }, [positions])

  const handlePointerDown = useCallback((e, idx) => {
    e.preventDefault()
    e.stopPropagation()
    dragging.current = idx
  }, [])

  useEffect(() => {
    const handleMove = (e) => {
      if (dragging.current === null) return
      const idx = dragging.current
      setPositions((prev) => {
        const next = [...prev]
        next[idx] = { x: e.clientX, y: e.clientY }
        return next
      })
    }
    const handleUp = () => {
      dragging.current = null
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [])

  const maskUniforms = getMaskUniforms()
  const handleNames = ['waves', 'terrain', 'flow']

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Link to="/" className="ascii-mask-back">&larr; Back</Link>
      </motion.div>
      <div className="ascii-mask-wrapper">
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} />
          <OrbitControls />
          <Suspense fallback={null}>
            <BlumieModel masks={maskUniforms} />
          </Suspense>
        </Canvas>
        {positions.map((pos, i) => (
          <div
            key={i}
            className={`mask-handle mask-handle--${handleNames[i]}`}
            style={{ left: pos.x, top: pos.y }}
            onPointerDown={(e) => handlePointerDown(e, i)}
          />
        ))}
      </div>
    </>
  )
}
