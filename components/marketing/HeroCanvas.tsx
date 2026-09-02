"use client";

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WORLDS, DEFAULT_ACCENT } from "@/lib/constants";
import { computeWorldScrollState } from "@/lib/scrollMath";

type GroupRef = React.RefObject<THREE.Group | null>;

/** applies opacity * userData.baseOpacity to every material in a group */
function applyGroupOpacity(group: THREE.Group | null, opacity: number) {
  if (!group) return;
  group.traverse((child) => {
    const obj = child as THREE.Mesh | THREE.Points;
    const material = obj.material as (THREE.Material & { opacity?: number }) | undefined;
    if (material && "opacity" in material) {
      const base = (child.userData?.baseOpacity as number) ?? 1;
      material.transparent = true;
      material.opacity = opacity * base;
    }
  });
}

function Core({ accentRef }: { accentRef: React.MutableRefObject<THREE.Color> }) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const icoMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) groupRef.current.rotation.y += 0.0022;

    const pulse = 1 + Math.sin(t * 1.6) * 0.06;
    if (glowRef.current) glowRef.current.scale.setScalar(pulse);
    if (coreMatRef.current) coreMatRef.current.emissiveIntensity = 0.75 + Math.sin(t * 1.8) * 0.25;

    const accent = accentRef.current;
    if (icoMatRef.current) icoMatRef.current.color.copy(accent);
    if (ringMatRef.current) ringMatRef.current.color.copy(accent);
    if (coreMatRef.current) coreMatRef.current.emissive.copy(accent);
  });

  return (
    <group ref={groupRef}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.05, 48, 48]} />
        <meshBasicMaterial color="#5ff2ff" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.68, 48, 48]} />
        <meshBasicMaterial color="#9d6bff" transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1.32, 1]} />
        <meshBasicMaterial ref={icoMatRef} color="#5ff2ff" wireframe transparent opacity={0.5} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1.58, 1]} />
        <meshBasicMaterial color="#4d8dff" wireframe transparent opacity={0.16} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.44, 3]} />
        <meshStandardMaterial
          ref={coreMatRef}
          color="#0d1a24"
          emissive="#5ff2ff"
          emissiveIntensity={0.9}
          metalness={0.6}
          roughness={0.25}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2.15, 0, 0]}>
        <torusGeometry args={[2.0, 0.003, 8, 128]} />
        <meshBasicMaterial ref={ringMatRef} color="#5ff2ff" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function Starfield() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 700;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 7 + Math.random() * 15;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.005;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#8fb4ff" size={0.017} transparent opacity={0.5} />
    </points>
  );
}

function ResearchWorld({ groupRef, color }: { groupRef: GroupRef; color: string }) {
  const docs = useMemo(() => Array.from({ length: 7 }, (_, i) => (i / 7) * Math.PI * 2), []);
  const scanlines = useMemo(() => Array.from({ length: 10 }, (_, i) => i), []);
  const dotPositions = useMemo(() => {
    const arr = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.getElapsedTime();
    group.children.forEach((child) => {
      const baseA = child.userData?.baseA as number | undefined;
      if (baseA === undefined) return;
      const angle = baseA + t * 0.12;
      child.position.x = Math.cos(angle) * 3.3;
      child.position.z = Math.sin(angle) * 1.5 - 1;
      child.rotation.y += 0.01;
    });
  });

  return (
    <group ref={groupRef}>
      {scanlines.map((i) => (
        <mesh key={i} position={[0, -3 + i * 0.66, -2.5]} userData={{ baseOpacity: 0.16 }}>
          <planeGeometry args={[9, 0.006]} />
          <meshBasicMaterial color={color} transparent opacity={0.16} />
        </mesh>
      ))}
      {docs.map((a, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * 3.3, Math.sin(a * 1.3) * 1.2, Math.sin(a) * 1.5 - 1]}
          userData={{ baseA: a, baseOpacity: 0.5 }}
        >
          <planeGeometry args={[0.5, 0.7]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.5} />
        </mesh>
      ))}
      <points userData={{ baseOpacity: 0.7 }}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dotPositions, 3]} count={dotPositions.length / 3} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color={color} size={0.02} transparent opacity={0.7} />
      </points>
    </group>
  );
}

