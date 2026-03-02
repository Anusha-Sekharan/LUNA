# Luna

Luna AI Bestie is a personalized AI assistant desktop application designed to be a virtual companion that integrates seamlessly with your operating system. Built with Electron, React, Vite, and Python, Luna monitors your system health, automates local workflows, and helps manage tasks dynamically via an interactive companion interface.

## Features

- **Floating UI & Interactive Interface:** The assistant lives as an always-on-top, frameless widget on your screen, which can periodically check in on you.
- **Smart OS Integrations:**
  - **Launch & Focus Apps:** Seamlessly launch or focus applications natively (e.g., VS Code, Spotify, your web browser) using Python bridge and PyAutoGUI.
  - **Automated Messaging:** Can send WhatsApp messages and Gmails automatically using simulated typing.
  - **Clipboard Monitoring:** Automatically reads and updates based on clipboard text changes.
  - **Vision / Screenshots:** Capable of capturing your current screen context.
- **System Health Monitoring:** Active tracking of CPU usage, RAM (total and active), Battery level, Temperature, Network speeds, and the Top 3 most demanding running applications.
- **Scene Modes:** Context-aware shortcuts to adapt your environment:
  - **Coding Mode:** Focuses or launches VS Code and opens StackOverflow.
  - **Cinema Mode:** Focuses YouTube and toggles audio mute.
  - **Relax Mode:** Focuses Spotify.
- **Contextual Memory & Database:** Utilizes `better-sqlite3` to store:
  - Conversational memories with emotional context and vectors/embeddings.
  - User profiles, specific entities, and historical logs.
  - Recency biases, importance indexing, and memory consolidation.

## Tech Stack

- **Frontend:** React, Vite
- **Backend (Desktop):** Electron, Node.js (`main.js`, `database.js`)
- **Storage:** SQLite (`better-sqlite3`)
- **System Operations:** Systeminformation, `face-api.js` (for vision capabilities)
- **OS Bridge:** Python (Handles low-level operations such as PyAutoGUI for automations).

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/)
- [Python 3](https://www.python.org/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd LUNA-main
   ```

2. **Install Node dependencies:**
   ```bash
   npm install
   ```

3. **Development Mode:**
   To start the application locally with hot-reloading (spawns both Vite dev server and Electron window):
   ```bash
   npm start
   ```
   *(Alternative commands: `npm run vite:dev` and `npm run electron:dev`)*

4. **Production Build:**
   To build the Vite app and package it using `electron-builder`:
   ```bash
   npm run dist
   ```
   This outputs the packaged executable into the `dist-electron` folder (e.g., NSIS installer for Windows).

## Project Structure

- `main.js` - The entry point for Electron. Handles IPC communication, window lifecycle management, and system interval polling.
- `database.js` - SQLite connections and migration/query logic for memories, profiling, and logs.
- `python/bridge.py` - Core Python script that executes system operations like automations, sending WhatsApp messages, emails, launching contexts, and typing.
- `src/` - React frontend code alongside services like personality and memory management.
- `package.json` - Dependency, versioning, and script records.

## License
ISC
