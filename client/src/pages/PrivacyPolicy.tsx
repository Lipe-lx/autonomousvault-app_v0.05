import React from 'react';
import { Database, Lock, EyeOff, ArrowLeft } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
    const handleReturn = () => {
        window.location.reload(); // Simplest way to return to initial state/auth check
    };
    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200 p-8 font-sans">
            <div className="max-w-3xl mx-auto space-y-8">

                {/* Header */}
                <div className="border-b border-slate-700 pb-6 mb-10">
                    <h1 className="text-4xl font-light text-white mb-2">Privacy Policy</h1>
                    <p className="text-slate-400">Last Updated: December 23, 2025</p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 mb-8">
                    <p className="text-blue-200 text-sm">
                        This Privacy Policy explains how AutonomousVault handles your data.
                        In short: We don't want your data, and we can't see your keys.
                    </p>
                </div>

                {/* Sections */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-[#E7FE55]">
                        <Database size={20} />
                        <h2 className="text-2xl font-light text-white">1. Data Collection & Storage</h2>
                    </div>
                    <p className="leading-relaxed text-slate-300">
                        AutonomousVault operates on a <strong>"Local-First"</strong> architecture.
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-slate-400">
                        <li><strong>Private Keys:</strong> Generated locally and stored ONLY in your browser's encrypted storage (IndexedDB). They never leave your device unencrypted.</li>
                        <li><strong>Chat History:</strong> Stored locally on your device.</li>
                        <li><strong>Usage Data:</strong> We do not collect analytics or tracking data.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-[#E7FE55]">
                        <EyeOff size={20} />
                        <h2 className="text-2xl font-light text-white">2. Third-Party Services</h2>
                    </div>
                    <p className="leading-relaxed text-slate-300">
                        While the app runs locally, it interacts with the following services to function:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="bg-slate-800 p-4 rounded-lg">
                            <h3 className="text-white font-medium mb-1">Google Gemini (AI)</h3>
                            <p className="text-xs text-slate-400">Processes user prompts to generate responses. Your keys are NOT sent to the AI.</p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-lg">
                            <h3 className="text-white font-medium mb-1">Firebase (Auth)</h3>
                            <p className="text-xs text-slate-400">Handles email/password and Google login. We only see your User ID.</p>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-lg">
                            <h3 className="text-white font-medium mb-1">RPC Nodes</h3>
                            <p className="text-xs text-slate-400">Public nodes (Solana, Hyperliquid) receive your signed transactions to execute them on-chain.</p>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-[#E7FE55]">
                        <Lock size={20} />
                        <h2 className="text-2xl font-light text-white">3. Your Rights (GDPR/LGPD)</h2>
                    </div>
                    <p className="leading-relaxed text-slate-300">
                        You have complete control over your data:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-slate-400">
                        <li><strong>Access:</strong> All your data is visible within the application.</li>
                        <li><strong>Deletion:</strong> You can use the "Delete Account" button in Settings to wipe all local data and delete your Firebase authentication record.</li>
                        <li><strong>Portability:</strong> You can export your private keys at any time via the Backup feature.</li>
                    </ul>
                </section>

                <div className="pt-10 border-t border-slate-700 flex justify-between items-center mt-12">
                    <p className="text-xs text-slate-500">AutonomousVault v0.1</p>
                    <button onClick={handleReturn} className="text-[#E7FE55] hover:underline flex items-center gap-2">
                        <ArrowLeft size={14} /> Return to App
                    </button>
                </div>
            </div>
        </div>
    );
};

