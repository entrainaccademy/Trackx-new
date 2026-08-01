const dns = require("dns");
const tls = require("tls");
require("dotenv").config();

const uri = process.env.MONGODB_URI;
console.log("Testing MongoDB URI:", uri ? uri.replace(/:[^:@]+@/, ":***@") : "None");

if (!uri) {
  console.error("No MONGODB_URI found");
  process.exit(1);
}

const match = uri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)/);
if (!match) {
  console.error("Invalid srv uri format");
  process.exit(1);
}

const host = match[3];
console.log("Resolving SRV records for:", host);

dns.resolveSrv(`_mongodb._tcp.${host}`, (err, addresses) => {
  if (err) {
    console.error("DNS SRV resolution error:", err.message);
    process.exit(1);
  }
  console.log("Found MongoDB cluster nodes:", addresses);
  const target = addresses[0];
  if (!target) {
    console.error("No nodes found");
    process.exit(1);
  }

  console.log(`Testing TLS connection to ${target.name}:${target.port}...`);
  const socket = tls.connect(target.port, target.name, { servername: target.name }, () => {
    console.log(`✅ Connection to MongoDB host ${target.name}:${target.port} successful!`);
    socket.end();
    process.exit(0);
  });

  socket.on("error", (connErr) => {
    console.error("❌ TLS Connection Error:", connErr.message);
    process.exit(1);
  });
});
