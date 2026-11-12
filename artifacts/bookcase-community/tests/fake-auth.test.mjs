import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeAuthAllowed, resolveFakeAuth } from '../src/lib/fake-auth.ts';

test('fake auth is only allowed on loopback hosts', () => {
  assert.equal(fakeAuthAllowed('localhost'), true);
  assert.equal(fakeAuthAllowed('127.0.0.1'), true);
  assert.equal(fakeAuthAllowed('story-bookcase.replit.app'), false);
  assert.equal(fakeAuthAllowed('imaginemode.com'), false);
  assert.equal(fakeAuthAllowed(''), false);
});

test('query param wins over the stored flag, and off-loopback stays off', () => {
  assert.equal(resolveFakeAuth('?fakeAuth=1', false, true), true);
  assert.equal(resolveFakeAuth('?fakeAuth=true', false, true), true);
  assert.equal(resolveFakeAuth('?fakeAuth=0', true, true), false);
  assert.equal(resolveFakeAuth('?fakeAuth=false', true, true), false);
  assert.equal(resolveFakeAuth('', true, true), true);
  assert.equal(resolveFakeAuth('?q=oak', false, true), false);
  assert.equal(resolveFakeAuth('?fakeAuth=1', false, false), false);
  assert.equal(resolveFakeAuth('?fakeAuth=1&share=photo', false, true), true);
});
