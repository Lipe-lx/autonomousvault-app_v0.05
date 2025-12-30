import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '../../ui/dialog';
import { SupabaseSetupWizard } from '../SupabaseSetupWizard';

interface SupabaseConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: () => void;
}

export const SupabaseConnectModal: React.FC<SupabaseConnectModalProps> = ({
    isOpen,
    onClose,
    onConnect
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl bg-[#13141A] border-gray-800 text-white p-0 overflow-hidden">
                {/* We use a hidden header for accessibility but custom rendering inside */}
                <DialogHeader className="sr-only">
                    <DialogTitle>Connect Supabase</DialogTitle>
                    <DialogDescription>Setup your Supabase connection for advanced features</DialogDescription>
                </DialogHeader>
                
                <div className="p-1">
                     <SupabaseSetupWizard 
                        onConnect={onConnect}
                        onCancel={onClose}
                     />
                </div>
            </DialogContent>
        </Dialog>
    );
};
