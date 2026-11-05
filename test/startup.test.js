import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('absence de DATABASE_URL : échec explicite', () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  const result = spawnSync(process.execPath, ['src/server.js'], {
    env, encoding: 'utf8', timeout: 10000
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DATABASE_URL/);
});

test('configuration invalide : aucun secret affiché', () => {
  const result = spawnSync(process.execPath, ['src/server.js'], {
    env: { ...process.env, DATABASE_URL: 'postgresql://user:secret-test@127.0.0.1:1/nope' },
    encoding: 'utf8', timeout: 10000
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /initialiser/);
  assert.doesNotMatch(result.stderr + result.stdout, /secret-test/);
});
