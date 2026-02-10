// UI Module
import { state } from './state.js';
import { saveData, exportBoardData, importBoardData } from './storage.js';
import { toggleTimer, formatTime, updateActiveMemoDraft } from './timer.js';
import { addToHistory, clearHistory, formatTimeAgo } from './history.js';
import { initDragSystem } from './drag.js';

// DOM Elements Cache
const elements = {
  modal: document.getElementById('task-modal'),
  modalTitle: document.getElementById('modal-title'),
  taskForm: document.getElementById('task-form'),
  taskDescInput: document.getElementById('task-desc'),
  taskIdInput: document.getElementById('task-id'),
  taskUrlInput: document.getElementById('task-url'),
  // New Fields
  taskPriorityInput: document.getElementById('task-priority'),
  taskDueDateInput: document.getElementById('task-due-date'),
  taskTagsContainer: document.getElementById('task-tags'),
  taskTagsInput: document.getElementById('task-tags-input'),
  
  historyModal: document.getElementById('history-modal'),
  historyList: document.getElementById('history-list'),
  timeLogsModal: document.getElementById('time-logs-modal'),
  timeLogsList: document.getElementById('time-logs-list'),
  totalDurationContainer: document.getElementById('total-duration-container'),
  memoHistoryList: document.getElementById('memo-history-list'),
  analyticsModal: document.getElementById('analytics-modal'),
  analyticsContent: document.getElementById('analytics-content'),
  filterSearch: document.getElementById('task-search'),
  filterPriority: document.getElementById('filter-priority'),
  filterTags: document.getElementById('filter-tags'),
  filterStatus: document.getElementById('filter-status'),
  filterDueDate: document.getElementById('filter-due-date'),
  sortDueDate: document.getElementById('sort-due-date'),
  
  columns: {
    todo: document.getElementById('todo-container'),
    progress: document.getElementById('progress-container'),
    'on-hold': document.getElementById('on-hold-container'),
    done: document.getElementById('done-container'),
  },
  columnWrappers: {
    todo: document.getElementById('todo-col'),
    progress: document.getElementById('progress-col'),
    'on-hold': document.getElementById('on-hold-col'),
    done: document.getElementById('done-col'),
  },
  counts: {
    todo: document.querySelector('#todo-col .count'),
    progress: document.querySelector('#progress-col .count'),
    'on-hold': document.querySelector('#on-hold-col .count'),
    done: document.querySelector('#done-col .count'),
  }
};

const memoDraftTimers = new Map();

function queueMemoDraftSave(taskId, note, delay = 400) {
  if (memoDraftTimers.has(taskId)) {
    clearTimeout(memoDraftTimers.get(taskId));
  }

  const timer = setTimeout(() => {
    updateActiveMemoDraft(taskId, note);
    memoDraftTimers.delete(taskId);
  }, delay);

  memoDraftTimers.set(taskId, timer);
}

function flushMemoDraftSave(taskId, note) {
  if (memoDraftTimers.has(taskId)) {
    clearTimeout(memoDraftTimers.get(taskId));
    memoDraftTimers.delete(taskId);
  }
  updateActiveMemoDraft(taskId, note);
}

// -- Render Functions --

