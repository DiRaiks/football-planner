import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../src/lib/password.js';

const legacyHash = (password: string) => {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');
  return { hash, salt };
};

describe('password', () => {
  it('hashes with scrypt and a random salt', async () => {
    const first = await hashPassword('secret-password');
    const second = await hashPassword('secret-password');

    expect(first).toMatch(/^scrypt\$32768\$8\$3\$/);
    expect(first).not.toBe(second);
  });

  it('verifies a scrypt hash', async () => {
    const hash = await hashPassword('secret-password');

    expect(await verifyPassword('secret-password', { hash })).toEqual({
      ok: true,
      needsRehash: false,
    });
    expect((await verifyPassword('wrong-password', { hash })).ok).toBe(false);
  });

  it('verifies a legacy PBKDF2 hash and asks for a rehash', async () => {
    const stored = legacyHash('old-password');

    expect(await verifyPassword('old-password', stored)).toEqual({
      ok: true,
      needsRehash: true,
    });
    expect(await verifyPassword('wrong', stored)).toEqual({
      ok: false,
      needsRehash: false,
    });
  });

  it('rejects malformed hashes', async () => {
    expect((await verifyPassword('x', { hash: 'scrypt$broken' })).ok).toBe(
      false,
    );
    expect((await verifyPassword('x', { hash: 'abcdef' })).ok).toBe(false);
  });
});
