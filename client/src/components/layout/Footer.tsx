import React from 'react';
import { AppTab } from '../../types';

interface FooterProps {
    onNavigate?: (tab: AppTab) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
    return (
        <footer className="w-full py-4 text-center mt-auto border-t border-[#232328]/50">
            <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] text-slate-600 font-medium tracking-wide">
                    © 2025 AutonomousVault. All rights reserved.
                </p>
                {onNavigate && (
                    <div className="flex items-center gap-4 text-[10px] text-slate-500">
                        <button onClick={() => onNavigate(AppTab.TERMS)} className="hover:text-[#E7FE55] transition-colors">Terms of Use</button>
                        <span>•</span>
                        <button onClick={() => onNavigate(AppTab.PRIVACY)} className="hover:text-[#E7FE55] transition-colors">Privacy Policy</button>
                    </div>
                )}
            </div>
        </footer>
    );
};