export function renderTasks() {
  updateTagFilterOptions(state.tasks);
  updateFilterIndicators();

  const filteredTasks = sortTasksByDueDate(applyFilters(state.tasks));
  const hasActiveFilters = Boolean(
    state.filters.search.trim() ||
    state.filters.priority !== 'all' ||
    state.filters.tag !== 'all' ||
    state.filters.status !== 'all' ||
    state.filters.dueDate !== 'all'
  );

  // Clear containers
  Object.values(elements.columns).forEach(el => el.innerHTML = '');
  
  // Reset counts
  Object.keys(elements.counts).forEach(k => elements.counts[k].innerText = '0');

  const taskCounts = { todo: 0, progress: 0, 'on-hold': 0, done: 0 };
  const totalCounts = { todo: 0, progress: 0, 'on-hold': 0, done: 0 };

  state.tasks.forEach(task => {
    if (totalCounts[task.status] !== undefined) {
      totalCounts[task.status]++;
    }
  });

  filteredTasks.forEach(task => {
    // Safety check
    if (!elements.columns[task.status]) {
        task.status = 'todo';
    }

    const card = createTaskCard(task);
    if (elements.columns[task.status]) {
       elements.columns[task.status].appendChild(card);
       taskCounts[task.status]++;
    }
  });

  // Empty States
  Object.keys(elements.columns).forEach(status => {
    if (elements.columns[status].children.length === 0) {
      elements.columns[status].appendChild(createEmptyState());
    }
  });

  // Update counts
  Object.keys(totalCounts).forEach(k => {
    const limit = state.wipLimits?.[k];
    const hasLimit = Number.isFinite(limit);
    const filteredCount = taskCounts[k];
    const totalCount = totalCounts[k];
    const countLabel = hasActiveFilters
      ? `${filteredCount}/${totalCount}${hasLimit ? `/${limit}` : ''}`
      : hasLimit
        ? `${totalCount} / ${limit}`
        : `${totalCount}`;

    if (elements.counts[k]) elements.counts[k].innerText = countLabel;
    if (elements.columnWrappers[k]) {
      elements.columnWrappers[k].classList.toggle('over-limit', hasLimit && totalCount > limit);
    }
  });
}

function createTaskCard(task) {
  const div = document.createElement('div');
  div.classList.add('task-card');
  div.setAttribute('draggable', 'true');
  div.dataset.id = task.id;
  // Metadata attributes for easier debug/css
  div.dataset.priority = task.priority || 'medium';
  const dueTimestamp = task.dueDate ? new Date(task.dueDate).getTime() : null;
  if (Number.isFinite(dueTimestamp)) {
    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;
    if (dueTimestamp < now) {
      div.classList.add('is-overdue');
    } else if (dueTimestamp - now <= msInDay) {
      div.classList.add('is-due-soon');
    }
  }

  // --- Template Parts ---
  const priorityHtml = task.priority ? `<span class="badge badge-${task.priority}">${task.priority}</span>` : '';
  const dateHtml = task.dueDate ? `<span class="badge badge-date">📅 ${new Date(task.dueDate).toLocaleDateString()}</span>` : '';
  const tagsHtml = (task.tags || []).map(tag => `<span class="badge badge-tag">#${tag}</span>`).join('');
  const urlHtml = task.url
    ? `<a class="task-link" href="${escapeHtml(normalizeUrl(task.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(formatUrlLabel(task.url))}</a>`
    : '';
  const metadataHtml = dateHtml || tagsHtml
    ? `<div class="task-metadata-bar">${dateHtml} ${tagsHtml}</div>`
    : '<div class="task-metadata-bar"><span class="task-muted">No metadata added</span></div>';

  const isTracking = Boolean(task.isTracking);
  const currentSession = isTracking ? Date.now() - task.lastStartTime : 0;
  const totalDisplay = formatTime((task.totalTime || 0) + currentSession);
  const timerStateLabel = task.status === 'done'
    ? 'Timer complete'
    : task.status === 'todo'
      ? 'Not started'
      : isTracking
        ? 'Running'
        : 'Paused';
  const timerStateClass = isTracking ? 'is-active' : '';

  const timerControlHtml = (task.status !== 'todo' && task.status !== 'done')
    ? !isTracking
      ? `<button class="timer-btn start-btn" title="Start Timer" data-action="start">${getIcon('play')}</button>`
      : `<button class="timer-btn pause-btn" title="Pause Timer" data-action="pause">${getIcon('pause')}</button>`
    : '';

  const memoDraft = task.activeMemoSession?.note || '';
  const memoPanelHtml = isTracking
    ? `
      <div class="active-memo-panel">
        <label for="memo-${task.id}">Session Memo</label>
        <textarea
          id="memo-${task.id}"
          class="active-memo-input"
          data-memo-task-id="${task.id}"
          placeholder="Add a short summary while you work..."
        >${escapeHtml(memoDraft)}</textarea>
      </div>
    `
    : '<div class="active-memo-panel"><span class="task-muted">Start a timer session to capture notes.</span></div>';

  const hasDetails = Boolean(task.url || task.dueDate || (task.tags && task.tags.length) || isTracking);

  // 3. Footer Actions
  const logsBtnHtml = `<button class="view-logs-btn" title="View Time Logs">${getIcon('clock')}</button>`;
  const editBtnHtml = task.status === 'done'
    ? ''
    : `<button class="edit-btn" aria-label="Edit">${getIcon('edit')}</button>`;

  div.innerHTML = `
    <div class="task-primary-row">
      <div class="task-content">${escapeHtml(task.content)}</div>
      ${priorityHtml}
    </div>
    <div class="task-secondary-row task-timer ${isTracking ? 'is-running' : ''}">
      <span class="task-timer-state ${timerStateClass}">${isTracking ? '<span class="recording-dot"></span>' : ''}${timerStateLabel}</span>
      <span class="timer-display" id="timer-${task.id}">${totalDisplay}</span>
    </div>
    <div class="task-details ${hasDetails ? '' : 'is-empty'}">
      ${urlHtml}
      ${metadataHtml}
      ${memoPanelHtml}
    </div>
    <div class="task-meta task-actions-row">
      <span>${new Date(task.createdAt).toLocaleDateString()}</span>
      <div class="task-actions">
        ${timerControlHtml}
        ${logsBtnHtml}
        ${editBtnHtml}
        <button class="delete-btn" aria-label="Delete">${getIcon('trash')}</button>
        <button class="details-toggle" aria-label="Toggle Details" title="Toggle Details" aria-expanded="false">Details</button>
      </div>
    </div>
  `;


  const detailsPanel = div.querySelector('.task-details');
  if (detailsPanel) {
    detailsPanel.hidden = true;
  }

  // Drag Events (CRITICAL FIX)
  div.addEventListener('dragstart', () => {
    div.classList.add('dragging');
    state.draggedTask = task; // Sync with state if preferred, or just rely on DOM
  });
  div.addEventListener('dragend', () => {
    div.classList.remove('dragging');
    state.draggedTask = null;
  });
  
  return div;
}

