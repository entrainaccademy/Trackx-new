require('dotenv').config();
const { Pool, neonConfig } = require('@neondatabase/serverless');

// Allow neonConfig fallback for node environment if needed
try {
  const ws = require('ws');
  neonConfig.webSocketConstructor = ws;
} catch {}

(async () => {
  try {
    const url = process.env.DATABASE_URL || process.env.PSQL || process.env.NEON_DATABASE_URL;
    console.log('Testing Neon driver with DATABASE_URL:', url ? url.replace(/:[^:@]+@/, ':***@') : 'none');
    
    const pool = new Pool({ connectionString: url });
    const res = await pool.query('SELECT NOW() as now, version() as version');
    console.log('✅ Connected via @neondatabase/serverless successfully!');
    console.log('Result:', res.rows[0]);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Neon driver error:', err.message || err);
    process.exit(1);
  }
})();
