"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/providers/auth-provider";

// Dynamic imports for better code splitting
const LandingPageCanvas = dynamic(
  () => import("@/components/LandingPage/LandingPageCanvas"),
  {
    ssr: false,
  },
);

import LandingPageDOM from "@/components/LandingPage/LandingPageDOM";
import Dashboard from "@/components/Dashboard";
import { DashboardProvider } from "@/providers/dashboard-provider";

// Loading component to reuse
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="w-12 h-12 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
  </div>
);

export default function LandingContent() {
  // Get authentication state from the auth context
  const { isAuthenticated, isLoading, error, checkAuth } = useAuth();
  const [initialLoading, setInitialLoading] = useState(true);

  // Check authentication status when the component mounts
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        await checkAuth();
      } catch (err) {
        console.error("Auth verification error:", err);
      } finally {
        setInitialLoading(false);
      }
    };

    if (typeof window !== "undefined") {
      verifyAuth();
    }
  }, [checkAuth]);

  // Show loading state while checking authentication
  if (initialLoading || isLoading) {
    return <LoadingSpinner />;
  }

  // If there's an authentication error, we could handle it here
  if (error) {
    console.warn("Auth error:", error);
    // Still proceed to show unauthenticated UI
  }

  // Render different components based on authentication state
  return isAuthenticated ? (
    <Dashboard />
  ) : (
    <>
      <LandingPageCanvas />
      <LandingPageDOM />
    </>
  );
}
