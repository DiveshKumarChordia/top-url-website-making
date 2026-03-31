import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { useRef } from 'react'

function HeroScene() {
  const groupRef = useRef(null)
  useFrame((_, dt) => {
    const g = groupRef.current
    if (!g) return
    g.rotation.y += dt * 0.18
    g.rotation.x = Math.sin(performance.now() * 0.00045) * 0.12
  })
  return (
    <group ref={groupRef}>
      <mesh position={[-0.65, 0.08, 0]}>
        <torusGeometry args={[0.52, 0.18, 28, 56]} />
        <meshStandardMaterial
          color="#7c3aed"
          metalness={0.45}
          roughness={0.28}
        />
      </mesh>
      <mesh position={[0.72, -0.12, -0.15]}>
        <icosahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial
          color="#a78bfa"
          metalness={0.35}
          roughness={0.32}
        />
      </mesh>
    </group>
  )
}

export default function HeroCanvas() {
  return (
    <div className="hero-canvas">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <PerspectiveCamera makeDefault position={[0, 0.15, 4]} fov={42} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 8]} intensity={1.1} />
        <directionalLight
          position={[-4, -2, -4]}
          intensity={0.35}
          color="#c4b5fd"
        />
        <HeroScene />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.65}
          maxPolarAngle={Math.PI / 1.85}
          minPolarAngle={Math.PI / 4}
        />
      </Canvas>
    </div>
  )
}
