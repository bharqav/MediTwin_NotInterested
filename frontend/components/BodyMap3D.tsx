'use client';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { TimelinePoint } from '@/types/simulation';

/* ─── Organ 3D positions ─── */

const ORGANS: Record<string, { pos: [number, number, number]; r: number; label: string }> = {
  brain: { pos: [0, 1.68, 0], r: 0.08, label: 'BRAIN' },
  heart: { pos: [-0.04, 1.28, 0.06], r: 0.04, label: 'HEART' },
  lungs: { pos: [0, 1.3, 0], r: 0.1, label: 'LUNGS' },
  liver: { pos: [0.09, 1.13, 0.04], r: 0.06, label: 'LIVER' },
  stomach: { pos: [-0.07, 1.1, 0.05], r: 0.05, label: 'STOMACH' },
  kidneys: { pos: [0, 1.02, -0.06], r: 0.04, label: 'KIDNEYS' },
  bloodstream: { pos: [0, 1.2, 0], r: 0.16, label: 'BLOOD' },
  skin: { pos: [0, 1.2, 0], r: 0.22, label: 'SKIN' },
};

function scoreToColor(score: number): THREE.Color {
  if (score < 0.15) return new THREE.Color(0x00f0ff);
  if (score < 0.3) return new THREE.Color(0x00ff66);
  if (score < 0.5) return new THREE.Color(0xffd700);
  if (score < 0.7) return new THREE.Color(0xff6600);
  return new THREE.Color(0xff3366);
}

/* ─── Floating Particles ─── */

function Particles({ count = 200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!);
  const seeded = (seed: number) => {
    const x = Math.sin(seed * 9999.91) * 43758.5453;
    return x - Math.floor(x);
  };
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const sx = seeded(i + count * 1);
      const sy = seeded(i + count * 2);
      const sz = seeded(i + count * 3);
      arr[i * 3] = (sx - 0.5) * 1.2;
      arr[i * 3 + 1] = sy * 2.2 + 0.1;
      arr[i * 3 + 2] = (sz - 0.5) * 0.8;
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.05;
      const posArr = ref.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        posArr[i * 3 + 1] += Math.sin(Date.now() * 0.001 + i) * 0.0003;
      }
      ref.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.008} color={0x00f0ff} transparent opacity={0.4} sizeAttenuation />
    </points>
  );
}

/* ─── Wireframe body (original block / cylinder silhouette) ─── */

function WireframeBody() {
  const ref = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.08;
    }
  });

  const wireframeMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.15 }),
    [],
  );
  const edgeMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.3 }),
    [],
  );

  return (
    <group ref={ref}>
      <mesh position={[0, 1.68, 0]} material={wireframeMat}>
        <icosahedronGeometry args={[0.12, 2]} />
      </mesh>
      <lineSegments position={[0, 1.68, 0]}>
        <edgesGeometry args={[new THREE.IcosahedronGeometry(0.12, 2)]} />
        <primitive object={edgeMat} attach="material" />
      </lineSegments>

      <mesh position={[0, 1.54, 0]} material={wireframeMat}>
        <cylinderGeometry args={[0.035, 0.04, 0.1, 8]} />
      </mesh>

      <mesh position={[0, 1.25, 0]} material={wireframeMat}>
        <boxGeometry args={[0.32, 0.52, 0.16]} />
      </mesh>
      <lineSegments position={[0, 1.25, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(0.32, 0.52, 0.16)]} />
        <primitive object={edgeMat} attach="material" />
      </lineSegments>

      <mesh position={[0, 0.92, 0]} material={wireframeMat}>
        <boxGeometry args={[0.28, 0.14, 0.14]} />
      </mesh>
      <lineSegments position={[0, 0.92, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(0.28, 0.14, 0.14)]} />
        <primitive object={edgeMat} attach="material" />
      </lineSegments>

      <mesh position={[-0.24, 1.38, 0]} rotation={[0, 0, -0.35]} material={wireframeMat}>
        <cylinderGeometry args={[0.028, 0.032, 0.26, 6]} />
      </mesh>
      <mesh position={[0.24, 1.38, 0]} rotation={[0, 0, 0.35]} material={wireframeMat}>
        <cylinderGeometry args={[0.028, 0.032, 0.26, 6]} />
      </mesh>

      <mesh position={[-0.33, 1.14, 0]} rotation={[0, 0, -0.12]} material={wireframeMat}>
        <cylinderGeometry args={[0.022, 0.028, 0.26, 6]} />
      </mesh>
      <mesh position={[0.33, 1.14, 0]} rotation={[0, 0, 0.12]} material={wireframeMat}>
        <cylinderGeometry args={[0.022, 0.028, 0.26, 6]} />
      </mesh>

      <mesh position={[-0.09, 0.68, 0]} material={wireframeMat}>
        <cylinderGeometry args={[0.04, 0.055, 0.38, 6]} />
      </mesh>
      <mesh position={[0.09, 0.68, 0]} material={wireframeMat}>
        <cylinderGeometry args={[0.04, 0.055, 0.38, 6]} />
      </mesh>

      <mesh position={[-0.09, 0.3, 0]} material={wireframeMat}>
        <cylinderGeometry args={[0.03, 0.04, 0.38, 6]} />
      </mesh>
      <mesh position={[0.09, 0.3, 0]} material={wireframeMat}>
        <cylinderGeometry args={[0.03, 0.04, 0.38, 6]} />
      </mesh>

      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 1.49, -0.04, 0, 0.85, -0.04]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={0x00f0ff} transparent opacity={0.5} />
      </line>
    </group>
  );
}

