require('dotenv').config({ path: '.env' });
const https = require('https');

const secretKey = process.env.CLERK_SECRET_KEY;
const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

console.log("Testing Clerk Keys:");
console.log("Publishable Key:", pubKey);
console.log("Secret Key:", secretKey ? secretKey.substring(0, 10) + "..." : "MISSING");

if (!secretKey) {
  console.error("CLERK_SECRET_KEY is missing in .env");
  process.exit(1);
}

const req = https.request({
  hostname: 'api.clerk.com',
  path: '/v1/instance',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log("API Status:", res.statusCode);
    try {
      const parsed = JSON.parse(data);
      if (res.statusCode === 200) {
        console.log("✅ Clerk Secret Key is VALID!");
        console.log("Instance ID:", parsed.id);
        console.log("Environment Type:", parsed.environment_type);
      } else {
        console.log("❌ Clerk API Error:", parsed);
      }
    } catch (e) {
      console.log("Raw Response:", data);
    }
  });
});

req.on('error', (e) => {
  console.error("Network Error:", e.message);
});

req.end();