function createEmptyState() {
  const div = document.createElement('div');
  div.classList.add('empty-state');
  div.innerHTML = `${getIcon('plus-lg')} <p>No tasks yet</p>`;
  return div;
}

// -- Modal & Event Handlers --

function setupFilterListeners() {
  if (!elements.filterSearch) return;

  if (elements.sortDueDate) {
    elements.sortDueDate.value = state.filters.sortDueDate;
  }

  elements.filterSearch.addEventListener('input', () => {
    state.filters.search = elements.filterSearch.value;
    renderTasks();
  });

  elements.filterPriority?.addEventListener('change', () => {
    state.filters.priority = elements.filterPriority.value;
    renderTasks();
  });

  elements.filterTags?.addEventListener('change', () => {
    state.filters.tag = elements.filterTags.value;
    renderTasks();
  });

  elements.filterStatus?.addEventListener('change', () => {
    state.filters.status = elements.filterStatus.value;
    renderTasks();
  });

  elements.filterDueDate?.addEventListener('change', () => {
    state.filters.dueDate = elements.filterDueDate.value;
    renderTasks();
  });

  elements.sortDueDate?.addEventListener('change', () => {
    state.filters.sortDueDate = elements.sortDueDate.value;
    renderTasks();
  });
}

function applyFilters(tasks) {
  const searchValue = state.filters.search.trim().toLowerCase();
  const priorityValue = state.filters.priority;
  const tagValue = state.filters.tag;
  const statusValue = state.filters.status;
  const dueDateValue = state.filters.dueDate;

  return tasks.filter(task => {
    const taskPriority = task.priority || 'medium';
    if (priorityValue !== 'all' && taskPriority !== priorityValue) return false;
    if (statusValue !== 'all' && task.status !== statusValue) return false;

    if (tagValue !== 'all') {
      const tagList = (task.tags || []).map(tag => tag.toLowerCase());
      if (!tagList.includes(tagValue)) return false;
    }

    if (searchValue) {
      const contentMatch = task.content?.toLowerCase().includes(searchValue);
      const tagMatch = (task.tags || []).some(tag => tag.toLowerCase().includes(searchValue));
      if (!contentMatch && !tagMatch) return false;
    }

    if (!matchesDueDateFilter(task, dueDateValue)) return false;

    return true;
  });
}


