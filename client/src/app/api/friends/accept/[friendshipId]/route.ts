import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(
  _: NextRequest,
  { params }: { params: { friendshipId: string } },
) {
  try {
    const { friendshipId } = await params;
    const token = (await cookies()).get("auth_token")?.value;
    // Forward the request to your Go backend
    const response = await fetch(
      `${process.env.SERVER_URI || "http://localhost:8080"}/api/friends/accept/${friendshipId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();
    console.log(data);
    // Return the response from your Go backend
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to accept friend request" },
      { status: 500 },
    );
  }
}
