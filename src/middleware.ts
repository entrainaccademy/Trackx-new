import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

function extractSubdomain(host?: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  // Handle IPs
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
  // Handle localhost and *.localhost during development
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  if (hostname.endsWith(".localhost")) {
    const left = hostname.slice(0, -".localhost".length);
    const label = left.split(".")[0];
    return label && label !== "localhost" && label !== "www" ? label : null;
  }

  // Handle platform app domains (e.g. *.vercel.app, *.now.sh, *.netlify.app, *.onrender.com, *.ngrok-free.app, *.ngrok.io, *.loca.lt)
  const platformSuffixes = [".vercel.app", ".now.sh", ".netlify.app", ".onrender.com", ".ngrok-free.app", ".ngrok.io", ".loca.lt"];
  for (const suffix of platformSuffixes) {
    if (hostname.endsWith(suffix)) {
      const parts = hostname.split(".");
      // E.g. trackx-new.vercel.app has 3 parts. Platform root app domain has 3 labels -> return null.
      // E.g. tenant1.trackx-new.vercel.app has 4 parts -> return "tenant1".
      if (parts.length <= 3) return null;
      const potentialSubdomain = parts[0];
      return potentialSubdomain && potentialSubdomain !== 'www' ? potentialSubdomain : null;
    }
  }

  const parts = hostname.split(".");
  if (parts.length <= 2) return null; // example.com → no subdomain
  // For multi-level domains like app.staging.example.com take the left-most label as subdomain
  const potentialSubdomain = parts[0];
  // Treat 'www' as main domain (not a tenant)
  if (potentialSubdomain === 'www') return null;
  return potentialSubdomain || null;
}

export default clerkMiddleware((auth, req: NextRequest) => {
  const url = req.nextUrl.clone();
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const subdomain = extractSubdomain(host);

  // Public routes that should not require authentication
  const publicRoutes = ['/login', '/signup', '/onboarding', '/accept-invitation'];
  const isPublicRoute = publicRoutes.some(route => url.pathname.startsWith(route));

  // Allow public routes to pass through without authentication checks
  if (isPublicRoute) {
    const requestHeaders = new Headers(req.headers);
    if (subdomain) requestHeaders.set("x-tenant-subdomain", subdomain);
    requestHeaders.set("x-resolved-host", host || "");
    requestHeaders.set("x-resolved-path", url.pathname);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  const requestHeaders = new Headers(req.headers);
  if (subdomain) requestHeaders.set("x-tenant-subdomain", subdomain);
  requestHeaders.set("x-resolved-host", host || "");
  requestHeaders.set("x-resolved-path", url.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
