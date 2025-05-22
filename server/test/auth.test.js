import test from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

function setPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');
  return { hash, salt };
}

test('returns hash and salt', () => {
  const { hash, salt } = setPassword('secret');
  assert.ok(hash.length > 0);
  assert.ok(salt.length > 0);
});

test('generates different salts', () => {
  const first = setPassword('secret');
  const second = setPassword('secret');
  assert.notStrictEqual(first.salt, second.salt);
});
