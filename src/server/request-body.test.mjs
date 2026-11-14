import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatch } from './dispatch.ts';
import { JSON_BODY_LIMIT, readBounded, readJsonObject } from './limited-body.ts';

function countingStream(chunkSize, chunks) {
  let sent = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (sent >= chunks) {
        controller.close();
        return;
      }
      sent += 1;
      controller.enqueue(new Uint8Array(chunkSize));
    },
  });
  return { stream, sent: () => sent };
}

test('a missing content-length still stops at the byte cap', async () => {
  const body = countingStream(50_000, 20);
  const request = new Request('http://local/upload', { method: 'PUT', body: body.stream, duplex: 'half' });
  assert.equal(await readBounded(request, 100_000), null);
  assert.ok(body.sent() < 20, `read ${body.sent()} chunks`);
});

test('a declared content-length over the cap does not buffer the stream', async () => {
  const body = countingStream(1024, 8);
  const request = new Request('http://local/upload', {
    method: 'PUT',
    body: body.stream,
    duplex: 'half',
    headers: { 'content-length': '100001' },
  });
  assert.equal(await readBounded(request, 100_000), null);
  assert.equal(request.bodyUsed, false);
  // Reading the header can prefetch one chunk inside the runtime. It must not drain the stream.
  assert.ok(body.sent() <= 1, `read ${body.sent()} chunks`);
});

test('a small content-length does not raise the cap', async () => {
  const body = countingStream(50_000, 20);
  const request = new Request('http://local/upload', {
    method: 'PUT',
    body: body.stream,
    duplex: 'half',
    headers: { 'content-length': '10' },
  });
  assert.equal(await readBounded(request, 100_000), null);
  assert.ok(body.sent() < 20, `read ${body.sent()} chunks`);
});

test('json objects under the cap parse, and empty, arrays, and oversize do not', async () => {
  const ok = new Request('http://local/builds', { method: 'POST', body: '{"title":"Oak"}' });
  assert.deepEqual(await readJsonObject(ok), { title: 'Oak' });

  const empty = new Request('http://local/builds', { method: 'POST', body: '' });
  assert.deepEqual(await readJsonObject(empty), {});

  const list = new Request('http://local/builds', { method: 'POST', body: '[1]' });
  assert.equal(await readJsonObject(list), null);

  const huge = new Request('http://local/builds', { method: 'POST', body: `{"a":"${'x'.repeat(JSON_BODY_LIMIT)}"}` });
  assert.equal(await readJsonObject(huge), null);
});

test('signed-out build and photo requests are rejected before the body is consumed', async () => {
  for (const [method, path] of [
    ['POST', ['builds']],
    ['PATCH', ['builds', '4']],
    ['PATCH', ['profiles', 'me']],
    ['POST', ['storage', 'uploads', 'request-url']],
    ['PUT', ['storage', 'uploads', 'raw', 'photo-1']],
  ]) {
    const body = countingStream(4096, 8);
    const request = new Request('http://local/api', { method, body: body.stream, duplex: 'half' });
    const response = await dispatch(method, request, path);
    assert.equal(response.status, 401, `${method} ${path.join('/')}`);
    assert.equal(request.bodyUsed, false, `${method} ${path.join('/')} consumed the body`);
    assert.ok(body.sent() <= 1, `${method} ${path.join('/')} read ${body.sent()} chunks`);
  }
});
