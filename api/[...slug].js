import { app } from '../server/dist/app.js';

export default function handler(req, res) {
  try {
    if (req.query && req.query.slug) {
      const slugPath = Array.isArray(req.query.slug) ? req.query.slug.join('/') : req.query.slug;
      const urlParts = (req.url || '').split('?');
      const queryString = urlParts[1] ? '?' + urlParts[1] : '';
      req.url = '/api/' + slugPath + queryString;
    }
    return app(req, res);
  } catch (error) {
    console.error('API catch-all error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Serverda xatolik yuz berdi: ' + (error && error.message ? error.message : String(error)) });
    }
  }
}
