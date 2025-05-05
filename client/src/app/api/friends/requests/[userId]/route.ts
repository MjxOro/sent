import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const token = (await cookies()).get("auth_token")?.value;
    const response = await fetch(
      `${process.env.SERVER_URI || "http://localhost:8080"}/api/friends/requests/${userId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to send friend request: ${error}` },
      { status: 500 },
    );
  }
}
