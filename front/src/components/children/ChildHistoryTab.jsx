/**
 * ChildHistoryTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * World-class child-specific session history tab.
 *
 * Key changes vs. original:
 *  1. "Performance Breakdown" modal fully redesigned with Framer Motion.
 *  2. Strength (weight/reps) vs. Cardio (distance/time) rendered with distinct
 *     visual cues: colour-coded rings, large "hero" metric, per-metric stat cards.
 *  3. Typography hierarchy: primary result = large bold mono; labels = muted xs.
 *  4. Session cards carry mini exercise previews with type-colour coding.
 *  5. Skeleton cards match real card shape.
 *  6. Beautiful animated empty state with icon composition.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, User, Activity, X, Loader2, StickyNote, Info,
    ChevronLeft, ChevronRight, Dumbbell, Timer, Zap, Target,
    TrendingUp, Clock, ArrowRight, Repeat,
} from 'lucide-react';
import api from '../../api';

// ─── Constants & helpers ──────────────────────────────────────────────────────

const PAGE_SIZE = 20;

/**
 * Exercise-type → display metadata.
 * Aligned with CATEGORY_META from ChildrenHistory for visual consistency.
 * Supports both legacy types (strength/cardio) and new API values (weight/reps/time).
 */
const TYPE_META = {
    weight: {
        label:   'Weight',
        color:   'text-blue-400',
        bg:      'bg-blue-500/10 border-blue-500/20',
        iconBg:  'bg-blue-500/10 border border-blue-500/20',
        ring:    '#3b82f6',
        icon:    Dumbbell,
        metrics: ['Weight', 'Reps'],
        units:   ['kg', 'reps'],
    },
    reps: {
        label:   'Reps',
        color:   'text-violet-400',
        bg:      'bg-violet-500/10 border-violet-500/20',
        iconBg:  'bg-violet-500/10 border border-violet-500/20',
        ring:    '#8b5cf6',
        icon:    Repeat,
        metrics: ['Reps', 'Sets'],
        units:   ['reps', 'sets'],
    },
    time: {
        label:   'Time',
        color:   'text-emerald-400',
        bg:      'bg-emerald-500/10 border-emerald-500/20',
        iconBg:  'bg-emerald-500/10 border border-emerald-500/20',
        ring:    '#10b981',
        icon:    Timer,
        metrics: ['Duration', 'Reps'],
        units:   ['min', 'reps'],
    },
    // Legacy aliases — map to new canonical entries
    strength: {
        label:   'Weight',
        color:   'text-blue-400',
        bg:      'bg-blue-500/10 border-blue-500/20',
        iconBg:  'bg-blue-500/10 border border-blue-500/20',
        ring:    '#3b82f6',
        icon:    Dumbbell,
        metrics: ['Weight', 'Reps'],
        units:   ['kg', 'reps'],
    },
    cardio: {
        label:   'Cardio',
        color:   'text-orange-400',
        bg:      'bg-orange-500/10 border-orange-500/20',
        iconBg:  'bg-orange-500/10 border border-orange-500/20',
        ring:    '#f97316',
        icon:    Activity,
        metrics: ['Distance', 'Time'],
        units:   ['km', 'min'],
    },
    circuit: {
        label:   'Circuit',
        color:   'text-emerald-400',
        bg:      'bg-emerald-500/10 border-emerald-500/20',
        iconBg:  'bg-emerald-500/10 border border-emerald-500/20',
        ring:    '#10b981',
        icon:    Timer,
        metrics: ['Duration', 'Reps'],
        units:   ['min', 'reps'],
    },
};

const getMeta = (type) => TYPE_META[(type || 'weight').toLowerCase()] || TYPE_META.weight;

const formatDateFull = (ds) =>
    new Date(ds).toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const formatDateShort = (ds) =>
    new Date(ds).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Skeleton card matching real session card shape. */
const SkeletonCard = () => (
    <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 animate-pulse">
        <div className="flex justify-between items-start mb-4">
            <div className="space-y-2">
                <div className="h-5 w-28 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
            <div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 flex gap-2">
            <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
            <div className="h-5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
        </div>
    </div>
);

/**
 * Single exercise performance card inside the modal.
 * Matches the design language of ChildrenHistory's exercise rows,
 * while retaining the performance metric data (val1 / val2).
 */
