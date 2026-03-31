/**
 * ChildHistoryTab.jsx — UI/UX Elevated
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, User, Activity, X, StickyNote, Info,
    ChevronLeft, ChevronRight, Dumbbell, Timer, Target,
    TrendingUp, Clock, ArrowRight, Repeat, Layers, Zap
} from 'lucide-react';
import api from '../../api';

// ─── Constants & helpers ──────────────────────────────────────────────────────
const PAGE_SIZE = 20;

const TYPE_META = {
    weight: { label: 'Weight', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30', gradient: 'from-blue-500 to-cyan-500', icon: Dumbbell, metrics: ['Weight', 'Reps'], units: ['kg', 'reps'] },
    reps: { label: 'Reps', color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-200 dark:border-violet-500/30', gradient: 'from-violet-500 to-purple-500', icon: Repeat, metrics: ['Reps', 'Sets'], units: ['reps', 'sets'] },
    time: { label: 'Time', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/30', gradient: 'from-emerald-500 to-teal-500', icon: Timer, metrics: ['Duration', 'Reps'], units: ['min', 'reps'] },
    strength: { label: 'Weight', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30', gradient: 'from-blue-500 to-cyan-500', icon: Dumbbell, metrics: ['Weight', 'Reps'], units: ['kg', 'reps'] },
    cardio: { label: 'Cardio', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/30', gradient: 'from-orange-500 to-amber-500', icon: Activity, metrics: ['Distance', 'Time'], units: ['km', 'min'] },
    circuit: { label: 'Circuit', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10', border: 'border-rose-200 dark:border-rose-500/30', gradient: 'from-rose-500 to-pink-500', icon: Target, metrics: ['Duration', 'Reps'], units: ['min', 'reps'] },
};

const getMeta = (type) => TYPE_META[(type || 'weight').toLowerCase()] || TYPE_META.weight;

const formatDateFull = (ds) => new Date(ds).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const formatDateShort = (ds) => new Date(ds).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
// BUG #7 FIX: حُذفت formatTime — كانت معرّفة لكن لا يستخدمها أي مكان في الملف (dead code).

// ─── Sub-components ───────────────────────────────────────────────────────────
const SkeletonCard = () => (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 animate-pulse shadow-sm">
        <div className="flex justify-between items-start mb-6">
            <div className="space-y-3">
                <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
            <div className="h-10 w-10 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        </div>
        <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-4 flex gap-2">
            <div className="h-6 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
            <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
        </div>
    </div>
);

const ExercisePerformanceCard = ({ perf, index }) => {
    const meta = getMeta(perf.category || perf.type);
    const Icon = meta.icon;
    const hasVal1 = perf.val1 && perf.val1 !== '-';
    const hasVal2 = perf.val2 && perf.val2 !== '-';

    return (
        <motion.div
            variants={{ hidden: { opacity: 0, x: -15 }, visible: { opacity: 1, x: 0 } }}
            className="group relative rounded-2xl border bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
        >
            <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${meta.gradient} opacity-80 group-hover:opacity-100 transition-opacity`} />

            <div className="flex items-start sm:items-center gap-3 p-4 pl-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${meta.bg} ${meta.border}`}>
                    <Icon size={18} className={meta.color} />
                </div>

                <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight mb-1 truncate">
                        {perf.exercise}
                    </p>
                    <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                        {meta.label}
                    </span>
                </div>

                {/* Desktop Metrics Inline (if space allows, otherwise stacks below on mobile) */}
                <div className="hidden sm:flex gap-4 shrink-0 border-l border-zinc-100 dark:border-zinc-800 pl-4">
                    {hasVal1 && (
                        <div className="text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">{meta.metrics[0]}</p>
                            <p className={`text-xl font-black font-mono leading-none ${meta.color}`}>{perf.val1}</p>
                        </div>
                    )}
                    {hasVal2 && (
                        <div className="text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">{meta.metrics[1]}</p>
                            <p className={`text-xl font-black font-mono leading-none ${meta.color}`}>{perf.val2}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Metrics Strip */}
            <div className="sm:hidden flex border-t border-zinc-100 dark:border-zinc-800 divide-x divide-zinc-100 dark:divide-zinc-800 bg-zinc-50 dark:bg-zinc-800/20">
                {hasVal1 && (
                    <div className="flex-1 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">{meta.metrics[0]}</p>
                        <p className={`text-lg font-black font-mono leading-none ${meta.color}`}>{perf.val1}</p>
                    </div>
                )}
                {hasVal2 && (
                    <div className="flex-1 p-3 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">{meta.metrics[1]}</p>
                        <p className={`text-lg font-black font-mono leading-none ${meta.color}`}>{perf.val2}</p>
                    </div>
                )}
            </div>

            {perf.note && (
                <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-900/10">
                    <StickyNote size={13} className="mt-0.5 shrink-0" />
                    <span className="font-medium italic leading-relaxed">{perf.note}</span>
                </div>
            )}
        </motion.div>
    );
};

