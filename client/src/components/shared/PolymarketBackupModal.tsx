import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Copy, AlertTriangle } from 'lucide-react';
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

interface PolymarketBackupModalProps {
    backupKey: string;
    setBackupKey: (key: string) => void;
    setShowBackupModal: (show: boolean) => void;
    addNotification: (msg: string) => void;
}

export const PolymarketBackupModal: React.FC<PolymarketBackupModalProps> = ({
    backupKey,
    setBackupKey,
    setShowBackupModal,
    addNotification
}) => {
    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(backupKey);
            addNotification("Polymarket private key copied to clipboard");
        } catch (e) {
            addNotification("Failed to copy to clipboard");
        }
    };

    const handleConfirm = () => {
        setBackupKey("");
        setShowBackupModal(false);
        addNotification("Polymarket backup confirmed!");
    };

    return (
        <Dialog open={true} onOpenChange={() => { }}>
            <DialogContent 
                className="max-w-md rounded-sm" 
                style={{
                    background: 'linear-gradient(180deg, rgba(30, 32, 40, 0.95) 0%, rgba(24, 26, 32, 0.9) 100%)',
                    border: '1px solid rgba(60, 63, 75, 0.4)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.02)'
                }}
                onPointerDownOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-[#E7FE55]/10 rounded-sm flex items-center justify-center">
                            <ShieldCheck className="text-[#E7FE55] w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="flex items-center gap-2">
                                Backup Your Polymarket Key
                                <Badge variant="destructive">CRITICAL</Badge>
                            </DialogTitle>
                        </div>
                    </div>
                    <DialogDescription>
                        This is your Polymarket (Polygon) wallet private key. Save it securely - you will NOT see it again.
                    </DialogDescription>
                </DialogHeader>

                <motion.div
                    className="bg-red-500/10 border border-red-500/30 rounded p-3 flex items-start gap-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <AlertTriangle className="text-red-400 w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-red-400 text-sm">
                        <strong>Warning:</strong> Anyone with this key can access your Polygon funds. Never share it with anyone.
                    </p>
                </motion.div>

                <div className="space-y-3">
                    <div className="bg-[rgba(30,32,40,0.6)] rounded-sm p-4 border border-[rgba(60,63,75,0.3)]">
                        <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-2">Private Key (Polygon EVM)</p>
                        <div className="font-mono text-xs text-slate-300 break-all bg-black/30 p-3 rounded-sm border border-slate-700/50">
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
                        className="w-full bg-[#E7FE55] hover:bg-[#d9f044] text-black font-bold"
                    >
                        I've Saved My Key Securely
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
