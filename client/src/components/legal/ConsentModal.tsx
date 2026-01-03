
import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../../services/storageService';
import { ArrowRight, ShieldCheck } from 'lucide-react';

interface ConsentModalProps {
    userId: string | null; // Firebase User ID
    onAccept?: () => void; // Callback when user accepts terms
}

export const ConsentModal: React.FC<ConsentModalProps> = ({ userId, onAccept }) => {
    const [hasConsented, setHasConsented] = useState<boolean>(true); // Default true to avoid flash, we verify in effect
    const [isLoading, setIsLoading] = useState(true);
    const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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

    // Detect when user scrolls to bottom
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
            // Check if scrolled to bottom (with generous 50px threshold for better UX)
            // Also check if content doesn't need scrolling at all (scrollHeight <= clientHeight)
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 50 || scrollHeight <= clientHeight;
            setHasScrolledToBottom(isAtBottom);
        };

        scrollContainer.addEventListener('scroll', handleScroll);
        
        // Check initial state in case content is short enough to not need scrolling
        // Use setTimeout to ensure DOM is fully rendered
        setTimeout(handleScroll, 100);

        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, [isLoading, hasConsented]);

    const handleAccept = async () => {
        if (consentKey && hasAcceptedTerms) {
            await StorageService.setItem(consentKey, 'true');
            setHasConsented(true);
            onAccept?.(); // Trigger callback to redirect
        }
    };

    if (isLoading || hasConsented) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-3xl rounded shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="p-6 pb-4 text-center border-b border-[rgba(60,63,75,0.4)]">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#E7FE55]/10 mb-3">
                        <ShieldCheck size={28} className="text-[#E7FE55]" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">User Acknowledgement & Risk Disclosure</h2>
                    <p className="text-slate-400 text-sm">Please read and acknowledge before proceeding</p>
                </div>

                {/* Content - Scrollable */}
                <div ref={scrollContainerRef} className="px-6 py-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-4 text-sm text-slate-300">
                        <p className="text-slate-200 leading-relaxed">
                            By proceeding, you acknowledge and agree that:
                        </p>

                        <div className="space-y-3">
                            <div className="bg-[rgba(30,32,40,0.6)] rounded p-4 border border-[rgba(60,63,75,0.3)]">
                                <h3 className="font-semibold text-white mb-2">Non-Custodial & Autonomous Execution</h3>
                                <p className="text-slate-400 leading-relaxed">
                                    This Autonomous Vault is a non-custodial system. You retain control of your assets and explicitly authorize autonomous agents ("Dealers") to execute on-chain operations based on parameters and permissions you define.
                                </p>
                            </div>

                            <div className="bg-[rgba(30,32,40,0.6)] rounded p-4 border border-[rgba(60,63,75,0.3)]">
                                <h3 className="font-semibold text-white mb-2">No Advice, No Guarantees</h3>
                                <p className="text-slate-400 leading-relaxed">
                                    The system does not provide investment, financial, legal, or tax advice. Execution outcomes are not guaranteed and may differ from expectations due to market conditions, liquidity, MEV, or blockchain-level factors.
                                </p>
                            </div>

                            <div className="bg-[rgba(30,32,40,0.6)] rounded p-4 border border-[rgba(60,63,75,0.3)]">
                                <h3 className="font-semibold text-white mb-2">User Responsibility</h3>
                                <p className="text-slate-400 leading-relaxed">
                                    You are solely responsible for your vault configuration, permissions granted, private key security, and all resulting transactions. Feedback or evaluations do not constitute direct control over autonomous execution.
                                </p>
                            </div>

                            <div className="bg-[rgba(30,32,40,0.6)] rounded p-4 border border-[rgba(60,63,75,0.3)]">
                                <h3 className="font-semibold text-white mb-2">Risk Acceptance</h3>
                                <p className="text-slate-400 leading-relaxed">
                                    You understand and accept the risks of digital assets and smart contracts, including potential loss of funds, execution failures, oracle errors, cross-chain risks, and regulatory changes.
                                </p>
                            </div>

                            <div className="bg-[rgba(30,32,40,0.6)] rounded p-4 border border-[rgba(60,63,75,0.3)]">
                                <h3 className="font-semibold text-white mb-2">Third-Party Protocols</h3>
                                <p className="text-slate-400 leading-relaxed">
                                    The Autonomous Vault may interact with external protocols (DEXs, bridges, oracles). No liability is assumed for failures or losses arising from such integrations.
                                </p>
                            </div>

                            <div className="bg-[rgba(30,32,40,0.6)] rounded p-4 border border-[rgba(60,63,75,0.3)]">
                                <h3 className="font-semibold text-white mb-2">Acceptance On-Chain</h3>
                                <p className="text-slate-400 leading-relaxed">
                                    If you interact directly with the smart contracts, your first successful on-chain transaction constitutes full acceptance of these terms.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded">
                            <p className="text-amber-200 text-xs leading-relaxed">
                                By clicking "I Agree" or executing an on-chain transaction, you confirm that you have read, understood, and accept full responsibility for using an autonomous, non-custodial system.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer with Checkbox and Button */}
                <div className="p-6 pt-4 border-t border-[rgba(60,63,75,0.4)] space-y-4">
                    {/* Scroll requirement notice */}
                    {!hasScrolledToBottom && (
                        <div className="flex items-center gap-2 text-amber-400 text-xs">
                            <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                            <span>Please scroll to the bottom to continue</span>
                        </div>
                    )}

                    {/* Checkbox */}
                    <label className={`flex items-start gap-3 ${hasScrolledToBottom ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} group`}>
                        <div className="relative flex items-center justify-center mt-0.5">
                            <input
                                type="checkbox"
                                checked={hasAcceptedTerms}
                                onChange={(e) => setHasAcceptedTerms(e.target.checked)}
                                disabled={!hasScrolledToBottom}
                                className="w-5 h-5 border-2 border-slate-600 rounded bg-slate-800 checked:bg-[#E7FE55] checked:border-[#E7FE55] focus:ring-2 focus:ring-[#E7FE55]/50 focus:ring-offset-0 transition-all cursor-pointer appearance-none checked:after:content-['✓'] checked:after:text-black checked:after:text-sm checked:after:font-bold checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                        <span className={`text-sm ${hasScrolledToBottom ? 'text-slate-300 group-hover:text-slate-200' : 'text-slate-500'} transition-colors select-none leading-relaxed`}>
                            I have read and understood all the terms, risks, and responsibilities outlined above. I consciously accept full responsibility for using this autonomous, non-custodial system.
                        </span>
                    </label>

                    {/* Accept Button */}
                    <button
                        onClick={handleAccept}
                        disabled={!hasAcceptedTerms || !hasScrolledToBottom}
                        className={`w-full font-bold py-3.5 rounded transition-all flex items-center justify-center gap-2 shadow-lg ${
                            hasAcceptedTerms && hasScrolledToBottom
                                ? 'bg-[#E7FE55] hover:bg-[#d9f044] text-black shadow-[#E7FE55]/20 cursor-pointer'
                                : 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                        }`}
                    >
                        I Agree & Continue <ArrowRight size={18} />
                    </button>
                </div>

            </div>

            {/* Custom Scrollbar Styles */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(51, 65, 85, 0.3);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(100, 116, 139, 0.5);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(100, 116, 139, 0.7);
                }
            `}</style>
        </div>
    );
};

