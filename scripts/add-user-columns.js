require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function getDatabaseUrl() {
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
  return raw || "postgresql://postgres:postgres@localhost:5432/trackx";
}

function normalizePostgresUrl(input) {
  if (!input) return "";
  let s = input.trim();
  const match = s.match(/(postgres(?:ql)?:\/\/[\w\-:@.%\/? ,=&+#]+)"?'?/i);
  if (s.startsWith("psql ") || match) {
    if (match && match[1]) return match[1];
    s = s.replace(/^psql\s+/, "").replace(/^[\'"]|[\'"]$/g, "");
  }
  return s;
}

function sanitizeUrl(input) {
  try {
    const u = new URL(input);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    return u.toString();
  } catch {
    return input;
  }
}

(async () => {
  try {
    const raw = getDatabaseUrl();
    const url = normalizePostgresUrl(raw);
    console.log('Connecting to database URL...');
    const hostname = (() => {
      try { return new URL(url).hostname; } catch { return ""; }
    })();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

    const pool = new Pool({
      connectionString: sanitizeUrl(url),
      ssl: isLocal ? false : { rejectUnauthorized: false },
    });

    console.log('Running ALTER TABLE commands to add phone, department, status columns if missing...');

    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone varchar(32);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department varchar(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'Active';
    `);

    console.log('✅ Successfully added phone, department, and status columns to users table!');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
})();
