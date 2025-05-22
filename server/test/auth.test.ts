import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPassword } from '../src/modules/auth/routes.ts';

test('setPassword returns hash and salt', () => {
  const { hash, salt } = setPassword('secret');
  assert.ok(hash.length > 0, 'hash should not be empty');
  assert.ok(salt.length > 0, 'salt should not be empty');
});

test('setPassword generates different salts', () => {
  const first = setPassword('secret');
  const second = setPassword('secret');
  assert.notStrictEqual(first.salt, second.salt, 'salts should be unique');
});
