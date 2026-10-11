import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyTheme, getTheme } from './utils/theme';

// set before the first paint so there's no flash of the wrong palette
applyTheme(getTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