// ─── Elevated Performance Modal ────────────────────────────────────────────────
const PerformanceModal = ({ session, onClose }) => {
    if (!session) return null;

    const total = session.performance.length;
    const strengthCount = session.performance.filter(p => ['strength', 'weight'].includes((p.category || p.type || '').toLowerCase())).length;
    const cardioCount = session.performance.filter(p => ['cardio', 'time'].includes((p.category || p.type || '').toLowerCase())).length;

    const statBoxes = [
        { label: 'Exercises', value: total, icon: Layers, gradient: 'from-zinc-500 to-zinc-600' },
        strengthCount > 0 && { label: 'Strength', value: strengthCount, icon: Dumbbell, gradient: 'from-blue-500 to-indigo-500' },
        cardioCount > 0 && { label: 'Cardio', value: cardioCount, icon: Activity, gradient: 'from-orange-500 to-red-500' },
    ].filter(Boolean);

    const containerVariants = {
        hidden: { opacity: 0, scale: 0.95, y: 30 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300, staggerChildren: 0.05, delayChildren: 0.1 } },
        exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-900/60 backdrop-blur-md"
            >
                <motion.div
                    variants={containerVariants} initial="hidden" animate="visible" exit="exit"
                    onClick={e => e.stopPropagation()}
                    className="w-full max-w-xl max-h-[90vh] sm:max-h-[85vh] flex flex-col bg-white dark:bg-[#0c0c0e] rounded-[2rem] shadow-2xl overflow-hidden ring-1 ring-white/20 dark:ring-white/10"
                >
                    {/* ── Vibrant Header ── */}
                    <div className="relative p-6 sm:p-8 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-800 text-white shrink-0 overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-fuchsia-400/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />

                        <div className="relative flex items-start justify-between z-10">
                            <div className="flex-1 pr-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap size={16} className="text-fuchsia-200" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-fuchsia-100/80">Performance Record</span>
                                </div>
                                <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-none mb-4">
                                    {session.day_name}
                                </h2>
                                <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-fuchsia-50/90">
                                    <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10">
                                        <Calendar size={14} /> {formatDateFull(session.date)}
                                    </span>
                                    <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10">
                                        <User size={14} /> {session.coach}
                                    </span>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2.5 rounded-full bg-black/20 text-white/80 hover:text-white hover:bg-black/40 hover:rotate-90 transition-all duration-300 backdrop-blur-md border border-white/10">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* ── Body ── */}
                    <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 scrollbar-hide">

                        {/* Quick Stats Grid */}
                        <motion.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="flex flex-wrap gap-3 sm:gap-4 -mt-2">
                            {statBoxes.map(({ label, value, icon: StatIcon, gradient }) => (
                                <div key={label} className="flex-1 min-w-[30%] flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
                                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${gradient}`} />
                                    <StatIcon size={18} className="text-zinc-400 mb-2" />
                                    <p className="text-2xl font-black text-zinc-900 dark:text-white leading-none mb-1">{value}</p>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
                                </div>
                            ))}
                        </motion.div>

                        {/* Coach Note */}
                        {session.session_note && (
                            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} className="flex gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 shadow-sm">
                                <StickyNote size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">Coach Note</p>
                                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 italic leading-relaxed">"{session.session_note}"</p>
                                </div>
                            </motion.div>
                        )}

                        {/* Breakdown */}
                        <motion.section variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}>
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-fuchsia-500" /> Performance Breakdown
                            </h3>
                            {session.performance.length === 0 ? (
                                <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-800/30 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-3xl">
                                    <div className="mx-auto w-16 h-16 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center shadow-sm mb-4 border border-zinc-100 dark:border-zinc-700">
                                        <Activity size={28} className="text-zinc-400" />
                                    </div>
                                    <p className="text-base font-bold text-zinc-700 dark:text-zinc-300 mb-1">Attended Only</p>
                                    <p className="text-sm text-zinc-500 max-w-xs mx-auto">No specific exercise performance data was logged for this session.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {session.performance.map((p, i) => (
                                        <ExercisePerformanceCard key={i} perf={p} index={i} />
                                    ))}
                                </div>
                            )}
                        </motion.section>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ─── Main Tab Component ───────────────────────────────────────────────────────
const ChildHistoryTab = ({ clientId }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState(null);
    const [pagination, setPagination] = useState({ count: 0, next: null, previous: null, currentPage: 1, totalPages: 1 });

    useEffect(() => {
        const controller = new AbortController();
        fetchHistory(1, controller.signal);
        return () => controller.abort();
    }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchHistory = async (page = 1, signal) => {
        setLoading(true);
        try {
            const res = await api.get(`/group-training/child_history/?client_id=${clientId}&page=${page}`, { signal });
            if (!signal?.aborted) {
                if (res.data.results) {
                    setHistory(res.data.results);
                    setPagination({ count: res.data.count, next: res.data.next, previous: res.data.previous, currentPage: page, totalPages: Math.ceil(res.data.count / PAGE_SIZE) });
                } else { setHistory(res.data); }
            }
        } catch (err) {
            if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
                console.error('Error fetching child history:', err);
            }
        } finally { if (!signal?.aborted) setLoading(false); }
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        fetchHistory(newPage);
    };

    if (loading) {
        return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-6">{[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}</div>;
    }

    if (history.length === 0 && pagination.count === 0) {
        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-24 bg-white dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem] mt-6">
                <div className="relative mx-auto w-24 h-24 mb-6">
                    <div className="absolute inset-0 rounded-full bg-violet-500/10 animate-pulse" />
                    <div className="absolute inset-2 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center border border-white dark:border-zinc-800">
                        <Target size={32} className="text-violet-500" />
                    </div>
                </div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2">No Training Records</h3>
                <p className="text-sm font-medium text-zinc-500 max-w-sm mx-auto px-4">This athlete hasn't participated in any recorded sessions yet, or you don't have permission to view them.</p>
            </motion.div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 sm:space-y-8 mt-4">
            <div className="bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-500/10 dark:to-fuchsia-500/10 border border-violet-200 dark:border-violet-500/20 rounded-2xl p-4 sm:p-5 flex items-start gap-4 shadow-sm">
                <div className="p-2 rounded-xl bg-violet-200 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 shrink-0">
                    <TrendingUp size={20} />
                </div>
                <div>
                    <p className="text-sm font-bold text-violet-900 dark:text-violet-100 mb-1">Athlete Progress History</p>
                    <p className="text-xs font-medium text-violet-700/80 dark:text-violet-300/80 leading-relaxed">
                        Track every group session attended. Click any card to dive deep into the specific weights, reps, and times achieved.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                {history.map(session => {
                    const exerciseTypes = [...new Set(session.performance.map(p => (p.category || p.type || 'strength').toLowerCase()))];
                    return (
                        <motion.div
                            key={session.id}
                            whileHover={{ y: -5, scale: 1.02 }}
                            onClick={() => setSelectedSession(session)}
                            className="group relative cursor-pointer overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-violet-300 dark:hover:border-violet-600 shadow-sm hover:shadow-xl hover:shadow-violet-500/10 transition-all duration-300 flex flex-col"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-125 transition-transform duration-500" />

                            <div className="relative p-5 flex-1 flex flex-col">
                                <div className="flex items-start justify-between mb-5">
                                    <div>
                                        <h4 className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400 group-hover:from-violet-600 group-hover:to-fuchsia-500 transition-all mb-1.5 leading-tight">
                                            {session.day_name}
                                        </h4>
                                        <p className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                                            <Calendar size={12} className="text-violet-500" /> {formatDateShort(session.date)}
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-zinc-50 dark:bg-zinc-800 text-zinc-400 group-hover:bg-violet-600 group-hover:text-white transition-colors shadow-sm">
                                        <ArrowRight size={18} className="-rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-2.5 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-700/50">
                                        <User size={12} className="text-emerald-500" /> {session.coach}
                                    </p>
                                    <div className="flex gap-1.5">
                                        {session.performance.length === 0 ? (
                                            <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">Attended</span>
                                        ) : exerciseTypes.slice(0, 3).map(t => {
                                            const m = getMeta(t);
                                            return <span key={t} className={`flex items-center justify-center w-7 h-7 rounded-lg border ${m.bg} ${m.border}`} title={m.label}><m.icon size={12} className={m.color} /></span>;
                                        })}
                                        {exerciseTypes.length > 3 && <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500">+{exerciseTypes.length - 3}</span>}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-6">
                    {/* Pagination matches ChildrenHistory style for consistency */}
                    <button onClick={() => handlePageChange(pagination.currentPage - 1)} disabled={!pagination.previous} className="px-4 py-2 rounded-xl text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 disabled:opacity-50 transition-all shadow-sm">Prev</button>
                    <div className="flex gap-1 hidden sm:flex">
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            const p = Math.max(1, pagination.currentPage - 2) + i;
                            if (p > pagination.totalPages) return null;
                            return <button key={p} onClick={() => handlePageChange(p)} className={`w-10 h-10 rounded-xl text-sm font-bold transition-all shadow-sm ${p === pagination.currentPage ? 'bg-violet-600 text-white shadow-violet-500/30' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50'}`}>{p}</button>;
                        })}
                    </div>
                    <button onClick={() => handlePageChange(pagination.currentPage + 1)} disabled={!pagination.next} className="px-4 py-2 rounded-xl text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 disabled:opacity-50 transition-all shadow-sm">Next</button>
                </div>
            )}

            <PerformanceModal session={selectedSession} onClose={() => setSelectedSession(null)} />
        </motion.div>
    );
};

export default ChildHistoryTab;