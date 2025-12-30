import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../ui/dialog';
import { Zap, Lock, Loader2, ShieldAlert } from 'lucide-react';

interface PersistentKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

export const PersistentKeyModal: React.FC<PersistentKeyModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    isLoading,
    error
}) => {
    const [password, setPassword] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);

    const handleSubmit = async () => {
        if (!password || !acknowledged) return;
        await onConfirm(password);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md glass-panel rounded border-[#232328] text-white">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 rounded bg-red-500/10">
                            <Zap className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold tracking-wide">Setup Persistent Keys</DialogTitle>
                            <DialogDescription className="text-[11px] text-[#747580] mt-0.5">
                                Store encrypted keys for permanent 24/7 execution
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-5 py-3">
                    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded">
                        <div className="flex items-start gap-3">
                            <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-[11px] font-bold text-red-300 mb-1 uppercase tracking-wide">
                                    Security Warning
                                </h4>
                                <p className="text-[10px] text-red-200/70 leading-relaxed">
                                    This option stores your encrypted private keys and password on the server database. 
                                    While we use encryption, this is less secure than local or session-based storage.
                                    If the server is compromised, your keys could be at risk.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-[#a0a1a8] mb-1.5 uppercase tracking-wide">
                                Wallet Password
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your wallet password"
                                    className="w-full pl-10 pr-3 py-2.5 bg-[#0f1015] border border-[#232328] rounded text-sm text-white placeholder:text-[#747580] focus:outline-none focus:border-red-500/50 transition-colors"
                                />
                                <Lock className="w-4 h-4 text-[#747580] absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>

                        <div 
                            className="flex items-start gap-3 p-3 bg-[#0f1015] rounded border border-[#232328] hover:border-[#747580] transition-colors cursor-pointer" 
                            onClick={() => setAcknowledged(!acknowledged)}
                        >
                            <div className="flex items-center h-5">
                                <input
                                    type="checkbox"
                                    checked={acknowledged}
                                    onChange={(e) => setAcknowledged(e.target.checked)}
                                    className="w-4 h-4 rounded border-[#232328] text-red-500 focus:ring-red-500 bg-[#0f1015]"
                                />
                            </div>
                            <div className="text-[10px] text-[#747580] select-none leading-relaxed">
                                <span className="font-bold text-[#a0a1a8]">I understand the risks.</span>
                                <span className="block mt-0.5">I accept full responsibility for storing my keys on the server.</span>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-300">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[#1a1b21] hover:bg-[#232328] text-[#a0a1a8] rounded text-[11px] font-semibold uppercase tracking-wide transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!password || !acknowledged || isLoading}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-[#1a1b21] disabled:text-[#747580] text-white rounded text-[11px] font-semibold uppercase tracking-wide transition-colors flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Enabling...
                            </>
                        ) : (
                            'Enable Persistent Keys'
                        )}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
