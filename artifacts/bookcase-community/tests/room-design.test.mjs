import assert from 'node:assert/strict';
import test from 'node:test';
import { roomDesignChanged } from '../src/lib/room-design.ts';

const defaults = { wall: '#F6F4F0', floorId: 'pale' };

test('default room is unchanged, including a differently cased wall hex', () => {
  assert.equal(roomDesignChanged({ wall: '#F6F4F0', floorId: 'pale' }, defaults), false);
  assert.equal(roomDesignChanged({ wall: '#f6f4f0', floorId: 'pale' }, defaults), false);
});

test('a different wall or a custom wall counts as a room change', () => {
  assert.equal(roomDesignChanged({ wall: '#EBD3CF', floorId: 'pale' }, defaults), true);
  assert.equal(roomDesignChanged({ wall: '#112233', floorId: 'pale' }, defaults), true);
});

test('another floor, including a custom floor, counts as a room change', () => {
  assert.equal(roomDesignChanged({ wall: '#F6F4F0', floorId: 'walnut' }, defaults), true);
  assert.equal(roomDesignChanged({ wall: '#F6F4F0', floorId: 'custom' }, defaults), true);
});

test('a bookcase-only difference is not a room change', () => {
  // Size, finish, and shelf directions are not inputs. An unchanged room
  // stays hidden on the reset button even when the bookcase was edited.
  assert.equal(roomDesignChanged({ wall: '#F6F4F0', floorId: 'pale' }, defaults), false);
});
