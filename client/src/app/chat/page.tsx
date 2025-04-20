"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDashboardStore } from "@/stores/dashboardStore";
import Dashboard from "@/components/Dashboard";

export default function NewChatPage() {
  const router = useRouter();
  const createNewThread = useDashboardStore((state) => state.createNewThread);

  useEffect(() => {
    // Create a new thread and redirect to it
    const id = createNewThread("New Chat");
    router.push(`/chat/${id}`);
  }, []);

  // While redirecting, show the dashboard in a "new chat" state
  return <Dashboard />;
}
