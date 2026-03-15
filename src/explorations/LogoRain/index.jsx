import { useRef, useMemo, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Stats, OrbitControls } from '@react-three/drei'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useControls } from 'leva'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier'
import { MeshStandardNodeMaterial, PostProcessing } from 'three/webgpu'
import { pass, screenUV, smoothstep } from 'three/tsl'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import * as THREE from 'three'
import { createWavesShader, createTerrainShader, createFlowShader, createDitherShader } from './shaders'
import modelUrl from '../../assets/Blumie-3D-Logo.glb?url'
import './LogoRain.css'

const SHADER_FACTORIES = {
  waves: createWavesShader,
  terrain: createTerrainShader,
  flow: createFlowShader,
  dither: createDitherShader,
}

function FallingLogo({ position, material, geometries, logoSize }) {
  return (
    <RigidBody
      position={position}
      colliders={false}
      restitution={0.2}
      friction={0.5}
      enabledTranslations={[true, true, false]}
    >
      <CuboidCollider args={[logoSize[0] / 2, logoSize[1] / 2, logoSize[2] / 2]} />
      {geometries.map((geo, i) => (
        <mesh key={i} geometry={geo} material={material} />
      ))}
    </RigidBody>
  )
}

function Floor() {
  return (
    <RigidBody type="fixed" position={[0, -6, 0]}>
      <CuboidCollider args={[20, 0.5, 2]} />
    </RigidBody>
  )
}

function Walls() {
  return (
    <>
      <RigidBody type="fixed" position={[-10, 14, 0]}>
        <CuboidCollider args={[0.5, 24, 2]} />
      </RigidBody>
      <RigidBody type="fixed" position={[10, 14, 0]}>
        <CuboidCollider args={[0.5, 24, 2]} />
      </RigidBody>
    </>
  )
}

function Spawner({ rate, maxCount, material, geometries, logoSize }) {
  const [logos, setLogos] = useState([])
  const lastSpawn = useRef(0)
  const nextId = useRef(0)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const interval = 1 / rate
    if (t - lastSpawn.current >= interval) {
      lastSpawn.current = t
      setLogos((prev) => {
        if (prev.length >= maxCount) return prev
        const id = nextId.current++
        const x = (Math.random() - 0.5) * 18
        const y = 14 + Math.random() * 4
        return [...prev, { id, position: [x, y, 0] }]
      })
    }
  })

  return logos.map(({ id, position }) => (
    <FallingLogo
      key={id}
      position={position}
      material={material}
      geometries={geometries}
      logoSize={logoSize}
    />
  ))
}

function PostFX() {
  const { gl, scene, camera } = useThree()

  const postProcessing = useMemo(() => {
    const pp = new PostProcessing(gl)
    const scenePass = pass(scene, camera)
    const color = scenePass.getTextureNode()

    // Bloom — subtle glow on bright areas
    const bloomEffect = bloom(color, 0.5, 0.4, 0.85)

    // Vignette — darken edges
    const dist = screenUV.sub(0.5).length()
    const vig = smoothstep(0.9, 0.35, dist)

    pp.outputNode = color.add(bloomEffect).mul(vig)
    return pp
  }, [gl, scene, camera])

  useFrame(() => {
    postProcessing.render()
  }, 1) // priority > 0 tells R3F to skip default render

  return null
}

