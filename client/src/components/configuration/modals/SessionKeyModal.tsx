import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../ui/dialog';
import { Clock, Lock, Loader2 } from 'lucide-react';

interface SessionKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (password: string, duration: number) => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

export const SessionKeyModal: React.FC<SessionKeyModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    isLoading,
    error
}) => {
    const [password, setPassword] = useState('');
    const [sessionDuration, setSessionDuration] = useState(24);

    const handleSubmit = async () => {
        if (!password) return;
        await onConfirm(password, sessionDuration);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md glass-panel rounded border-[#232328] text-white">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 rounded bg-amber-500/10">
                            <Clock className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold tracking-wide">Setup Session Keys</DialogTitle>
                            <DialogDescription className="text-[11px] text-[#747580] mt-0.5">
                                Configure temporary keys for 24/7 execution
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-5 py-3">
                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded">
                        <h4 className="text-[11px] font-bold text-amber-300 mb-2 uppercase tracking-wide">
                             How it works
                        </h4>
                        <ul className="text-[10px] text-amber-200/70 space-y-1 list-disc list-inside leading-relaxed">
                             <li>Keys are decrypted and stored in server memory</li>
                             <li>Bot runs 24/7 within the session duration</li>
                             <li>Keys are automatically wiped when session expires</li>
                             <li>More secure than persistent storage</li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-[#a0a1a8] mb-1.5 uppercase tracking-wide">
                                Session Duration (Hours)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={sessionDuration}
                                    onChange={(e) => setSessionDuration(Math.max(1, Math.min(72, parseInt(e.target.value) || 24)))}
                                    min={1}
                                    max={72}
                                    className="w-full pl-10 pr-3 py-2.5 bg-[#0f1015] border border-[#232328] rounded text-sm font-mono text-white placeholder:text-[#747580] focus:outline-none focus:border-amber-500/50 transition-colors"
                                />
                                <Clock className="w-4 h-4 text-[#747580] absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                            <p className="text-[9px] text-[#747580] mt-1.5">
                                Maximum 72 hours.
                            </p>
                        </div>

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
                                    className="w-full pl-10 pr-3 py-2.5 bg-[#0f1015] border border-[#232328] rounded text-sm text-white placeholder:text-[#747580] focus:outline-none focus:border-amber-500/50 transition-colors"
                                />
                                <Lock className="w-4 h-4 text-[#747580] absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                            <p className="text-[9px] text-[#747580] mt-1.5">
                                Required to decrypt your private key for this session.
                            </p>
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
                        disabled={!password || isLoading}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-[#1a1b21] disabled:text-[#747580] text-white rounded text-[11px] font-semibold uppercase tracking-wide transition-colors flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Starting...
                            </>
                        ) : (
                            'Start Session'
                        )}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
