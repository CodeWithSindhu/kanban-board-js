// Simple ID generator to avoid external dependencies
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// State Management
let tasks = [];
let history = [];
let viewedTaskId = null;

try {
  tasks = JSON.parse(localStorage.getItem('kanban-tasks')) || [];
} catch (e) {
  console.error("Failed to load tasks:", e);
  tasks = [];
}

try {
  history = JSON.parse(localStorage.getItem('kanban-history')) || [];
} catch (e) {
  console.error("Failed to load history:", e);
  history = [];
}

// DOM Elements
const modal = document.getElementById('task-modal');
const modalTitle = document.getElementById('modal-title');
const taskForm = document.getElementById('task-form');
const taskDescInput = document.getElementById('task-desc');
const taskIdInput = document.getElementById('task-id');
const addTaskBtn = document.getElementById('add-task-btn');
const historyBtn = document.getElementById('history-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const cancelModalBtn = document.getElementById('cancel-modal');
const historyModal = document.getElementById('history-modal');
const closeHistoryBtn = document.getElementById('close-history');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const historyList = document.getElementById('history-list');
// Time Logs Modal Elements
const timeLogsModal = document.getElementById('time-logs-modal');
const timeLogsList = document.getElementById('time-logs-list');
const totalDurationContainer = document.getElementById('total-duration-container');
const closeLogsBtn = document.getElementById('close-logs-btn');

const columns = document.querySelectorAll('.column');
const containers = {
  todo: document.getElementById('todo-container'),
  progress: document.getElementById('progress-container'),
  'on-hold': document.getElementById('on-hold-container'),
  done: document.getElementById('done-container'),
};
const counts = {
  todo: document.querySelector('#todo-col .count'),
  progress: document.querySelector('#progress-col .count'),
  'on-hold': document.querySelector('#on-hold-col .count'),
  done: document.querySelector('#done-col .count'),
};

// Data Migration: Ensure all tasks have timer properties AND timeLogs
try {
  tasks = tasks.map(task => ({
    ...task,
    totalTime: task.totalTime || 0,
    isTracking: task.isTracking || false,
    lastStartTime: task.lastStartTime || null,
    timeLogs: task.timeLogs || [] // Add timeLogs array
  }));
  localStorage.setItem('kanban-tasks', JSON.stringify(tasks));
} catch (e) {
  console.error("Migration error:", e);
}

// Initial Render
try {
  renderTasks();
} catch (e) {
  console.error("Render error:", e);
  alert("There was an error loading your tasks. Please check the console or clear data.");
}
setInterval(updateActiveTimers, 1000); // Update active timers every second

// Event Listeners
addTaskBtn.addEventListener('click', () => openModal());
historyBtn.addEventListener('click', openHistoryModal);
closeHistoryBtn.addEventListener('click', closeHistoryModal);
clearHistoryBtn.addEventListener('click', clearHistory);
clearAllBtn.addEventListener('click', clearAllTasks);
cancelModalBtn.addEventListener('click', closeModal);
closeLogsBtn.addEventListener('click', closeTimeLogsModal); // New Listener

window.addEventListener('click', (e) => {
  // Modal Closing Logic
  if (e.target === modal) closeModal();
  if (e.target === historyModal) closeHistoryModal();
  if (e.target === timeLogsModal) closeTimeLogsModal();

  // Task Card Button Delegation
  const btn = e.target.closest('button');
  if (!btn) return;

  const card = btn.closest('.task-card');
  if (!card) return;

  const taskId = card.dataset.id;

  // Timer Controls
  if (btn.classList.contains('timer-btn')) {
    e.stopPropagation(); // prevent drag or other events
    const action = btn.dataset.action;
    window.toggleTimer(taskId, action);
  }

  // View Logs
  if (btn.classList.contains('view-logs-btn')) {
    e.stopPropagation();
    window.showTimeLogs(taskId);
  }
});

taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = taskIdInput.value;
  const description = taskDescInput.value.trim();

  if (!description) return;

  if (id) {
    // Edit existing task
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex > -1) {
      tasks[taskIndex].content = description;
    }
  } else {
    // Create new task
    const newTask = {
      id: generateId(),
      content: description,
      status: 'todo',
      createdAt: new Date().toISOString(),
      totalTime: 0,
      isTracking: false,
      lastStartTime: null,
      timeLogs: []
    };
    tasks.push(newTask);
    addToHistory('created', `Created task "${description}"`);
  }

  saveAndRender();
  closeModal();
});

