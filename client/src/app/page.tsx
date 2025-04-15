"use client";

import { AuthProvider } from "@/providers/auth-provider";
import { ExitStoreProvider } from "@/providers/store-provider";
import LandingContent from "@/components/LandingPage/LandingContent";

export default function Page() {
  return (
    <AuthProvider>
      <ExitStoreProvider>
        <LandingContent />
      </ExitStoreProvider>
    </AuthProvider>
  );
}
