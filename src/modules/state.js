// State Management Module

export const state = {
  tasks: [],
  history: [],
  activeMemoDraftTaskId: null,
  viewedTaskId: null, // For UI tracking
  draggedTask: null,  // For Drag & Drop
  wipLimits: {
    todo: 5,
    progress: 3,
    'on-hold': 3,
    done: 10
  },
  filters: {
    search: '',
    priority: 'all',
    tag: 'all',
    status: 'all',
    dueDate: 'all',
    sortDueDate: 'none'
  }
};

// Simple ID generator
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
