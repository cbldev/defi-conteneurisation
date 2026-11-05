import { once } from 'node:events';
import { createApp } from './app.js';
import { createDatabase } from './database.js';

async function start() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL est obligatoire.');
    process.exitCode = 1;
    return;
  }
  let db;
  let server;
  try {
    db = createDatabase(process.env.DATABASE_URL);
    await db.initialize();
    server = createApp(db).listen(3000, '0.0.0.0');
    await once(server, 'listening');
  } catch {
    console.error('Impossible d’initialiser le service ; vérifier PostgreSQL et la configuration.');
    if (db) await db.close();
    process.exitCode = 1;
    return;
  }
  console.log('Application disponible sur le port 3000.');
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 8000);
    deadline.unref();
    server.close(async () => {
      try { await db.close(); }
      catch { process.exitCode = 1; }
      finally { clearTimeout(deadline); }
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

await start();
