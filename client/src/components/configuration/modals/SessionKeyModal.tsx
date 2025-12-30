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
        if (!error) {
             // If we don't clear these here, they persist if the modal is reopened
             // However, onConfirm usually closes the modal on success or handles error state
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-[#13141A] border-gray-800 text-white">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-full bg-amber-500/10">
                            <Clock className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                            <DialogTitle>Setup Session Keys</DialogTitle>
                            <DialogDescription className="text-gray-500">
                                Configure temporary keys for 24/7 execution
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                        <h4 className="text-sm font-medium text-amber-200 mb-2 flex items-center gap-2">
                             How it works
                        </h4>
                        <ul className="text-xs text-amber-200/70 space-y-1.5 list-disc list-inside">
                             <li>Keys are decrypted and stored in server memory</li>
                             <li>Bot runs 24/7 within the session duration</li>
                             <li>Keys are automatically wiped when session expires</li>
                             <li>More secure than persistent storage</li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                Session Duration (Hours)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={sessionDuration}
                                    onChange={(e) => setSessionDuration(Math.max(1, Math.min(72, parseInt(e.target.value) || 24)))}
                                    min={1}
                                    max={72}
                                    className="w-full pl-10 pr-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                                />
                                <Clock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1.5">
                                Maximum 72 hours.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                Wallet Password
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your wallet password"
                                    className="w-full pl-10 pr-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                                />
                                <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1.5">
                                Required to decrypt your private key for this session.
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!password || isLoading}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Starting Session...
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
