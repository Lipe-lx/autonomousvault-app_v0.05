import './polyfills';
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { AuthGate } from './components/auth/AuthGate';
import { SecurityService } from './services/securityService';

// Initialize production security measures before React renders
// This must happen early to protect console and global namespace
SecurityService.initializeProductionSecurity();


const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <AuthProvider>
            <AuthGate>
                <App />
            </AuthGate>
        </AuthProvider>
    </React.StrictMode>
);
