import { app } from '../server/dist/app.js';

export default function handler(req, res) {
  try {
    return app(req, res);
  } catch (error) {
    console.error('API root error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Serverda xatolik yuz berdi: ' + (error && error.message ? error.message : String(error)) });
    }
  }
}
