import assert from 'node:assert/strict';
import test from 'node:test';
import { expiredSessionCookies } from './session-cookies.ts';

test('expires each cookie name and never echoes the value', () => {
  const headers = expiredSessionCookies('session=secret-token; theme=ink');
  assert.deepEqual(headers, [
    'session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    'theme=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
  ]);
  assert.equal(headers.join('\n').includes('secret'), false);
});

test('drops duplicate names and names that could inject a header', () => {
  const headers = expiredSessionCookies('ok=1; ok=2; bad name=1; a\r\nSet-Cookie=b=1; =novalue');
  assert.deepEqual(headers, ['ok=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax']);
});

test('empty cookie header expires nothing', () => {
  assert.deepEqual(expiredSessionCookies(''), []);
});
