import { setPassword } from '../src/modules/auth/routes.ts';

describe('setPassword', () => {
  it('returns hash and salt', () => {
    const { hash, salt } = setPassword('secret');
    expect(hash.length).toBeGreaterThan(0);
    expect(salt.length).toBeGreaterThan(0);
  });

  it('generates different salts', () => {
    const first = setPassword('secret');
    const second = setPassword('secret');
    expect(first.salt).not.toBe(second.salt);
  });
});
