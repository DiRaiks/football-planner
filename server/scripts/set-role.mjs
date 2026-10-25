// Grants or revokes admin rights: node scripts/set-role.mjs <email> <admin|user>
// Reads MONGO_URI from the environment (e.g. `node --env-file=../.env scripts/set-role.mjs ...`).
import mongoose from 'mongoose';

const [email, role] = process.argv.slice(2);
if (!email || !['admin', 'user'].includes(role)) {
  console.error('Usage: node scripts/set-role.mjs <email> <admin|user>');
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is not set');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const result = await mongoose.connection.collection('users').updateOne(
  { email: email.trim() },
  // Revoke existing tokens so the role change applies immediately
  { $set: { role }, $inc: { tokenVersion: 1 } },
  { collation: { locale: 'en', strength: 2 } },
);
await mongoose.disconnect();

if (!result.matchedCount) {
  console.error(`User ${email} not found`);
  process.exit(1);
}
console.log(`User ${email} is now ${role}`);
