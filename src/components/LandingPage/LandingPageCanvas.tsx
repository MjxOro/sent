// components/LandingCanvas.tsx
"use client";

import { Suspense } from "react";
import { Stars } from "@react-three/drei";
import dynamic from "next/dynamic";
import CanvasWrapper from "@/components/CanvasWrapper";
import { useExitStore } from "@/providers/store-provider";
// Dynamic imports for better code splitting
const PaperPlane = dynamic(
  () => import("@/components/LandingPage/PaperPlane"),
  {
    ssr: false,
  },
);
const Background = dynamic(
  () => import("@/components/LandingPage/Background"),
  {
    ssr: false,
  },
);

const LandingPage = () => {
  const { exitThree } = useExitStore((state) => state);

  return (
    <CanvasWrapper>
      <pointLight position={[0, 10, 4]} color={"#FFD042"} />
      <color attach="background" args={["#301860"]} />
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
          scale={[0.003, 0.003, 0.003]}
          position={exitThree ? [0, 0, -2] : [0, 0, 4]}
        />
      </Suspense>
    </CanvasWrapper>
  );
};

export default LandingPage;
