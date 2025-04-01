"use client";
// components/Background.tsx
import { useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import "@/components/customShaders/NoiseShader";
import { NoiseMaterialType } from "@/components/customShaders/NoiseShader";
import { useMotionValue, useSpring } from "motion/react";
import * as THREE from "three";

const Background = () => {
  const material = useRef<NoiseMaterialType>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { width } = useThree((s) => s.viewport);

  // Create motion values for rotation and animation speed
  const rotationX = useMotionValue((-4 * Math.PI) / 9);
  const animationSpeed = useMotionValue(2);

  // Create springs for smooth animation
  const springRotationX = useSpring(rotationX, {
    stiffness: 100,
    damping: 80,
    mass: 1,
  });

  const springAnimationSpeed = useSpring(animationSpeed, {
    stiffness: 60,
    damping: 50,
    mass: 1,
  });

  // Update shader time and apply spring values
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    // Smoothly oscillate rotation and animation speed using sine waves
    // Use a very slow frequency for subtle, gradual changes
    const rotationOffset = Math.sin(time * 1) * 0.025; // Small oscillation with period of a few seconds
    const speedFactor = 0.25 + Math.sin(time * 0.13) * 0.35; // Oscillates between 0 and 0.5, offset by 0.35

    // Set the motion values
    rotationX.set((-4 * Math.PI) / 9 + rotationOffset);
    animationSpeed.set(2 + speedFactor);

    // Apply the spring values
    if (material.current) {
      material.current.uTime += delta * springAnimationSpeed.get();
    }

    if (meshRef.current) {
      meshRef.current.rotation.x = springRotationX.get();
    }
  });

  return (
    <mesh ref={meshRef} rotation={[(-4 * Math.PI) / 9, 0, 0]}>
      <planeGeometry args={[width * 4, width * 3, 300, 300]} />
      <noiseMaterial ref={material} />
    </mesh>
  );
};

export default Background;
