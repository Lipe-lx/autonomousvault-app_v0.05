import './polyfills';
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { AuthGate } from './components/auth/AuthGate';
import { SecurityService } from './services/securityService';
import { TermsOfUse } from './pages/TermsOfUse';
import { PrivacyPolicy } from './pages/PrivacyPolicy';

// Initialize production security measures before React renders
// This must happen early to protect console and global namespace
SecurityService.initializeProductionSecurity();


const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);

// Simple routing for legal pages to support opening in new tabs
const path = window.location.pathname;

if (path === '/terms') {
    root.render(
        <React.StrictMode>
            <div className="min-h-screen bg-[#0f1015] text-[#e4e5e9]">
                <TermsOfUse onBack={() => window.location.href = '/'} />
            </div>
        </React.StrictMode>
    );
} else if (path === '/privacy') {
    root.render(
        <React.StrictMode>
            <div className="min-h-screen bg-[#0f1015] text-[#e4e5e9]">
                <PrivacyPolicy onBack={() => window.location.href = '/'} />
            </div>
        </React.StrictMode>
    );
} else {
    root.render(
        <React.StrictMode>
            <AuthProvider>
                <AuthGate>
                    <App />
                </AuthGate>
            </AuthProvider>
        </React.StrictMode>
    );
}
