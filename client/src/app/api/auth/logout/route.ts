// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    // Call your backend logout endpoint
    try {
      await fetch(`${process.env.BACKEND_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          Cookie: cookies().toString(),
        },
      });
    } catch (error) {
      console.error("Backend logout call failed:", error);
      // Continue with local cookie clearing even if backend call fails
    }

    // Create response
    const response = NextResponse.json(
      { success: true, message: "Logged out successfully" },
      { status: 200 },
    );

    // Clear auth_token cookie
    response.cookies.delete("auth_token");
    // Clear refresh_token cookie
    response.cookies.delete("refresh_token");

    return response;
  } catch (error) {
    console.error("Logout failed:", error);

    return NextResponse.json(
      { success: false, message: "Failed to logout" },
      { status: 500 },
    );
  }
}
