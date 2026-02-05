import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; 
import { Baby, Calendar, History, LayoutGrid } from 'lucide-react';
import ChildrenProfiles from './ChildrenProfiles'; 
import ChildrenSchedule from './ChildrenSchedule'; 
import ChildrenHistory from './ChildrenHistory';   

const Children = () => {
    const [activeTab, setActiveTab] = useState('profiles');
    const location = useLocation(); 

    // --- FIX: Automatically switch to 'schedule' tab if repeating a session ---
    useEffect(() => {
        if (location.state && location.state.action === 'repeat_session') {
            setActiveTab('schedule');
        }
    }, [location]);

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-white p-6 pt-24 lg:pl-80 animate-in fade-in duration-500 transition-colors">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* --- Header Section --- */}
                <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-zinc-200 dark:border-zinc-800/60 pb-8">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-100 dark:bg-blue-500/10 rounded-2xl border border-blue-200 dark:border-blue-500/20">
                                <Baby className="text-blue-600 dark:text-blue-500" size={32} strokeWidth={1.5} />
                            </div>
                            <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
                                Junior <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-500">Athletes</span>
                            </h1>
                        </div>
                        <p className="text-zinc-500 dark:text-zinc-400 font-medium max-w-md">
                            Manage profiles, weekly schedules, and group workout history.
                        </p>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex bg-white/80 dark:bg-zinc-900/80 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm">
                        <button 
                            onClick={() => setActiveTab('profiles')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'profiles' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-lg border border-zinc-200 dark:border-zinc-700' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                        >
                            <LayoutGrid size={16} /> Profiles
                        </button>
                        <button 
                            onClick={() => setActiveTab('schedule')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'schedule' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                        >
                            <Calendar size={16} /> Schedule
                        </button>
                        <button 
                            onClick={() => setActiveTab('history')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-emerald-100 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                        >
                            <History size={16} /> Records
                        </button>
                    </div>
                </div>

                {/* --- Content Area --- */}
                <div className="min-h-[600px]">
                    {activeTab === 'profiles' && <ChildrenProfiles />} 
                    {activeTab === 'schedule' && <ChildrenSchedule />}
                    {activeTab === 'history' && <ChildrenHistory />}
                </div>
            </div>
        </div>
    );
};

export default Children;