// Drag and Drop Logic
let draggedTask = null;

columns.forEach(column => {
  const container = column.querySelector('.tasks-container');

  column.addEventListener('dragover', (e) => {
    e.preventDefault();
    column.classList.add('drag-over');
    const afterElement = getDragAfterElement(container, e.clientY);
    const draggable = document.querySelector('.dragging');
    if (afterElement == null) {
      container.appendChild(draggable);
    } else {
      container.insertBefore(draggable, afterElement);
    }
  });

  column.addEventListener('dragleave', () => {
    column.classList.remove('drag-over');
  });

  column.addEventListener('drop', (e) => {
    e.preventDefault();
    column.classList.remove('drag-over');
    const status = column.dataset.status;
    const draggable = document.querySelector('.dragging');
    const id = draggable.dataset.id;
    
    // Update task status
    const task = tasks.find(t => t.id === id);

    // Constraint: Cannot move back to Todo if already started
    if (task && status === 'todo' && task.status !== 'todo') {
      alert("Tasks cannot be moved back to Todo once started!");
      renderTasks(); // Re-render to reset visual state
      return;
    }

    if (task && task.status !== status) {
      const oldStatus = task.status;
      task.status = status;
      
      // Auto-stop timer logic
      if ((status === 'done' || status === 'todo') && task.isTracking) {
        window.toggleTimer(task.id, 'pause'); // Reuse pause logic to stop
        addToHistory('timer', `Auto-stopped timer for "${task.content}" (Moved to ${formatStatus(status)})`);
      }

      // Confetti for Done
      if (status === 'done') {
        if (window.confetti) {
          window.confetti({
             particleCount: 100,
             spread: 70,
             origin: { y: 0.6 }
          });
        }
      }

      addToHistory('moved', `Moved "${task.content}" from ${oldStatus} to ${status}`, {
        from: oldStatus,
        to: status,
        task: task.content
      });
      saveAndRender();
    }
  });
});

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

// Rendering Functions
function renderTasks() {
  // Clear containers
  Object.values(containers).forEach(c => c.innerHTML = '');
  
  // Reset counts
  Object.keys(counts).forEach(k => counts[k].innerText = '0');

  const taskCounts = { todo: 0, progress: 0, 'on-hold': 0, done: 0 };

  tasks.forEach(task => {
    // Safety check: Ensure status is valid
    if (!containers[task.status]) {
      console.warn(`Task ${task.id} has invalid status '${task.status}'. Defaulting to 'todo'.`);
      task.status = 'todo';
    }

    const card = createTaskCard(task);
    if (containers[task.status]) {
       containers[task.status].appendChild(card);
       taskCounts[task.status]++;
    }
    
    // Resume timer check logic handled by updateActiveTimers
  });

  // Check for empty columns
  Object.keys(containers).forEach(status => {
    if (containers[status].children.length === 0) {
      containers[status].appendChild(createEmptyState());
    }
  });

  // Update counts
  Object.keys(taskCounts).forEach(k => {
    if (counts[k]) counts[k].innerText = taskCounts[k];
  });
}

