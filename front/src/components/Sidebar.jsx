import React, { useState, useContext, useCallback, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Users, ShieldCheck,
    Menu, X, LogOut, Ticket, Database, Calculator, Baby,
    Briefcase, Sun, Moon, Dumbbell
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Sidebar = () => {
    const { logoutUser, user } = useContext(AuthContext);
    const { theme, toggleTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();

    const closeSidebar = useCallback(() => setIsOpen(false), []);

    const handleLogoClick = useCallback(() => {
        const pathSegments = location.pathname.split('/');
        const mainSection = pathSegments[1];
        navigate(mainSection ? '/' + mainSection : '/');
        closeSidebar();
    }, [location.pathname, navigate, closeSidebar]);

    // منع التمرير في الموبايل عند فتح القائمة
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const navItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/clients', label: 'Clients', icon: Users },
        { path: '/children', label: 'Children', icon: Baby },
        { path: '/subscriptions', label: 'Subscriptions', icon: Ticket },
        { path: '/food-database', label: 'Food Database', icon: Database },
        ...(!user?.is_receptionist ? [
            { path: '/quick-plan', label: 'Quick Nutrition', icon: Calculator },
            { path: '/quick-workout', label: 'Quick Workout', icon: Dumbbell },
        ] : []),
        { path: '/profile', label: 'My Profile', icon: Briefcase },
        ...(user?.is_superuser ? [{ path: '/admin', label: 'Admin Panel', icon: ShieldCheck }] : []),
    ];

    const getUserInitial = useCallback(() => {
        if (user?.first_name) return user.first_name.charAt(0).toUpperCase();
        if (user?.username) return user.username.charAt(0).toUpperCase();
        return 'U';
    }, [user]);

    const getDisplayName = useCallback(
        () => user?.first_name || user?.username || 'User',
        [user]
    );

    const getUserRole = useCallback(() => {
        if (user?.is_superuser) return 'Super Admin';
        if (user?.is_receptionist) return 'Receptionist';
        return 'Trainer';
    }, [user]);

    // إعدادات الأنيميشن لعناصر القائمة (Staggered Effect)
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.08, // التتابع الزمني بين كل عنصر والثاني
                delayChildren: 0.1,
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -20 },
        visible: {
            opacity: 1,
            x: 0,
            transition: { type: "spring", stiffness: 300, damping: 24 }
        }
    };

    const Logo = ({ size = 'w-16 h-16', textSize = 'text-4xl' }) => (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            onClick={handleLogoClick}
            className="flex items-center gap-4 cursor-pointer group select-none"
        >
            <div className={`${size} relative rounded-2xl overflow-hidden shadow-lg border border-white/20 dark:border-white/10 shrink-0 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-2 group-hover:shadow-orange-500/20`}>
                <img
                    src="/tiger-logo.jpg"
                    alt="TFG Tiger"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="eager"
                />
            </div>
            <h1 className={`${textSize} font-black text-zinc-900 dark:text-white leading-none tracking-tighter transition-all duration-300 group-hover:text-orange-500`}>
                T<span className="text-orange-500 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors duration-300">F</span>G
            </h1>
        </motion.div>
    );

    return (
        <>
            {/* Header الموبايل */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-20 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 z-[50] transition-colors duration-300 shadow-sm">
                <Logo size="w-12 h-12" textSize="text-3xl" />
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsOpen(true)}
                    className="p-2.5 text-zinc-600 dark:text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm"
                    aria-label="Open menu"
                >
                    <Menu size={24} />
                </motion.button>
            </div>

            {/* Backdrop الموبايل مع AnimatePresence */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm z-[90] lg:hidden"
                        onClick={closeSidebar}
                        aria-hidden="true"
                    />
                )}
            </AnimatePresence>

            {/* القائمة الجانبية */}
            <aside className={`
                fixed top-0 bottom-0 left-0 z-[100] w-72
                bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-xl
                border-r border-zinc-200 dark:border-zinc-800/80
                flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
                shadow-2xl shadow-zinc-400/20 dark:shadow-none
                ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
            `}>
                {/* منطقة اللوجو */}
                <div className="h-32 flex items-center justify-between px-6 border-b border-zinc-100 dark:border-zinc-800/50 bg-gradient-to-b from-zinc-50 to-transparent dark:from-zinc-900/50 relative">
                    <Logo />
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={closeSidebar}
                        className="lg:hidden p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all duration-200"
                        aria-label="Close menu"
                    >
                        <X size={22} />
                    </motion.button>
                </div>

                {/* روابط القائمة مع الأنيميشن المتتابع */}
                <motion.nav
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex-1 py-6 px-4 space-y-2 overflow-y-auto custom-scrollbar"
                >
                    {navItems.map((item) => (
                        <motion.div key={item.path} variants={itemVariants}>
                            <NavLink
                                to={item.path}
                                end={item.path === '/'}
                                onClick={closeSidebar}
                                className={({ isActive }) => `
                                    flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 font-semibold text-sm relative overflow-hidden group w-full
                                    ${isActive
                                        ? 'text-orange-600 dark:text-orange-400 bg-orange-50/80 dark:bg-orange-500/10 border border-orange-200/50 dark:border-orange-500/20 shadow-sm shadow-orange-500/10'
                                        : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 border border-transparent'
                                    }
                                `}
                            >
                                {({ isActive }) => (
                                    <>
                                        {/* مؤشر الحالة النشطة */}
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeIndicator"
                                                className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 rounded-r-full shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                                            />
                                        )}

                                        <item.icon
                                            size={22}
                                            className={`transition-all duration-300 ${isActive ? 'scale-110 drop-shadow-md' : 'group-hover:scale-110 group-hover:-rotate-3'}`}
                                        />
                                        <span className={`relative z-10 transition-transform duration-300 ${!isActive && 'group-hover:translate-x-1'}`}>
                                            {item.label}
                                        </span>
                                    </>
                                )}
                            </NavLink>
                        </motion.div>
                    ))}
                </motion.nav>

                {/* الفوتر (الوضع الليلي والملف الشخصي) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, type: "spring" }}
                    className="p-5 border-t border-zinc-100 dark:border-zinc-800/50 bg-white/50 dark:bg-transparent backdrop-blur-md z-10"
                >
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-between px-4 py-3 mb-4 rounded-xl
                        bg-zinc-50 dark:bg-zinc-900/80
                        border border-zinc-200 dark:border-zinc-800
                        text-zinc-600 dark:text-zinc-400
                        hover:border-orange-300 dark:hover:border-orange-500/50 hover:shadow-md transition-all duration-300 group"
                    >
                        <span className="text-xs font-bold uppercase tracking-wider group-hover:text-orange-500 transition-colors">
                            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                        </span>
                        <div className="relative w-6 h-6 flex items-center justify-center">
                            {theme === 'dark'
                                ? <Moon size={18} className="text-purple-400 fill-purple-400/20 absolute transition-transform duration-500 rotate-0 scale-100" />
                                : <Sun size={18} className="text-orange-500 fill-orange-500/20 absolute transition-transform duration-500 rotate-90 scale-100" />
                            }
                        </div>
                    </motion.button>

                    {user ? (
                        <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 transition-colors duration-300 shadow-sm hover:shadow-md">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-orange-100 to-orange-200 dark:from-zinc-800 dark:to-zinc-700 border-2 border-white dark:border-zinc-600 flex items-center justify-center text-orange-700 dark:text-white font-bold text-base shadow-sm shrink-0">
                                    {getUserInitial()}
                                </div>
                                <div className="overflow-hidden flex-1">
                                    <p className="text-zinc-900 dark:text-white text-sm font-bold truncate">
                                        {getDisplayName()}
                                    </p>
                                    <p className={`text-[10px] font-bold uppercase tracking-wider truncate mt-0.5 ${
                                        user?.is_receptionist
                                            ? 'text-violet-600 dark:text-violet-400'
                                            : 'text-orange-600 dark:text-orange-400'
                                    }`}>
                                        {getUserRole()}
                                    </p>
                                </div>
                            </div>
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={logoutUser}
                                className="w-full flex items-center justify-center gap-2
                                bg-white dark:bg-zinc-950
                                hover:bg-red-50 hover:text-red-600 hover:border-red-200
                                dark:hover:bg-red-500/10 dark:hover:text-red-500 dark:hover:border-red-500/30
                                text-zinc-600 dark:text-zinc-400
                                border border-zinc-200 dark:border-zinc-800/80
                                py-2.5 rounded-xl transition-all duration-300 text-xs font-bold uppercase tracking-wider group"
                            >
                                <LogOut size={16} className="transition-transform group-hover:-translate-x-1" /> Log Out
                            </motion.button>
                        </div>
                    ) : (
                        <div className="text-center p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                            <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Please Log In</p>
                        </div>
                    )}
                </motion.div>
            </aside>
        </>
    );
};

export default Sidebar;