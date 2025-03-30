// components/LandingCanvas.tsx
'use client';

import { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
// import useStore from '@/utils/store';
import dynamic from 'next/dynamic';
import { useSpring, useMotionValue } from 'motion/react';
import CanvasWrapper from '@/components/CanvasWrapper';
import * as THREE from 'three';

// Dynamic imports for better code splitting
const PaperPlane = dynamic(
  () => import('@/components/LandingPage/PaperPlane'),
  {
    ssr: false
  }
);
const Background = dynamic(
  () => import('@/components/LandingPage/Background'),
  {
    ssr: false
  }
);

// Logo component (3D)
const Logo: React.FC = () => {
  const { width, height } = useThree((s) => s.viewport);

  return (
    <group position={[-width * 0.425, height * 0.43, 0]}>
      <motion.mesh
        scale={[0.15, 0.15, 0.15]}
        position={[0.15, 0, 0]}
        animate={{
          rotateY: [Math.PI * 0.1, Math.PI * 2],
          rotateZ: [0, -3 * Math.PI]
        }}
        transition={{
          repeat: Infinity,
          repeatType: 'reverse',
          duration: 8,
          ease: 'easeInOut'
        }}
      >
        <torusGeometry />
        <meshToonMaterial color={'#906090'} />
      </motion.mesh>
      <mesh position={[0.7, 0, 0]}>
        {/* Replace Text component with a custom solution */}
        <planeGeometry args={[0.8, 0.2]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
};

import { Group } from 'three';

const LandingPage = () => {
  const { exitThree, editProfile } = useStore();
  const paperPlaneRef = useRef<Group>(null);

  // Create a motion value for rotation
  const rotationX = useMotionValue(Math.PI / 9);

  // Create a spring that will animate smoothly
  const springRotationX = useSpring(rotationX, {
    stiffness: 280, // tension
    damping: 120, // friction
    mass: 1
  });

  // Effect to toggle the rotation value
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const toggleRotation = () => {
      // Get current value to determine direction
      const currentValue = rotationX.get();

      if (currentValue === Math.PI / 9) {
        rotationX.set(Math.PI / 15);
      } else {
        rotationX.set(Math.PI / 9);
      }
    };

    // Start the animation loop with 2s intervals
    interval = setInterval(toggleRotation, 2000);

    return () => clearInterval(interval);
  }, [rotationX]);

  // Use Three.js animation loop to apply the spring value
  useFrame(() => {
    if (paperPlaneRef.current) {
      paperPlaneRef.current.rotation.x = springRotationX.get();
    }
  });

  return (
    <ExitAnimation>
      <CanvasWrapper>
        <pointLight position={[0, 10, 4]} color={'#FFD042'} />
        <color attach="background" args={['#301860']} />
        <Stars
          radius={100}
          depth={50}
          count={5000}
          factor={4}
          saturation={0}
          fade
        />
        <Suspense fallback={null}>
          <Background />
          <PaperPlane
            ref={paperPlaneRef}
            scale={[0.003, 0.003, 0.003]}
            position={exitThree ? [0, 0, -2] : [0, 0, 4]}
          />
        </Suspense>
      </CanvasWrapper>
    </ExitAnimation>
  );
};

export default LandingPage;
