// Main Entry Point
import { state } from './modules/state.js';
import { loadData } from './modules/storage.js';
import { setupEventListeners, renderTasks } from './modules/ui.js';
import { restoreActiveTimers, getActiveTimerIds, formatTime } from './modules/timer.js';
import { initDragSystem } from './modules/drag.js';

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  // 1. Load Data
  loadData();

  // 2. Restore active timers (for safety)
  restoreActiveTimers();

  // 3. Setup UI
  setupEventListeners();
  
  // 4. Initialize Drag & Drop
  const columns = document.querySelectorAll('.column');
  initDragSystem(columns, () => {
      // Callback after drag drop if needed (re-rendering is mostly handled inside drag module trigger)
      renderTasks();
  });

  // 5. Initial Render
  renderTasks();

  // 6. Global Timer Loop (Optimized)
  setInterval(() => {
    const activeIds = getActiveTimerIds();
    if (activeIds.size === 0) return;

    activeIds.forEach(id => {
      const task = state.tasks.find(t => t.id === id);
      if (task) {
        // Calculate new total
        const currentTotal = task.totalTime + (Date.now() - task.lastStartTime);
        
        // Update DOM directly
        const el = document.getElementById(`timer-${task.id}`);
        if (el) {
          // Keep inner structure
          // This string manipulation is slightly expensive but limited to active tasks only
          el.innerHTML = `<span class="recording-dot"></span> ${formatTime(currentTotal)}`;
        }
        
        // If viewing logs for this task, update that display too
        if (state.viewedTaskId === id) {
             const modalDisplay = document.querySelector('.total-time-display');
             if (modalDisplay) modalDisplay.innerText = formatTime(currentTotal);
        }
      }
    });
  }, 1000);
});
