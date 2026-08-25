import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// Global error handler for non-fatal browser/storage/network transport glitches (e.g. tab hiding / iframe reload)
if (typeof window !== 'undefined') {
  const isNonFatalStorageError = (err: unknown): boolean => {
    if (!err) return false;
    const candidates: string[] = [];

    if (typeof err === 'string') {
      candidates.push(err);
    } else if (typeof err === 'object' && err !== null) {
      const e = err as Record<string, any>;
      if (e.message) candidates.push(String(e.message));
      if (e.name) candidates.push(String(e.name));
      if (e.stack) candidates.push(String(e.stack));
      if (e.reason) {
        if (typeof e.reason === 'string') candidates.push(e.reason);
        else if (typeof e.reason === 'object') {
          if (e.reason.message) candidates.push(String(e.reason.message));
          if (e.reason.name) candidates.push(String(e.reason.name));
          if (e.reason.stack) candidates.push(String(e.reason.stack));
        }
      }
      if (e.error) {
        if (typeof e.error === 'string') candidates.push(e.error);
        else if (typeof e.error === 'object') {
          if (e.error.message) candidates.push(String(e.error.message));
          if (e.error.name) candidates.push(String(e.error.name));
          if (e.error.stack) candidates.push(String(e.error.stack));
        }
      }
    }

    const combined = candidates.join(' ').toLowerCase();

    return (
      combined.includes('database is closing') ||
      combined.includes('closing/hidden') ||
      combined.includes('indexeddb') ||
      combined.includes('idbdatabase') ||
      combined.includes('webchannelconnection') ||
      combined.includes("failed to execute 'transaction'") ||
      combined.includes('database connection is closing')
    );
  };

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isNonFatalStorageError(event) || isNonFatalStorageError(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        console.warn('[Suppressed non-fatal browser storage/network event]', event.reason);
      }
    },
    true
  );

  window.addEventListener(
    'error',
    (event) => {
      if (isNonFatalStorageError(event) || isNonFatalStorageError(event.error)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        console.warn('[Suppressed non-fatal browser storage/network event]', event.error || event.message);
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(<App />);
