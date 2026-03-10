import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Baby, Calendar, History, LayoutGrid } from 'lucide-react';
import ChildrenProfiles from './ChildrenProfiles';
import ChildrenSchedule from './ChildrenSchedule';
import ChildrenHistory from './ChildrenHistory';

const TABS = [
  { key: 'profiles', label: 'Profiles', icon: LayoutGrid },
  { key: 'schedule', label: 'Schedule', icon: Calendar },
  { key: 'history',  label: 'Records',  icon: History },
];

const Children = () => {
  const [activeTab, setActiveTab] = useState('profiles');
  const location = useLocation();

  useEffect(() => {
    if (location.state?.action === 'repeat_session') {
      setActiveTab('schedule');
    }
  }, [location.state]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-white p-4 md:p-6 lg:p-10 animate-in fade-in duration-500 transition-colors">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 border-b border-zinc-200 dark:border-zinc-800/60 pb-6 md:pb-8">
          {/* Title */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 md:p-3 bg-blue-100 dark:bg-blue-500/10 rounded-2xl border border-blue-200 dark:border-blue-500/20">
                <Baby className="text-blue-600 dark:text-blue-500" size={26} strokeWidth={1.5} />
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900 dark:text-white">
                Junior{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-500">
                  Athletes
                </span>
              </h1>
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm md:text-base max-w-md">
              Manage profiles, weekly schedules, and group workout history.
            </p>
          </div>

          {/* Navigation Tabs
            FIX: Added overflow-x-auto + shrink-0 on buttons so they never wrap or squish on mobile.
            The scrollbar is hidden (scrollbar-hide) while still being scrollable via touch. */}
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-1">
            <div className="flex bg-white dark:bg-zinc-900/80 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm min-w-max md:min-w-0 md:w-fit">
              {TABS.map(({ key, label, icon: Icon }) => {
                const isActive = activeTab === key;
                let activeClass = '';
                if (key === 'profiles') {
                  activeClass = isActive
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-md border border-zinc-200 dark:border-zinc-700'
                    : '';
                } else if (key === 'schedule') {
                  activeClass = isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : '';
                } else {
                  activeClass = isActive
                    ? 'bg-emerald-100 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                    : '';
                }

                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`shrink-0 px-4 md:px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap
                      ${isActive
                        ? activeClass
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}
                  >
                    <Icon size={15} /> {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────── */}
        <div className="min-h-[500px]">
          {activeTab === 'profiles' && <ChildrenProfiles />}
          {activeTab === 'schedule' && <ChildrenSchedule />}
          {activeTab === 'history'  && <ChildrenHistory />}
        </div>
      </div>
    </div>
  );
};

export default Children;