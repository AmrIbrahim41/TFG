import React, { useContext, useState, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Dumbbell, ArrowRight, Lock, User, Loader2, AlertCircle } from 'lucide-react';

const Login = () => {
    const { loginUser } = useContext(AuthContext);
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // إعدادات الأنيميشن المتتابع (Stagger Effect) للعناصر داخل الكارت
    const containerVariants = {
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                duration: 0.5,
                ease: [0.4, 0, 0.2, 1],
                when: "beforeChildren",
                staggerChildren: 0.1, // تتابع ظهور العناصر كل 0.1 ثانية
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
    };

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError('');

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
        <div className="w-full min-h-screen bg-zinc-100 dark:bg-[#09090b] flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">

            {/* تأثيرات الإضاءة في الخلفية (مع حركة نبض خفيفة) */}
            <motion.div 
                animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.5, 0.3]
                }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[-10%] left-[-10%] w-[30rem] h-[30rem] bg-orange-500/20 dark:bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" 
            />
            <motion.div 
                animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.2, 0.4, 0.2]
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-[-10%] right-[-10%] w-[30rem] h-[30rem] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" 
            />

            {/* كارت تسجيل الدخول */}
            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="w-full max-w-md bg-white/80 dark:bg-zinc-900/60 backdrop-blur-2xl border border-zinc-200 dark:border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl dark:shadow-black/50 relative z-10"
            >
                {/* اللوجو والعنوان */}
                <motion.div variants={itemVariants} className="flex flex-col items-center mb-8">
                    <motion.div 
                        whileHover={{ scale: 1.05, rotate: 5 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30 mb-6"
                    >
                        <Dumbbell size={32} />
                    </motion.div>
                    <h2 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Welcome Back</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm">Sign in to access your dashboard</p>
                </motion.div>

                {/* رسالة الخطأ مع AnimatePresence لظهور واختفاء ناعم */}
                <div className="min-h-[60px] mb-2 flex items-center">
                    <AnimatePresence>
                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0, scale: 0.9 }}
                                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                exit={{ opacity: 0, height: 0, scale: 0.9 }}
                                transition={{ duration: 0.3, type: "spring", bounce: 0.4 }}
                                className="w-full p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl flex items-center gap-3 overflow-hidden"
                            >
                                <AlertCircle size={18} className="text-red-500 shrink-0" />
                                <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    {/* حقل اسم المستخدم */}
                    <motion.div variants={itemVariants} className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-orange-500 transition-colors">
                            <User size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            className={`w-full bg-zinc-100 dark:bg-black/40 border rounded-2xl pl-12 pr-4 py-4 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-600 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all duration-300 ${error ? 'border-red-300 dark:border-red-500/30' : 'border-zinc-200 dark:border-zinc-800'}`}
                            onChange={(e) => { setUsername(e.target.value); setError(''); }}
                            autoComplete="username"
                        />
                    </motion.div>

                    {/* حقل كلمة المرور */}
                    <motion.div variants={itemVariants} className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-orange-500 transition-colors">
                            <Lock size={20} />
                        </div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            className={`w-full bg-zinc-100 dark:bg-black/40 border rounded-2xl pl-12 pr-4 py-4 text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-600 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all duration-300 ${error ? 'border-red-300 dark:border-red-500/30' : 'border-zinc-200 dark:border-zinc-800'}`}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            autoComplete="current-password"
                        />
                    </motion.div>

                    {/* زر تسجيل الدخول */}
                    <motion.div variants={itemVariants} className="pt-2">
                        <motion.button
                            type="submit"
                            disabled={isLoading}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.97 }}
                            className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={22} />
                            ) : (
                                <>
                                    Sign In 
                                    <motion.div
                                        animate={{ x: [0, 5, 0] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                    >
                                        <ArrowRight size={20} />
                                    </motion.div>
                                </>
                            )}
                        </motion.button>
                    </motion.div>
                </form>
            </motion.div>
        </div>
    );
};

export default Login;