function sortTasksByDueDate(tasks) {
  const sortOrder = state.filters.sortDueDate || 'none';
  if (sortOrder === 'none') return tasks;

  const sortedTasks = [...tasks];
  sortedTasks.sort((a, b) => {
    const aHasDueDate = Boolean(a.dueDate);
    const bHasDueDate = Boolean(b.dueDate);

    if (!aHasDueDate && !bHasDueDate) return 0;
    if (!aHasDueDate) return 1;
    if (!bHasDueDate) return -1;

    const aTime = new Date(a.dueDate).getTime();
    const bTime = new Date(b.dueDate).getTime();

    if (aTime === bTime) return 0;
    return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
  });

  return sortedTasks;
}

function matchesDueDateFilter(task, filterValue) {
  if (filterValue === 'all') return true;
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;

  if (filterValue === 'no-date') return !dueDate;
  if (!dueDate) return false;

  const todayStart = startOfDay(new Date());
  const dueStart = startOfDay(dueDate);

  switch (filterValue) {
    case 'overdue':
      return dueStart < todayStart;
    case 'today':
      return dueStart.getTime() === todayStart.getTime();
    case 'next-7': {
      const rangeEnd = new Date(todayStart);
      rangeEnd.setDate(rangeEnd.getDate() + 7);
      return dueStart >= todayStart && dueStart <= rangeEnd;
    }
    default:
      return true;
  }
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function updateTagFilterOptions(tasks) {
  if (!elements.filterTags) return;
  const currentSelection = elements.filterTags.value || state.filters.tag;
  const tagSet = new Set();

  tasks.forEach(task => {
    (task.tags || []).forEach(tag => {
      if (tag) tagSet.add(tag.toLowerCase());
    });
  });

  const sortedTags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  elements.filterTags.innerHTML = '<option value="all">All tags</option>';
  sortedTags.forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = `#${tag}`;
    elements.filterTags.appendChild(option);
  });

  if (sortedTags.includes(currentSelection)) {
    elements.filterTags.value = currentSelection;
    state.filters.tag = currentSelection;
  } else {
    elements.filterTags.value = 'all';
    state.filters.tag = 'all';
  }
}

function updateFilterIndicators() {
  if (!elements.filterSearch) return;
  const filterMap = new Map([
    [elements.filterSearch, state.filters.search.trim() !== ''],
    [elements.filterPriority, state.filters.priority !== 'all'],
    [elements.filterTags, state.filters.tag !== 'all'],
    [elements.filterStatus, state.filters.status !== 'all'],
    [elements.filterDueDate, state.filters.dueDate !== 'all'],
    [elements.sortDueDate, state.filters.sortDueDate !== 'none']
  ]);

  filterMap.forEach((isActive, element) => {
    if (!element) return;
    element.classList.toggle('filter-active', isActive);
  });
}

export function setupEventListeners() {
    // Add/Edit Task Modal
    document.getElementById('add-task-btn').addEventListener('click', () => openModal());
    document.getElementById('cancel-modal').addEventListener('click', closeModal);
    elements.taskForm.addEventListener('submit', handleTaskSubmit);
    
    // Tag Chip Input
    setupTagsInput();

    // History Modal
    document.getElementById('history-btn').addEventListener('click', openHistoryModal);
    document.getElementById('close-history').addEventListener('click', closeHistoryModal);
    document.getElementById('analytics-btn').addEventListener('click', openAnalyticsModal);
    document.getElementById('close-analytics').addEventListener('click', closeAnalyticsModal);
    document.getElementById('clear-history-btn').addEventListener('click', () => {
        if(confirm('Clear history?')) { clearHistory(); renderHistory(); }
    });

    // Global Button Actions (Clear All, Import/Export)
    document.getElementById('clear-all-btn').addEventListener('click', () => {
         if(confirm('Delete all tasks?')) { state.tasks = []; saveData(); renderTasks(); addToHistory('cleared', 'Cleared all tasks'); }
    });

    document.getElementById('export-btn').addEventListener('click', exportBoardData);
    
    document.getElementById('import-btn-trigger').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    
    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (importBoardData(event.target.result)) {
                // Reload data into state from storage (importBoardData saves to storage)
                // We just need to re-render.
                renderTasks();
                renderHistory();
                alert('Board imported successfully!');
            } else {
                alert('Failed to import board. Invalid file format.');
            }
        };
        reader.readAsText(file);
    });

    // Global Delegation for dynamically created cards
    document.getElementById('close-logs-btn').addEventListener('click', closeTimeLogsModal);
    window.addEventListener('click', handleGlobalClick);

    document.addEventListener('input', handleMemoInput);
    document.addEventListener('blur', handleMemoBlur, true);

    setupFilterListeners();
}

