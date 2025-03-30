// 1. Modify CanvasLayout.tsx to work as a background
import { Canvas } from '@react-three/fiber';
import { Suspense, ReactNode } from 'react';

type CanvasLayoutProps = {
  children: ReactNode;
  className?: string;
  orthographic?: boolean;
};

const CanvasWrapper: React.FC<CanvasLayoutProps> = ({
  children,
  className,
  orthographic
}) => {
  return (
    <Canvas
      orthographic={orthographic ? true : false}
      camera={orthographic ? { zoom: 200 } : undefined}
      style={{
        position: 'fixed', // Changed from absolute to fixed
        width: '100vw',
        height: '100vh',
        top: 0,
        left: 0,
        zIndex: -1 // Place behind content
      }}
      className={className}
    >
      <Suspense fallback={null}>
        <ambientLight />
        {children}
      </Suspense>
    </Canvas>
  );
};

export default CanvasWrapper;
