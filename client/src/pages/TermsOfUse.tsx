import React from 'react';
import { Shield, AlertTriangle, Key, Terminal, ArrowLeft } from 'lucide-react';

export const TermsOfUse: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200 p-8 font-sans">
            <div className="max-w-3xl mx-auto space-y-8">

                {/* Header */}
                <div className="border-b border-slate-700 pb-6 mb-10">
                    <h1 className="text-4xl font-light text-white mb-2">Terms of Use</h1>
                    <p className="text-slate-400">Effective Date: December 23, 2025</p>
                </div>

                {/* Important Disclaimer Card */}
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-3 text-red-400">
                        <AlertTriangle size={24} />
                        <h2 className="text-xl font-semibold">Critical Disclaimer</h2>
                    </div>
                    <p className="text-sm leading-relaxed text-red-100/80">
                        AutonomousVault is experimental, open-source software. It is provided "AS IS", without warranty of any kind.
                        You use this software entirely at your own risk. The developers constitute a non-custodial entity and accept
                        no liability for lost funds, private key mismanagement, or protocol failures.
                    </p>
                </div>

                {/* Sections */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-[#E7FE55]">
                        <Key size={20} />
                        <h2 className="text-2xl font-light text-white">1. Self-Custody Model</h2>
                    </div>
                    <p className="leading-relaxed text-slate-300">
                        By using AutonomousVault, you acknowledge that:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-slate-400">
                        <li>You are the sole custodian of your cryptographic private keys.</li>
                        <li>Private keys are encrypted and stored solely within your device's browser (IndexedDB).</li>
                        <li>We (the developers) never have access to your private keys or funds.</li>
                        <li>If you lose your password or clear your browser data without a backup, your funds are permanently lost.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-[#E7FE55]">
                        <Terminal size={20} />
                        <h2 className="text-2xl font-light text-white">2. AI Agent Autonomy</h2>
                    </div>
                    <p className="leading-relaxed text-slate-300">
                        The application uses Artificial Intelligence (AI) to execute transactions on your behalf.
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-slate-400">
                        <li>You are responsible for reviewing and supervising the AI's configured strategies.</li>
                        <li>The AI may make errors, hallucinate market data, or execute suboptimal trades.</li>
                        <li>You agree to hold the developers harmless for any trading losses incurred by the AI agent.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-[#E7FE55]">
                        <Shield size={20} />
                        <h2 className="text-2xl font-light text-white">3. Prohibited Activities</h2>
                    </div>
                    <p className="leading-relaxed text-slate-300">
                        You agree not to use AutonomousVault for:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-slate-400">
                        <li>Money laundering or financing terrorism.</li>
                        <li>Interacting with sanctioned addresses or entities.</li>
                        <li>Any illegal activity defined by the laws of your jurisdiction.</li>
                    </ul>
                </section>

                <div className="pt-10 border-t border-slate-700 flex justify-between items-center mt-12">
                    <p className="text-xs text-slate-500">AutonomousVault v0.1</p>
                    <button onClick={() => window.location.reload()} className="text-[#E7FE55] hover:underline flex items-center gap-2">
                        <ArrowLeft size={14} /> Return to App
                    </button>
                </div>

            </div>
        </div>
    );
};
