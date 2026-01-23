// Timer Module
import { state } from './state.js';
import { saveData } from './storage.js';

// Optimization: Track working timers in a Set to avoid looping all tasks
const activeTimerIds = new Set();

export function toggleTimer(taskId, action) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (action === 'start') {
    task.isTracking = true;
    task.lastStartTime = Date.now();
    
    // Start Log
    if (!task.timeLogs) task.timeLogs = [];
    task.timeLogs.push({
      start: Date.now(),
      end: null
    });
    
    activeTimerIds.add(taskId);
  } else if (action === 'pause') {
    if (task.isTracking) {
      const now = Date.now();
      task.totalTime += now - task.lastStartTime;
      task.isTracking = false;
      task.lastStartTime = null;
      
      // End Log
      if (task.timeLogs && task.timeLogs.length > 0) {
        const lastLog = task.timeLogs[task.timeLogs.length - 1];
        if (!lastLog.end) {
          lastLog.end = now;
        }
      }
      
      activeTimerIds.delete(taskId);
    }
  }

  saveData();
  // UI update trigger will be handled by the main loop or reactive binding
}

export function getActiveTimerIds() {
  return activeTimerIds;
}

export function restoreActiveTimers() {
  // Call on load to repopulate the Set
  state.tasks.forEach(task => {
    if (task.isTracking) activeTimerIds.add(task.id);
  });
}

export function formatTime(ms) {
  if (!ms || isNaN(ms)) ms = 0;
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)));

  const pad = (num) => num.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
