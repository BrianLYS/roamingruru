import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MailingSignup from './MailingSignup';
import './style.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{new URLSearchParams(location.search).get('signup') === '1' ? <MailingSignup /> : <App />}</React.StrictMode>);
