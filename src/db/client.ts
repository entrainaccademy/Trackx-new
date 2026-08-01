import { Pool as PgPool } from "pg";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import fs from "fs";
import path from "path";

function normalizePostgresUrl(input?: string): string {
	if (!input) return "";
	let s = input.trim();
	const match = s.match(/(postgres(?:ql)?:\/\/[\w\-:@.%\/? ,=&+#]+)"?'?/i);
	if (s.startsWith("psql ") || match) {
		if (match && match[1]) return match[1];
		s = s.replace(/^psql\s+/, "").replace(/^[\'"]|[\'"]$/g, "");
	}
	return s;
}

function getDatabaseUrl(): string {
  let raw = process.env.PSQL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  
  if (!raw) {
    const envFiles = [".env.local", ".env", ".env.development"];
    for (const file of envFiles) {
      try {
        const fullPath = path.resolve(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf8");
          const match = content.match(/^\s*(?:PSQL|DATABASE_URL|NEON_DATABASE_URL)\s*=\s*(.*)$/m);
          if (match && match[1]) {
            raw = match[1].trim().replace(/^['"]|['"]$/g, "");
            break;
          }
        }
      } catch {}
    }
  }

  if (!raw) {
    raw = "postgresql://postgres:postgres@localhost:5432/trackx";
  }

  return raw;
}

const raw = getDatabaseUrl();
const url = normalizePostgresUrl(raw);

if (!url || !/^postgres(?:ql)?:\/\//i.test(url)) {
	throw new Error(
		`Invalid Postgres connection string. Set one of PSQL, DATABASE_URL, or NEON_DATABASE_URL to a value like postgresql://user:pass@host/db?sslmode=require. Got: ${raw ?? "<empty>"}`
	);
}

function sanitizeUrl(input: string): string {
	try {
		const u = new URL(input);
		u.searchParams.delete("sslmode");
		u.searchParams.delete("ssl");
		return u.toString();
	} catch {
		return input;
	}
}

const hostname = (() => {
	try {
		return new URL(url).hostname;
	} catch {
		return "";
	}
})();
const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
const isNeon = hostname.includes("neon.tech");

let clientDb: any;

if (isNeon) {
	const pool = new NeonPool({ connectionString: url });
	pool.on("error", (err: any) => {
		console.error("Unexpected Neon database pool error:", err.message || err);
	});
	clientDb = drizzleNeon(pool);
} else {
	const caPath = process.env.RDS_CA_BUNDLE_PATH || process.env.PGSSLROOTCERT;
	let ssl: false | { rejectUnauthorized?: boolean; ca?: string } = isLocal ? false : { rejectUnauthorized: false };
	if (!isLocal && caPath) {
		try {
			const ca = fs.readFileSync(caPath, "utf8");
			ssl = { ca, rejectUnauthorized: true };
		} catch {
			ssl = { rejectUnauthorized: false };
		}
	}

	const pool = new PgPool({
		connectionString: sanitizeUrl(url),
		ssl,
		max: Number(process.env.PG_MAX_POOL_SIZE || 10),
		idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 10000),
		connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 5000),
	});

	pool.on("error", (err) => {
		console.error("Unexpected Postgres database pool error:", err.message || err);
	});

	clientDb = drizzlePg(pool);
}

export const db = clientDb;


