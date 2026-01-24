# Contributing to Kanban Board

First off, thanks for taking the time to contribute! ❤️

All types of contributions are encouraged and valued. See the [Table of Contents](#table-of-contents) for different ways to help and details about how this project is handled.

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Pull Request Process](#pull-request-process)
- [License](#license)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm (comes with Node.js)

### Installation

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/CodeWithSindhu/kanban-board-js.git
   cd kanban-board-js
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```

## Development Workflow

1. **Start the development server**:
   ```bash
   npm run dev
   ```
   This will start the local server, usually at `http://localhost:5173`.

2. **Make your changes**. The project uses Vite with Vanilla JavaScript.
   - Code is located in the `src` directory.
   - Assets are in `public` or `assets`.

3. **Build for production** (to verify consistent builds):
   ```bash
   npm run build
   ```

4. **Preview the production build**:
   ```bash
   npm run preview
   ```

## Project Structure

```
kanban-board-js/
├── src/
│   ├── modules/
│   │   ├── drag.js      # Drag and drop logic
│   │   ├── history.js   # Undo/Redo history management
│   │   ├── state.js     # Global state management
│   │   ├── storage.js   # LocalStorage handling
│   │   ├── timer.js     # Time tracking functionality
│   │   └── ui.js        # DOM manipulation and UI rendering
│   ├── main.js          # Application entry point
│   └── style.css        # Global styles
├── assets/              # Static assets (images, icons)
├── index.html           # Main HTML file
├── package.json         # Project configuration and scripts
└── README.md            # Project documentation
```

## Pull Request Process

1. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feature/amazing-feature
   ```
2. Commit your changes with clear, descriptive messages.
3. Push your branch to your fork:
   ```bash
   git push origin feature/amazing-feature
   ```
4. Open a **Pull Request** on the main repository.
5. Provide a clear description of the changes and link to any relevant issues.

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
