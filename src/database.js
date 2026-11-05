import { Pool } from 'pg';

export function createDatabase(connectionString) {
  if (!connectionString) throw new Error('DATABASE_URL est obligatoire.');
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 10000,
    statement_timeout: 2000,
    query_timeout: 3000
  });
  pool.on('error', () => console.error('Connexion PostgreSQL interrompue.'));
  return {
    async initialize() {
      await pool.query(`CREATE TABLE IF NOT EXISTS nickname (
        id integer PRIMARY KEY CHECK (id = 1),
        pseudo text NOT NULL CHECK (char_length(pseudo) BETWEEN 1 AND 50)
      )`);
    },
    async read() {
      const result = await pool.query('SELECT pseudo FROM nickname WHERE id = 1');
      return result.rows[0]?.pseudo ?? null;
    },
    async save(pseudo) {
      await pool.query('INSERT INTO nickname (id, pseudo) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', [pseudo]);
    },
    async health() { await pool.query('SELECT 1'); },
    async close() { await pool.end(); }
  };
}
