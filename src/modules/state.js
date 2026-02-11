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

export const RECURRENCE_TYPES = ['none', 'daily', 'weekly', 'monthly'];

export function normalizeTaskSubtasks(subtasks) {
  if (!Array.isArray(subtasks)) return [];

  return subtasks
    .map(subtask => {
      const text = typeof subtask?.text === 'string' ? subtask.text.trim() : '';
      if (!text) return null;

      return {
        id: subtask.id || generateId(),
        text,
        done: Boolean(subtask.done)
      };
    })
    .filter(Boolean);
}

export function normalizeTaskRecurrence(task) {
  const recurrenceType = RECURRENCE_TYPES.includes(task.recurrenceType) ? task.recurrenceType : 'none';
  const parsedInterval = Number.parseInt(task.recurrenceInterval, 10);
  const recurrenceInterval = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 1;
  const recurrenceEnd = recurrenceType === 'none' ? null : (task.recurrenceEnd || null);

  return {
    recurrenceType,
    recurrenceInterval,
    recurrenceEnd
  };
}

export function createNextRecurringTask(task) {
  const recurrence = normalizeTaskRecurrence(task);
  if (recurrence.recurrenceType === 'none') return null;

  const baseDate = task.dueDate ? new Date(task.dueDate) : new Date();
  if (!Number.isFinite(baseDate.getTime())) return null;

  const nextDueDate = new Date(baseDate);
  const interval = recurrence.recurrenceInterval;

  if (recurrence.recurrenceType === 'daily') {
    nextDueDate.setDate(nextDueDate.getDate() + interval);
  } else if (recurrence.recurrenceType === 'weekly') {
    nextDueDate.setDate(nextDueDate.getDate() + (7 * interval));
  } else if (recurrence.recurrenceType === 'monthly') {
    nextDueDate.setMonth(nextDueDate.getMonth() + interval);
  }

  if (recurrence.recurrenceEnd) {
    const recurrenceEnd = new Date(recurrence.recurrenceEnd);
    recurrenceEnd.setHours(23, 59, 59, 999);
    if (nextDueDate > recurrenceEnd) {
      return null;
    }
  }

  return {
    ...task,
    id: generateId(),
    status: 'todo',
    createdAt: new Date().toISOString(),
    dueDate: nextDueDate.toISOString().slice(0, 10),
    totalTime: 0,
    isTracking: false,
    lastStartTime: null,
    timeLogs: [],
    memoSessions: [],
    activeMemoSession: null,
    subtasks: normalizeTaskSubtasks(task.subtasks).map(subtask => ({
      id: generateId(),
      text: subtask.text,
      done: false
    }))
  };
}

// Simple ID generator
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
