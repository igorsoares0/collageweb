import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Basic Auth over the whole editor. Two audiences share this deployment:
// the mobile app, which reads /api/* anonymously (it has no login), and the
// designer, who gets everything else — pages and API writes — behind
// EDITOR_USER/EDITOR_PASSWORD. Enforcing here (and not per page) means a
// request that skips the UI and hits the API directly is equally blocked.
//
// Local dev without the env vars stays open; anywhere else the absence of
// credentials fails closed, so a production deploy can never be writable
// by accident.

const PUBLIC_API_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/// Constant-time credential check: comparing digests instead of strings
/// equalises lengths, so timingSafeEqual never throws and never leaks how
/// much of the password matched.
function authorized(request: NextRequest): boolean {
  const user = process.env.EDITOR_USER;
  const password = process.env.EDITOR_PASSWORD;
  if (!user || !password) return false;
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return false;
  }
  const digest = (value: string) =>
    createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(decoded), digest(`${user}:${password}`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/") && PUBLIC_API_METHODS.has(request.method)) {
    return NextResponse.next();
  }
  const configured =
    process.env.EDITOR_USER && process.env.EDITOR_PASSWORD;
  if (!configured && process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }
  if (authorized(request)) {
    return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    // Prompts the browser's native login dialog; it then re-sends the
    // credentials on every same-origin request, editor saves included.
    headers: {
      "WWW-Authenticate": 'Basic realm="Collage Studio editor", charset="UTF-8"',
    },
  });
}

export const config = {
  // Static chunks and image optimisation stay open — the page HTML that
  // uses them is what carries the secrets, and that is gated above.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
