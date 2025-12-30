import React from 'react';
import { Shield, AlertTriangle, Key, Terminal, ArrowLeft } from 'lucide-react';

interface TermsOfUseProps {
    onBack?: () => void;
}

export const TermsOfUse: React.FC<TermsOfUseProps> = ({ onBack }) => {
    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            window.location.reload();
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-200 p-8 font-sans">
            <div className="max-w-3xl mx-auto space-y-8">

                {/* Header */}
                <div className="border-b border-slate-700 pb-6 mb-10 flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-light text-white mb-2">Terms of Use</h1>
                        <p className="text-slate-400">Effective Date: December 23, 2025</p>
                    </div>
                    <button 
                        onClick={handleBack}
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
                        title="Go Back"
                    >
                        <ArrowLeft size={24} />
                    </button>
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

                {/* Universal Data Liability */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-[#E7FE55]">
                        <Shield size={20} />
                        <h2 className="text-2xl font-light text-white">2. Universal Data Liability</h2>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-red-400 shrink-0 mt-1" size={20} />
                            <div className="space-y-2">
                                <h3 className="text-red-200 font-medium">Full User Responsibility</h3>
                                <p className="text-red-200/80 text-sm leading-relaxed">
                                    The user assumes <strong>FULL RESPONSIBILITY</strong> for data security, custody, and management in <strong>ALL MODES OF OPERATION</strong> (including "Local-Only" and "24/7 Server Mode").
                                </p>
                                <p className="text-red-200/80 text-sm leading-relaxed">
                                    The application always operates on the user's own infrastructure (local machine or personal Supabase database). The developers of AutonomousVault accept <strong>NO LIABILITY</strong> for data loss, unauthorized access, key compromise, or any other security breaches under any circumstances.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-[#E7FE55]">
                        <Terminal size={20} />
                        <h2 className="text-2xl font-light text-white">3. Experimental Protocols & Risks</h2>
                    </div>
                    
                    <div className="space-y-4 text-slate-300">
                        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                            <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                                Hyperliquid (Testnet)
                            </h3>
                            <p className="text-sm">
                                Trading on Hyperliquid is currently on <strong>Testnet</strong>. While no real funds are at risk on Testnet, the trading logic is experimental. The AI Agent's performance on Testnet does not guarantee future results on Mainnet.
                            </p>
                        </div>

                        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                            <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                                Polymarket (Prediction Markets)
                            </h3>
                            <p className="text-sm">
                                Prediction markets involve high risk. The AI Agent provides analysis based on available data, but <strong>outcome predictions are never guaranteed</strong>.
                            </p>
                            <p className="text-sm mt-2 text-slate-400 italic">
                                <strong>Regular compliance:</strong> You are solely responsible for ensuring that using prediction markets complies with the laws of your jurisdiction.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-[#E7FE55]">
                        <Key size={20} />
                        <h2 className="text-2xl font-light text-white">4. AI Agent Autonomy</h2>
                    </div>
                    <ul className="list-disc pl-6 space-y-2 text-slate-400">
                        <li>The AI Agent executes instructions based on your prompts.</li>
                        <li>It may generate code, execute transactions (Solana), trade perps (Hyperliquid), or interact with prediction markets (Polymarket).</li>
                        <li><strong>You are the final approver.</strong> While the agent can be autonomous, you are responsible for monitoring its actions.</li>
                        <li>The developers are not liable for losses caused by AI hallucination, error, or unintended execution.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center gap-2 text-[#E7FE55]">
                        <Shield size={20} />
                        <h2 className="text-2xl font-light text-white">5. Prohibited Activities</h2>
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
                    <button onClick={handleBack} className="text-[#E7FE55] hover:underline flex items-center gap-2">
                        <ArrowLeft size={14} /> Return to App
                    </button>
                </div>

            </div>
        </div>
    );
};
