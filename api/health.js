export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    message: 'AgroBozor Vercel Serverless API faol ishlamoqda',
    timestamp: new Date().toISOString(),
  });
}
