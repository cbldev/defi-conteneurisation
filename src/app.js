import express from 'express';

const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = value => value.replace(/[&<>"']/g, char => entities[char]);

function page(pseudo, error = '') {
  const content = pseudo === null
    ? `<h1>Choisis un pseudo</h1>
       <p role="alert">${escape(error)}</p>
       <form method="post" action="/">
         <label for="pseudo">Pseudo (1 à 50 caractères)</label>
         <input id="pseudo" name="pseudo" required>
         <button type="submit">Enregistrer</button>
       </form>`
    : `<h1>Bonjour ${escape(pseudo)}</h1>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Défi conteneurisation</title></head><body><main>${content}</main></body></html>`;
}

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Content-Security-Policy', "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(express.urlencoded({ extended: false, limit: '4kb' }));
  app.get('/health', async (req, res) => {
    try {
      await db.health();
      res.status(200).json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
  app.get('/', async (req, res) => {
    res.type('html').send(page(await db.read()));
  });
  app.post('/', async (req, res) => {
    const pseudo = typeof req.body?.pseudo === 'string' ? req.body.pseudo.trim() : '';
    if ([...pseudo].length < 1 || [...pseudo].length > 50) {
      return res.status(400).type('html').send(page(null, 'Le pseudo doit contenir 1 à 50 caractères.'));
    }
    await db.save(pseudo);
    res.redirect(303, '/');
  });
  app.use((error, req, res, next) => {
    const status = error.status === 413 ? 413 : error.status === 400 ? 400 : 503;
    res.status(status).type('text').send(status === 503
      ? 'Service temporairement indisponible.' : 'Requête invalide.');
  });
  return app;
}
