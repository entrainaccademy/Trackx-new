import "dotenv/config";
import type { Config } from "drizzle-kit";

// Normalize connection string and ensure SSL params are included for non-local connections
function getConnectionUrl(): string {
  const raw = process.env.PSQL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/trackx";

  
  let url = raw.trim();
  // Handle values like: psql 'postgresql://user:pass@host/db?sslmode=require'
  const match = url.match(/(postgres(?:ql)?:\/\/[\w\-:@.%\/? ,=&+#]+)"?'?/i);
  if (url.startsWith("psql ") || match) {
    if (match && match[1]) url = match[1];
    else url = url.replace(/^psql\s+/, "").replace(/^[\'"]|[\'"]$/g, "");
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    
    // For non-local connections, ensure SSL mode is set if not already present
    if (!isLocal && !parsed.searchParams.has("sslmode") && !parsed.searchParams.has("ssl")) {
      parsed.searchParams.set("sslmode", "require");
    }
    
    return parsed.toString();
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getConnectionUrl(),
  },
  strict: true,
} satisfies Config;


