import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../ui/dialog';
import { Zap, Lock, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';

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
            <DialogContent className="max-w-md bg-[#13141A] border-gray-800 text-white">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-full bg-red-500/10">
                            <Zap className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <DialogTitle>Setup Persistent Keys</DialogTitle>
                            <DialogDescription className="text-gray-500">
                                Store encrypted keys for permanent 24/7 execution
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                        <div className="flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-red-200 mb-1">
                                    Security Warning
                                </h4>
                                <p className="text-xs text-red-200/70 leading-relaxed">
                                    This option stores your encrypted private keys and password on the server database. 
                                    While we use encryption, this is less secure than local or session-based storage.
                                    If the server is compromised, your keys could be at risk.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
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
                                    className="w-full pl-10 pr-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
                                />
                                <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors cursor-pointer" onClick={() => setAcknowledged(!acknowledged)}>
                            <div className="flex items-center h-5">
                                <input
                                    type="checkbox"
                                    checked={acknowledged}
                                    onChange={(e) => setAcknowledged(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-600 text-red-500 focus:ring-red-500 bg-gray-800"
                                />
                            </div>
                            <div className="text-xs text-gray-400 select-none">
                                <span className="font-medium text-gray-300">I understand the risks.</span>
                                <span className="block mt-0.5">I accept full responsibility for storing my keys on the server.</span>
                            </div>
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
                        disabled={!password || !acknowledged || isLoading}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Enabled Persistent Keys...
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
