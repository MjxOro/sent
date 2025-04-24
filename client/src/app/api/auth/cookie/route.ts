// src/app/api/auth/cookie/route.ts
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    // Get cookies from the request
    const access_token = (await cookies()).get("auth_token")?.value;
    const { searchParams } = new URL(request.url);
    const purpose = searchParams.get("purpose");

    // Get the auth_token cookie

    if (!access_token) {
      return NextResponse.json(
        { authenticated: false, message: "No authentication token found" },
        { status: 401 },
      );
    }

    // Verify the token
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || process.env.NEXT_PUBLIC_JWT_SECRET || "secret",
    );

    const { payload } = await jwtVerify(access_token, secret);

    // Check token expiration
    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < currentTime) {
      return NextResponse.json(
        { authenticated: false, message: "Token expired" },
        { status: 401 },
      );
    }

    // Extract user data from payload
    const user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      roles: payload.roles || [],
      ...payload, // Include other fields
    };

    if (purpose === "token") {
      return NextResponse.json({ token: access_token });
    }
    // Return authenticated response
    return NextResponse.json(
      {
        authenticated: true,
        user,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Authentication verification failed:", error);

    return NextResponse.json(
      { authenticated: false, message: "Invalid authentication token" },
      { status: 401 },
    );
  }
}
