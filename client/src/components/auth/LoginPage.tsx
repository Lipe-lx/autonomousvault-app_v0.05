import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { TermsOfUse } from '../../pages/TermsOfUse';

export function LoginPage() {
    const { 
        signInWithGoogle, 
        signInWithGitHub, 
        signInWithDiscord, 
        signInWithEthereum,
        signInWithSolana,
        signInWithEmail, 
        signUp 
    } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
    const [showTerms, setShowTerms] = useState(false);

    if (showTerms) {
        return <TermsOfUse onBack={() => setShowTerms(false)} />;
    }

    // DEBUG: Log URL parameters on mount to check for OAuth return values
    React.useEffect(() => {
        console.log('[LoginPage] Mounted. URL:', window.location.href);
        console.log('[LoginPage] Search:', window.location.search);
        console.log('[LoginPage] Hash:', window.location.hash);
        
        // Check for specific error parameters from Supabase/Provider
        const params = new URLSearchParams(window.location.hash.substring(1)); // Supabase typically uses hash for implicit flow or search for code
        const error = params.get('error');
        const errorDesc = params.get('error_description');
        if (error || errorDesc) {
            console.error('[LoginPage] OAuth Error detected in URL:', error, errorDesc);
            setError(decodeURIComponent(errorDesc || error || 'Unknown OAuth error'));
        }
    }, []);

    const handleOAuthSignIn = async (provider: 'google' | 'github' | 'discord') => {
        setError(null);
        setLoadingProvider(provider);
        try {
            if (provider === 'google') {
                await signInWithGoogle();
            } else if (provider === 'github') {
                await signInWithGitHub();
            } else if (provider === 'discord') {
                await signInWithDiscord();
            }
        } catch (err: any) {
            setError(err.message || `Failed to sign in with ${provider}`);
        } finally {
            setLoadingProvider(null);
        }
    };

    const handleWeb3SignIn = async (chain: 'ethereum' | 'solana') => {
        setError(null);
        setLoadingProvider(chain);
        try {
            if (chain === 'ethereum') {
                await signInWithEthereum();
            } else {
                await signInWithSolana();
            }
        } catch (err: any) {
            setError(err.message || `Failed to sign in with ${chain}`);
        } finally {
            setLoadingProvider(null);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isSignUp) {
                await signUp(email, password);
            } else {
                await signInWithEmail(email, password);
            }
        } catch (err: any) {
            // Parse Firebase error messages
            const errorCode = err.code || '';
            if (errorCode.includes('user-not-found')) {
                setError('No account found with this email');
            } else if (errorCode.includes('wrong-password')) {
                setError('Incorrect password');
            } else if (errorCode.includes('email-already-in-use')) {
                setError('An account already exists with this email');
            } else if (errorCode.includes('weak-password')) {
                setError('Password should be at least 6 characters');
            } else if (errorCode.includes('invalid-email')) {
                setError('Invalid email address');
            } else {
                setError(err.message || 'Authentication failed');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f1015] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo & Branding */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#E7FE55] to-[#c8e044] rounded-2xl mb-4 shadow-lg shadow-[#E7FE55]/20">
                        <svg
                            className="w-8 h-8 text-black"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <path d="M12 8v4" />
                            <path d="M12 16h.01" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">AutonomousVault</h1>
                    <p className="text-[#747580] text-sm">Multi-Chain DeFi Agent</p>
                </div>

                {/* Login Card */}
                <div className="bg-[#14151a] border border-[#232328] rounded-xl p-6 shadow-xl">
                    <h2 className="text-lg font-semibold text-white mb-6 text-center">
                        {isSignUp ? 'Create Account' : 'Welcome Back'}
                    </h2>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4">
                            <AlertCircle size={16} />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* OAuth Buttons Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        {/* Google */}
                        <button
                            onClick={() => handleOAuthSignIn('google')}
                            disabled={loadingProvider !== null}
                            className="flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-gray-800 font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            {loadingProvider === 'google' ? '...' : 'Google'}
                        </button>

                        {/* GitHub */}
                        <button
                            onClick={() => handleOAuthSignIn('github')}
                            disabled={loadingProvider !== null}
                            className="flex items-center justify-center gap-2 bg-[#24292e] hover:bg-[#2d3339] text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                            </svg>
                            {loadingProvider === 'github' ? '...' : 'GitHub'}
                        </button>

                        {/* Discord */}
                        <button
                            onClick={() => handleOAuthSignIn('discord')}
                            disabled={loadingProvider !== null}
                            className="flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                            </svg>
                            {loadingProvider === 'discord' ? '...' : 'Discord'}
                        </button>

                        {/* Ethereum Wallet */}
                        <button
                            onClick={() => handleWeb3SignIn('ethereum')}
                            disabled={loadingProvider !== null}
                            className="flex items-center justify-center gap-2 bg-[#627EEA] hover:bg-[#5470d4] text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Sign in with Ethereum wallet (MetaMask, etc.)"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 1.5l-9 15.5L12 22l9-5-9-15.5zM12 22v-5l9-5-9 10z" opacity="0.6" />
                                <path d="M12 1.5v8l9 5.5-9-13.5zM12 1.5L3 17l9-7.5V1.5z" />
                            </svg>
                            {loadingProvider === 'ethereum' ? '...' : 'ETH'}
                        </button>

                        {/* Solana Wallet */}
                        <button
                            onClick={() => handleWeb3SignIn('solana')}
                            disabled={loadingProvider !== null}
                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 text-white font-medium py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Sign in with Solana wallet (Phantom, etc.)"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M4.5 17.88l2.12-2.12a.75.75 0 01.53-.22H19.5a.75.75 0 01.53 1.28l-2.12 2.12a.75.75 0 01-.53.22H4.5a.75.75 0 01-.53-1.28h.03zM4.5 5.88A.75.75 0 015.03 4.6l2.12-2.12a.75.75 0 01.53-.22H19.5a.75.75 0 01.53 1.28L17.91 5.66a.75.75 0 01-.53.22H4.5zM19.5 11.88l-2.12-2.12a.75.75 0 00-.53-.22H4.5a.75.75 0 00-.53 1.28l2.12 2.12a.75.75 0 00.53.22H19.5a.75.75 0 00.53-1.28z" />
                            </svg>
                            {loadingProvider === 'solana' ? '...' : 'SOL'}
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-[#232328]" />
                        <span className="text-[#5a5b63] text-xs uppercase tracking-wider">or continue with email</span>
                        <div className="flex-1 h-px bg-[#232328]" />
                    </div>

                    {/* Email/Password Form */}
                    <form onSubmit={handleEmailAuth} className="space-y-4">
                        <div>
                            <label className="block text-[#a0a1a8] text-sm mb-2">Email</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5b63]" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                    className="w-full bg-[#0f1015] border border-[#232328] rounded-lg py-3 pl-10 pr-4 text-white placeholder-[#5a5b63] focus:outline-none focus:border-[#E7FE55] focus:ring-1 focus:ring-[#E7FE55]/20 transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[#a0a1a8] text-sm mb-2">Password</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5b63]" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    className="w-full bg-[#0f1015] border border-[#232328] rounded-lg py-3 pl-10 pr-12 text-white placeholder-[#5a5b63] focus:outline-none focus:border-[#E7FE55] focus:ring-1 focus:ring-[#E7FE55]/20 transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a5b63] hover:text-[#a0a1a8] transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#E7FE55] hover:bg-[#f0ff7a] text-black font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
                        </button>
                    </form>

                    {/* Toggle Sign Up / Sign In */}
                    <p className="text-center text-[#747580] text-sm mt-6">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <button
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError(null);
                            }}
                            className="text-[#E7FE55] hover:underline font-medium"
                        >
                            {isSignUp ? 'Sign In' : 'Sign Up'}
                        </button>
                    </p>
                </div>

                {/* Footer */}
                <p className="text-center text-[#5a5b63] text-xs mt-6">
                    By continuing, you agree to our{' '}
                    <button onClick={() => setShowTerms(true)} className="text-[#E7FE55] hover:underline">
                        Terms of Use
                    </button>
                </p>
            </div>
        </div>
    );
}
