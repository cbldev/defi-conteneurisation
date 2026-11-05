import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

async function fixture(t) {
  let pseudo = null;
  let unavailable = false;
  const check = () => {
    if (unavailable) throw new Error('secret-database-url');
  };
  const db = {
    async read() { check(); return pseudo; },
    async save(value) { check(); pseudo ??= value; },
    async health() { check(); }
  };
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    request: (path = '/', options) => fetch(url + path, options),
    post: pseudo => fetch(url + '/', {
      method: 'POST', redirect: 'manual',
      body: new URLSearchParams({ pseudo })
    }),
    fail: () => { unavailable = true; }
  };
}

test('formulaire, enregistrement nettoyé et premier pseudo conservé', async t => {
  const f = await fixture(t);
  const initial = await f.request();
  assert.equal(initial.status, 200);
  assert.match(await initial.text(), /<form/);
  const response = await f.post(' Ada ');
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/');
  await f.post('Autre');
  const html = await (await f.request()).text();
  assert.match(html, /Bonjour Ada/);
  assert.doesNotMatch(html, /<form/);
});

test('validation du pseudo vide, trop long et caractères Unicode', async t => {
  const f = await fixture(t);
  for (const value of ['', '   ', 'a'.repeat(51)]) {
    const response = await f.post(value);
    assert.equal(response.status, 400);
    assert.match(await response.text(), /1 à 50/);
  }
  assert.equal((await f.post('😀'.repeat(50))).status, 303);
});

test('le pseudo HTML est affiché comme du texte', async t => {
  const f = await fixture(t);
  await f.post('<script>alert(1)</script>');
  const html = await (await f.request()).text();
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('santé recalculée et erreurs sans divulgation', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/health')).status, 200);
  f.fail();
  for (const path of ['/health', '/']) {
    const response = await f.request(path);
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /secret-database-url/);
  }
  assert.equal((await f.post('Ada')).status, 503);
});
