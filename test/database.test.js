import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { createDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';

const url = process.env.TEST_DATABASE_URL;
test('PostgreSQL 17 : initialisation, concurrence, HTTP et reconnexion', {
  skip: !url && 'TEST_DATABASE_URL requis (base dédiée)'
}, async t => {
  const admin = new Pool({ connectionString: url, connectionTimeoutMillis: 2000 });
  t.after(() => admin.end());
  const version = await admin.query('SHOW server_version_num');
  assert.equal(Math.floor(Number(version.rows[0].server_version_num) / 10000), 17);
  // Base de test jetable seulement : cette table est supprimée.
  await admin.query('DROP TABLE IF EXISTS nickname');
  let db = createDatabase(url);
  t.after(() => db.close());
  await db.initialize();
  await db.initialize();
  assert.equal(await db.read(), null);
  await db.health();
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.match(await (await fetch(base)).text(), /<form/);
  const response = await fetch(base, {
    method: 'POST', redirect: 'manual', body: new URLSearchParams({ pseudo: 'Ada' })
  });
  assert.equal(response.status, 303);
  await Promise.all([db.save('Grace'), db.save('Linus')]);
  assert.match(await (await fetch(base)).text(), /Bonjour Ada/);
  assert.equal((await fetch(base + '/health')).status, 200);
  const count = await admin.query('SELECT count(*)::int AS count FROM nickname');
  assert.equal(count.rows[0].count, 1);
  await db.close();
  assert.equal((await fetch(base + '/health')).status, 503);
  db = createDatabase(url);
  await db.initialize();
  assert.equal(await db.read(), 'Ada');

  await admin.query('TRUNCATE nickname');
  await Promise.all([db.save('Ada'), db.save('Grace')]);
  assert.ok(['Ada', 'Grace'].includes(await db.read()));
  const concurrent = await admin.query('SELECT count(*)::int AS count FROM nickname');
  assert.equal(concurrent.rows[0].count, 1);

  await admin.query('TRUNCATE nickname');
  const sql = "'; DROP TABLE nickname; --";
  await db.save(sql);
  assert.equal(await db.read(), sql);
});
