import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import vertexShader from '@/components/customShaders/vertex';
import fragmentShader from '@/components/customShaders/fragment';
export type NoiseMaterialType = THREE.ShaderMaterial & {
  uniforms: {
    uTime: { value: number };
    // Add any other uniforms you have here
  };
  uTime: number;
};

export const NoiseMaterial = shaderMaterial(
  {
    uTime: 0
  },
  vertexShader,
  fragmentShader
);

extend({ NoiseMaterial });
