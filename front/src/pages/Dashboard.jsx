import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
import {
  Users, Activity, DollarSign, TrendingUp,
  ChevronDown, Check, UserCheck, Hash, CreditCard, ChevronRight,
  ArrowUpRight, ArrowDownRight, Wallet, AlertCircle, RefreshCw, Infinity,
  Calendar,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ─────────────────────────────────────────────────────────────────
// FIX #3 + #9: yearOptions computed dynamically from the current
// year and defined OUTSIDE the component.
//
// Previously this was:
//   const yearOptions = useMemo(() => [
//     { value: 2024, label: '2024' },
//     { value: 2025, label: '2025' },
//     { value: 2026, label: '2026' },
//   ], []);
//
// Two problems with that:
//   • The year range was hardcoded — would silently break in 2027.
//   • A static array inside useMemo adds memoisation overhead with
//     zero benefit; the array never changes between renders.
//
// Moving it to module scope means it is computed exactly once when
// the module loads, and the reference is always stable (no useMemo
// needed at all).
// ─────────────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
const yearOptions = [
  { value: CURRENT_YEAR - 1, label: String(CURRENT_YEAR - 1) },
  { value: CURRENT_YEAR,     label: String(CURRENT_YEAR) },
  { value: CURRENT_YEAR + 1, label: String(CURRENT_YEAR + 1) },
];

// ─────────────────────────────────────────────────────────────────
// Custom Dropdown
// ─────────────────────────────────────────────────────────────────
const CustomSelect = ({ value, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // FIX #6: Replace loose == with explicit String() coercion on both sides.
  //
  // The original code used `opt.value == value` in three places.  This
  // "worked" only because JavaScript's abstract equality coerces numbers to
  // strings when one side is a string — month/year state is a number while
  // option.value could be either, depending on how onChange propagates the
  // value.  Relying on that coercion is undocumented and fragile.
  //
  // Using String(x) === String(y) is explicit, type-safe, and communicates
  // intent clearly to future readers.
  const selectedLabel = useMemo(
    () => options.find(opt => String(opt.value) === String(value))?.label ?? value,
    [options, value],
  );

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between min-w-[120px] bg-white dark:bg-[#18181b] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm"
      >
        <span className="truncate mr-2">{selectedLabel}</span>
        <ChevronDown
          size={14}
          className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-full min-w-[140px] right-0 bg-white dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto">
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => { onChange(option.value); setIsOpen(false); }}
              className={`px-4 py-3 text-xs font-bold cursor-pointer flex items-center justify-between transition-colors
                ${String(option.value) === String(value)
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                }`}
            >
              {option.label}
              {String(option.value) === String(value) && <Check size={12} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Chart Tooltip
// ─────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-800 p-3 rounded-xl shadow-2xl">
      <p className="text-zinc-500 dark:text-zinc-400 text-xs font-bold mb-1">{label}</p>
      <p className="text-zinc-900 dark:text-white text-lg font-black">
        ${Number(payload[0].value).toLocaleString()}
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Skeleton Loaders
// ─────────────────────────────────────────────────────────────────
const Sk = ({ className = '' }) => (
  <div className={`animate-pulse bg-zinc-200 dark:bg-zinc-800 rounded-xl ${className}`} />
);

const StatCardSkeleton = () => (
  <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl animate-pulse">
    <div className="flex justify-between items-start mb-4">
      <div className="w-12 h-12 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="w-24 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
    </div>
    <Sk className="w-32 h-5 mb-2" />
    <Sk className="w-48 h-10" />
  </div>
);

const ClientCardSkeleton = () => (
  <div className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 p-5 rounded-3xl animate-pulse">
    <div className="flex items-start gap-4 mb-6">
      <div className="w-14 h-14 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex-1 space-y-2 pt-1">
        <Sk className="w-2/3 h-5" />
        <Sk className="w-1/3 h-4" />
      </div>
    </div>
    <Sk className="h-2 w-full mb-3" />
    <Sk className="h-14 w-full" />
  </div>
);

// ─────────────────────────────────────────────────────────────────
// Sessions display helper
// ─────────────────────────────────────────────────────────────────
const SessionsDisplay = ({ sessionsUsed, totalSessions }) => {
  const isUnlimited = totalSessions == null || totalSessions === 0;
  return (
    <div className="flex items-center gap-1 text-xs font-bold">
      <span className="text-zinc-900 dark:text-white">{sessionsUsed ?? 0}</span>
      <span className="text-zinc-400 dark:text-zinc-600">/</span>
      {isUnlimited ? (
        <Infinity size={14} className="text-zinc-400 dark:text-zinc-500" />
      ) : (
        <span className="text-zinc-500 dark:text-zinc-400">{totalSessions}</span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const navigate              = useNavigate();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear());

  const monthOptions = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: new Date(0, i).toLocaleString('default', { month: 'long' }),
    })), []);

  // yearOptions is now defined at module scope (see top of file).

  const currentMonthLabel = useMemo(
    () => monthOptions[selectedMonth - 1]?.label || '',
    [monthOptions, selectedMonth],
  );

  // ── Data Fetch ── AbortController pattern (unchanged — already correct) ──
  const fetchStats = useCallback(() => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();

    api.get(`/dashboard/stats/?month=${selectedMonth}&year=${selectedYear}`, {
      signal: controller.signal,
    })
      .then(res => setData(res.data))
      .catch(err => {
        if (err.name === 'CanceledError' || err.name === 'AbortError') return;
        console.error('Failed to load dashboard stats', err);
        setError('Failed to load dashboard data. Please try again.');
      })
      .finally(() => setLoading(false));

    return controller;
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    const controller = fetchStats();
    return () => controller.abort();
  }, [fetchStats]);

  const computeProgress = useCallback((client) => {
    const used  = Number(client.sessions_used ?? 0);
    const total = Number(client.total_sessions);
    if (!total || total <= 0) return null;
    return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
  }, []);

  // ─── Loading skeleton ───────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 pt-20 md:p-6 lg:p-10 min-h-screen bg-zinc-100 dark:bg-[#09090b] text-zinc-900 dark:text-white transition-colors">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-2">
              <Sk className="w-48 h-8" />
              <Sk className="w-64 h-5" />
            </div>
            <div className="flex gap-3">
              <Sk className="w-28 h-10" />
              <Sk className="w-20 h-10" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCardSkeleton /> <StatCardSkeleton />
          </div>
          <Sk className="h-[320px] w-full rounded-3xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <ClientCardSkeleton /> <ClientCardSkeleton /> <ClientCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-4 pt-20 md:p-6 lg:p-10 min-h-screen bg-zinc-100 dark:bg-[#09090b] flex items-center justify-center transition-colors">
        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 flex flex-col items-center gap-4 text-center max-w-sm mx-4">
          <AlertCircle size={40} className="text-red-500" />
          <p className="text-zinc-700 dark:text-zinc-300 font-medium">{error}</p>
          <button
            onClick={fetchStats}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-3 rounded-xl transition-all active:scale-95"
          >
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pt-20 md:p-6 lg:p-10 min-h-screen bg-zinc-100 dark:bg-[#09090b] text-zinc-900 dark:text-white animate-in fade-in duration-300 transition-colors">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Header & Filters ──────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-zinc-500 mt-1 text-sm md:text-base">
              Welcome back,{' '}
              <span className="text-orange-600 dark:text-orange-500 font-bold">{user?.username}</span>
            </p>
          </div>

          {(data?.role === 'admin' || data?.role === 'trainer') && (
            <div className="flex items-center gap-2 flex-wrap">
              <CustomSelect value={selectedMonth} options={monthOptions} onChange={setSelectedMonth} />
              <CustomSelect value={selectedYear}  options={yearOptions}  onChange={setSelectedYear} />
            </div>
          )}
        </div>

        {/* ── ADMIN VIEW ───────────────────────────────────────── */}
        {data?.role === 'admin' && (
          <div className="space-y-8">

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl
                         bg-gradient-to-r from-blue-600 to-blue-700
                         hover:from-blue-700 hover:to-blue-800
                         text-white shadow-lg shadow-blue-600/20
                         transition-all group relative overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full
                              -mr-12 -mt-12 blur-2xl pointer-events-none" />
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center
                              flex-shrink-0 group-hover:bg-white/30 transition-colors shadow-sm">
                <Users size={22} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-base font-bold leading-tight">Manage Trainers &amp; Schedules</p>
                <p className="text-xs text-blue-100 mt-0.5">
                  View all trainers, inspect schedules, and drill into individual performance
                </p>
              </div>
              <ChevronRight
                size={20}
                className="text-white/70 group-hover:text-white group-hover:translate-x-1
                           transition-all flex-shrink-0"
              />
            </motion.button>

            {/* Financial Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-5 md:p-6 rounded-3xl relative overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm">
                <div className="absolute right-0 top-0 p-32 bg-orange-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl text-zinc-500 dark:text-zinc-400">
                    <TrendingUp size={22} />
                  </div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider bg-zinc-100 dark:bg-zinc-900/50 px-2 py-1 rounded-lg">
                    {currentMonthLabel} Sales
                  </span>
                </div>
                <h3 className="text-zinc-500 text-sm font-medium">Total Sales</h3>
                <div className="text-3xl md:text-4xl font-black mt-1 text-zinc-900 dark:text-white">
                  {data.financials.total_sales || 0}
                  <span className="text-base text-zinc-400 dark:text-zinc-600 font-bold ml-1">Pkgs</span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-5 md:p-6 rounded-3xl relative overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm">
                <div className="absolute right-0 top-0 p-32 bg-green-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl text-green-600 dark:text-green-500">
                    <DollarSign size={22} />
                  </div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider bg-zinc-100 dark:bg-zinc-900/50 px-2 py-1 rounded-lg">
                    {currentMonthLabel} Revenue
                  </span>
                </div>
                <h3 className="text-zinc-500 text-sm font-medium">Total Revenue</h3>
                <div className="text-3xl md:text-4xl font-black mt-1 text-zinc-900 dark:text-white">
                  ${Number(data.financials.total_revenue || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Revenue Chart */}
            <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-5 md:p-6 rounded-3xl shadow-sm">
              <h3 className="text-base md:text-lg font-bold mb-5 flex items-center gap-2 text-zinc-900 dark:text-white">
                <Activity size={20} className="text-orange-500" /> Revenue Overview ({selectedYear})
              </h3>
              <div className="h-[260px] md:h-[300px] w-full">
                {data.financials.chart_data.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 gap-2">
                    <Activity size={32} className="opacity-20" />
                    <span className="text-sm font-medium">No sales data found.</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.financials.chart_data} barSize={32}>
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: theme === 'dark' ? '#52525b' : '#a1a1aa', fontSize: 11, fontWeight: 'bold' }}
                        dy={10}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: theme === 'dark' ? '#27272a' : '#f4f4f5', opacity: 0.4 }} />
                      <Bar dataKey="revenue" radius={[6, 6, 6, 6]}>
                        {data.financials.chart_data.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.revenue > 0 ? '#ea580c' : (theme === 'dark' ? '#27272a' : '#e4e4e7')}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Trainers Overview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base md:text-lg font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
                  <Users size={20} className="text-blue-500" /> Coach Performance
                </h3>
                <motion.button
                  whileHover={{ x: 2 }}
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-1 text-xs font-bold text-blue-500
                             hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  View All <ChevronRight size={14} />
                </motion.button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.trainers_overview.map(trainer => (
                  <motion.div
                    key={trainer.id}
                    whileHover={{ y: -2, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/admin/trainers/${trainer.id}`)}
                    className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800
                               p-4 md:p-5 rounded-2xl flex flex-col gap-4
                               hover:border-blue-400/60 dark:hover:border-blue-500/40
                               transition-all cursor-pointer shadow-sm hover:shadow-md group"
                  >
                    <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700
                                      flex items-center justify-center text-white font-bold shrink-0 shadow-sm">
                        {trainer.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-zinc-900 dark:text-white truncate
                                       group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {trainer.name}
                        </h4>
                        <span className="text-xs text-zinc-500">Coach</span>
                      </div>
                      <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 shrink-0
                                                          group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/10 p-3 rounded-xl">
                        <div className="flex justify-between items-start mb-1">
                          <div className="text-[10px] text-green-600 dark:text-green-500 font-bold uppercase">Active</div>
                          <UserCheck size={14} className="text-green-600 dark:text-green-500 opacity-50" />
                        </div>
                        <div className="text-xl font-black text-zinc-900 dark:text-white">{trainer.active_packages}</div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/10 p-3 rounded-xl">
                        <div className="flex justify-between items-start mb-1">
                          <div className="text-[10px] text-blue-600 dark:text-blue-500 font-bold uppercase">Net Earn</div>
                          <Wallet size={14} className="text-blue-600 dark:text-blue-500 opacity-50" />
                        </div>
                        <div className="text-xl font-black text-zinc-900 dark:text-white">
                          ${Number(trainer.net_revenue || 0).toLocaleString()}
                        </div>
                        {Math.abs(trainer.adjustments) > 0 && (
                          <div className={`text-[10px] font-bold mt-1 ${trainer.adjustments > 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                            {trainer.adjustments > 0 ? '+' : ''}{Number(trainer.adjustments).toLocaleString()} adj.
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 pt-1 border-t
                                    border-zinc-100 dark:border-zinc-800 text-xs font-semibold
                                    text-zinc-400 dark:text-zinc-600
                                    group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                      <Calendar size={12} />
                      View Schedule &amp; Details
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TRAINER VIEW ────────────────────────────────────── */}
        {data?.role === 'trainer' && (
          <div className="space-y-8 animate-in fade-in duration-500">

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/schedule')}
              className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl
                         bg-gradient-to-r from-orange-500 to-orange-600
                         hover:from-orange-600 hover:to-orange-700
                         text-white shadow-lg shadow-orange-500/20
                         transition-all group relative overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full
                              -mr-12 -mt-12 blur-2xl pointer-events-none" />
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center
                              flex-shrink-0 group-hover:bg-white/30 transition-colors shadow-sm">
                <Calendar size={22} className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-base font-bold leading-tight">Manage My Weekly Schedule</p>
                <p className="text-xs text-orange-100 mt-0.5">
                  Configure your shift hours and assign clients to time slots
                </p>
              </div>
              <ChevronRight
                size={20}
                className="text-white/70 group-hover:text-white group-hover:translate-x-1
                           transition-all flex-shrink-0"
              />
            </motion.button>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-5 md:p-6 rounded-3xl flex flex-col justify-center items-center gap-2 group hover:border-green-500/50 transition-colors relative overflow-hidden min-h-[200px] md:h-[240px] shadow-sm">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-10 -mt-10 blur-2xl" />
                <div className="p-4 bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-500 rounded-2xl group-hover:scale-110 transition-transform">
                  <UserCheck size={28} />
                </div>
                <div className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white mt-2 z-10">
                  {data.summary.active_clients}
                </div>
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest z-10">Active Clients</div>
              </div>

              <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-5 md:p-6 rounded-3xl flex flex-col justify-between group hover:border-orange-500/50 transition-colors relative overflow-hidden min-h-[200px] md:h-[240px] shadow-sm">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-10 -mt-10 blur-2xl" />

                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-800 text-orange-600 dark:text-orange-500 rounded-2xl group-hover:bg-orange-100 dark:group-hover:bg-orange-500/10 transition-all">
                      <Wallet size={22} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Net Revenue</div>
                      <div className="text-xs font-medium text-zinc-400">{currentMonthLabel} {selectedYear}</div>
                    </div>
                  </div>
                </div>

                <div className="z-10 mt-2">
                  <div className="text-3xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tight">
                    ${Number(data.summary.net_revenue || 0).toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 z-10">
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-2 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowUpRight size={12} className="text-green-600 dark:text-green-500" />
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Covered</span>
                    </div>
                    <div className="text-green-600 dark:text-green-500 font-bold text-sm">
                      +${Number(data.summary.additions || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-2 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 mb-1">
                      <ArrowDownRight size={12} className="text-red-600 dark:text-red-500" />
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Deducted</span>
                    </div>
                    <div className="text-red-600 dark:text-red-500 font-bold text-sm">
                      -${Number(data.summary.deductions || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Client Cards Grid */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-lg md:text-xl text-zinc-900 dark:text-white flex items-center gap-2">
                  <Users className="text-orange-500" size={20} /> My Active Clients
                </h3>
                <span className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-bold px-4 py-2 rounded-xl">
                  {data.clients.length} Active
                </span>
              </div>

              {data.clients.length === 0 ? (
                <div className="bg-white dark:bg-[#121214] border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl p-12 md:p-16 flex flex-col items-center justify-center text-center gap-4 shadow-sm">
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
                    <Users size={32} className="text-zinc-400 dark:text-zinc-600 opacity-50" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-zinc-900 dark:text-white font-bold text-lg">No Active Clients</h4>
                    <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                      Clients assigned to you with an active subscription will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {data.clients.map((client, i) => {
                    const sessionsUsed   = Number(client.sessions_used ?? 0);
                    const totalSessions  = client.total_sessions != null ? Number(client.total_sessions) : null;
                    const hasLimit       = totalSessions != null && totalSessions > 0;
                    const progress       = hasLimit
                      ? Math.min(100, Math.max(0, Math.round((sessionsUsed / totalSessions) * 100)))
                      : null;
                    const isComplete     = progress != null && progress >= 100;

                    return (
                      <div
                        key={client.id || i}
                        onClick={() => navigate(client.is_child ? `/children/${client.id}` : `/clients/${client.id}`)}
                        className="bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 hover:border-orange-400/60 dark:hover:border-orange-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 p-4 md:p-5 rounded-3xl transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md"
                      >
                        <div className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-green-300 dark:bg-green-500/20 group-hover:bg-green-500 transition-colors" />

                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-zinc-200 dark:border-zinc-700/50 group-hover:border-orange-400 dark:group-hover:border-orange-500 transition-colors shadow-sm shrink-0">
                              {client.photo ? (
                                <img src={client.photo} alt={client.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-base md:text-lg font-bold text-zinc-400">
                                  {client.name.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-zinc-900 dark:text-white text-sm md:text-base leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors truncate">
                                {client.name}
                              </h4>
                              <span className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 text-[10px] font-bold px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-800 mt-1">
                                <Hash size={10} /> {client.manual_id || 'N/A'}
                              </span>
                            </div>
                          </div>
                          <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-full text-zinc-400 dark:text-zinc-600 group-hover:text-orange-600 dark:group-hover:text-orange-500 group-hover:bg-orange-100 dark:group-hover:bg-orange-500/10 transition-colors shrink-0">
                            <ChevronRight size={16} />
                          </div>
                        </div>

                        {hasLimit ? (
                          <div className="mb-3">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider">
                                Progress
                              </span>
                              <span className={`text-[10px] font-black ${isComplete ? 'text-green-600 dark:text-green-500' : 'text-zinc-600 dark:text-zinc-300'}`}>
                                {isComplete ? '✓ Complete' : `${progress}%`}
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-green-500' : 'bg-orange-500'}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="mb-3">
                            <div className="flex items-center gap-1.5">
                              <div className="h-1.5 flex-1 bg-gradient-to-r from-orange-200 to-orange-100 dark:from-orange-500/20 dark:to-orange-500/5 rounded-full" />
                              <span className="text-[10px] font-bold text-orange-500 dark:text-orange-400 flex items-center gap-0.5">
                                <Infinity size={10} /> Unlimited
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800/50">
                          <div>
                            <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                              <CreditCard size={10} /> Plan
                            </div>
                            <div className="text-zinc-700 dark:text-zinc-200 text-xs font-bold truncate" title={client.plan}>
                              {client.plan}
                            </div>
                          </div>
                          <div className="border-l border-zinc-200 dark:border-zinc-800 pl-2 md:pl-3">
                            <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-end gap-1">
                              <Activity size={10} /> Sessions
                            </div>
                            <div className="flex justify-end">
                              <SessionsDisplay
                                sessionsUsed={sessionsUsed}
                                totalSessions={totalSessions}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RECEPTIONIST VIEW ───────────────────────────────── */}
        {data?.role === 'rec' && (
          <div className="space-y-8 animate-in fade-in duration-500">

            {/* Welcome banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 to-violet-700 p-6 md:p-8 text-white shadow-lg shadow-violet-500/20">
              <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <p className="text-violet-200 text-xs font-bold uppercase tracking-widest mb-1">Reception</p>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-1">Trainer Overview</h2>
                <p className="text-violet-200 text-sm">
                  {data.trainers.length} trainer{data.trainers.length !== 1 ? 's' : ''} on the team
                </p>
              </div>
            </div>

            {/* Trainer cards grid */}
            {data.trainers.length === 0 ? (
              <div className="border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl p-16 flex flex-col items-center gap-3 text-zinc-400">
                <Users size={40} className="opacity-30" />
                <p className="font-medium text-sm">No trainers registered yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.trainers.map((trainer) => (
                  <motion.div
                    key={trainer.id}
                    whileHover={{ y: -3, scale: 1.01 }}
                    className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 md:p-6 flex flex-col gap-5 shadow-sm hover:shadow-md hover:border-violet-300 dark:hover:border-violet-500/30 transition-all"
                  >
                    {/* Trainer header */}
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white font-black text-lg shadow-md shadow-violet-500/20 shrink-0">
                        {(trainer.name || trainer.username).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-zinc-900 dark:text-white truncate">
                          {trainer.name || trainer.username}
                        </h3>
                        <p className="text-zinc-500 text-xs truncate">@{trainer.username}</p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          <UserCheck size={10} className="text-green-500" /> Active Clients
                        </div>
                        <div className="text-2xl font-black text-zinc-900 dark:text-white">
                          {trainer.active_clients}
                        </div>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          <Hash size={10} className="text-violet-500" /> Booked Slots
                        </div>
                        <div className="text-2xl font-black text-zinc-900 dark:text-white">
                          {trainer.booked_slots}
                        </div>
                      </div>
                    </div>

                    {/* Shift hours */}
                    <div className="flex items-center gap-3 bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/15 rounded-2xl px-4 py-3">
                      <Calendar size={16} className="text-violet-500 shrink-0" />
                      {trainer.shift_start && trainer.shift_end ? (
                        <div>
                          <p className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">Working Hours</p>
                          <p className="text-sm font-bold text-zinc-900 dark:text-white">
                            {trainer.shift_start} — {trainer.shift_end}
                            {trainer.slot_duration && (
                              <span className="text-xs font-medium text-zinc-500 ml-2">
                                ({trainer.slot_duration} min slots)
                              </span>
                            )}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-400 italic">No shift set</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;