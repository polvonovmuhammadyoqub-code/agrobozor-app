import { app } from './app.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🌾 AgroBozor Server http://localhost:${PORT} portida ishga tushdi`);
});