function handleMemoInput(e) {
  if (!e.target.classList?.contains('active-memo-input')) return;

  const taskId = e.target.dataset.memoTaskId;
  if (!taskId) return;

  queueMemoDraftSave(taskId, e.target.value);
}

function handleMemoBlur(e) {
  if (!e.target.classList?.contains('active-memo-input')) return;

  const taskId = e.target.dataset.memoTaskId;
  if (!taskId) return;

  flushMemoDraftSave(taskId, e.target.value);
}

function handleGlobalClick(e) {
  // Modal Backdrops
  if (e.target === elements.modal) closeModal();
  if (e.target === elements.historyModal) closeHistoryModal();
  if (e.target === elements.timeLogsModal) closeTimeLogsModal();
  if (e.target === elements.analyticsModal) closeAnalyticsModal();

  // Input Delegation for active memo autosave
  if (e.target.classList?.contains('active-memo-input')) {
    return;
  }

  // Button Delegation
  const btn = e.target.closest('button');
  if (!btn) return;
  const card = btn.closest('.task-card');

  // Timer Controls
  if (btn.classList.contains('timer-btn') && card) {
      e.stopPropagation();
      const taskId = card.dataset.id;
      const action = btn.dataset.action;

      if (action === 'pause') {
        const task = state.tasks.find(t => t.id === taskId);
        const memoInput = card.querySelector('.active-memo-input');
        const note = memoInput ? memoInput.value.trim() : (task?.activeMemoSession?.note || '').trim();

        if (memoInput) {
          flushMemoDraftSave(taskId, memoInput.value);
        }

        if (!note) {
          const shouldAddSummary = confirm('No memo summary was added for this session. Do you want to add one before stopping the timer?');
          if (shouldAddSummary) {
            if (memoInput) {
              memoInput.focus();
            }
            return;
          }
        }
      }

      toggleTimer(taskId, action);
      renderTasks(); // Or update DOM specific part
  }

  // Edit
  if (btn.classList.contains('edit-btn') && card) {
      const task = state.tasks.find(t => t.id === card.dataset.id);
      openModal(task);
  }

  // Delete
  if (btn.classList.contains('delete-btn') && card) {
      const task = state.tasks.find(t => t.id === card.dataset.id);
      if(confirm('Delete task?')) {
          state.tasks = state.tasks.filter(t => t.id !== task.id);
          saveData();
          renderTasks();
          addToHistory('deleted', `Deleted "${task.content}"`);
      }
  }


  // Details Toggle
  if (btn.classList.contains('details-toggle') && card) {
      e.stopPropagation();
      card.classList.toggle('is-expanded');
      const details = card.querySelector('.task-details');
      const expanded = card.classList.contains('is-expanded');
      if (details) details.hidden = !expanded;
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      return;
  }

  // Time Logs
  if (btn.classList.contains('view-logs-btn') && card) {
      e.stopPropagation();
      openTimeLogs(card.dataset.id);
  }
}

// -- Helpers --

function openModal(task = null) {
  elements.modal.classList.add('active');
  // Clear existing tag chips
  clearTagChips();
  
  if (task) {
    elements.modalTitle.innerText = 'Edit Task';
    elements.taskIdInput.value = task.id;
    elements.taskDescInput.value = task.content;
    if (elements.taskUrlInput) elements.taskUrlInput.value = task.url || '';
    // New fields
    if(elements.taskPriorityInput) elements.taskPriorityInput.value = task.priority || 'medium';
    if(elements.taskDueDateInput && task.dueDate) elements.taskDueDateInput.value = task.dueDate.slice(0, 10); // YYYY-MM-DD
    // Populate tag chips
    if(task.tags && task.tags.length > 0) {
      task.tags.forEach(tag => addTagChip(tag));
    }
  } else {
    elements.modalTitle.innerText = 'Add New Task';
    elements.taskIdInput.value = '';
    elements.taskDescInput.value = '';
    if (elements.taskUrlInput) elements.taskUrlInput.value = '';
    if(elements.taskPriorityInput) elements.taskPriorityInput.value = 'medium';
    if(elements.taskDueDateInput) elements.taskDueDateInput.value = '';
  }
  elements.taskDescInput.focus();
}

