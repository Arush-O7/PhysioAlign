import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConnectionBanner } from './components/ConnectionBanner';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConnectionBanner />
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
