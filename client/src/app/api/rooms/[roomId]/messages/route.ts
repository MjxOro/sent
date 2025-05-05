import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const offset = request.nextUrl.searchParams.get("offset") || "0";
    const limit = request.nextUrl.searchParams.get("limit") || "20";
    const token = (await cookies()).get("auth_token")?.value;
    const response = await fetch(
      `${process.env.SERVER_URI || "http://localhost:8080"}/api/rooms/${roomId}/messages?offset=${offset}&limit=${limit}`,
      {
        method: "GET",
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
      { error: `Failed to get rooms: ${error}` },
      { status: 500 },
    );
  }
}
