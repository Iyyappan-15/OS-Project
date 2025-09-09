    let totalMemory = 20;
    let memory = new Array(totalMemory).fill(null);
    let processes = [], currentIndex = 0, simInterval = null;
    let isPaused = false, processOrder = [], currentProcess = null;

    const colorMap = {};
    function getColorForPid(pid) {
      if (colorMap[pid]) return colorMap[pid];
      const colors = [
        'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
        'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)', 
        'linear-gradient(135deg, #45b7d1 0%, #96c93d 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      ];
      let hash = [...pid].reduce((acc, c) => acc + c.charCodeAt(0), 0);
      return colorMap[pid] = colors[hash % colors.length];
    }

    function addProcess() {
      const pid = document.getElementById('pid').value.trim();
      const burst = parseInt(document.getElementById('burst').value);
      const memReq = parseInt(document.getElementById('memReq').value);
      
      if (!pid || burst <= 0 || memReq <= 0 || memReq > totalMemory) {
        showAlert('Please enter valid values.', 'error');
        return;
      }
      
      if (processes.find(p => p.pid === pid)) {
        showAlert('Process ID must be unique.', 'error');
        return;
      }
      
      processes.push({ 
        pid, 
        burstTime: burst, 
        memoryReq: memReq, 
        remainingTime: burst, 
        state: 'waiting', 
        memStart: -1 
      });
      
      updateProcessList();
      clearInputs();
      showAlert(`Process ${pid} added successfully!`, 'success');
    }

    function showAlert(message, type = 'info') {
      // You can implement a custom toast notification here
      alert(message);
    }

    function clearInputs() {
      document.getElementById('pid').value = 'P' + (processes.length + 1);
      document.getElementById('burst').value = 4;
      document.getElementById('memReq').value = 3;
    }

    function updateProcessList() {
      const container = document.getElementById('processes');
      container.innerHTML = '';
      
      processes.forEach((p, index) => {
        const div = document.createElement('div');
        div.className = 'process';
        div.style.animationDelay = `${index * 0.1}s`;
        
        const progress = ((p.burstTime - p.remainingTime) / p.burstTime) * 100;
        
        div.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${getColorForPid(p.pid)};"></div>
            <strong>${p.pid}</strong> | Burst: ${p.burstTime} | Memory: ${p.memoryReq} | 
            <span style="padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; 
                         color: ${p.state === 'running' ? '#059669' : p.state === 'finished' ? '#7c3aed' : '#f59e0b'};
                         background: ${p.state === 'running' ? '#ecfdf5' : p.state === 'finished' ? '#f3e8ff' : '#fef3c7'};">
              ${p.state.toUpperCase()}
            </span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
        `;
        
        container.appendChild(div);
      });
    }

    function allocateMemory(process) {
      let start = -1, count = 0;
      for (let i = 0; i < totalMemory; i++) {
        if (memory[i] === null) {
          if (start === -1) start = i;
          count++;
          if (count === process.memoryReq) {
            for (let j = start; j < start + count; j++) memory[j] = process.pid;
            process.memStart = start;
            return true;
          }
        } else { 
          start = -1; 
          count = 0; 
        }
      }
      return false;
    }

    function freeMemory(p) {
      if (p.memStart >= 0) {
        for (let i = p.memStart; i < p.memStart + p.memoryReq; i++) {
          memory[i] = null;
        }
      }
      p.memStart = -1;
    }

    function freeAllMemory() {
      for (let p of processes) freeMemory(p);
    }

    function updateMemoryVisual() {
      const memDiv = document.getElementById('memory-visual');
      memDiv.innerHTML = '';
      
      let start = 0;
      while (start < totalMemory) {
        let pid = memory[start], length = 1;
        while (start + length < totalMemory && memory[start + length] === pid) length++;
        
        const block = document.createElement('div');
        block.className = 'mem-block ' + (pid === null ? 'free' : '');
        block.style.background = pid === null ? 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)' : getColorForPid(pid);
        block.textContent = pid === null ? `Free (${length})` : `${pid} (${length})`;
        block.style.flex = length;
        block.style.minWidth = `${Math.max(60, length * 20)}px`;
        
        memDiv.appendChild(block);
        start += length;
      }
    }

    function startSimulation() {
      if (simInterval) {
        showAlert('Simulation is already running!', 'error');
        return;
      }
      
      if (!processes.length) {
        showAlert('Add processes first!', 'error');
        return;
      }
      
      // Reset all processes
      processes.forEach(p => { 
        p.state = 'waiting'; 
        p.remainingTime = p.burstTime; 
        p.memStart = -1; 
      });
      
      freeAllMemory();
      
      // Try to allocate memory for all processes
      for (let p of processes) {
        if (!allocateMemory(p)) {
          showAlert(`Not enough memory for ${p.pid}`, 'error');
          freeAllMemory(); 
          updateMemoryVisual(); 
          updateProcessList(); 
          return;
        }
      }
      
      updateMemoryVisual(); 
      updateProcessList();
      
      const algo = document.getElementById('algorithm-select').value;
      processOrder = algo === 'sjf' ? 
        [...processes].sort((a, b) => a.burstTime - b.burstTime) : 
        [...processes];
      
      currentIndex = 0; 
      isPaused = false; 
      currentProcess = null;
      document.getElementById('gantt-chart').innerHTML = '';
      
      showAlert('Simulation started!', 'success');
      runNextProcess();
    }

    function runNextProcess() {
      if (currentIndex >= processOrder.length) {
        showAlert('Simulation complete!', 'success');
        return;
      }
      
      currentProcess = processOrder[currentIndex];
      currentProcess.state = 'running';
      updateProcessList();
      
      const ganttChart = document.getElementById('gantt-chart');
      const block = document.createElement('div');
      block.className = 'gantt-block';
      block.style.background = getColorForPid(currentProcess.pid);
      block.textContent = currentProcess.pid;
      block.style.width = '0px';
      block.style.transition = 'width 1s ease-in-out';
      
      ganttChart.appendChild(block);
      
      let runTime = currentProcess.remainingTime, elapsed = 0;
      
      simInterval = setInterval(() => {
        if (isPaused) return;
        
        if (elapsed < runTime) {
          elapsed++;
          currentProcess.remainingTime--;
          block.style.width = `${Math.max(40, elapsed * 40)}px`;
          updateProcessList();
        } else {
          clearInterval(simInterval);
          simInterval = null;
          freeMemory(currentProcess);
          currentProcess.state = 'finished';
          updateMemoryVisual(); 
          updateProcessList(); 
          currentIndex++;
          
          setTimeout(runNextProcess, 500); // Small delay between processes
        }
      }, 1000);
    }

    function pauseSimulation() { 
      isPaused = true; 
      showAlert('Simulation paused', 'info');
    }
    
    function resumeSimulation() { 
      isPaused = false; 
      showAlert('Simulation resumed', 'info');
    }

    function updateTotalMemory() {
      const newSize = parseInt(document.getElementById('memSize').value);
      if (newSize > totalMemory) {
        memory = memory.concat(new Array(newSize - totalMemory).fill(null));
      } else if (newSize < totalMemory) {
        memory = memory.slice(0, newSize);
      }
      totalMemory = newSize;
      updateMemoryVisual();
    }

    function resetSimulation() {
      if (simInterval) clearInterval(simInterval);
      simInterval = null; 
      isPaused = false;
      memory.fill(null); 
      processes = []; 
      currentIndex = 0; 
      processOrder = [];
      
      updateProcessList(); 
      updateMemoryVisual();
      document.getElementById('gantt-chart').innerHTML = '';
      clearInputs();
      
      showAlert('Simulation reset!', 'info');
    }

    // Theme Management
    function initTheme() {
      const savedTheme = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
    
    function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      
      // Add a subtle animation effect
      document.body.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        document.body.style.transition = '';
      }, 300);
    }

    // Initialize
    initTheme();
    updateMemoryVisual();
    updateProcessList();