// Supabase Setup Wizard Component
// Guides users through connecting their own Supabase project for Security Tiers B/C

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Database,
    Key,
    Eye,
    EyeOff,
    ExternalLink,
    Copy,
    Check,
    AlertTriangle,
    Loader2,
    CheckCircle2,
    XCircle,
    ChevronRight,
} from 'lucide-react';
import { userDataSupabase, SchemaValidation } from '../../services/supabase/userDataSupabase';
import { cn } from '@/lib/utils';

interface SupabaseSetupWizardProps {
    onConnect: () => void;
    onCancel: () => void;
}

type SetupStep = 'input' | 'connecting' | 'validating' | 'schema-missing' | 'success' | 'error';

export const SupabaseSetupWizard: React.FC<SupabaseSetupWizardProps> = ({ onConnect, onCancel }) => {
    const [step, setStep] = useState<SetupStep>('input');
    const [url, setUrl] = useState('');
    const [anonKey, setAnonKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [schemaResult, setSchemaResult] = useState<SchemaValidation | null>(null);
    const [copied, setCopied] = useState(false);

    // Validation states
    const [urlError, setUrlError] = useState<string | null>(null);
    const [keyError, setKeyError] = useState<string | null>(null);

    // Validate URL on blur
    const handleUrlBlur = useCallback(() => {
        if (!url) {
            setUrlError(null);
            return;
        }
        const result = userDataSupabase.validateUrl(url);
        setUrlError(result.valid ? null : result.error || 'Invalid URL');
    }, [url]);

    // Validate key on blur
    const handleKeyBlur = useCallback(() => {
        if (!anonKey) {
            setKeyError(null);
            return;
        }
        const result = userDataSupabase.validateAnonKey(anonKey);
        setKeyError(result.valid ? null : result.error || 'Invalid key');
    }, [anonKey]);

    // Copy SQL to clipboard
    const handleCopySQL = useCallback(async () => {
        const sql = userDataSupabase.getSetupSQL();
        await navigator.clipboard.writeText(sql);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    // Connect and validate
    const handleConnect = useCallback(async () => {
        setError(null);
        setStep('connecting');

        // Connect to Supabase
        const connectResult = await userDataSupabase.connect(url.trim(), anonKey.trim());

        if (!connectResult.success) {
            setError(connectResult.error || 'Connection failed');
            setStep('error');
            return;
        }

        setStep('validating');

        // Validate schema
        const schemaValidation = await userDataSupabase.validateSchema();
        setSchemaResult(schemaValidation);

        if (!schemaValidation.valid) {
            setStep('schema-missing');
            return;
        }

        setStep('success');
    }, [url, anonKey]);

    // Retry after schema setup
    const handleRetryValidation = useCallback(async () => {
        setStep('validating');
        const schemaValidation = await userDataSupabase.validateSchema();
        setSchemaResult(schemaValidation);

        if (!schemaValidation.valid) {
            setStep('schema-missing');
            return;
        }

        setStep('success');
    }, []);

    // Continue after success
    const handleContinue = useCallback(() => {
        onConnect();
    }, [onConnect]);

    const isInputValid = url.trim() && anonKey.trim() && !urlError && !keyError;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 bg-[#0f1015] border border-[#232328] rounded-xl space-y-4"
        >
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                    <Database className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <h3 className="text-base font-semibold text-white">Connect Your Supabase</h3>
                    <p className="text-xs text-[#747580]">Required for 24/7 execution</p>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {/* Input Step */}
                {step === 'input' && (
                    <motion.div
                        key="input"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        {/* Instructions */}
                        <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                            <p className="text-xs text-blue-200 mb-2 font-medium">Quick Setup:</p>
                            <ol className="text-xs text-blue-200/80 space-y-1 list-decimal list-inside">
                                <li>Create free account at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">supabase.com</a></li>
                                <li>Create a new project (any name)</li>
                                <li>Go to <strong>Settings → API</strong></li>
                                <li>Copy the values below</li>
                            </ol>
                        </div>

                        {/* URL Input */}
                        <div>
                            <label className="block text-[10px] text-[#747580] uppercase tracking-[0.1em] mb-1.5">
                                Project URL
                            </label>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onBlur={handleUrlBlur}
                                placeholder="https://abc123.supabase.co"
                                className={cn(
                                    "w-full px-3 py-2 text-xs font-mono bg-[#14151a] border rounded text-white placeholder:text-[#3a3b42] focus:outline-none transition-colors",
                                    urlError ? "border-red-500/50 focus:border-red-500" : "border-[#232328] focus:border-blue-500/50"
                                )}
                            />
                            {urlError && (
                                <p className="text-[10px] text-red-400 mt-1">{urlError}</p>
                            )}
                        </div>

                        {/* Anon Key Input */}
                        <div>
                            <label className="block text-[10px] text-[#747580] uppercase tracking-[0.1em] mb-1.5">
                                Anon Key (public)
                            </label>
                            <div className="relative">
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    value={anonKey}
                                    onChange={(e) => setAnonKey(e.target.value)}
                                    onBlur={handleKeyBlur}
                                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                    className={cn(
                                        "w-full px-3 py-2 pr-9 text-xs font-mono bg-[#14151a] border rounded text-white placeholder:text-[#3a3b42] focus:outline-none transition-colors",
                                        keyError ? "border-red-500/50 focus:border-red-500" : "border-[#232328] focus:border-blue-500/50"
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#747580] hover:text-white transition-colors"
                                >
                                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                            {keyError && (
                                <p className="text-[10px] text-red-400 mt-1">{keyError}</p>
                            )}
                        </div>

                        {/* Help Link */}
                        <div className="flex items-center justify-between">
                            <a
                                href="https://supabase.com/dashboard/project/_/settings/api"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors flex items-center gap-1"
                            >
                                Open Supabase API Settings <ExternalLink size={10} />
                            </a>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={onCancel}
                                className="flex-1 px-4 py-2 bg-[#232328] hover:bg-[#2a2b30] text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConnect}
                                disabled={!isInputValid}
                                className={cn(
                                    "flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
                                    isInputValid
                                        ? "bg-blue-600 hover:bg-blue-500 text-white"
                                        : "bg-[#232328] text-[#3a3b42] cursor-not-allowed"
                                )}
                            >
                                Connect <ChevronRight size={14} />
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Connecting Step */}
                {(step === 'connecting' || step === 'validating') && (
                    <motion.div
                        key="connecting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="py-8 flex flex-col items-center gap-4"
                    >
                        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                        <p className="text-sm text-[#a0a1a8]">
                            {step === 'connecting' ? 'Connecting to Supabase...' : 'Validating schema...'}
                        </p>
                    </motion.div>
                )}

                {/* Schema Missing Step */}
                {step === 'schema-missing' && schemaResult && (
                    <motion.div
                        key="schema-missing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-amber-200">Schema Setup Required</p>
                                    <p className="text-xs text-amber-200/70 mt-1">
                                        Your Supabase project is connected, but missing required tables:
                                    </p>
                                    <ul className="mt-2 space-y-1">
                                        {schemaResult.missingTables.map((table) => (
                                            <li key={table} className="text-xs text-amber-300 flex items-center gap-2">
                                                <XCircle size={12} />
                                                <code className="bg-amber-500/10 px-1 rounded">{table}</code>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* SQL Instructions */}
                        <div className="p-4 bg-[#14151a] border border-[#232328] rounded-lg space-y-3">
                            <p className="text-xs text-[#a0a1a8]">
                                Copy this SQL and run it in your Supabase SQL Editor:
                            </p>
                            <button
                                onClick={handleCopySQL}
                                className="w-full px-4 py-3 bg-[#0f1015] border border-[#232328] rounded-lg hover:border-blue-500/30 transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                {copied ? (
                                    <>
                                        <Check size={16} className="text-green-400" />
                                        <span className="text-green-400">Copied!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={16} className="text-[#747580]" />
                                        <span className="text-white">Copy SQL Schema</span>
                                    </>
                                )}
                            </button>
                            <a
                                href="https://supabase.com/dashboard/project/_/sql/new"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full px-4 py-2 bg-[#232328] rounded-lg hover:bg-[#2a2b30] transition-all flex items-center justify-center gap-2 text-sm text-white"
                            >
                                Open SQL Editor <ExternalLink size={14} />
                            </a>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={onCancel}
                                className="flex-1 px-4 py-2 bg-[#232328] hover:bg-[#2a2b30] text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRetryValidation}
                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
                            >
                                I've Run the SQL <ChevronRight size={14} />
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Error Step */}
                {step === 'error' && (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="flex items-start gap-3">
                                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-red-200">Connection Failed</p>
                                    <p className="text-xs text-red-200/70 mt-1">{error}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={onCancel}
                                className="flex-1 px-4 py-2 bg-[#232328] hover:bg-[#2a2b30] text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setStep('input')}
                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Success Step */}
                {step === 'success' && (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="py-6 flex flex-col items-center gap-4"
                    >
                        <div className="p-3 rounded-full bg-green-500/10">
                            <CheckCircle2 className="w-8 h-8 text-green-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-white">Supabase Connected!</p>
                            <p className="text-xs text-[#747580] mt-1">
                                Project: {userDataSupabase.getConfig()?.projectId}
                            </p>
                        </div>
                        <button
                            onClick={handleContinue}
                            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold transition-all"
                        >
                            Continue
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default SupabaseSetupWizard;
