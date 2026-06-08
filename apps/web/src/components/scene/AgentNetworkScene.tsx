import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Stars, Trail, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

interface AgentNodeProps {
  color: string
  angleOffset: number
  radius: number
}

function AgentNode({ color, angleOffset, radius }: AgentNodeProps) {
  const ref = useRef<THREE.Mesh>(null!)
  const time = useRef(0)

  useFrame((_, delta) => {
    time.current += delta * 0.35
    const angle = time.current + angleOffset
    if (ref.current) {
      ref.current.position.x = Math.cos(angle) * radius
      ref.current.position.z = Math.sin(angle) * radius
      ref.current.position.y = Math.sin(time.current * 1.3 + angleOffset) * 0.4
    }
  })

  return (
    <Trail
      width={0.8}
      length={6}
      color={new THREE.Color(color)}
      attenuation={(t) => t * t}
    >
      <mesh ref={ref}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.5}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>
    </Trail>
  )
}

function CentralShield() {
  const meshRef = useRef<THREE.Mesh>(null!)
  const wireRef = useRef<THREE.Mesh>(null!)

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.15
      meshRef.current.rotation.x += delta * 0.05
    }
    if (wireRef.current) {
      wireRef.current.rotation.y += delta * 0.15
      wireRef.current.rotation.x += delta * 0.05
    }
  })

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.1, 1]} />
        <MeshDistortMaterial
          color="#06b6d4"
          distort={0.35}
          speed={1.5}
          transparent
          opacity={0.18}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[1.12, 1]} />
        <meshBasicMaterial
          color="#22d3ee"
          wireframe
          transparent
          opacity={0.12}
        />
      </mesh>
    </Float>
  )
}

function Scene() {
  return (
    <>
      <Stars radius={80} depth={50} count={3000} factor={3} saturation={0} fade speed={0.5} />
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 3, 3]} intensity={2} color="#22d3ee" />
      <pointLight position={[-3, -2, -3]} intensity={1} color="#818cf8" />

      <CentralShield />

      <AgentNode color="#22d3ee" angleOffset={0} radius={3} />
      <AgentNode color="#818cf8" angleOffset={(2 * Math.PI) / 3} radius={3} />
      <AgentNode color="#34d399" angleOffset={(4 * Math.PI) / 3} radius={3} />
    </>
  )
}

export default function AgentNetworkScene() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 55 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
