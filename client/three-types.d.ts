// Declare modules for 3D model files
import { NoiseMaterial } from '@/components/customShaders/NoiseShader';
// three-types.d.ts - Place this at the root of your project
import * as THREE from 'three';
import { Object3DNode } from '@react-three/fiber';

// Declare module for React Three Fiber JSX elements
declare module '@react-three/fiber' {
  interface ThreeElements {
    noiseMaterial: Object3DNode<
      THREE.ShaderMaterial,
      typeof THREE.ShaderMaterial
    >;
  }
}
declare module '*.glb';
declare module '*.gltf';
