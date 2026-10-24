import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './state/store';
import { DialogProvider } from './components/ui/dialogs';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

createRoot(root).render(
  <StrictMode>
    <StoreProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </StoreProvider>
  </StrictMode>,
);

// Service worker: served edition only (file:// cannot register one). Same-origin, no network beyond the loopback host.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline cache is a convenience, not a requirement */ });
  });
}
