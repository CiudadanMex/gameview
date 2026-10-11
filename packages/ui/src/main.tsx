import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// Ciudadan GameView — UI/UX Bloque 1: React renders the app shell;
// the shell boots Phaser inside the world area once it is mounted
// (see App's world effect — no static phaser div needed).
const rootElement = document.getElementById('app-root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<App />);
}