function createTaskCard(task) {
  const div = document.createElement('div');
  div.classList.add('task-card');
  div.setAttribute('draggable', 'true');
  div.dataset.id = task.id;

  let timerHtml = '';

  const viewLogsBtn = `
    <button class="view-logs-btn" title="View Time Logs">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
        <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
      </svg>
    </button>
  `;
  
  if (task.status !== 'todo' && task.status !== 'done') {
      const timerControls = !task.isTracking 
        ? `<button class="timer-btn start-btn" title="Start Timer" data-action="start">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
               <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
             </svg>
           </button>` 
        : `<button class="timer-btn pause-btn" title="Pause Timer" data-action="pause">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
               <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
             </svg>
           </button>`;

      timerHtml = `
        <div class="task-timer ${task.isTracking ? 'is-running' : ''}">
           <div class="timer-display" id="timer-${task.id}">
             ${task.isTracking ? '<span class="recording-dot"></span>' : ''}
             ${formatTime(task.totalTime + (task.isTracking ? Date.now() - task.lastStartTime : 0))}
           </div>
           <div class="timer-controls">
             ${timerControls}
             ${viewLogsBtn}
           </div>
        </div>
      `;
  }

  let extraActions = '';
  if (task.status === 'done') {
      extraActions = viewLogsBtn;
  }

  const editButtonHtml = task.status === 'done' ? '' : `
    <button class="edit-btn" aria-label="Edit">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
        <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
      </svg>
    </button>`;

  div.innerHTML = `
    <div class="task-content">${escapeHtml(task.content)}</div>
    ${timerHtml}
    <div class="task-meta">
      <span>${new Date(task.createdAt).toLocaleDateString()}</span>
      <div class="task-actions">
        ${extraActions}
        ${editButtonHtml}
        <button class="delete-btn" aria-label="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
            <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a.5.5 0 0 1-1-0V3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0-1h3A.5.5 0 0 1 11 2.5v.5h4a.5.5 0 0 1 .5.5zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // Drag Events
  div.addEventListener('dragstart', () => {
    div.classList.add('dragging');
    draggedTask = task;
  });

  div.addEventListener('dragend', () => {
    div.classList.remove('dragging');
    draggedTask = null;
  });

  // Action Buttons
  div.querySelector('.delete-btn').addEventListener('click', () => {
    if(confirm('Are you sure you want to delete this task?')) {
      addToHistory('deleted', `Deleted task "${task.content}"`);
      tasks = tasks.filter(t => t.id !== task.id);
      saveAndRender();
    }
  });

  const editBtn = div.querySelector('.edit-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      openModal(task);
    });
  }

  return div;
}

function createEmptyState() {
  const div = document.createElement('div');
  div.classList.add('empty-state');
  div.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
      <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
      <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
    </svg>
    <p>No tasks yet</p>
  `;
  return div;
}

// Helpers
function saveAndRender() {
  localStorage.setItem('kanban-tasks', JSON.stringify(tasks));
  renderTasks();
}

function openModal(task = null) {
  modal.classList.add('active');
  if (task) {
    modalTitle.innerText = 'Edit Task';
    taskIdInput.value = task.id;
    taskDescInput.value = task.content;
  } else {
    modalTitle.innerText = 'Add New Task';
    taskIdInput.value = '';
    taskDescInput.value = '';
  }
  taskDescInput.focus();
}

function closeModal() {
  modal.classList.remove('active');
}

function clearAllTasks() {
  if (confirm('Are you sure you want to clear all tasks? This action cannot be undone.')) {
    tasks = [];
    addToHistory('cleared', 'Cleared all tasks from board');
    saveAndRender();
  }
}

// History Functions
function addToHistory(action, description, metadata = null) {
  const entry = {
    id: generateId(),
    action,
    description,
    metadata,
    timestamp: new Date().toISOString()
  };
  history.unshift(entry); // Add to beginning
  saveHistory();
}

function saveHistory() {
  localStorage.setItem('kanban-history', JSON.stringify(history));
}

function openHistoryModal() {
  historyModal.classList.add('active');
  renderHistory();
}

function closeHistoryModal() {
  historyModal.classList.remove('active');
}

function clearHistory() {
  if(confirm('Clear entire activity log?')) {
    history = [];
    saveHistory();
    renderHistory();
  }
}

function formatStatus(status) {
  const map = {
    'todo': 'To Do',
    'progress': 'In Progress',
    'on-hold': 'On Hold',
    'done': 'Done'
  };
  return map[status] || status;
}

