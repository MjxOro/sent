// app/chat/[chatId]/page.tsx
import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";
import ChatLoading from "./loading";
import { cookies } from "next/headers";

// Metadata for the page
export const metadata = {
  title: "Chat Room",
  description: "Chat with others in real-time",
};

// This is a server component that fetches initial data
async function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  // You can prefetch data here for initial state
  const token = (await cookies()).get("auth_token")?.value;
  const { chatId } = await params;
  let initialMessages = [];
  let chatDetails = null;

  try {
    // Fetch chat details
    const detailsRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://backend:8080"}/api/rooms/${chatId}`,
      {
        cache: "no-store", // Don't cache this data
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (detailsRes.ok) {
      chatDetails = await detailsRes.json();
    }

    // Fetch initial messages
    const messagesRes = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://backend:8080"}/api/rooms/${chatId}/messages?limit=50&offset=0`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (messagesRes.ok) {
      initialMessages = await messagesRes.json();
    }
  } catch (error) {
    console.error("Error fetching initial chat data:", error);
    // We'll handle missing data gracefully in the client component
  }

  return (
    <Suspense fallback={<ChatLoading />}>
      {/* 
        The Dashboard component is client-side and will use 
        the chatId from the URL to connect to the right chat.
        We'll set up the initial state with the data we fetched.
      */}
      <Dashboard
        initialChatId={chatId}
        initialMessages={initialMessages}
        chatDetails={chatDetails}
      />
    </Suspense>
  );
}

export default ChatPage;
