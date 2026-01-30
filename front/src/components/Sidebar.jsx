import React, { useState, useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Dumbbell, Utensils, ShieldCheck, Menu, X, LogOut, User,Ticket,Database } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const Sidebar = () => {
    const { logoutUser, user } = useContext(AuthContext);
    const [isOpen, setIsOpen] = useState(false);

    const navItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/clients', label: 'Clients', icon: Users },
        { path: '/subscriptions', label: 'Subscriptions', icon: Ticket },
        { path: '/plans', label: 'Training Plans', icon: Dumbbell },
        { path: '/food-database', label: 'Food Database', icon: Database },
        { path: '/nutrition', label: 'Nutrition', icon: Utensils },
        // Only show Admin Panel if user exists and is a superuser
        ...(user?.is_superuser ? [{ path: '/admin', label: 'Admin Panel', icon: ShieldCheck }] : []),
    ];

    // Safety function to get initials without crashing
    const getUserInitial = () => {
        if (user?.first_name) return user.first_name.charAt(0).toUpperCase();
        if (user?.username) return user.username.charAt(0).toUpperCase();
        return 'U';
    };

    const getDisplayName = () => {
        return user?.first_name || user?.username || 'User';
    };

    const getUserRole = () => {
        return user?.is_superuser ? 'Super Admin' : 'Trainer';
    };

    return (
        <>
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#09090b]/90 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-4 z-[50]">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-zinc-800 rounded-lg flex items-center justify-center text-white">
                        <Dumbbell size={16} />
                    </div>
                    <span className="font-black text-white text-lg tracking-tight">Gym<span className="text-orange-600">OS</span></span>
                </div>
                <button onClick={() => setIsOpen(true)} className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 rounded-lg">
                    <Menu size={24} />
                </button>
            </div>

            {/* Mobile Backdrop */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] lg:hidden animate-in fade-in duration-200" onClick={() => setIsOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed top-0 left-0 z-[100] h-screen w-72 bg-[#09090b] border-r border-zinc-800 flex flex-col
                transition-transform duration-300 ease-out shadow-2xl lg:shadow-none
                ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
            `}>
                {/* Logo Area */}
                <div className="h-24 flex items-center justify-between px-8 border-b border-zinc-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-zinc-800 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-900/20">
                            <Dumbbell size={20} />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Gym<span className="text-orange-600">OS</span></h1>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="lg:hidden text-zinc-500 hover:text-white"><X size={24} /></button>
                </div>

                {/* Nav Links */}
                <nav className="flex-1 py-8 px-6 space-y-2 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsOpen(false)}
                            className={({ isActive }) => `
                                flex items-center gap-4 px-4 py-4 rounded-2xl transition-all font-bold text-sm
                                ${isActive
                                    ? 'text-orange-500 bg-orange-500/10 border border-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
                                    : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200 border border-transparent'}
                            `}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800/50 bg-[#0c0c0e]">
                    {user ? (
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-white font-bold shadow-inner">
                                    {getUserInitial()}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-white text-sm font-bold truncate">
                                        {getDisplayName()}
                                    </p>
                                    <p className="text-zinc-500 text-xs truncate">
                                        {getUserRole()}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={logoutUser}
                                className="w-full flex items-center justify-center gap-2 bg-zinc-950 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 text-zinc-400 border border-zinc-800 py-2.5 rounded-xl transition-all text-xs font-bold uppercase tracking-wider"
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