function CameraSync({ cameraX, cameraY, cameraZ, targetX, targetY, targetZ, parallax, setLeva, interacting, controlsRef }) {
  const { camera } = useThree()
  const mouse = useRef({ x: 0, y: 0 })
  const smoothMouse = useRef({ x: 0, y: 0 })
  const mouseMoved = useRef(false)
  const lastLevaUpdate = useRef(0)
  const levaUpdate = useRef({})

  useEffect(() => {
    const onMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1
      mouseMoved.current = true
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useEffect(() => {
    if (interacting.current) return
    camera.position.set(cameraX, cameraY, cameraZ)
    camera.updateProjectionMatrix()
    if (controlsRef.current) {
      controlsRef.current.target.set(targetX, targetY, targetZ)
      controlsRef.current.update()
    }
  }, [camera, cameraX, cameraY, cameraZ, targetX, targetY, targetZ])

  useFrame(({ clock }, delta) => {
    if (interacting.current) {
      const now = clock.getElapsedTime()
      if (now - lastLevaUpdate.current > 0.1) {
        lastLevaUpdate.current = now
        const t = controlsRef.current?.target
        levaUpdate.current['Camera X'] = Math.round(camera.position.x * 100) / 100
        levaUpdate.current['Camera Y'] = Math.round(camera.position.y * 100) / 100
        levaUpdate.current['Camera Z'] = Math.round(camera.position.z * 100) / 100
        if (t) {
          levaUpdate.current['Target X'] = Math.round(t.x * 100) / 100
          levaUpdate.current['Target Y'] = Math.round(t.y * 100) / 100
          levaUpdate.current['Target Z'] = Math.round(t.z * 100) / 100
        }
        setLeva(levaUpdate.current)
      }
      return
    }

    if (!mouseMoved.current) return

    // Frame-rate independent smooth parallax
    smoothMouse.current.x = THREE.MathUtils.damp(smoothMouse.current.x, mouse.current.x, 4, delta)
    smoothMouse.current.y = THREE.MathUtils.damp(smoothMouse.current.y, mouse.current.y, 4, delta)

    // Check convergence
    const dx = Math.abs(smoothMouse.current.x - mouse.current.x)
    const dy = Math.abs(smoothMouse.current.y - mouse.current.y)
    if (dx < 0.0001 && dy < 0.0001) {
      smoothMouse.current.x = mouse.current.x
      smoothMouse.current.y = mouse.current.y
      mouseMoved.current = false
    }

    const offsetX = smoothMouse.current.x * parallax
    const offsetY = -smoothMouse.current.y * parallax * 0.5
    camera.position.set(cameraX + offsetX, cameraY + offsetY, cameraZ)
  })

  return null
}

function Scene({ shader, gravity, rate, maxCount, cameraX, cameraY, cameraZ, targetX, targetY, targetZ, parallax, setLeva }) {
  const interacting = useRef(false)
  const controlsRef = useRef()
  const { scene } = useGLTF(modelUrl)

  // Extract geometries with world transforms baked in — shared across all instances
  const { geometries, logoSize } = useMemo(() => {
    const geos = []
    const box = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    box.getSize(size)
    scene.updateWorldMatrix(true, true)
    scene.traverse((child) => {
      if (child.isMesh) {
        const geo = child.geometry.clone()
        geo.applyMatrix4(child.matrixWorld)
        geos.push(geo)
      }
    })
    return { geometries: geos, logoSize: [size.x, size.y, size.z] }
  }, [scene])

  const material = useMemo(() => {
    const mat = new MeshStandardNodeMaterial()
    const factory = SHADER_FACTORIES[shader]
    if (factory) {
      mat.colorNode = factory()
    }
    return mat
  }, [shader])

  return (
    <>
      <color attach="background" args={['#0a1628']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} />
      <Physics gravity={[0, -gravity, 0]}>
        <Floor />
        <Walls />
        <Spawner rate={rate} maxCount={maxCount} material={material} geometries={geometries} logoSize={logoSize} />
      </Physics>
      <CameraSync cameraX={cameraX} cameraY={cameraY} cameraZ={cameraZ} targetX={targetX} targetY={targetY} targetZ={targetZ} parallax={parallax} setLeva={setLeva} interacting={interacting} controlsRef={controlsRef} />
      <OrbitControls
        ref={controlsRef}
        target={[targetX, targetY, targetZ]}
        enableZoom={true}
        enablePan={false}
        enableRotate={false}
        onStart={() => { interacting.current = true }}
        onEnd={() => { interacting.current = false }}
      />
      <Stats />
      <PostFX />
    </>
  )
}

export default function LogoRain() {
  const [useWebGPU, setUseWebGPU] = useState(true)
  const [fallback, setFallback] = useState(false)

  const [{ Shader: shader, Gravity: gravity, Rate: rate, Count: maxCount, Parallax: parallax, 'Camera X': cameraX, 'Camera Y': cameraY, 'Camera Z': cameraZ, 'Target X': targetX, 'Target Y': targetY, 'Target Z': targetZ }, setLeva] = useControls(() => ({
    Shader: { value: 'flow', options: { Waves: 'waves', Terrain: 'terrain', Flow: 'flow', Dither: 'dither' } },
    Gravity: { value: 9.8, min: 1, max: 20, step: 0.1 },
    Rate: { value: 8, min: 1, max: 30, step: 1, label: 'Logos/sec' },
    Count: { value: 50, min: 5, max: 200, step: 5 },
    Parallax: { value: 0.3, min: 0, max: 3, step: 0.1 },
    'Camera X': { value: -6.3, min: -20, max: 20 },
    'Camera Y': { value: -0.1, min: -20, max: 20 },
    'Camera Z': { value: 6.7, min: -20, max: 20 },
    'Target X': { value: -2.7, min: -20, max: 20 },
    'Target Y': { value: 0.6, min: -20, max: 20 },
    'Target Z': { value: -1.8, min: -20, max: 20 },
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

  const canvasProps = {
    camera: { position: [cameraX, cameraY, cameraZ], fov: 60 },
    style: { background: '#0a1628', position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' },
  }

  if (fallback) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Link to="/" className="logo-rain-back">&larr; Back</Link>
        </motion.div>
        <Canvas {...canvasProps}>
          <Suspense fallback={null}>
            <Scene shader={shader} gravity={gravity} rate={rate} maxCount={maxCount} cameraX={cameraX} cameraY={cameraY} cameraZ={cameraZ} targetX={targetX} targetY={targetY} targetZ={targetZ} parallax={parallax} setLeva={setLeva} />
          </Suspense>
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
        <Link to="/" className="logo-rain-back">&larr; Back</Link>
      </motion.div>
      <Canvas gl={glProp} {...canvasProps}>
        <Suspense fallback={null}>
          <Scene shader={shader} gravity={gravity} rate={rate} maxCount={maxCount} cameraX={cameraX} cameraY={cameraY} cameraZ={cameraZ} targetX={targetX} targetY={targetY} targetZ={targetZ} parallax={parallax} setLeva={setLeva} />
        </Suspense>
      </Canvas>
    </>
  )
}
