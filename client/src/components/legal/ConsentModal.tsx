
import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storageService';
import { ArrowRight, ShieldCheck } from 'lucide-react';

interface ConsentModalProps {
    userId: string | null; // Firebase User ID
}

export const ConsentModal: React.FC<ConsentModalProps> = ({ userId }) => {
    const [hasConsented, setHasConsented] = useState<boolean>(true); // Default true to avoid flash, we verify in effect
    const [isLoading, setIsLoading] = useState(true);

    // User-specific consent key
    const consentKey = userId ? `legal_consent_v1_${userId}` : null;

    useEffect(() => {
        const checkConsent = async () => {
            if (!consentKey) {
                setIsLoading(false);
                return;
            }
            const consent = await StorageService.getItem(consentKey);
            setHasConsented(consent === 'true');
            setIsLoading(false);
        };
        checkConsent();
    }, [consentKey]);

    const handleAccept = async () => {
        if (consentKey) {
            await StorageService.setItem(consentKey, 'true');
        }
        setHasConsented(true);
    };

    if (isLoading || hasConsented) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0f172a] border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="p-8 pb-4 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#E7FE55]/10 mb-4">
                        <ShieldCheck size={32} className="text-[#E7FE55]" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Welcome to AutonomousVault</h2>
                    <p className="text-slate-400 text-sm">Use AI to manage your DeFi portfolio autonomously.</p>
                </div>

                {/* Content */}
                <div className="px-8 py-4 space-y-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-300 border border-slate-700">
                        <p className="mb-2 font-semibold text-white">Before you continue:</p>
                        <ul className="space-y-2 list-disc pl-4 text-slate-400">
                            <li>This software is <strong>experimental</strong>.</li>
                            <li>You maintain <strong>sole custody</strong> of your keys.</li>
                            <li>The developers are <strong>not liable</strong> for any funds lost.</li>
                        </ul>
                    </div>

                    <p className="text-xs text-center text-slate-500 mt-4 leading-relaxed">
                        By clicking "I Agree", you acknowledge that you have read and agree to our<br />
                        <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="text-[#E7FE55] hover:underline">Terms of Use</a> and <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-[#E7FE55] hover:underline">Privacy Policy</a>.
                    </p>
                </div>

                {/* Footer */}
                <div className="p-8 pt-4">
                    <button
                        onClick={handleAccept}
                        className="w-full bg-[#E7FE55] hover:bg-[#d9f044] text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#E7FE55]/20"
                    >
                        I Agree & Continue <ArrowRight size={18} />
                    </button>
                </div>

            </div>
        </div>
    );
};