function ProjectsWorld({ groupRef, color }: { groupRef: GroupRef; color: string }) {
  const arcs = useMemo(() => [0, 1, 2], []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    group.children.forEach((child) => {
      const spin = child.userData?.spin as number | undefined;
      if (spin) child.rotation.z += spin * 0.01;
    });
  });

  return (
    <group ref={groupRef}>
      <gridHelper args={[10, 20, color, color]} position={[0, -2.2, -2]} userData={{ baseOpacity: 0.28 }} />
      {arcs.map((i) => (
        <mesh
          key={i}
          rotation={[Math.PI / 2 + i * 0.2, 0, 0]}
          userData={{ spin: 0.05 * (i % 2 === 0 ? 1 : -1), baseOpacity: 0.35 }}
        >
          <torusGeometry args={[1.9 + i * 0.55, 0.004, 8, 64, Math.PI * 1.4]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function PlacementWorld({ groupRef, color }: { groupRef: GroupRef; color: string }) {
  const rings = useMemo(() => [0, 1, 2], []);
  const sweepRef = useRef<THREE.Mesh>(null);
  const dotPositions = useMemo(() => {
    const arr = new Float32Array(30 * 3);
    for (let i = 0; i < 30; i++) {
      const r = 1.4 + Math.random() * 2.2;
      const a = Math.random() * Math.PI * 2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = 0;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (sweepRef.current) sweepRef.current.rotation.y = clock.getElapsedTime() * 0.6;
  });

  return (
    <group ref={groupRef}>
      {rings.map((i) => (
        <mesh key={i} rotation={[Math.PI / 2, 0, 0]} userData={{ baseOpacity: 0.32 }}>
          <torusGeometry args={[1.4 + i * 0.75, 0.005, 8, 96]} />
          <meshBasicMaterial color={color} transparent opacity={0.32} />
        </mesh>
      ))}
      <mesh ref={sweepRef} position={[1.45, 0, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ baseOpacity: 0.6 }}>
        <planeGeometry args={[2.9, 0.03]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} blending={THREE.AdditiveBlending} />
      </mesh>
      <points userData={{ baseOpacity: 0.8 }}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dotPositions, 3]} count={dotPositions.length / 3} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color={color} size={0.035} transparent opacity={0.8} />
      </points>
    </group>
  );
}

function ResumeWorld({ groupRef, color }: { groupRef: GroupRef; color: string }) {
  const panels = useMemo(() => Array.from({ length: 5 }, (_, i) => i), []);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.getElapsedTime();
    group.children.forEach((child) => {
      const i = child.userData?.i as number | undefined;
      if (i === undefined) return;
      const spread = 0.3;
      child.position.set((i - 2) * 0.5 * spread, Math.sin(t * 0.4 + i) * 0.15, -0.5 - i * 0.15);
      child.rotation.y = 0.6 * spread * (i % 2 === 0 ? 1 : -1);
    });
  });

  return (
    <group ref={groupRef}>
      {panels.map((i) => (
        <mesh key={i} userData={{ i, baseOpacity: 0.4 }}>
          <planeGeometry args={[1.3, 1.7]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function CameraRig() {
  useFrame(({ camera, mouse }) => {
    camera.position.x += (mouse.x * 0.5 - camera.position.x) * 0.03;
    camera.position.y += (0.3 - mouse.y * 0.3 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

interface SceneProps {
  sectionRefs: React.RefObject<Array<HTMLElement | null>>;
}

function Scene({ sectionRefs }: SceneProps) {
  const researchRef = useRef<THREE.Group>(null);
  const projectsRef = useRef<THREE.Group>(null);
  const placementRef = useRef<THREE.Group>(null);
  const resumeRef = useRef<THREE.Group>(null);
  const keyLightRef = useRef<THREE.PointLight>(null);

  const accentColor = useRef(new THREE.Color(DEFAULT_ACCENT));
  const targetColor = useRef(new THREE.Color(DEFAULT_ACCENT));

  useFrame(({ size }) => {
    const worldRects = sectionRefs.current.slice(1, 5).map((el) => el?.getBoundingClientRect() ?? null);
    const { opacities, activeColor } = computeWorldScrollState(worldRects, size.height);

    applyGroupOpacity(researchRef.current, opacities[0] ?? 0);
    applyGroupOpacity(projectsRef.current, opacities[1] ?? 0);
    applyGroupOpacity(placementRef.current, opacities[2] ?? 0);
    applyGroupOpacity(resumeRef.current, opacities[3] ?? 0);

    targetColor.current.set(activeColor);
    accentColor.current.lerp(targetColor.current, 0.03);
    if (keyLightRef.current) keyLightRef.current.color.copy(accentColor.current);
  });

  return (
    <>
      <fogExp2 attach="fog" args={["#050505", 0.035]} />
      <ambientLight color="#223355" intensity={1.1} />
      <pointLight ref={keyLightRef} position={[3, 3, 4]} intensity={6} distance={22} color={DEFAULT_ACCENT} />
      <pointLight position={[-4, -2, -3]} intensity={3.4} distance={22} color="#9d6bff" />

      <Core accentRef={accentColor} />
      <Starfield />

      <ResearchWorld groupRef={researchRef} color={WORLDS[0]!.color} />
      <ProjectsWorld groupRef={projectsRef} color={WORLDS[1]!.color} />
      <PlacementWorld groupRef={placementRef} color={WORLDS[2]!.color} />
      <ResumeWorld groupRef={resumeRef} color={WORLDS[3]!.color} />

      <CameraRig />
    </>
  );
}

/** Detects whether the browser can actually create a WebGL context — some
 * sandboxed/GPU-disabled browsers report the API but fail on creation. */
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/** Swallows any render/context-creation error from the 3D scene so a
 * missing/disabled GPU never crashes the page — it just hides the canvas. */
class CanvasErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  override state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  override render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

interface HeroCanvasProps {
  sectionRefs: React.RefObject<Array<HTMLElement | null>>;
}

export default function HeroCanvas({ sectionRefs }: HeroCanvasProps) {
  const [webglOk, setWebglOk] = useState(false);

  useEffect(() => {
    setWebglOk(isWebGLAvailable());
  }, []);

  if (!webglOk) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[1]">
      <CanvasErrorBoundary>
        <Canvas
          camera={{ position: [0, 0.3, 9], fov: 50, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false }}
          dpr={[1, 2]}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
          }}
        >
          <Scene sectionRefs={sectionRefs} />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