function renderHistory() {
  historyList.innerHTML = '';
  if (history.length === 0) {
    historyList.innerHTML = '<div class="empty-state"><p>No activity recorded yet</p></div>';
    return;
  }

  history.forEach(entry => {
    const item = document.createElement('div');
    item.classList.add('history-item');
    
    // Determine color class and icon based on action
    let actionClass = '';
    let iconSvg = '';
    
    switch(entry.action) {
      case 'created': 
        actionClass = 'action-created'; 
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>';
        break;
      case 'moved': 
        actionClass = 'action-moved'; 
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/></svg>';
        break;
      case 'deleted': 
        actionClass = 'action-deleted'; 
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a.5.5 0 0 1-1-0V3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0-1h3A.5.5 0 0 1 11 2.5v.5h4a.5.5 0 0 1 .5.5z"/></svg>';
        break;
      case 'timer': 
        actionClass = 'action-timer'; 
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>';
        break;
      default:
        actionClass = 'action-cleared';
        iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>';
    }
    
    // Add specific class to the item for icon styling
    item.classList.add(actionClass);

    const timeAgoStr = timeAgo(new Date(entry.timestamp));
    
    let contentHtml = escapeHtml(entry.description);
    
    // Rich rendering for moves
    if (entry.action === 'moved' && entry.metadata) {
      const fromBadge = `<span class="status-badge status-${entry.metadata.from}">${formatStatus(entry.metadata.from)}</span>`;
      const toBadge = `<span class="status-badge status-${entry.metadata.to}">${formatStatus(entry.metadata.to)}</span>`;
      const arrowIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="margin: 0 4px; vertical-align: middle; color: var(--text-secondary);"><path fill-rule="evenodd" d="M4 8a.5.5 0 0 1 .5-.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5A.5.5 0 0 1 4 8z"/></svg>`;
      contentHtml = `Moved "<strong>${escapeHtml(entry.metadata.task)}</strong>" from ${fromBadge} ${arrowIcon} ${toBadge}`;
    }

    item.innerHTML = `
      <div class="history-icon-wrapper">${iconSvg}</div>
      <div class="history-content">
        <div class="history-header">
           <span class="history-action-label">${entry.action}</span>
           <span class="history-time" title="${new Date(entry.timestamp).toLocaleString()}">${timeAgoStr}</span>
        </div>
        <div class="history-text">${contentHtml}</div>
      </div>
    `;
    historyList.appendChild(item);
  });
}

function timeAgo(date) {
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

// Time Logs Functions
// Time Logs Functions
function showTimeLogs(taskId) {
  console.log('showTimeLogs called for:', taskId);
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    console.error('Task not found for logs:', taskId);
    return;
  }

  viewedTaskId = taskId;
  timeLogsModal.classList.add('active');
  renderTimeLogs(task);
}
// Expose to window for inline HTML onclicks if needed (though we switched to delegation)
window.showTimeLogs = showTimeLogs;

function closeTimeLogsModal() {
  viewedTaskId = null;
  timeLogsModal.classList.remove('active');
}
window.closeTimeLogsModal = closeTimeLogsModal;

function renderTimeLogs(task) {
  timeLogsList.innerHTML = '';
  const logs = task.timeLogs || [];

  // Calculate Total Time (including current session if tracking)
  let currentTotal = task.totalTime || 0;
  if (task.isTracking && task.lastStartTime) {
    currentTotal += (Date.now() - task.lastStartTime);
  }

  // Header for Total Time
  totalDurationContainer.innerHTML = '';
  const totalDiv = document.createElement('div');
  totalDiv.className = 'simple-total-header';
  totalDiv.innerHTML = `Total Duration <span class="simple-time">${formatTime(currentTotal)}</span>`;
  totalDurationContainer.appendChild(totalDiv);

  if (logs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<p>No time logs recorded</p>';
    timeLogsList.appendChild(empty);
    return;
  }

  // Reverse to show newest first
  [...logs].reverse().forEach(log => {
    const item = document.createElement('div');
    item.classList.add('log-entry');

    const start = new Date(log.start).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
    const end = log.end ? new Date(log.end).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Running...';
    const duration = log.end ? formatTime(log.end - log.start) : '---';

    item.innerHTML = `
      <div class="log-times">
        <div class="log-row">
            <span class="log-label">Start</span>
            <span class="log-value">${start}</span>
        </div>
        <div class="log-row">
            <span class="log-label">End</span>
            <span class="log-value">${end}</span>
        </div>
      </div>
      <div class="log-duration-badge">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
        </svg>
        <span>${duration}</span>
      </div>
    `;
    timeLogsList.appendChild(item);
  });
}

// Timer Functions
function toggleTimer(id, action) {
  const task = tasks.find(t => t.id === id);
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
    }
  }

  saveAndRender();
}
window.toggleTimer = toggleTimer;

function updateActiveTimers() {
  tasks.forEach(task => {
    if (task.isTracking) {
      const currentTotal = task.totalTime + (Date.now() - task.lastStartTime);
      
      const el = document.getElementById(`timer-${task.id}`);
      if (el) {
        el.innerHTML = `
          <span class="recording-dot"></span>
          ${formatTime(currentTotal)}
        `;
      }

      // Live update for modal if open
      if (viewedTaskId === task.id) {
          const modalDisplay = document.querySelector('.total-time-display');
          if (modalDisplay) {
              modalDisplay.innerText = formatTime(currentTotal);
          }
      }
    }
  });
}

function formatTime(ms) {
  if (!ms || isNaN(ms)) ms = 0;
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)));

  const pad = (num) => num.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
