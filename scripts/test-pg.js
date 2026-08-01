/* eslint-disable */
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
	try {
		const raw = process.env.DATABASE_URL || process.env.PSQL || process.env.NEON_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/trackx';
		console.log('DATABASE_URL present:', Boolean(process.env.DATABASE_URL || process.env.PSQL || process.env.NEON_DATABASE_URL));
		const url = raw.trim();
		const hostname = new URL(url).hostname;
		const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
		const pool = new Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
		const info = await pool.query('select current_database() as db, version() as ver, now() as now');
		console.log('Connected OK:', info.rows[0]);
		const reg = await pool.query("select to_regclass('public.tenants') as tenants, to_regclass('public.leads') as leads");
		console.log('Tables presence:', reg.rows[0]);
		await pool.end();
		process.exit(0);
	} catch (e) {
		console.error('PG error:', e);
		process.exit(1);
	}
})(); 