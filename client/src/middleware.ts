// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Get access and refresh tokens from cookies
  const accessToken = request.cookies.get("auth_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  // This can directly call api backend instead of using route
  // If we have no access token but do have a refresh token, try refreshing
  if (!accessToken && refreshToken) {
    try {
      console.log(
        "[Middleware] Found refresh token:",
        refreshToken.substring(0, 10) + "...",
      );

      // Create URL for the refresh endpoint
      const url = new URL("/api/auth/refresh", request.url);
      console.log(
        "[Middleware] Attempting to refresh token at:",
        url.toString(),
      );

      // Pass the refresh token in the request body
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log("[Middleware] Token refreshed successfully");

          // Clone the response to modify headers
          const nextResponse = NextResponse.next();

          // Forward any Set-Cookie headers from the refresh response
          const setCookieHeader = response.headers.get("set-cookie");
          if (setCookieHeader) {
            console.log(
              "[Middleware] Forwarding cookies from refresh response",
            );
            nextResponse.headers.set("set-cookie", setCookieHeader);
          }

          return nextResponse;
        } else {
          console.log("[Middleware] Token refresh failed:", data.message);
        }
      } else {
        console.log(
          "[Middleware] Token refresh request failed with status:",
          response.status,
        );
      }
    } catch (error) {
      console.error("[Middleware] Token refresh failed:", error);
    }
  }

  // Continue with the request (either we have a valid token, refresh succeeded, or refresh failed)
  return NextResponse.next();
}

// Only run this middleware on pages that require authentication
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
