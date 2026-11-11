import { releaseExpiredOrders, autoCompleteDelivered } from '../routes/orders.js';

let intervalId: NodeJS.Timeout | null = null;

export function startScheduler(intervalMs = 60000) {
  if (intervalId) return;

  const runTasks = async () => {
    try {
      await releaseExpiredOrders();
      await autoCompleteDelivered();
    } catch (err) {
      console.error('Scheduler task execution error:', err);
    }
  };

  // Birinchi marta server ishga tushganda ham darhol tekshirib olamiz
  runTasks();

  // Har 60 soniyada fon vazifasi sifatida davriy ishlaydi
  intervalId = setInterval(runTasks, intervalMs);
  if (intervalId.unref) {
    intervalId.unref(); // Jarayon to'xtaganda bloklamaydi
  }

  console.log(`⏱️ Fon vazifalari (Scheduler) har ${Math.round(intervalMs / 1000)} soniyada faollashtirildi`);
}

export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
