// src/app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Get the refresh token from cookies
    const body = await request.json();
    const refreshToken = body.refreshToken;

    if (!refreshToken) {
      console.log("no tokens");
      return NextResponse.json(
        { success: false, message: "Failed to fetch cookies" },
        { status: 401 },
      );
    }
    console.log("Refresh token found, sending to backend...");

    // Send the refresh token to your backend
    // Replace with your actual backend refresh endpoint
    // const response = await fetch(`${process.env.BACKEND_URL}/auth/refresh`, {
    const response = await fetch(`http://backend:8080/api/auth/refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    // If the backend responds with an error (refresh token invalid or expired)
    if (!response.ok) {
      console.log("Backend rejected refresh token, clearing cookies");

      // Create a response that clears the refresh_token cookie
      const clearResponse = NextResponse.json(
        { success: false, message: "Refresh token invalid or expired" },
        { status: 401 },
      );

      // Clear the refresh token cookie
      // clearResponse.cookies.delete("refresh_token");

      return clearResponse;
    }

    // Backend accepted the refresh token and provided a new auth token
    // The backend should have set the new auth_token cookie directly
    // We just need to pass that cookie back to the client

    console.log("Token refresh successful");

    // Get the response data from the backend
    const data = await response.json();
    console.log(data);

    // Create a response
    const successResponse = NextResponse.json(
      { success: true, message: "Token refreshed successfully" },
      { status: 200 },
    );

    // If your backend doesn't set cookies directly, you can set them here
    // Uncomment this if you need to manually set the auth_token cookie
    if (data.auth_token) {
      successResponse.cookies.set({
        name: "auth_token",
        value: data.auth_token,
        httpOnly: true,
        secure: true,
        maxAge: 3600 * 24,
        path: "/",
      });
    }

    return successResponse;
  } catch (error) {
    console.error("Token refresh failed:", error);

    return NextResponse.json(
      { success: false, message: "Failed to refresh token" },
      { status: 500 },
    );
  }
}
