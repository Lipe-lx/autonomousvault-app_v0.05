import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
    const { signInWithGoogle, signInWithEmail, signUp } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        setError(null);
        setLoading(true);
        try {
            await signInWithGoogle();
        } catch (err: any) {
            setError(err.message || 'Failed to sign in with Google');
        } finally {
            setLoading(false);
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

                    {/* Google Sign In */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Continue with Google
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-4 my-6">
                        <div className="flex-1 h-px bg-[#232328]" />
                        <span className="text-[#5a5b63] text-xs uppercase tracking-wider">or</span>
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
                    By continuing, you agree to our Terms of Service
                </p>
            </div>
        </div>
    );
}
