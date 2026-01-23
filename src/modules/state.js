// State Management Module

export const state = {
  tasks: [],
  history: [],
  viewedTaskId: null, // For UI tracking
  draggedTask: null   // For Drag & Drop
};

// Simple ID generator
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