/* ─── Organ spheres ─── */

function OrganSphere({
  position,
  radius,
  score,
  name,
  selected,
  onClick,
}: {
  position: [number, number, number];
  radius: number;
  score: number;
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const color = useMemo(() => scoreToColor(score), [score]);
  const shouldPulse = score > 0.35;

  useFrame((state) => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    if (shouldPulse) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
      ref.current.scale.setScalar(s);
    } else {
      ref.current.scale.setScalar(1);
    }
    mat.emissiveIntensity = 0.5 + score * 2 + (selected ? 1.5 : 0);
  });

  if (name === 'bloodstream' || name === 'skin') return null;

  return (
    <mesh
      ref={ref}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5 + score * 2}
        transparent
        opacity={0.6 + score * 0.3}
        roughness={0.2}
        metalness={0.8}
      />
    </mesh>
  );
}

/* ─── Grid floor ─── */

function HoloGrid() {
  return <gridHelper args={[2, 20, 0x003344, 0x001a22]} position={[0, 0.05, 0]} />;
}

/* ─── Scan ring ─── */

function ScanRing() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (ref.current) {
      const y = 0.1 + ((state.clock.elapsedTime * 0.3) % 1.8);
      ref.current.position.y = y;
      const mat = ref.current.material;
      if (!Array.isArray(mat)) {
        mat.opacity = 0.15 + Math.sin(state.clock.elapsedTime * 2) * 0.08;
      }
    }
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.28, 0.3, 64]} />
      <meshBasicMaterial color={0x00f0ff} transparent opacity={0.15} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ─── Scene ─── */

interface BodyMap3DProps {
  timeline: TimelinePoint[];
  currentTimeIndex: number;
  onOrganClick: (organ: string) => void;
  selectedOrgan: string | null;
}

function Scene({ timeline, currentTimeIndex, onOrganClick, selectedOrgan }: BodyMap3DProps) {
  const tp = timeline[currentTimeIndex];
  if (!tp) return null;
  const effects = tp.organ_effects;

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[1, 3, 2]} intensity={0.8} color={0x00f0ff} />
      <pointLight position={[-1, 1, -2]} intensity={0.4} color={0xff3366} />
      <pointLight position={[0, 0, 3]} intensity={0.3} color={0xffd700} />

      <WireframeBody />
      <Particles count={150} />
      <HoloGrid />
      <ScanRing />

      {Object.entries(ORGANS).map(([name, organ]) => {
        const score = effects[name]?.effect_score ?? 0;
        return (
          <OrganSphere
            key={name}
            position={organ.pos}
            radius={organ.r}
            score={score}
            name={name}
            selected={selectedOrgan === name}
            onClick={() => onOrganClick(name)}
          />
        );
      })}

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={0.8}
        maxDistance={3}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.85}
        autoRotate
        autoRotateSpeed={0.45}
        target={[0, 1.1, 0]}
      />
    </>
  );
}

export default function BodyMap3D(props: BodyMap3DProps) {
  const [eventSource, setEventSource] = useState<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const setContainer = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setEventSource(node);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [eventSource]);

  return (
    <div
      ref={setContainer}
      className="relative h-full w-full min-h-[200px]"
      style={{ touchAction: 'none' }}
    >
      <Canvas
        className="touch-none !block h-full w-full"
        style={{ width: '100%', height: '100%', display: 'block', background: 'transparent' }}
        camera={{ position: [0, 1.2, 1.8], fov: 40, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        eventSource={eventSource ?? undefined}
        eventPrefix="client"
        resize={{ scroll: true, debounce: { scroll: 50, resize: 0 } }}
      >
        <Scene {...props} />
      </Canvas>
      <div className="pointer-events-none absolute bottom-2 left-2 text-[8px] font-mono text-[var(--text-muted)] opacity-50">
        DRAG TO ROTATE // SCROLL TO ZOOM
      </div>
    </div>
  );
}
