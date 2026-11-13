import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { ToastProvider } from './components/ui.tsx';
import { followHomeAssistantTheme } from './lib/haTheme.ts';
import './styles.css';

// Before the first render, so a Home Assistant theme doesn't flash the default palette first.
followHomeAssistantTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
