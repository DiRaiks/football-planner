import test from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

function setPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');
  return { hash, salt };
}

function validatePassword(password, user) {
  const hash = pbkdf2Sync(password, user.salt, 10000, 512, 'sha512').toString('hex');
  return user.hash === hash;
}

test('validatePassword accepts correct password', () => {
  const creds = setPassword('secret');
  assert.ok(validatePassword('secret', creds));
});

test('validatePassword rejects wrong password', () => {
  const creds = setPassword('secret');
  assert.equal(validatePassword('wrong', creds), false);
});
