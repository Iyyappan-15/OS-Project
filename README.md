# OS Scheduler Visualizer

> An interactive, browser-based CPU scheduling simulator with real-time Gantt charts, memory allocation visualization, and detailed statistics.

---

## ✨ Features

| Feature | Details |
|---------|---------|
| **5 Scheduling Algorithms** | FCFS, SJF, Round Robin, Priority (Non-Preemptive), SRTF |
| **Arrival Time Support** | Processes can arrive at different times; IDLE gaps shown in Gantt |
| **Real-Time Gantt Chart** | Animated blocks with time axis and timestamps |
| **Memory Allocation** | Contiguous allocation with live visual and usage percentage |
| **Statistics Panel** | Per-process: Completion, Turnaround, Waiting, Response Time + Averages |
| **Custom Toast Notifications** | Slide-in toasts replace all native `alert()` popups |
| **Process Management** | Add, delete individual processes or clear all |
| **Speed Control** | 0.5× to 8× simulation speed slider |
| **Dark / Light Mode** | Persistent theme toggle (Slate Forge dark-first design) |
| **Export Results** | Download Gantt chart as PNG or statistics as CSV |

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/Iyyappan-15/OS-Project.git
cd OS-Project

# Open in browser (no build step needed)
# Option 1: Use VS Code Live Server
# Option 2: Use Python
python -m http.server 8080
# Then open http://localhost:8080
```

---

## 📖 Usage Guide

1. **Select Algorithm** — Choose from FCFS, SJF, Round Robin, Priority, or SRTF
2. **Set Memory** — Enter total system memory units (default: 20)
3. **Add Processes** — Enter PID, Arrival Time, Burst Time, and Memory Required
   - For Round Robin: set the **Time Quantum**
   - For Priority: set the **Priority** (lower = higher priority)
4. **Control Speed** — Adjust the speed slider (0.5× to 8×)
5. **Start** — Click ▶ Start to begin the simulation
6. **Observe** — Watch the Gantt chart, memory blocks, and process states update live
7. **View Stats** — After completion, see the statistics table with all metrics
8. **Export** — Download results as PNG or CSV

---

## 🧠 Algorithm Reference

### FCFS — First Come First Serve
Processes are executed in the order they arrive. Non-preemptive.

### SJF — Shortest Job First
Processes with the shortest burst time run first. Non-preemptive. Ties broken by arrival order.

### Round Robin (RR)
Each process gets a fixed **Time Quantum**. If not finished, it goes back to the end of the queue.

### Priority Scheduling
Processes are ordered by priority value. Lower number = higher priority. Non-preemptive.

### SRTF — Shortest Remaining Time First
Preemptive version of SJF. At each tick, the process with the shortest remaining time runs. Context switches are reflected in the Gantt chart.

---

## 📊 Statistics Explained

| Metric | Formula |
|--------|---------|
| **Completion Time (CT)** | When the process finishes |
| **Turnaround Time (TAT)** | CT − Arrival Time |
| **Waiting Time (WT)** | TAT − Burst Time |
| **Response Time (RT)** | First CPU time − Arrival Time |
| **CPU Utilization** | Total Burst / Time Span × 100% |

---

## 🛠️ Tech Stack

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

- **HTML5** — Semantic structure with ARIA accessibility
- **CSS3** — Custom "Slate Forge" design system, glassmorphism, CSS variables
- **Vanilla JavaScript** — No frameworks, no build tools required
- **Google Fonts** — Space Grotesk, Inter, JetBrains Mono
- **html2canvas** (CDN, loaded on demand) — PNG export

---

## 📁 Project Structure

```
OS-Project/
├── index.html   # Application markup
├── style.css    # Slate Forge design system + component styles
├── script.js    # All algorithms, simulation engine, and UI logic
└── README.md    # Documentation
```

---

## 🤝 Contributing

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a Pull Request

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

*Built with ❤️ for learning Operating System concepts and process scheduling.*
