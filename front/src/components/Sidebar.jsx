import React, { useState, useContext } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
    LayoutDashboard, Users, ShieldCheck, 
    Menu, X, LogOut, Ticket, Database, Calculator, Baby,
    Briefcase, Sun, Moon, Dumbbell, PawPrint 
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Sidebar = () => {
    const { logoutUser, user } = useContext(AuthContext);
    const { theme, toggleTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogoClick = () => {
        const pathSegments = location.pathname.split('/');
        const mainSection = pathSegments[1];

        if (!mainSection) {
            navigate('/');
        } else {
            navigate('/' + mainSection);
        }
        
        setIsOpen(false);
    };

    const navItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/clients', label: 'Clients', icon: Users },
        { path: '/children', label: 'Children', icon: Baby }, 
        { path: '/subscriptions', label: 'Subscriptions', icon: Ticket },
        { path: '/food-database', label: 'Food Database', icon: Database },
        { path: '/quick-plan', label: 'Quick Nutrition', icon: Calculator },
        { path: '/quick-workout', label: 'Quick Workout', icon: Dumbbell },
        { path: '/profile', label: 'My Profile', icon: Briefcase },
        ...(user?.is_superuser ? [{ path: '/admin', label: 'Admin Panel', icon: ShieldCheck }] : []),
    ];

    const getUserInitial = () => {
        if (user?.first_name) return user.first_name.charAt(0).toUpperCase();
        if (user?.username) return user.username.charAt(0).toUpperCase();
        return 'U';
    };

    const getDisplayName = () => user?.first_name || user?.username || 'User';
    const getUserRole = () => user?.is_superuser ? 'Super Admin' : 'Trainer';

    // --- مكون الشعار المكبر ---
    // تم تكبير القيم الافتراضية هنا
    const Logo = ({ size = "w-20 h-20", textSize = "text-5xl" }) => (
        <div onClick={handleLogoClick} className="flex items-center gap-4 cursor-pointer group select-none transition-transform hover:scale-105">
            {/* حاوية الصورة (أكبر حجماً) */}
            <div className={`${size} relative rounded-xl overflow-hidden shadow-lg border border-zinc-200 dark:border-zinc-700`}>
                <img 
                    src="/tiger-logo.jpg" 
                    alt="TFG Tiger" 
                    className="w-full h-full object-cover"
                />
            </div>
            
            {/* النص TFG (أضخم وبدون Elite Gym) */}
            <h1 className={`${textSize} font-black text-zinc-900 dark:text-white leading-none tracking-tighter`}>
                T<span className="text-orange-500">F</span>G
            </h1>
        </div>
    );

    return (
        <>
            {/* Mobile Header */}
            {/* تم زيادة الارتفاع هنا لـ h-24 ليستوعب اللوجو الكبير */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-24 bg-zinc-50/90 dark:bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-300 dark:border-zinc-800 flex items-center justify-between px-6 z-[50] transition-colors duration-300">
                {/* تصغير اللوجو قليلاً للموبايل فقط ليتناسب مع الشاشة */}
                <Logo size="w-14 h-14" textSize="text-3xl" />
                <button onClick={() => setIsOpen(true)} className="p-2.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-200 dark:bg-zinc-800/50 rounded-xl border border-zinc-300 dark:border-zinc-700 active:scale-95 transition-all">
                    <Menu size={26} />
                </button>
            </div>

            {/* Mobile Backdrop */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] lg:hidden animate-in fade-in duration-200" onClick={() => setIsOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 left-0 z-[100] h-screen w-72 
                bg-zinc-50 dark:bg-[#09090b] 
                border-r border-zinc-300 dark:border-zinc-800 
                flex flex-col transition-all duration-300 ease-out 
                shadow-2xl lg:shadow-xl shadow-zinc-300/20 dark:shadow-none
                ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
            `}>
                {/* Logo Area */}
                {/* تم زيادة الارتفاع هنا لـ h-40 ليعطي مساحة للوجو الضخم */}
                <div className="h-40 flex items-center justify-center px-6 border-b border-zinc-300 dark:border-zinc-800 bg-zinc-100/30 dark:bg-zinc-900/30">
                    <Logo />
                    <button onClick={() => setIsOpen(false)} className="lg:hidden absolute right-6 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={24} /></button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 py-6 px-5 space-y-2 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsOpen(false)}
                            className={({ isActive }) => `
                                flex items-center gap-4 px-4 py-4 rounded-2xl transition-all font-bold text-sm border relative overflow-hidden group
                                ${isActive
                                    ? 'text-orange-600 bg-white dark:bg-zinc-800 border-orange-200 dark:border-orange-500/20 shadow-lg shadow-orange-500/5'
                                    : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-200 border-transparent hover:border-zinc-300 dark:hover:border-zinc-800'}
                            `}
                        >
                            <item.icon size={22} className={`transition-transform duration-300 group-hover:scale-110 ${item.path === '/quick-workout' ? 'text-orange-500' : ''}`} />
                            <span className="relative z-10">{item.label}</span>
                            
                            {/* مؤشر صغير للحالة النشطة */}
                            {({ isActive }) => isActive && (
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-orange-500 rounded-l-full" />
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer with Theme Toggle */}
                <div className="p-6 border-t border-zinc-300 dark:border-zinc-800 bg-zinc-100/50 dark:bg-[#0c0c0e] transition-colors duration-300">
                    <button 
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-between px-4 py-3.5 mb-4 rounded-xl 
                        bg-zinc-50 dark:bg-zinc-900 
                        border border-zinc-300 dark:border-zinc-800 
                        text-zinc-600 dark:text-zinc-400 
                        hover:border-orange-400 dark:hover:border-zinc-700 hover:shadow-md transition-all active:scale-95"
                    >
                        <span className="text-xs font-bold uppercase tracking-wider">
                            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                        </span>
                        {theme === 'dark' ? <Moon size={18} className="text-purple-400 fill-purple-400/20" /> : <Sun size={18} className="text-orange-500 fill-orange-500/20" />}
                    </button>

                    {user ? (
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 transition-colors duration-300 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-white font-bold text-sm shadow-inner">
                                    {getUserInitial()}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-zinc-900 dark:text-white text-sm font-bold truncate">
                                        {getDisplayName()}
                                    </p>
                                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider truncate">
                                        {getUserRole()}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={logoutUser}
                                className="w-full flex items-center justify-center gap-2 
                                bg-zinc-100 dark:bg-zinc-950 
                                hover:bg-red-50 hover:text-red-600 hover:border-red-200
                                dark:hover:bg-red-500/10 dark:hover:text-red-500 dark:hover:border-red-500/20
                                text-zinc-600 dark:text-zinc-400 
                                border border-zinc-300 dark:border-zinc-800 
                                py-3 rounded-xl transition-all text-xs font-bold uppercase tracking-wider active:scale-95"
                            >
                                <LogOut size={14} /> Log Out
                            </button>
                        </div>
                    ) : (
                        <div className="text-center p-4">
                            <p className="text-zinc-500 text-sm">Please Log In</p>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
};

export default Sidebar;