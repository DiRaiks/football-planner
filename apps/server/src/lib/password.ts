import {
  pbkdf2,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;
const pbkdf2Async = promisify(pbkdf2);

// OWASP-recommended scrypt profile with a moderate memory footprint (~32 MiB per hash)
const SCRYPT = { N: 2 ** 15, r: 8, p: 3, keylen: 64, maxmem: 64 * 1024 * 1024 };
const PREFIX = 'scrypt';

// Legacy format: hex PBKDF2-SHA512, 10k iterations, 512-byte key, separate salt field
const LEGACY_PBKDF2 = { iterations: 10000, keylen: 512, digest: 'sha512' };

export type StoredPassword = { hash: string; salt?: string | null };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const { N, r, p, keylen, maxmem } = SCRYPT;
  const key = await scryptAsync(password, salt, keylen, { N, r, p, maxmem });

  return [
    PREFIX,
    N,
    r,
    p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

const safeEqual = (a: Buffer, b: Buffer) =>
  a.length === b.length && timingSafeEqual(a, b);

/**
 * Verifies a password against both the current scrypt format and the legacy PBKDF2 one.
 * `needsRehash` is true when the stored hash should be upgraded to the current format.
 */
export async function verifyPassword(
  password: string,
  stored: StoredPassword,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (stored.hash.startsWith(`${PREFIX}$`)) {
    const [, n, r, p, salt, key] = stored.hash.split('$');
    if (!n || !r || !p || !salt || !key)
      return { ok: false, needsRehash: false };

    const expected = Buffer.from(key, 'base64');
    const actual = await scryptAsync(
      password,
      Buffer.from(salt, 'base64'),
      expected.length,
      {
        N: Number(n),
        r: Number(r),
        p: Number(p),
        maxmem: SCRYPT.maxmem,
      },
    );
    const needsRehash =
      Number(n) !== SCRYPT.N ||
      Number(r) !== SCRYPT.r ||
      Number(p) !== SCRYPT.p;

    return { ok: safeEqual(actual, expected), needsRehash };
  }

  if (!stored.salt) return { ok: false, needsRehash: false };

  const { iterations, keylen, digest } = LEGACY_PBKDF2;
  const actual = await pbkdf2Async(
    password,
    stored.salt,
    iterations,
    keylen,
    digest,
  );
  const ok = safeEqual(actual, Buffer.from(stored.hash, 'hex'));

  return { ok, needsRehash: ok };
}