function closeModal() {
  elements.modal.classList.remove('active');
}

function handleTaskSubmit(e) {
  e.preventDefault();
  const id = elements.taskIdInput.value;
  const content = elements.taskDescInput.value.trim();
  const url = elements.taskUrlInput ? elements.taskUrlInput.value.trim() : '';
  const priority = elements.taskPriorityInput ? elements.taskPriorityInput.value : 'medium';
  const dueDate = elements.taskDueDateInput ? elements.taskDueDateInput.value : null;
  const tags = getTagsFromChips();

  if (!content) return;

  if (id) {
    const task = state.tasks.find(t => t.id === id);
    if (task) {
        task.content = content;
        task.url = url;
        task.priority = priority;
        task.dueDate = dueDate;
        task.tags = tags;
    }
  } else {
    // Need generateId from state... or import it.
    // Let's create a temp ID here or ensure generateId is imported
    const newId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    state.tasks.push({
      id: newId,
      content,
      url,
      status: 'todo',
      createdAt: new Date().toISOString(),
      priority,
      dueDate,
      tags,
      totalTime: 0,
      isTracking: false,
      lastStartTime: null,
      timeLogs: [],
      memoSessions: [],
      activeMemoSession: null
    });
    addToHistory('created', `Created "${content}"`);
  }
  
  saveData();
  renderTasks();
  closeModal();
}

