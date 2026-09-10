import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import CorporateWebsite from './desktop/CorporateWebsite.jsx';

const BREAKPOINT = 880;

function Root() {
  // Choose the interface once when the app opens. Resizing or minimizing a
  // desktop window must not replace the user's current desktop session.
  const isDesktop = React.useMemo(() => window.innerWidth >= BREAKPOINT, []);
  return isDesktop ? <CorporateWebsite /> : <App />;
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The application remains fully usable online if registration is blocked.
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
