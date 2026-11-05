import { app } from '../server/dist/app.js';

export default function handler(req, res) {
  try {
    return app(req, res);
  } catch (error) {
    console.error('Unhandled Vercel API error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }
}
