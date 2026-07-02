/* ═══════════════════════════════════════════════════════════════
   OS Scheduler Visualizer — script.js
   Algorithms: FCFS, SJF, Round Robin, Priority, SRTF
   Features: Arrival Time, Stats, Toasts, Delete, Gantt Axis,
             Speed Control, Export PNG/CSV
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ─── STATE ────────────────────────────────────────────────────────
let totalMemory = 20;
let memory      = new Array(totalMemory).fill(null);
let processes   = [];
let simTimer    = null;   // single setTimeout handle — ONLY setTimeout, never setInterval
let isRunning   = false;  // true while simulation loop is alive
let isPaused    = false;
let simDone     = false;
let speedMs     = 1000;
let ganttData   = [];

// ─── TIMER HELPERS ───────────────────────────────────────────────
// Using only setTimeout (recursive) avoids clearInterval/clearTimeout mix-up bugs.
function scheduleNext(fn, delay) {
  cancelSim();
  simTimer  = setTimeout(fn, delay);
  isRunning = true;
}

function cancelSim() {
  if (simTimer !== null) {
    clearTimeout(simTimer);
    simTimer = null;
  }
}

// ─── PROCESS COLORS ──────────────────────────────────────────────
const COLOR_PALETTE = [
  { bg: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', solid: '#3b82f6' },
  { bg: 'linear-gradient(135deg,#06b6d4,#0891b2)', solid: '#06b6d4' },
  { bg: 'linear-gradient(135deg,#10b981,#059669)', solid: '#10b981' },
  { bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', solid: '#8b5cf6' },
  { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', solid: '#f59e0b' },
  { bg: 'linear-gradient(135deg,#ec4899,#be185d)', solid: '#ec4899' },
  { bg: 'linear-gradient(135deg,#ef4444,#b91c1c)', solid: '#ef4444' },
  { bg: 'linear-gradient(135deg,#14b8a6,#0f766e)', solid: '#14b8a6' },
  { bg: 'linear-gradient(135deg,#f97316,#c2410c)', solid: '#f97316' },
  { bg: 'linear-gradient(135deg,#6366f1,#4338ca)', solid: '#6366f1' },
];
const colorMap = {};
function getColor(pid) {
  if (colorMap[pid]) return colorMap[pid];
  const hash = [...pid].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (colorMap[pid] = COLOR_PALETTE[hash % COLOR_PALETTE.length]);
}

// ─── TOAST NOTIFICATION SYSTEM ───────────────────────────────────
const TOAST_ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || 'ℹ️'}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" onclick="dismissToast(this.parentElement)" aria-label="Dismiss">×</button>
    <div class="toast-progress"></div>
  `;
  container.appendChild(toast);
  const timer = setTimeout(() => dismissToast(toast), 3200);
  toast._timer = timer;
}

function dismissToast(toast) {
  if (!toast || !toast.parentElement) return;
  clearTimeout(toast._timer);
  toast.classList.add('toast-out');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

// ─── ALGORITHM CHANGE HANDLER ────────────────────────────────────
function onAlgoChange() {
  const algo = document.getElementById('algorithm-select').value;
  document.getElementById('quantum-group').style.display        = algo === 'rr'       ? '' : 'none';
  document.getElementById('priority-input-group').style.display = algo === 'priority' ? '' : 'none';
}

// ─── SPEED CONTROL ───────────────────────────────────────────────
const SPEED_MAP   = { 1: 2000, 2: 1000, 3: 667, 4: 500, 5: 333, 6: 250, 7: 167, 8: 125 };
const SPEED_LABEL = { 1: '0.5×', 2: '1×', 3: '1.5×', 4: '2×', 5: '3×', 6: '4×', 7: '6×', 8: '8×' };

function updateSpeed(val) {
  speedMs = SPEED_MAP[val] || 1000;
  document.getElementById('speedDisplay').textContent = SPEED_LABEL[val] || '1×';
}

// ─── PROCESS MANAGEMENT ──────────────────────────────────────────
function addProcess() {
  const pid     = document.getElementById('pid').value.trim().toUpperCase();
  const arrival = parseInt(document.getElementById('arrival').value);
  const burst   = parseInt(document.getElementById('burst').value);
  const memReq  = parseInt(document.getElementById('memReq').value);
  const algo    = document.getElementById('algorithm-select').value;
  const priority = algo === 'priority'
    ? (parseInt(document.getElementById('priorityVal').value) || 1) : 0;

  if (!pid)                    { showToast('Process ID cannot be empty.', 'error');                                        return; }
  if (isNaN(burst) || burst < 1)  { showToast('Burst time must be at least 1.', 'error');                             return; }
  if (isNaN(memReq) || memReq < 1){ showToast('Memory required must be at least 1.', 'error');                       return; }
  if (memReq > totalMemory)    { showToast(`Memory required (${memReq}) exceeds total (${totalMemory}).`, 'error');    return; }
  if (isNaN(arrival) || arrival < 0){ showToast('Arrival time cannot be negative.', 'error');                        return; }
  if (processes.find(p => p.pid === pid)) { showToast(`Process "${pid}" already exists.`, 'error');                  return; }

  processes.push({
    pid,
    arrivalTime:    isNaN(arrival) ? 0 : arrival,
    burstTime:      burst,
    memoryReq:      memReq,
    priority,
    remainingTime:  burst,
    state:          'waiting',
    memStart:       -1,
    completionTime: null,
    firstRunTime:   null,
  });

  updateProcessList();
  autoNextPID();
  showToast(`Process ${pid} added to queue.`, 'success');
}

function autoNextPID() {
  const last  = processes.length > 0 ? processes[processes.length - 1].pid : 'P0';
  const match = last.match(/^([A-Za-z]*)(\d+)$/);
  if (match) document.getElementById('pid').value = match[1] + (parseInt(match[2]) + 1);
  document.getElementById('burst').value   = 4;
  document.getElementById('memReq').value  = 3;
  document.getElementById('arrival').value = 0;
}

function deleteProcess(pid) {
  if (isRunning) { showToast('Cannot delete while simulation is running.', 'warning'); return; }
  processes = processes.filter(p => p.pid !== pid);
  delete colorMap[pid];
  updateProcessList();
  updateMemoryVisual();
  showToast(`Process ${pid} removed.`, 'info');
}

function clearAllProcesses() {
  if (isRunning) { showToast('Stop or reset the simulation first.', 'warning'); return; }
  processes = [];
  Object.keys(colorMap).forEach(k => delete colorMap[k]);
  updateProcessList();
  updateMemoryVisual();
  showToast('All processes cleared.', 'info');
}

function updateProcessList() {
  const container  = document.getElementById('processes');
  const empty      = document.getElementById('processes-empty');
  const countBadge = document.getElementById('processCount');
  const canDelete  = !isRunning && !simDone;

  container.innerHTML    = '';
  countBadge.textContent = `${processes.length} process${processes.length !== 1 ? 'es' : ''}`;

  if (processes.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  const algo = document.getElementById('algorithm-select').value;

  processes.forEach((p, i) => {
    const color    = getColor(p.pid);
    const progress = ((p.burstTime - p.remainingTime) / p.burstTime) * 100;
    const extraMeta = algo === 'priority'
      ? `<span class="meta-chip">Priority: ${p.priority}</span>` : '';

    const card = document.createElement('div');
    card.className = 'process-card';
    card.style.animationDelay  = `${i * 0.05}s`;
    card.style.borderLeftColor = color.solid;
    card.setAttribute('role', 'listitem');

    card.innerHTML = `
      <div class="process-color-dot" style="background:${color.solid};box-shadow:0 0 6px ${color.solid}60;"></div>
      <div class="process-info">
        <span class="process-pid">${p.pid}</span>
        <div class="process-meta">
          <span class="meta-chip">Arrival: ${p.arrivalTime}</span>
          <span class="meta-chip">Burst: ${p.burstTime}</span>
          <span class="meta-chip">Mem: ${p.memoryReq}</span>
          ${extraMeta}
        </div>
        <span class="process-status status-${p.state}">${p.state}</span>
      </div>
      <div class="process-progress-wrap">
        <div class="progress-track">
          <div class="progress-fill" style="width:${progress}%;background:${color.bg};"></div>
        </div>
        <span class="progress-pct">${Math.round(progress)}%</span>
      </div>
      ${canDelete
        ? `<button class="delete-btn" onclick="deleteProcess('${p.pid}')" aria-label="Delete ${p.pid}" title="Remove process">✕</button>`
        : ''}
    `;
    container.appendChild(card);
  });
}

// ─── MEMORY MANAGEMENT ───────────────────────────────────────────
function updateTotalMemory() {
  const newSize = parseInt(document.getElementById('memSize').value);
  if (isNaN(newSize) || newSize < 1) return;
  if (newSize > totalMemory) {
    memory = memory.concat(new Array(newSize - totalMemory).fill(null));
  } else {
    memory = memory.slice(0, newSize);
  }
  totalMemory = newSize;
  updateMemoryVisual();
}

function allocateMemory(process) {
  let start = -1, count = 0;
  for (let i = 0; i < totalMemory; i++) {
    if (memory[i] === null) {
      if (start === -1) start = i;
      if (++count === process.memoryReq) {
        for (let j = start; j < start + count; j++) memory[j] = process.pid;
        process.memStart = start;
        return true;
      }
    } else { start = -1; count = 0; }
  }
  return false;
}

function freeMemory(p) {
  if (p.memStart >= 0) {
    for (let i = p.memStart; i < p.memStart + p.memoryReq; i++) memory[i] = null;
    p.memStart = -1;
  }
}

function freeAllMemory() {
  processes.forEach(p => freeMemory(p));
  memory.fill(null);
}

function updateMemoryVisual() {
  const memDiv   = document.getElementById('memory-visual');
  const legendPr = document.getElementById('memory-legend-processes');
  const memUsed  = document.getElementById('memUsed');
  const memTotal = document.getElementById('memTotal');
  const memPct   = document.getElementById('memPercent');

  memDiv.innerHTML   = '';
  legendPr.innerHTML = '';

  const usedUnits      = memory.filter(m => m !== null).length;
  memUsed.textContent  = usedUnits;
  memTotal.textContent = totalMemory;
  memPct.textContent   = `${Math.round((usedUnits / totalMemory) * 100)}%`;

  let i = 0;
  const seenPids = new Set();
  while (i < totalMemory) {
    const pid = memory[i];
    let len = 1;
    while (i + len < totalMemory && memory[i + len] === pid) len++;

    const block = document.createElement('div');
    block.className = 'mem-block' + (pid === null ? ' free' : '');
    block.style.flex     = Math.max(len, 1);
    block.style.minWidth = `${Math.max(40, len * 18)}px`;

    if (pid === null) {
      block.textContent = `Free\n(${len})`;
    } else {
      const color = getColor(pid);
      block.style.background = color.bg;
      block.textContent = `${pid}\n(${len})`;
      if (!seenPids.has(pid)) {
        seenPids.add(pid);
        const li = document.createElement('div');
        li.className = 'legend-item';
        li.innerHTML = `<div class="legend-swatch" style="background:${color.solid};"></div><span>${pid}</span>`;
        legendPr.appendChild(li);
      }
    }
    memDiv.appendChild(block);
    i += len;
  }
}

// ─── SIMULATION START ────────────────────────────────────────────
function startSimulation() {
  if (isRunning)          { showToast('Simulation already running.', 'warning'); return; }
  if (!processes.length)  { showToast('Add at least one process first.', 'error'); return; }

  // Reset state
  processes.forEach(p => {
    p.remainingTime  = p.burstTime;
    p.state          = 'waiting';
    p.memStart       = -1;
    p.completionTime = null;
    p.firstRunTime   = null;
  });

  freeAllMemory();

  for (const p of processes) {
    if (!allocateMemory(p)) {
      showToast(`Not enough memory for ${p.pid}. Increase total memory.`, 'error');
      freeAllMemory();
      updateMemoryVisual();
      updateProcessList();
      return;
    }
  }

  updateMemoryVisual();
  updateProcessList();

  // Clear Gantt
  ganttData = [];
  document.getElementById('gantt-chart').innerHTML = '';
  document.getElementById('gantt-axis').innerHTML  = '';
  document.getElementById('gantt-empty').style.display   = 'none';
  document.getElementById('gantt-wrapper').style.display = '';
  document.getElementById('stats-section').style.display = 'none';
  document.getElementById('exportBtns').style.display    = 'none';

  simDone  = false;
  isPaused = false;
  isRunning = true;

  setSimStatus('running', 'Simulation running…');
  updateControlButtons('running');

  const algo = document.getElementById('algorithm-select').value;

  if (algo === 'rr') {
    runRoundRobin();
  } else if (algo === 'srtf') {
    runSRTF();
  } else {
    let order = [...processes];
    if (algo === 'sjf')      order.sort((a, b) => a.burstTime - b.burstTime  || a.arrivalTime - b.arrivalTime);
    if (algo === 'priority') order.sort((a, b) => a.priority  - b.priority   || a.arrivalTime - b.arrivalTime);
    runSequential(order);
  }

  showToast('Simulation started!', 'success');
}

// ═══════════════════════════════════════════════════════════════
// SEQUENTIAL RUNNER — FCFS / SJF / Priority (non-preemptive)
// Uses pure recursive setTimeout. No setInterval anywhere.
// ═══════════════════════════════════════════════════════════════
function runSequential(order) {
  let clock = 0;
  let idx   = 0;

  function tick() {
    // ── Pause: reschedule self after short delay, don't exit ──
    if (isPaused) {
      simTimer = setTimeout(tick, 100);
      return;
    }

    // ── All done ──
    if (idx >= order.length) {
      isRunning = false;
      finishSimulation();
      return;
    }

    const p = order[idx];

    // ── Process hasn't arrived yet — insert IDLE tick ──
    //    BUG WAS HERE: was returning without rescheduling
    if (clock < p.arrivalTime) {
      addGanttBlock('IDLE', clock, clock + 1, true);
      clock++;
      simTimer = setTimeout(tick, speedMs);   // ← FIXED: reschedule
      return;
    }

    // ── Process is ready to run ──
    if (p.firstRunTime === null) p.firstRunTime = clock;
    p.state = 'running';
    updateProcessList();

    const startClock = clock;

    // Inner recursive function: runs one tick of the process per call
    function runTick() {
      if (isPaused) {
        simTimer = setTimeout(runTick, 100);  // wait while paused
        return;
      }

      p.remainingTime--;
      clock++;
      updateProgressOnCard(p);

      if (p.remainingTime <= 0) {
        // Process finished
        p.state          = 'finished';
        p.completionTime = clock;
        freeMemory(p);
        addGanttBlock(p.pid, startClock, clock, false);
        updateMemoryVisual();
        updateProcessList();
        idx++;
        simTimer = setTimeout(tick, 300);     // move to next process
      } else {
        simTimer = setTimeout(runTick, speedMs); // continue this process
      }
    }

    simTimer = setTimeout(runTick, speedMs);
  }

  simTimer = setTimeout(tick, 100);
}

// ═══════════════════════════════════════════════════════════════
// ROUND ROBIN
// ═══════════════════════════════════════════════════════════════
function runRoundRobin() {
  const quantum    = Math.max(1, parseInt(document.getElementById('timeQuantum').value) || 2);
  const byArrival  = [...processes].sort((a, b) => a.arrivalTime - b.arrivalTime);
  let clock        = 0;
  let nextArrIdx   = 0;
  const rrQueue    = [];

  function enqueueArrived() {
    while (nextArrIdx < byArrival.length && byArrival[nextArrIdx].arrivalTime <= clock) {
      rrQueue.push(byArrival[nextArrIdx]);
      nextArrIdx++;
    }
  }

  function tick() {
    if (isPaused) {
      simTimer = setTimeout(tick, 100);
      return;
    }

    enqueueArrived();

    if (rrQueue.length === 0) {
      if (nextArrIdx < byArrival.length) {
        // CPU is idle, next process hasn't arrived yet
        addGanttBlock('IDLE', clock, clock + 1, true);
        clock++;
        simTimer = setTimeout(tick, speedMs);
      } else {
        isRunning = false;
        finishSimulation();
      }
      return;
    }

    const p = rrQueue.shift();
    if (p.state === 'finished') { simTimer = setTimeout(tick, 0); return; }

    if (p.firstRunTime === null) p.firstRunTime = clock;
    p.state = 'running';
    updateProcessList();

    const runFor     = Math.min(quantum, p.remainingTime);
    const startClock = clock;
    let   elapsed    = 0;

    function runTick() {
      if (isPaused) {
        simTimer = setTimeout(runTick, 100);
        return;
      }

      elapsed++;
      clock++;
      p.remainingTime--;
      updateProgressOnCard(p);

      if (elapsed >= runFor) {
        // Quantum exhausted or process finished
        addGanttBlock(p.pid, startClock, clock, false);

        if (p.remainingTime <= 0) {
          p.state          = 'finished';
          p.completionTime = clock;
          freeMemory(p);
          updateMemoryVisual();
        } else {
          p.state = 'waiting';
          enqueueArrived();   // enqueue newly arrived before re-queuing current
          rrQueue.push(p);
        }
        updateProcessList();
        simTimer = setTimeout(tick, 200);
      } else {
        simTimer = setTimeout(runTick, speedMs);
      }
    }

    simTimer = setTimeout(runTick, speedMs);
  }

  simTimer = setTimeout(tick, 100);
}

// ═══════════════════════════════════════════════════════════════
// SRTF — Shortest Remaining Time First (Preemptive SJF)
// ═══════════════════════════════════════════════════════════════
function runSRTF() {
  let clock    = 0;
  let currentP = null;
  let startClk = 0;
  const finished = new Set();

  function findShortest() {
    let best = null;
    for (const p of processes) {
      if (finished.has(p.pid))   continue;
      if (p.arrivalTime > clock) continue;
      if (!best || p.remainingTime < best.remainingTime ||
          (p.remainingTime === best.remainingTime && p.arrivalTime < best.arrivalTime)) {
        best = p;
      }
    }
    return best;
  }

  function tick() {
    if (isPaused) {
      simTimer = setTimeout(tick, 100);
      return;
    }

    if (finished.size >= processes.length) {
      // Flush last block
      if (currentP) {
        addGanttBlock(currentP.pid, startClk, clock, false);
        currentP = null;
      }
      isRunning = false;
      finishSimulation();
      return;
    }

    const next = findShortest();

    if (!next) {
      // CPU idle
      if (currentP) {
        addGanttBlock(currentP.pid, startClk, clock, false);
        currentP.state = 'waiting';
        currentP = null;
      }
      addGanttBlock('IDLE', clock, clock + 1, true);
      clock++;
      updateProcessList();
      simTimer = setTimeout(tick, speedMs);
      return;
    }

    // Context switch?
    if (currentP && currentP.pid !== next.pid) {
      addGanttBlock(currentP.pid, startClk, clock, false);
      currentP.state = 'waiting';
      updateProcessList();
      currentP = null;
    }

    if (!currentP) {
      currentP = next;
      startClk = clock;
      if (next.firstRunTime === null) next.firstRunTime = clock;
      next.state = 'running';
      updateProcessList();
    }

    // Run one tick
    simTimer = setTimeout(() => {
      if (isPaused) {
        simTimer = setTimeout(tick, 100);
        return;
      }
      clock++;
      currentP.remainingTime--;
      updateProgressOnCard(currentP);

      if (currentP.remainingTime <= 0) {
        addGanttBlock(currentP.pid, startClk, clock, false);
        currentP.state          = 'finished';
        currentP.completionTime = clock;
        freeMemory(currentP);
        finished.add(currentP.pid);
        updateMemoryVisual();
        updateProcessList();
        currentP = null;
      }

      simTimer = setTimeout(tick, speedMs);
    }, speedMs);
  }

  simTimer = setTimeout(tick, 100);
}

// ─── GANTT CHART ─────────────────────────────────────────────────
function addGanttBlock(pid, start, end, isIdle) {
  // Merge consecutive IDLE blocks for cleaner chart
  if (isIdle && ganttData.length > 0) {
    const last = ganttData[ganttData.length - 1];
    if (last.isIdle && last.end === start) {
      last.end = end;
      // update existing DOM block width
      const blocks = document.querySelectorAll('#gantt-chart .gantt-block');
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock) {
        lastBlock.style.width = `${Math.max(40, (last.end - last.start) * 44)}px`;
        lastBlock.title = `IDLE | t${last.start}–t${last.end}`;
      }
      redrawAxis();
      return;
    }
  }

  ganttData.push({ pid, start, end, isIdle });

  const chart = document.getElementById('gantt-chart');
  const block = document.createElement('div');
  block.className = 'gantt-block' + (isIdle ? ' idle' : '');
  block.style.width = `${Math.max(40, (end - start) * 44)}px`;
  block.textContent = isIdle ? 'IDLE' : pid;

  if (!isIdle) {
    const color = getColor(pid);
    block.style.background = color.bg;
    block.title = `${pid} | t${start}–t${end} (${end - start} unit${end - start !== 1 ? 's' : ''})`;
  } else {
    block.title = `IDLE | t${start}–t${end}`;
  }

  chart.appendChild(block);
  redrawAxis();

  // Auto-scroll Gantt to the right
  const scroll = document.getElementById('gantt-scroll');
  if (scroll) scroll.scrollLeft = scroll.scrollWidth;
}

function redrawAxis() {
  const axis = document.getElementById('gantt-axis');
  if (!axis || ganttData.length === 0) return;
  axis.innerHTML = '';

  const offsetMap = new Map();
  let cur = 0;
  for (const seg of ganttData) {
    if (!offsetMap.has(seg.start)) offsetMap.set(seg.start, cur);
    const w = Math.max(40, (seg.end - seg.start) * 44) + 4;
    offsetMap.set(seg.end, cur + w);
    cur += w;
  }

  axis.style.position = 'relative';
  axis.style.minWidth = `${cur}px`;

  for (const [time, left] of offsetMap.entries()) {
    const tick = document.createElement('div');
    tick.className    = 'gantt-tick';
    tick.style.left   = `${left}px`;
    tick.textContent  = `t${time}`;
    axis.appendChild(tick);
  }
}

// ─── PROGRESS CARD LIGHT UPDATE ──────────────────────────────────
function updateProgressOnCard(p) {
  const pct   = ((p.burstTime - p.remainingTime) / p.burstTime) * 100;
  const cards = document.querySelectorAll('.process-card');
  cards.forEach(card => {
    if (card.querySelector('.process-pid')?.textContent === p.pid) {
      const fill  = card.querySelector('.progress-fill');
      const pctEl = card.querySelector('.progress-pct');
      const stat  = card.querySelector('.process-status');
      if (fill)  fill.style.width       = `${pct}%`;
      if (pctEl) pctEl.textContent      = `${Math.round(pct)}%`;
      if (stat) {
        stat.textContent  = p.state;
        stat.className    = `process-status status-${p.state}`;
      }
    }
  });
}

// ─── SIMULATION CONTROLS ─────────────────────────────────────────
function pauseSimulation() {
  if (!isRunning) { showToast('No simulation to pause.', 'warning'); return; }
  if (isPaused)   { showToast('Already paused.', 'info'); return; }
  isPaused = true;
  setSimStatus('paused', 'Paused');
  updateControlButtons('paused');
  showToast('Simulation paused.', 'warning');
}

function resumeSimulation() {
  if (!isPaused) { showToast('Simulation is not paused.', 'info'); return; }
  isPaused = false;
  setSimStatus('running', 'Simulation running…');
  updateControlButtons('running');
  showToast('Simulation resumed.', 'success');
}

function resetSimulation() {
  cancelSim();
  isRunning = false;
  isPaused  = false;
  simDone   = false;

  processes.forEach(p => {
    p.remainingTime  = p.burstTime;
    p.state          = 'waiting';
    p.memStart       = -1;
    p.completionTime = null;
    p.firstRunTime   = null;
  });

  freeAllMemory();
  memory    = new Array(totalMemory).fill(null);
  ganttData = [];

  updateProcessList();
  updateMemoryVisual();

  document.getElementById('gantt-chart').innerHTML   = '';
  document.getElementById('gantt-axis').innerHTML    = '';
  document.getElementById('gantt-empty').style.display   = '';
  document.getElementById('gantt-wrapper').style.display = 'none';
  document.getElementById('stats-section').style.display = 'none';
  document.getElementById('exportBtns').style.display    = 'none';

  setSimStatus('idle', 'Idle — Add processes to begin');
  updateControlButtons('idle');
  showToast('Simulation reset.', 'info');
}

// ─── SIMULATION FINISH ───────────────────────────────────────────
function finishSimulation() {
  cancelSim();
  isRunning = false;
  isPaused  = false;
  simDone   = true;

  processes.forEach(p => { if (p.state !== 'finished') p.state = 'finished'; });
  freeAllMemory();
  updateProcessList();
  updateMemoryVisual();

  setSimStatus('done', 'Simulation complete!');
  updateControlButtons('done');
  showToast('🎉 Simulation complete!', 'success');

  setTimeout(renderStats, 400);
  document.getElementById('exportBtns').style.display = '';
}

// ─── STATISTICS ──────────────────────────────────────────────────
function renderStats() {
  const statsSection = document.getElementById('stats-section');
  const statsSummary = document.getElementById('stats-summary');
  const statsBody    = document.getElementById('stats-body');

  statsSection.style.display = '';
  statsBody.innerHTML        = '';
  statsSummary.innerHTML     = '';

  let totalWait = 0, totalTAT = 0, totalResponse = 0, validCount = 0;

  processes.forEach((p, i) => {
    const ct  = p.completionTime ?? 0;
    const tat = Math.max(0, ct - p.arrivalTime);
    const wt  = Math.max(0, tat - p.burstTime);
    const rt  = Math.max(0, (p.firstRunTime ?? p.arrivalTime) - p.arrivalTime);

    totalWait     += wt;
    totalTAT      += tat;
    totalResponse += rt;
    validCount++;

    const row = document.createElement('tr');
    row.style.animationDelay = `${i * 0.06}s`;
    row.innerHTML = `
      <td>${p.pid}</td>
      <td>${p.arrivalTime}</td>
      <td>${p.burstTime}</td>
      <td>${ct}</td>
      <td>${tat}</td>
      <td>${wt}</td>
      <td>${rt}</td>
    `;
    statsBody.appendChild(row);
  });

  if (validCount === 0) return;

  const avgWait = (totalWait    / validCount).toFixed(2);
  const avgTAT  = (totalTAT     / validCount).toFixed(2);
  const avgResp = (totalResponse / validCount).toFixed(2);

  const totalBurst = processes.reduce((s, p) => s + p.burstTime, 0);
  const maxCT      = Math.max(...processes.map(p => p.completionTime ?? 0));
  const minArr     = Math.min(...processes.map(p => p.arrivalTime));
  const timeSpan   = maxCT - minArr;
  const cpuUtil    = timeSpan > 0 ? Math.min(100, Math.round((totalBurst / timeSpan) * 100)) : 100;

  const items = [
    { label: 'Avg Waiting Time',    value: avgWait,      color: 'var(--accent-warning)'  },
    { label: 'Avg Turnaround Time', value: avgTAT,       color: 'var(--accent-cyan)'     },
    { label: 'Avg Response Time',   value: avgResp,      color: 'var(--accent-purple)'   },
    { label: 'CPU Utilization',     value: `${cpuUtil}%`,color: 'var(--accent-success)'  },
    { label: 'Total Processes',     value: validCount,   color: 'var(--accent-primary)'  },
  ];

  items.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.style.animationDelay = `${i * 0.07}s`;
    card.innerHTML = `
      <div class="stat-value" style="color:${item.color}">${item.value}</div>
      <div class="stat-label">${item.label}</div>
    `;
    statsSummary.appendChild(card);
  });

  setTimeout(() => statsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

// ─── EXPORT ──────────────────────────────────────────────────────
function exportCSV() {
  if (!processes.length) { showToast('No data to export.', 'warning'); return; }

  const algo = document.getElementById('algorithm-select').value.toUpperCase();
  const rows = [['Process', 'Algorithm', 'Arrival Time', 'Burst Time', 'Completion Time',
                  'Turnaround Time', 'Waiting Time', 'Response Time']];

  processes.forEach(p => {
    const ct  = p.completionTime ?? 0;
    const tat = Math.max(0, ct - p.arrivalTime);
    const wt  = Math.max(0, tat - p.burstTime);
    const rt  = Math.max(0, (p.firstRunTime ?? p.arrivalTime) - p.arrivalTime);
    rows.push([p.pid, algo, p.arrivalTime, p.burstTime, ct, tat, wt, rt]);
  });

  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `os_scheduler_${algo}_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported successfully.', 'success');
}

function exportPNG() {
  const wrapper = document.getElementById('gantt-wrapper');
  if (!wrapper) { showToast('No Gantt chart to export.', 'warning'); return; }
  if (typeof html2canvas === 'undefined') {
    const script  = document.createElement('script');
    script.src    = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => captureGantt();
    script.onerror = () => showToast('Failed to load export library.', 'error');
    document.head.appendChild(script);
    showToast('Loading export library…', 'info');
  } else {
    captureGantt();
  }
}

function captureGantt() {
  html2canvas(document.getElementById('gantt-wrapper'), {
    backgroundColor: '#161b22',
    scale: 2, useCORS: true, logging: false,
  }).then(canvas => {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `gantt_chart_${Date.now()}.png`;
    a.click();
    showToast('PNG exported successfully.', 'success');
  }).catch(() => showToast('PNG export failed. Try again.', 'error'));
}

// ─── UI HELPERS ──────────────────────────────────────────────────
function setSimStatus(state, text) {
  const dot  = document.querySelector('.status-dot');
  const span = document.getElementById('statusText');
  if (dot)  dot.className    = `status-dot ${state}`;
  if (span) span.textContent = text;
}

function updateControlButtons(state) {
  const startBtn  = document.getElementById('startBtn');
  const pauseBtn  = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  if (state === 'idle' || state === 'done') {
    startBtn.disabled  = false;
    pauseBtn.disabled  = true;
    resumeBtn.disabled = true;
  } else if (state === 'running') {
    startBtn.disabled  = true;
    pauseBtn.disabled  = false;
    resumeBtn.disabled = true;
  } else if (state === 'paused') {
    startBtn.disabled  = true;
    pauseBtn.disabled  = true;
    resumeBtn.disabled = false;
  }
}

// ─── THEME ───────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('os-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('os-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ─── INIT ────────────────────────────────────────────────────────
(function init() {
  initTheme();
  updateMemoryVisual();
  updateProcessList();
  updateControlButtons('idle');
  onAlgoChange();
})();