import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/base.css';

const container = document.getElementById('root');

if (!container) {
  document.body.innerHTML =
    '<div style="padding:40px;font-family:system-ui;color:#eef7ff;background:#050b16;min-height:100vh">' +
    '<h1>Winter Arc could not start</h1><p>The application root element is missing.</p></div>';
} else {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
