// app/api/rooms/route.ts (Next.js App Router)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const token = (await cookies()).get("auth_token")?.value;
    const response = await fetch(
      `${process.env.SERVER_URI || "http://localhost:8080"}/api/rooms`,
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
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = (await cookies()).get("auth_token")?.value;
    const response = await fetch(
      `${process.env.SERVERURI || "http://localhost:8080"}/api/rooms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to create rooms: ${error}` },
      { status: 500 },
    );
  }
}