// History & Logs Render Logic (Simplified for brevity)
function openHistoryModal() {
    elements.historyModal.classList.add('active');
    renderHistory();
}
function closeHistoryModal() { elements.historyModal.classList.remove('active'); }
function renderHistory() {
    elements.historyList.innerHTML = '';
    if (state.history.length === 0) {
        elements.historyList.innerHTML = '<p style="text-align:center;color:#888;">No activity yet</p>'; 
        return; 
    }
    // ... (reimplement history rendering with innerHTML string for speed)
    // For now, let's keep it simple to ensure we fit in the file.
    state.history.forEach(entry => {
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
    
    item.classList.add(actionClass);
    
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
           <span class="history-time" title="${new Date(entry.timestamp).toLocaleString()}">${formatTimeAgo(new Date(entry.timestamp))}</span>
        </div>
        <div class="history-text">${contentHtml}</div>
      </div>
    `;
    elements.historyList.appendChild(item);
  });
}

function openAnalyticsModal() {
    elements.analyticsModal.classList.add('active');
    renderAnalytics();
}

function closeAnalyticsModal() {
    elements.analyticsModal.classList.remove('active');
}

function renderAnalytics() {
    if (!elements.analyticsContent) return;

    const now = Date.now();
    const totalTracked = state.tasks.reduce((sum, task) => {
      const activeSession = task.isTracking && task.lastStartTime ? now - task.lastStartTime : 0;
      return sum + (task.totalTime || 0) + activeSession;
    }, 0);

    const statusLabels = {
      todo: 'To Do',
      progress: 'In Progress',
      'on-hold': 'On Hold',
      done: 'Done'
    };

    const timeByStatus = state.tasks.reduce((acc, task) => {
      const statusKey = task.status || 'todo';
      acc[statusKey] = (acc[statusKey] || 0) + (task.totalTime || 0);
      return acc;
    }, { todo: 0, progress: 0, 'on-hold': 0, done: 0 });

    const doneTasks = state.tasks.filter(task => task.status === 'done');
    const completedPerDay = doneTasks.reduce((acc, task) => {
      const createdDate = new Date(task.createdAt);
      if (Number.isNaN(createdDate.getTime())) return acc;
      const dayKey = createdDate.toISOString().slice(0, 10);
      acc[dayKey] = (acc[dayKey] || 0) + 1;
      return acc;
    }, {});

    const completedPerWeek = doneTasks.reduce((acc, task) => {
      const createdDate = new Date(task.createdAt);
      if (Number.isNaN(createdDate.getTime())) return acc;
      const weekStart = getWeekStart(createdDate).toISOString().slice(0, 10);
      acc[weekStart] = (acc[weekStart] || 0) + 1;
      return acc;
    }, {});

    const renderCountList = (entries, emptyText) => {
      if (entries.length === 0) return `<p class="analytics-empty">${emptyText}</p>`;
      return entries.map(([period, count]) => `
        <div class="analytics-row">
          <span class="analytics-label">${period}</span>
          <span class="analytics-value">${count}</span>
        </div>
      `).join('');
    };

    const dayEntries = Object.entries(completedPerDay).sort(([a], [b]) => b.localeCompare(a));
    const weekEntries = Object.entries(completedPerWeek).sort(([a], [b]) => b.localeCompare(a));

    elements.analyticsContent.innerHTML = `
      <section class="analytics-section analytics-highlight">
        <h3>Total time tracked</h3>
        <p class="analytics-total-time">${formatTime(totalTracked)}</p>
      </section>

      <section class="analytics-section">
        <h3>Time by status</h3>
        <div class="analytics-grid">
          ${Object.keys(statusLabels).map((status) => `
            <div class="analytics-card">
              <span class="analytics-card-title">${statusLabels[status]}</span>
              <span class="analytics-card-time">${formatTime(timeByStatus[status] || 0)}</span>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="analytics-section">
        <h3>Tasks completed per day</h3>
        <div class="analytics-list">
          ${renderCountList(dayEntries, 'No completed tasks yet')}
        </div>
      </section>

      <section class="analytics-section">
        <h3>Tasks completed per week</h3>
        <div class="analytics-list">
          ${renderCountList(weekEntries, 'No completed tasks yet')}
        </div>
      </section>
    `;
}

function getWeekStart(date) {
    const localDate = new Date(date);
    const day = localDate.getDay();
    const diff = (day + 6) % 7;
    localDate.setDate(localDate.getDate() - diff);
    localDate.setHours(0, 0, 0, 0);
    return localDate;
}

function formatStatus(status) {
    const map = { 'todo': 'To Do', 'progress': 'In Progress', 'on-hold': 'On Hold', 'done': 'Done' };
    return map[status] || status;
}

// Time Logs
function openTimeLogs(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if(!task) return;
    state.viewedTaskId = taskId;
    elements.timeLogsModal.classList.add('active');
    renderTimeLogs(task);
}
function closeTimeLogsModal() {
    state.viewedTaskId = null;
    elements.timeLogsModal.classList.remove('active');
}
function renderTimeLogs(task) {
    elements.timeLogsList.innerHTML = '';
    if (elements.memoHistoryList) elements.memoHistoryList.innerHTML = '';

    // Calculate Total Time (including current session)
    let currentTotal = task.totalTime || 0;
    if (task.isTracking && task.lastStartTime) {
        currentTotal += (Date.now() - task.lastStartTime);
    }

    // Update Header
    elements.totalDurationContainer.innerHTML = `
       <div class="simple-total-header">
          Total Duration <span class="simple-time">${formatTime(currentTotal)}</span>
       </div>
    `;

    if (!task.timeLogs || task.timeLogs.length === 0) {
        elements.timeLogsList.innerHTML = '<p>No logs</p>';
    } else {
      [...task.timeLogs].reverse().forEach(log => {
          const start = new Date(log.start).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
          const end = log.end ? new Date(log.end).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Running...';
          const duration = log.end ? formatTime(log.end - log.start) : '---';

          const div = document.createElement('div');
          div.className = 'log-entry';
          div.innerHTML = `
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
          elements.timeLogsList.appendChild(div);
      });
    }

    if (!elements.memoHistoryList) return;

    const memoSessions = task.memoSessions || [];
    const activeDraft = task.activeMemoSession
      ? [{ ...task.activeMemoSession, duration: task.lastStartTime ? Date.now() - task.lastStartTime : null, endedAt: null, isDraft: true }]
      : [];
    const allMemoEntries = [...activeDraft, ...memoSessions].reverse();

    if (allMemoEntries.length === 0) {
      elements.memoHistoryList.innerHTML = '<p>No memo sessions yet</p>';
      return;
    }

    allMemoEntries.forEach(session => {
      const entry = document.createElement('div');
      entry.className = `memo-history-entry ${session.isDraft ? 'is-draft' : ''}`;

      const startedAt = session.startedAt ? new Date(session.startedAt) : null;
      const periodLabel = startedAt && !Number.isNaN(startedAt.getTime())
        ? startedAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : 'Unknown time';
      const durationLabel = Number.isFinite(session.duration) ? formatTime(session.duration) : 'Running...';
      const noteText = (session.note || '').trim() || 'No summary added.';

      entry.innerHTML = `
        <div class="memo-history-meta">
          <span class="memo-history-time">${periodLabel}</span>
          <span class="memo-history-duration">${durationLabel}</span>
        </div>
        <p class="memo-history-note">${escapeHtml(noteText)}</p>
      `;

      elements.memoHistoryList.appendChild(entry);
    });
}

// Icon Helper
function getIcon(name) {
    // Simple SVG map
    const icons = {
        'play': '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/></svg>',
        'pause': '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg>',
        'clock': '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>',
        'edit': '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>',
        'trash': '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a.5.5 0 0 1-1-0V3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0-1h3A.5.5 0 0 1 11 2.5v.5h4a.5.5 0 0 1 .5.5zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>',
        'plus-lg': '<svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/></svg>'
    };
    return icons[name] || '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function normalizeUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function formatUrlLabel(url) {
  const trimmed = url.trim();
  return trimmed.length > 48 ? `${trimmed.slice(0, 45)}...` : trimmed;
}

// -- Tag Chip Functions --

function setupTagsInput() {
  if (!elements.taskTagsInput || !elements.taskTagsContainer) return;
  
  // Click on container focuses input
  elements.taskTagsContainer.addEventListener('click', () => {
    elements.taskTagsInput.focus();
  });
  
  // Handle keydown for comma, Enter, Backspace
  elements.taskTagsInput.addEventListener('keydown', (e) => {
    const value = elements.taskTagsInput.value.trim();
    
    // Comma or Enter adds a chip
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      if (value) {
        addTagChip(value);
        elements.taskTagsInput.value = '';
      }
    }
    
    // Backspace on empty input removes last chip
    if (e.key === 'Backspace' && !elements.taskTagsInput.value) {
      const chips = elements.taskTagsContainer.querySelectorAll('.tag-chip');
      if (chips.length > 0) {
        chips[chips.length - 1].remove();
      }
    }
  });
  
  // Also handle input for pasted commas
  elements.taskTagsInput.addEventListener('input', (e) => {
    const value = elements.taskTagsInput.value;
    if (value.includes(',')) {
      const parts = value.split(',');
      parts.forEach((part, index) => {
        const trimmed = part.trim();
        if (trimmed && index < parts.length - 1) {
          addTagChip(trimmed);
        }
      });
      // Keep only the last part (after the last comma) in the input
      elements.taskTagsInput.value = parts[parts.length - 1].trim();
    }
  });
}

function addTagChip(tag) {
  const normalizedTag = tag.trim().toLowerCase();
  if (!normalizedTag) return;
  
  // Check for duplicates
  const existingTags = getTagsFromChips();
  if (existingTags.includes(normalizedTag)) return;
  
  const chip = document.createElement('span');
  chip.className = 'tag-chip';
  chip.dataset.tag = normalizedTag;
  chip.innerHTML = `
    ${escapeHtml(normalizedTag)}
    <button type="button" class="tag-chip-remove" aria-label="Remove tag">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
      </svg>
    </button>
  `;
  
  // Remove button handler
  chip.querySelector('.tag-chip-remove').addEventListener('click', (e) => {
    e.stopPropagation();
    chip.remove();
  });
  
  // Insert chip before the input
  elements.taskTagsContainer.insertBefore(chip, elements.taskTagsInput);
}

function clearTagChips() {
  if (!elements.taskTagsContainer) return;
  const chips = elements.taskTagsContainer.querySelectorAll('.tag-chip');
  chips.forEach(chip => chip.remove());
  if (elements.taskTagsInput) elements.taskTagsInput.value = '';
}

function getTagsFromChips() {
  if (!elements.taskTagsContainer) return [];
  const chips = elements.taskTagsContainer.querySelectorAll('.tag-chip');
  return Array.from(chips).map(chip => chip.dataset.tag);
}
