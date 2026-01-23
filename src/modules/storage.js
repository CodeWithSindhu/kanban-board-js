// Storage Module
import { state } from './state.js';

const TASKS_KEY = 'kanban-tasks';
const HISTORY_KEY = 'kanban-history';

export function loadData() {
  try {
    const loadedTasks = localStorage.getItem(TASKS_KEY);
    state.tasks = loadedTasks ? JSON.parse(loadedTasks) : [];
    
    // Migration: Ensure fields exist
    state.tasks = state.tasks.map(task => ({
      ...task,
      totalTime: task.totalTime || 0,
      isTracking: task.isTracking || false,
      lastStartTime: task.lastStartTime || null,
      timeLogs: task.timeLogs || [],
      // New Metadata Fields (Defaults)
      priority: task.priority || 'medium',
      dueDate: task.dueDate || null,
      tags: task.tags || []
    }));

  } catch (e) {
    console.error("Failed to load tasks:", e);
    state.tasks = [];
  }

  try {
    const loadedHistory = localStorage.getItem(HISTORY_KEY);
    state.history = loadedHistory ? JSON.parse(loadedHistory) : [];
  } catch (e) {
    console.error("Failed to load history:", e);
    state.history = [];
  }
}

export function saveData() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(state.tasks));
}

export function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
}

export function exportBoardData() {
  const data = {
    tasks: state.tasks,
    history: state.history,
    exportDate: new Date().toISOString(),
    version: '1.0'
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `kanban-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importBoardData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (data.tasks && Array.isArray(data.tasks)) {
      state.tasks = data.tasks;
      saveData();
    }
    if (data.history && Array.isArray(data.history)) {
      state.history = data.history;
      saveHistory();
    }
    return true;
  } catch (e) {
    console.error("Import failed:", e);
    return false;
  }
}
