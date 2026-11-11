import { app } from './app.js';
import { startScheduler } from './services/scheduler.js';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🌾 AgroBozor Server http://localhost:${PORT} portida ishga tushdi`);
  startScheduler();
});