const ExercisePerformanceCard = ({ perf, index }) => {
    const meta    = getMeta(perf.type);
    const Icon    = meta.icon;
    const hasVal1 = perf.val1 && perf.val1 !== '-';
    const hasVal2 = perf.val2 && perf.val2 !== '-';

    return (
        <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl border bg-zinc-50 dark:bg-zinc-900/40
                       border-zinc-200 dark:border-zinc-800
                       hover:border-zinc-300 dark:hover:border-zinc-700
                       transition-colors overflow-hidden"
        >
            {/* ── Header row ── */}
            <div className="flex items-center gap-3 p-3.5">
                {/* Index badge */}
                <span className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-800
                                 flex items-center justify-center text-[10px] font-black
                                 text-zinc-500 dark:text-zinc-400 shrink-0">
                    {String(index + 1).padStart(2, '0')}
                </span>

                {/* Category icon */}
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${meta.iconBg}`}>
                    <Icon size={13} className={meta.color} />
                </div>

                {/* Name + type badge */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
                        {perf.exercise}
                    </p>
                </div>

                {/* Category label badge */}
                <span className={`text-[10px] font-bold uppercase tracking-wider
                                  px-2 py-0.5 rounded-full border shrink-0
                                  ${meta.bg} ${meta.color}`}>
                    {meta.label}
                </span>
            </div>

            {/* ── Metric strip (only shown when values exist) ── */}
            {(hasVal1 || hasVal2) && (
                <div className={`grid ${hasVal1 && hasVal2 ? 'grid-cols-2' : 'grid-cols-1'} gap-px border-t border-zinc-200 dark:border-zinc-800`}>
                    {hasVal1 && (
                        <div className="bg-white/70 dark:bg-zinc-900/60 px-4 py-2.5 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
                                {meta.metrics[0]}
                            </p>
                            <p className={`text-xl font-black font-mono leading-none ${meta.color}`}>
                                {perf.val1}
                            </p>
                            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5">
                                {meta.units[0]}
                            </p>
                        </div>
                    )}
                    {hasVal2 && (
                        <div className="bg-white/70 dark:bg-zinc-900/60 px-4 py-2.5 text-center border-l border-zinc-200 dark:border-zinc-800">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
                                {meta.metrics[1]}
                            </p>
                            <p className={`text-xl font-black font-mono leading-none ${meta.color}`}>
                                {perf.val2}
                            </p>
                            <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-0.5">
                                {meta.units[1]}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Optional per-exercise note */}
            {perf.note && (
                <div className="px-3.5 py-2.5 border-t border-zinc-200 dark:border-zinc-800
                                flex items-start gap-1.5 text-xs text-zinc-500 dark:text-zinc-400
                                bg-zinc-50/80 dark:bg-zinc-800/30">
                    <StickyNote size={11} className="mt-0.5 shrink-0" />
                    <span className="italic leading-snug">{perf.note}</span>
                </div>
            )}
        </motion.div>
    );
};

/**
 * Performance Breakdown Modal.
 * Framer Motion slide-up with backdrop blur.
 */
const PerformanceModal = ({ session, onClose }) => {
    if (!session) return null;

    const total         = session.performance.length;
    const strengthCount = session.performance.filter(p => (p.type || 'strength').toLowerCase() === 'strength').length;
    const cardioCount   = session.performance.filter(p => (p.type || '').toLowerCase() === 'cardio').length;

    return (
        <AnimatePresence>
            {session && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
                    />

                    {/* Modal panel (slides up from bottom on mobile, centered on desktop) */}
                    <motion.div
                        key="modal-panel"
                        initial={{ opacity: 0, y: 40, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.97 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                        className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 flex sm:items-center sm:justify-center sm:p-4"
                    >
                        <div className="w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] flex flex-col
                                        bg-white dark:bg-[#0f0f11] rounded-t-3xl sm:rounded-3xl
                                        border border-zinc-200 dark:border-zinc-800
                                        shadow-2xl overflow-hidden">

                            {/* ── MODAL HEADER ── */}
                            <div className="flex-shrink-0 px-6 pt-6 pb-5 border-b border-zinc-200 dark:border-zinc-800
                                            bg-zinc-50 dark:bg-zinc-900/60">
                                {/* Drag handle (mobile) */}
                                <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden" />

                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-xl font-black text-zinc-900 dark:text-white">
                                            {session.day_name}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={11} />
                                                {formatDateFull(session.date)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <User size={11} />
                                                <span className="text-zinc-700 dark:text-zinc-300 font-semibold">
                                                    {session.coach}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white
                                                   hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Stat pills */}
                                <div className="flex gap-2 mt-3 flex-wrap">
                                    <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full
                                                     bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
                                        <Target size={10} /> {total} exercises
                                    </span>
                                    {strengthCount > 0 && (
                                        <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full
                                                         bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            <Dumbbell size={10} /> {strengthCount} strength
                                        </span>
                                    )}
                                    {cardioCount > 0 && (
                                        <span className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full
                                                         bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                            <Activity size={10} /> {cardioCount} cardio
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* ── MODAL BODY ── */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-3">

                                {/* Coach note (if any) */}
                                {session.session_note && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex gap-2.5 p-3.5 rounded-xl
                                                   bg-blue-50 dark:bg-blue-500/10
                                                   border border-blue-200 dark:border-blue-500/20"
                                    >
                                        <StickyNote size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-0.5">
                                                Coach Note
                                            </p>
                                            <p className="text-sm text-blue-800 dark:text-blue-300 italic leading-snug">
                                                "{session.session_note}"
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Performance cards or empty state */}
                                {session.performance.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="relative mx-auto w-14 h-14 mb-4">
                                            <div className="absolute inset-0 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
                                            <div className="relative flex items-center justify-center w-14 h-14 rounded-full">
                                                <Activity size={24} className="text-zinc-400 dark:text-zinc-600" />
                                            </div>
                                        </div>
                                        <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-1">
                                            Attended — No Performance Data
                                        </p>
                                        <p className="text-xs text-zinc-400 dark:text-zinc-600 max-w-xs mx-auto">
                                            This athlete attended the session but no exercise results were logged.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {session.performance.map((p, i) => (
                                            <ExercisePerformanceCard key={i} perf={p} index={i} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ChildHistoryTab = ({ clientId }) => {
    const [history,         setHistory]         = useState([]);
    const [loading,         setLoading]         = useState(true);
    const [selectedSession, setSelectedSession] = useState(null);
    const [pagination,      setPagination]      = useState({
        count: 0, next: null, previous: null, currentPage: 1, totalPages: 1,
    });

    useEffect(() => { fetchHistory(1); }, [clientId]);

    const fetchHistory = async (page = 1) => {
        setLoading(true);
        try {
            const res = await api.get(`/group-training/client_history/?client_id=${clientId}&page=${page}`);
            if (res.data.results) {
                setHistory(res.data.results);
                setPagination({
                    count:       res.data.count,
                    next:        res.data.next,
                    previous:    res.data.previous,
                    currentPage: page,
                    totalPages:  Math.ceil(res.data.count / PAGE_SIZE),
                });
            } else {
                setHistory(res.data);
            }
        } catch (err) {
            console.error('Error fetching child history:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        fetchHistory(newPage);
    };

    // ── Loading ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            </div>
        );
    }

    // ── Empty ──────────────────────────────────────────────────────────────────
    if (history.length === 0 && pagination.count === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-24 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl"
            >
                {/* Layered icon composition */}
                <div className="relative mx-auto w-20 h-20 mb-6">
                    <div className="absolute inset-0 rounded-full bg-zinc-200 dark:bg-zinc-800/80" />
                    <div className="absolute inset-2 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center">
                        <Activity size={28} className="text-zinc-400 dark:text-zinc-500" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-900 flex items-center justify-center">
                        <Dumbbell size={13} className="text-zinc-400" />
                    </div>
                </div>
                <h3 className="text-base font-bold text-zinc-600 dark:text-zinc-400 mb-2">
                    No training records yet
                </h3>
                <p className="text-sm text-zinc-400 dark:text-zinc-600 max-w-xs mx-auto">
                    This athlete hasn't participated in any recorded sessions, or you don't have permission to view them.
                </p>
            </motion.div>
        );
    }

    // ── Main render ────────────────────────────────────────────────────────────
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-5"
        >
            {/* Info banner */}
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 flex gap-3">
                <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                    <p className="font-bold mb-0.5">Training History</p>
                    <p className="text-blue-600/80 dark:text-blue-400/80">
                        Showing all group sessions for this athlete. Click any card to see the full performance breakdown.
                    </p>
                </div>
            </div>

            {/* Count line */}
            {pagination.count > 0 && (
                <div className="flex items-center justify-between text-sm">
                    <p className="text-zinc-500 dark:text-zinc-400">
                        <span className="font-bold text-zinc-900 dark:text-white">{pagination.count}</span> sessions
                    </p>
                    {pagination.totalPages > 1 && (
                        <p className="text-xs text-zinc-400">
                            Page {pagination.currentPage} / {pagination.totalPages}
                        </p>
                    )}
                </div>
            )}

            {/* ── SESSIONS GRID ── */}
            <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            >
                {history.map(session => {
                    const exerciseTypes = [...new Set(session.performance.map(p => (p.type || 'strength').toLowerCase()))];

                    return (
                        <motion.div
                            key={session.id}
                            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
                            whileHover={{ y: -2, transition: { duration: 0.15 } }}
                            onClick={() => setSelectedSession(session)}
                            className="group relative cursor-pointer overflow-hidden rounded-2xl
                                       bg-white dark:bg-zinc-900/50
                                       border border-zinc-200 dark:border-zinc-800
                                       hover:border-zinc-300 dark:hover:border-zinc-700
                                       hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30
                                       transition-all duration-200"
                        >
                            {/* Hover shimmer */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity
                                            bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />

                            <div className="relative p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1
                                                       group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                            {session.day_name}
                                        </h4>
                                        <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">
                                            <Calendar size={11} /> {formatDateShort(session.date)}
                                        </p>
                                        <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                                            <User size={11} />
                                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                                {session.coach}
                                            </span>
                                        </p>
                                    </div>

                                    {/* Activity icon (type indicator) */}
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all
                                                    bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500
                                                    group-hover:bg-blue-600 group-hover:text-white`}>
                                        <TrendingUp size={15} />
                                    </div>
                                </div>

                                {/* Exercise count + type badges */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {session.performance.length} exercises
                                    </span>
                                    {exerciseTypes.map(t => {
                                        const m = getMeta(t);
                                        return (
                                            <span key={t} className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase
                                                                       tracking-wider px-2 py-0.5 rounded-full border ${m.bg} ${m.color}`}>
                                                <m.icon size={9} /> {m.label}
                                            </span>
                                        );
                                    })}
                                    {session.performance.length === 0 && (
                                        <span className="text-[10px] text-zinc-400 italic">Attended — no data</span>
                                    )}
                                </div>

                                {/* "View" caret */}
                                <div className="absolute bottom-4 right-4 flex items-center gap-1 text-xs text-blue-500
                                                opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all">
                                    View <ArrowRight size={13} />
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>

            {/* ── PAGINATION ── */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        disabled={!pagination.previous}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold
                                   bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800
                                   text-zinc-600 dark:text-zinc-400
                                   hover:bg-zinc-200 dark:hover:bg-zinc-800
                                   disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronLeft size={15} /> Prev
                    </button>

                    <div className="flex items-center gap-1">
                        {(() => {
                            const { currentPage: cp, totalPages: tp } = pagination;
                            const start = Math.max(1, cp - 1);
                            return Array.from({ length: Math.min(5, tp) }, (_, i) => {
                                const p = start + i;
                                if (p > tp) return null;
                                return (
                                    <button
                                        key={p}
                                        onClick={() => handlePageChange(p)}
                                        className={`min-w-[34px] h-9 rounded-xl text-sm font-bold transition-all ${
                                            p === cp
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                                                : 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                                        }`}
                                    >
                                        {p}
                                    </button>
                                );
                            });
                        })()}
                    </div>

                    <button
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        disabled={!pagination.next}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold
                                   bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800
                                   text-zinc-600 dark:text-zinc-400
                                   hover:bg-zinc-200 dark:hover:bg-zinc-800
                                   disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        Next <ChevronRight size={15} />
                    </button>
                </div>
            )}

            {/* ── PERFORMANCE MODAL ── */}
            <AnimatePresence>
                {selectedSession && (
                    <PerformanceModal
                        session={selectedSession}
                        onClose={() => setSelectedSession(null)}
                    />
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ChildHistoryTab;