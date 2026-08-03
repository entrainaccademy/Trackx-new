/**
 * Utility functions for tenant URL construction
 * Handles both localhost (development) and production domains
 */

/**
 * Check if we're running in localhost/development environment
 */
export function isLocalhost(): boolean {
  if (typeof window === 'undefined') {
    // Server-side: check environment variable
    return process.env.NODE_ENV === 'development' || 
           process.env.NEXT_PUBLIC_ENV === 'development';
  }
  
  // Client-side: check hostname
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('.localhost') ||
    hostname.startsWith('localhost:') ||
    hostname.startsWith('127.0.0.1:')
  );
}

/**
 * Get the base domain for tenant URLs
 */
export function getBaseDomain(): string {
  if (isLocalhost()) {
    // Use the current port from window.location if available
    const port = typeof window !== 'undefined' ? window.location.port : '3000';
    return `localhost:${port}`;
  }
  return 'wydex.co';
}

/**
 * Construct tenant subdomain URL
 * @param subdomain - The tenant subdomain
 * @param path - Optional path (default: '/team-leader')
 * @returns Full URL to tenant subdomain
 */
export function getTenantUrl(subdomain: string, path: string = '/team-leader'): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;

    // Localhost development
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) {
      return `${protocol}//localhost${port}${path}`;
    }

    // Vercel preview/app domains (*.vercel.app)
    if (hostname.endsWith('.vercel.app')) {
      return `${protocol}//${window.location.host}${path}`;
    }

    // Custom production domain with wildcard DNS (wydex.co)
    if (subdomain && hostname.includes('wydex.co')) {
      return `${protocol}//${subdomain}.wydex.co${path}`;
    }

    // Fallback to current host
    return `${protocol}//${window.location.host}${path}`;
  }

  // Server-side fallback
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}${path}`;
  }

  return path;
}

/**
 * Get the current port (useful for localhost URLs)
 */
export function getCurrentPort(): string {
  if (typeof window === 'undefined') {
    return process.env.PORT || '3000';
  }
  return window.location.port || '3000';
}


