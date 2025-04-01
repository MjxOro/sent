"use client";
import { ExitStoreProvider } from "@/providers/store-provider";
import dynamic from "next/dynamic";
// Dynamic imports for better code splitting
const LandingPageCanvas = dynamic(
  () => import("@/components/LandingPage/LandingPageCanvas"),
  {
    ssr: false,
  },
);
import LandingDOM from "@/components/LandingPage/LandingPageDOM";

export default function Home() {
  return (
    <ExitStoreProvider>
      <LandingPageCanvas />
      <LandingDOM />
    </ExitStoreProvider>
  );
}
