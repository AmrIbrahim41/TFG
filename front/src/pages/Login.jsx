import React, { useContext, useState, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, ArrowRight, Lock, User, Loader2, AlertCircle } from 'lucide-react';

const Login = () => {
    const { loginUser } = useContext(AuthContext);
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // ---------------------------------------------------------------------------
    // Submit — with frontend validation + error display
    // ---------------------------------------------------------------------------
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError('');

        // Frontend validation before hitting the API
        if (!username.trim()) {
            setError('Please enter your username.');
            return;
        }
        if (!password) {
            setError('Please enter your password.');
            return;
        }

        setIsLoading(true);
        try {
            const success = await loginUser(username.trim(), password);
            if (success) {
                navigate('/');
            } else {
                setError('Invalid username or password. Please try again.');
            }
        } catch {
            setError('Something went wrong. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    }, [username, password, loginUser, navigate]);

    return (
        <div className="w-full min-h-screen bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">

            {/* Background glows */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Login Card */}
            <div className="w-full max-w-md bg-zinc-50/80 dark:bg-zinc-900/40 backdrop-blur-xl border border-zinc-300 dark:border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">

                {/* Logo & Title */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20 mb-6">
                        <Dumbbell size={32} />
                    </div>
                    <h2 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Welcome Back</h2>
                    <p className="text-zinc-500 mt-2 text-sm">Sign in to access your dashboard</p>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl flex items-center gap-3 animate-in fade-in duration-200">
                        <AlertCircle size={18} className="text-red-500 shrink-0" />
                        <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                    {/* Username */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                            <User size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            className={`w-full bg-zinc-200 dark:bg-black/40 border rounded-xl pl-12 pr-4 py-4 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all ${error ? 'border-red-300 dark:border-red-500/30' : 'border-zinc-300 dark:border-white/5'}`}
                            onChange={(e) => { setUsername(e.target.value); setError(''); }}
                            autoComplete="username"
                        />
                    </div>

                    {/* Password */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
                            <Lock size={20} />
                        </div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            className={`w-full bg-zinc-200 dark:bg-black/40 border rounded-xl pl-12 pr-4 py-4 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-600 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all ${error ? 'border-red-300 dark:border-red-500/30' : 'border-zinc-300 dark:border-white/5'}`}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-orange-600 hover:bg-orange-500 active:scale-[0.98] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-orange-900/20 mt-2 flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                    >
                        {isLoading
                            ? <Loader2 className="animate-spin" size={20} />
                            : <>Sign In <ArrowRight size={20} /></>
                        }
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
