import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Copy, X, AlertTriangle } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

interface SolanaBackupModalProps {
    backupKey: string;
    setBackupKey: (key: string) => void;
    setShowBackupModal: (show: boolean) => void;
    addNotification: (msg: string) => void;
    onClose?: () => void;
}

export const SolanaBackupModal: React.FC<SolanaBackupModalProps> = ({
    backupKey,
    setBackupKey,
    setShowBackupModal,
    addNotification,
    onClose
}) => {
    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(backupKey);
            addNotification("Private key copied to clipboard");
        } catch (e) {
            addNotification("Failed to copy to clipboard");
        }
    };

    const handleConfirm = () => {
        setBackupKey("");
        setShowBackupModal(false);
        addNotification("Solana backup confirmed!");
        if (onClose) onClose();
    };

    return (
        <Dialog open={true} onOpenChange={() => { }}>
            <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                            <ShieldCheck className="text-purple-400 w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="flex items-center gap-2">
                                Backup Your Solana Key
                                <Badge variant="purple">CRITICAL</Badge>
                            </DialogTitle>
                        </div>
                    </div>
                    <DialogDescription>
                        This is your Solana wallet private key. Save it securely - you will NOT see it again.
                    </DialogDescription>
                </DialogHeader>

                <motion.div
                    className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <AlertTriangle className="text-red-400 w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-red-400 text-sm">
                        <strong>Warning:</strong> Anyone with this key can access your funds. Never share it with anyone.
                    </p>
                </motion.div>

                <div className="space-y-3">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <p className="text-[10px] uppercase text-slate-500 font-bold mb-2">Private Key</p>
                        <div className="font-mono text-xs text-slate-300 break-all bg-black/30 p-3 rounded border border-slate-700/50">
                            {backupKey}
                        </div>
                    </div>

                    <Button
                        onClick={copyToClipboard}
                        variant="outline"
                        className="w-full"
                    >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy to Clipboard
                    </Button>
                </div>

                <DialogFooter>
                    <Button
                        onClick={handleConfirm}
                        variant="success"
                        className="w-full"
                    >
                        I've Saved My Key Securely
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
