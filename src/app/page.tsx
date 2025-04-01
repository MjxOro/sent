"use client";
import Image from "next/image";
import { ExitStoreProvider } from "@/providers/store-provider";
import dynamic from "next/dynamic";
// Dynamic imports for better code splitting
const LandingPageCanvas = dynamic(
  () => import("@/components/LandingPage/LandingPageCanvas"),
  {
    ssr: false,
  },
);
import CanvasWrapper from "@/components/CanvasWrapper";

export default function Home() {
  return (
    <ExitStoreProvider>
      <LandingPageCanvas />
    </ExitStoreProvider>
  );
}
