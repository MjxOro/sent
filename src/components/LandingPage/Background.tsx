// components/Background.tsx
import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
// import useStore from '../../utils/store';
import '@/components/customShaders/NoiseShader';
import { NoiseMaterialType } from '@/components/customShaders/NoiseShader';
import { useMotionValue, useSpring } from 'motion/react';
import * as THREE from 'three';

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
    mass: 1
  });

  const springAnimationSpeed = useSpring(animationSpeed, {
    stiffness: 60,
    damping: 50,
    mass: 1
  });

  // Effect to toggle the rotation value for subtle movement
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const animateBackground = () => {
      // Get current value to determine direction
      const currentRotation = rotationX.get();

      // Alternate between two slightly different rotation values
      if (currentRotation <= (-4 * Math.PI) / 9) {
        rotationX.set((-4 * Math.PI) / 9 + 0.05);
        animationSpeed.set(2.5);
      } else {
        rotationX.set((-4 * Math.PI) / 9);
        animationSpeed.set(2);
      }
    };

    // Create a slow animation loop
    interval = setInterval(animateBackground, 5000);

    return () => clearInterval(interval);
  }, [rotationX, animationSpeed]);

  // Update shader time and apply spring values
  useFrame((_, delta) => {
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
