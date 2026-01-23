// History Module
import { state, generateId } from './state.js';
import { saveHistory } from './storage.js';

export function addToHistory(action, description, metadata = null) {
  const entry = {
    id: generateId(),
    action,
    description,
    metadata,
    timestamp: new Date().toISOString()
  };
  state.history.unshift(entry); // Add to beginning
  saveHistory();
}

export function clearHistory() {
  state.history = [];
  saveHistory();
}

export function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " mins ago";
  
  return Math.floor(seconds) + " seconds ago";
}
