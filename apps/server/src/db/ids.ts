import { randomBytes, randomInt } from 'node:crypto';

// Made like a MongoDB ObjectId: 4 bytes of seconds, 5 random bytes per process and a
// 3-byte counter. Ids keep their old form and still grow with time.
const processBytes = randomBytes(5);
let counter = randomInt(0xffffff);

/** A new id: 24 lowercase hex characters, like the ids moved over from MongoDB */
export const newId = (now = Date.now()) => {
  const bytes = Buffer.alloc(12);
  bytes.writeUInt32BE(Math.floor(now / 1000) >>> 0, 0);
  processBytes.copy(bytes, 4);
  counter = (counter + 1) % 0x1000000;
  bytes.writeUIntBE(counter, 9, 3);
  return bytes.toString('hex');
};
