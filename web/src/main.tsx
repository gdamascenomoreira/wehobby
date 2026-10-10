import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { createMsalAuthClient } from './auth/msalAuthClient';
import { SessionProvider } from './auth/session';
import './i18n';
import './App.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider createAuthClient={createMsalAuthClient}>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
