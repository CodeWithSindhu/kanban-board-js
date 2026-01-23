// Drag & Drop Module
import { state } from './state.js';
import { saveData } from './storage.js';
import { addToHistory } from './history.js';
import { toggleTimer } from './timer.js';
import { renderTasks } from './ui.js'; // Circular dependency warning: we will inject this dependence or move render to main

// We need a way to trigger rerenders. 
// Strategy: Export initDrag and let main pass the render callback or event bus.
let renderCallback = null;

export function initDragSystem(columns, renderCb) {
  renderCallback = renderCb;
  
  columns.forEach(column => {
    const container = column.querySelector('.tasks-container');

    column.addEventListener('dragover', (e) => handleDragOver(e, column, container));
    column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
    column.addEventListener('drop', (e) => handleDrop(e, column));
  });
}

function handleDragOver(e, column, container) {
  e.preventDefault();
  column.classList.add('drag-over');
  const afterElement = getDragAfterElement(container, e.clientY);
  const draggable = document.querySelector('.dragging');
  if (afterElement == null) {
    container.appendChild(draggable);
  } else {
    container.insertBefore(draggable, afterElement);
  }
}

function handleDrop(e, column) {
  e.preventDefault();
  column.classList.remove('drag-over');
  const status = column.dataset.status;
  const draggable = document.querySelector('.dragging');
  if (!draggable) return; // Touch drag edge case
  
  const id = draggable.dataset.id;
  const task = state.tasks.find(t => t.id === id);

  if (task && status === 'todo' && task.status !== 'todo') {
    alert("Tasks cannot be moved back to Todo once started!");
    if (renderCallback) renderCallback();
    return;
  }

  if (task && task.status !== status) {
    const oldStatus = task.status;
    task.status = status;
    
    // Auto-stop timer logic
    if ((status === 'done' || status === 'todo') && task.isTracking) {
      toggleTimer(task.id, 'pause');
      addToHistory('timer', `Auto-stopped timer for "${task.content}" (Moved to ${status})`);
    }

    // Confetti for Done
    if (status === 'done' && window.confetti) {
       window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }

    addToHistory('moved', `Moved "${task.content}" from ${oldStatus} to ${status}`, {
      from: oldStatus, to: status, task: task.content
    });
  }
  
  // FIX: Update Order based on DOM position
  updateTaskOrder();
  
  saveData();
  if (renderCallback) renderCallback();
}

function updateTaskOrder() {
  // Re-read the DOM to find the new order of IDs
  const newOrder = [];
  document.querySelectorAll('.column').forEach(col => {
    const status = col.dataset.status;
    const cards = col.querySelectorAll('.task-card');
    cards.forEach(card => {
       const id = card.dataset.id;
       // Find task in state
       const task = state.tasks.find(t => t.id === id);
       if (task) {
         task.status = status; // Ensure status reflects column
         newOrder.push(task);
       }
    });
  });
  
  // Replace state.tasks with reordered list (preserving any missing tasks safely?)
  // Better: We just used the DOM to rebuild the array.
  // Assuming all tasks are on board.
  state.tasks = newOrder;
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}
