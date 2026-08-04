"use client";

import { useState, useEffect } from "react";

export function useTenant() {
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getTenantSubdomain = async () => {
      try {
        // Get the current hostname
        const hostname = window.location.hostname;
        
        // Extract subdomain from hostname
        if (hostname === "localhost" || hostname.endsWith(".localhost")) {
          // Development environment
          const parts = hostname.split(".");
          if (parts.length > 1 && parts[0] !== "localhost") {
            setSubdomain(parts[0]);
          } else {
            setSubdomain(null);
          }
        } else {
          // Production environment
          const platformSuffixes = [".vercel.app", ".now.sh", ".netlify.app", ".onrender.com", ".ngrok-free.app", ".ngrok.io", ".loca.lt"];
          let isPlatform = false;
          for (const suffix of platformSuffixes) {
            if (hostname.endsWith(suffix)) {
              isPlatform = true;
              const parts = hostname.split(".");
              if (parts.length <= 3) {
                setSubdomain(null);
              } else {
                const potentialSubdomain = parts[0];
                setSubdomain(potentialSubdomain && potentialSubdomain !== 'www' ? potentialSubdomain : null);
              }
              break;
            }
          }

          if (!isPlatform) {
            const parts = hostname.split(".");
            if (parts.length <= 2) {
              // example.com → no subdomain
              setSubdomain(null);
            } else {
              // For multi-level domains like tenant.wydex.co, take the left-most label as subdomain
              const potentialSubdomain = parts[0];
              // Treat 'www' as main domain (not a tenant)
              if (potentialSubdomain === 'www') {
                setSubdomain(null);
              } else {
                setSubdomain(potentialSubdomain || null);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error getting tenant subdomain:", error);
        setSubdomain(null);
      } finally {
        setLoading(false);
      }
    };

    getTenantSubdomain();
  }, []);

  return { subdomain, loading };
} 