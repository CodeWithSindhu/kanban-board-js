# ProKanban 🚀

ProKanban is a premium, fully responsive Kanban board application built with vanilla JavaScript, modern CSS, and HTML5. It allows users to track tasks, manage time effectively, and visualize progress with a sleek, dark-themed glassmorphism UI.

![ProKanban Preview](https://via.placeholder.com/800x400?text=ProKanban+Board+Preview)

## ✨ Features

### **Core Functionality**
-   **Kanban Workflow**: Organize tasks seamlessly into **To Do**, **In Progress**, **On Hold**, and **Done** columns.
-   **Drag & Drop**: Smooth, intuitive drag-and-drop interface for moving tasks.
    -   *Touch Support*: Fully functional on mobile and tablet devices via a custom polyfill.
-   **Persistence**: Auto-saves all tasks, history, and timer states to the browser's **LocalStorage**, so you never lose your work.

### **⏱️ Advanced Time Tracking**
-   **Integrated Task Timers**: Track exactly how long you spend on each task with millisecond precision.
-   **Smart Controls**: Start/Pause controls directly on the card.
-   **Automation**: Timers automatically pause when a task is moved to "On Hold" or "Done".
-   **Detailed Logs**: View a complete history of work sessions (Start Time, End Time, Duration) for every task.

### **🎨 Premium UI/UX**
-   **Responsive Design**:
    -   **Desktop**: Spacious 4-column layout.
    -   **Tablet**: Optimized 2x2 grid layout.
    -   **Mobile**: Streamlined vertical stack layout (optimized for screens as small as 360px).
-   **Visual Effects**:
    -   🎉 **Confetti Celebration**: Bursts of confetti when you move a task to "Done".
    -   **Glassmorphism**: Modern frosted-glass aesthetic with dynamic gradients.
    -   **Activity Log**: detailed history tracking with color-coded status badges for all actions.

## 🛠️ Technology Stack

-   **Frontend**: Vanilla JavaScript (ES6+)
-   **Styling**: Modern CSS3 (CSS Variables, Flexbox, CSS Grid, Glassmorphism)
-   **Markup**: HTML5
-   **Storage**: LocalStorage API
-   **Libraries**:
    -   `canvas-confetti`: For celebration effects.
    -   `DragDropTouch`: Adds Drag & Drop support for touch devices.

## 📂 Project Structure

```
kanban-board-js/
├── index.html      # Main application entry point
├── README.md       # Project documentation (you are here)
└── src/
    ├── main.js     # Core logic (Drag & Drop, Timer, State Management)
    └── style.css   # Global styles and responsive definitions
```

## 🚀 Getting Started

1.  **Download** or Clone the repository.
2.  **Open `index.html`** in any modern web browser (Chrome, Edge, Firefox, Safari).
    -   No build step (`npm start` etc.) is required!
    -   *Tip*: For the best experience, use a local development server (like VS Code's "Live Server") to ensure all assets load perfectly.

## 📱 Mobile Experience

The board is fully optimized for mobile productivity:
-   **Tap & Hold to Drag**: Move tasks easily on your phone.
-   **Smart Layout**: The "Activity Log" and "Time Logs" adapt to small screens, stacking information vertically for better readability.
-   **Clean Interface**: Timer controls are hidden in the "Done" column to keep the view clutter-free.

## 📝 License

This project is created for educational and personal productivity use. Feel free to modify and expand it!
