import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const token = (await cookies()).get("auth_token")?.value;
    // Forward the request to your Go backend
    const response = await fetch(
      `${process.env.SERVERURI || "http://localhost:8080"}/api/friends`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await response.json();

    // Return the response from your Go backend
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get friends :(" },
      { status: 500 },
    );
  }
}
