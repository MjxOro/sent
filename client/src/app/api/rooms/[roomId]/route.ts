import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const token = (await cookies()).get("auth_token")?.value;
    const response = await fetch(
      `${process.env.SERVER_URI || "http://localhost:8080"}/api/rooms/${roomId}`,
      {
        method: "DELETE",
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
      { error: `Failed to delete rooms: ${error}` },
      { status: 500 },
    );
  }
}
