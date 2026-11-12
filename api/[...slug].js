import { parse as parseQuery } from 'node:querystring';
import { app } from '../server/dist/app.js';

export default function handler(req, res) {
  try {
    if (req.query && req.query.slug) {
      const slugPath = Array.isArray(req.query.slug) ? req.query.slug.join('/') : req.query.slug;
      const query = new URL(req.url, 'http://localhost').searchParams;
      query.delete('slug');
      const search = query.toString();
      // Vercel pre-populates req.query; Express otherwise retains the old value.
      req.query = parseQuery(search);
      req.url = '/api/' + slugPath + (search ? '?' + search : '');
    }
    return app(req, res);
  } catch (error) {
    console.error('API catch-all error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
    }
  }
}
