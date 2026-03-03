/**
 * ChildrenHistory.jsx  — Category-Based Refactor
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes from the previous version:
 *   1. Side-drawer replaced with a CENTERED MODAL using backdrop-blur-md
 *      and Framer Motion zoom/fade entrance + exit animations.
 *   2. Card layout: Day Name is the primary header; an Avatar Stack shows
 *      all attendees of that session.
 *   3. Modal detail view is MINIMALIST: shows only exercise names + category
 *      badge + sets count. No individual performance data.
 *   4. Category-aware icons: Weight (Dumbbell), Reps (Repeat), Time (Timer).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
    useEffect, useState, useContext, useCallback,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dumbbell, Repeat, Timer, User, Users, Shield, Info,
    ChevronLeft, ChevronRight, X, AlertCircle,
    Calendar, Clock, Layers,
} from 'lucide-react';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

/**
 * Category metadata.
 * category values: "weight" | "reps" | "time"
 * Also handles legacy "strength" / "cardio" values.
 */
const CATEGORY_META = {
    weight:   { label: 'Weight',  labelAr: 'وزن',  color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',    icon: Dumbbell },
    reps:     { label: 'Reps',    labelAr: 'عدات', color: 'text-violet-400',   bg: 'bg-violet-500/10 border-violet-500/20', icon: Repeat   },
    time:     { label: 'Time',    labelAr: 'وقت',  color: 'text-emerald-400',  bg: 'bg-emerald-500/10 border-emerald-500/20', icon: Timer },
    // legacy aliases
    strength: { label: 'Weight',  labelAr: 'وزن',  color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',    icon: Dumbbell },
    cardio:   { label: 'Time',    labelAr: 'وقت',  color: 'text-emerald-400',  bg: 'bg-emerald-500/10 border-emerald-500/20', icon: Timer },
};

const getCategoryMeta = (cat) => CATEGORY_META[cat] || CATEGORY_META.weight;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseExercises = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
};

const formatDate = (dateString) => {
    const d = new Date(dateString);
    return {
        day:     d.getDate(),
        month:   d.toLocaleString('default', { month: 'short' }),
        year:    d.getFullYear(),
        weekday: d.toLocaleString('default', { weekday: 'short' }),
        time:    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        full:    d.toLocaleDateString('default', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        }),
    };
};

const AVATAR_COLORS = [
    'bg-blue-600', 'bg-violet-600', 'bg-emerald-600',
    'bg-rose-600',  'bg-amber-600',  'bg-cyan-600',
];
const avatarColor = (name = '') => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
const initials = (name = '') =>
    name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Derive a short "focus" label from exercises list
const getWorkoutFocus = (exercises) => {
    if (!exercises.length) return { label: 'General', style: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
    const cats = exercises.map(e => e.category || e.type || 'weight');
    const unique = [...new Set(cats)];
    if (unique.length > 1) return { label: 'Mixed', style: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
    return {
        label: getCategoryMeta(unique[0]).label,
        style: getCategoryMeta(unique[0]).bg + ' ' + getCategoryMeta(unique[0]).color,
    };
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
    <div className="bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 overflow-hidden">
        <div className="animate-pulse space-y-4">
            <div className="flex justify-between items-start">
                <div className="space-y-2">
                    <div className="h-5 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                    <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
                <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
            </div>
            <div className="flex gap-1.5 pt-1">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
                ))}
            </div>
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-2">
                <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-3 w-4/5 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-3 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
        </div>
    </div>
);

// ─── AvatarStack ──────────────────────────────────────────────────────────────
const AvatarStack = ({ participants = [], max = 5 }) => {
    const visible  = participants.slice(0, max);
    const overflow = participants.length - max;

    return (
        <div className="flex items-center">
            <div className="flex -space-x-2.5">
                {visible.map((p, i) => (
                    <div
                        key={i}
                        title={p.client_name}
                        className={`relative h-8 w-8 rounded-full ring-2 ring-white dark:ring-zinc-900
                                    flex items-center justify-center text-[10px] font-bold text-white
                                    overflow-hidden select-none ${avatarColor(p.client_name)}`}
                        style={{ zIndex: visible.length - i }}
                    >
                        {p.client_photo_url ? (
                            <img
                                src={p.client_photo_url}
                                alt={p.client_name}
                                className="h-full w-full object-cover"
                                onError={e => { e.target.style.display = 'none'; }}
                            />
                        ) : initials(p.client_name)}
                    </div>
                ))}
            </div>
            {overflow > 0 && (
                <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400 font-semibold">
                    +{overflow}
                </span>
            )}
        </div>
    );
};

// ─── Session Card ─────────────────────────────────────────────────────────────
const SessionCard = ({ session, onClick }) => {
    const { day, month, weekday } = formatDate(session.date);
    const exercises = parseExercises(session.exercises_summary);
    const focus     = getWorkoutFocus(exercises);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, transition: { duration: 0.18 } }}
            onClick={onClick}
            className="group relative cursor-pointer overflow-hidden rounded-2xl border
                       border-zinc-200 dark:border-zinc-800
                       bg-white dark:bg-zinc-900/50
                       hover:border-zinc-300 dark:hover:border-zinc-600
                       hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/40
                       transition-all duration-200 select-none"
        >
            {/* hover shimmer */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                            bg-gradient-to-br from-blue-500/5 via-transparent to-transparent pointer-events-none" />

            <div className="relative p-5">
                {/* ── TOP: Day Name + Focus badge ── */}
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <h3 className="text-lg font-black text-zinc-900 dark:text-white
                                       group-hover:text-blue-600 dark:group-hover:text-blue-400
                                       transition-colors leading-tight">
                            {session.day_name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            <Calendar size={11} />
                            <span>
                                {weekday} {day} {month}
                            </span>
                        </div>
                    </div>

                    <span className={`text-[10px] font-bold uppercase tracking-wider
                                     px-2.5 py-1 rounded-full border whitespace-nowrap ml-2 mt-0.5
                                     ${focus.style}`}>
                        {focus.label}
                    </span>
                </div>

                {/* ── Coach line ── */}
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                    <User size={11} />
                    <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[120px]">
                        {session.coach_name}
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">·</span>
                    <Clock size={11} />
                    <span>{formatDate(session.date).time}</span>
                </div>

                {/* ── Avatar Stack (attendees) ── */}
                <div className="flex items-center justify-between mb-4">
                    <AvatarStack participants={session.participants || []} max={5} />
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 ml-2">
                        {session.participants?.length ?? 0} athletes
                    </span>
                </div>

                {/* ── Exercise preview ── */}
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
                    {exercises.length === 0 ? (
                        <p className="text-xs text-zinc-400 italic">No exercises recorded.</p>
                    ) : (
                        <div className="space-y-1.5">
                            {exercises.slice(0, 3).map((ex, i) => {
                                const meta = getCategoryMeta(ex.category || ex.type);
                                const Icon = meta.icon;
                                return (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                        <Icon size={10} className={`${meta.color} shrink-0`} />
                                        <span className="text-zinc-600 dark:text-zinc-400 truncate">
                                            {ex.name}
                                        </span>
                                        {ex.sets_count > 0 && (
                                            <span className="ml-auto text-[10px] font-mono text-zinc-400 shrink-0">
                                                {ex.sets_count}×
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                            {exercises.length > 3 && (
                                <p className="text-xs text-zinc-400 pl-3.5">
                                    +{exercises.length - 3} more
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// ─── Session Modal (centered, backdrop-blur) ──────────────────────────────────
const SessionModal = ({ session, onClose }) => {
    if (!session) return null;
    const exercises = parseExercises(session.exercises_summary);
    const { full, time } = formatDate(session.date);

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
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md"
                    />

                    {/* Modal Panel */}
                    <motion.div
                        key="modal-panel"
                        initial={{ opacity: 0, scale: 0.92, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 24 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            className="pointer-events-auto w-full max-w-lg max-h-[90vh] flex flex-col
                                       bg-white dark:bg-[#111113]
                                       border border-zinc-200 dark:border-zinc-800
                                       rounded-3xl shadow-2xl overflow-hidden"
                        >
                            {/* ── Modal Header ── */}
                            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800
                                            bg-zinc-50/80 dark:bg-zinc-900/50 shrink-0">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <h2 className="text-2xl font-black text-zinc-900 dark:text-white truncate">
                                            {session.day_name}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                                            <span className="flex items-center gap-1.5">
                                                <Calendar size={13} /> {full}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Clock size={13} /> {time}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <User size={13} />
                                                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                                    {session.coach_name}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="flex-shrink-0 p-2 rounded-xl text-zinc-400
                                                   hover:text-zinc-900 dark:hover:text-white
                                                   hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Quick stats */}
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <div className="bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50
                                                    rounded-xl px-4 py-3 text-center">
                                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Athletes</p>
                                        <p className="text-2xl font-black text-zinc-900 dark:text-white">
                                            {session.participants?.length ?? 0}
                                        </p>
                                    </div>
                                    <div className="bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50
                                                    rounded-xl px-4 py-3 text-center">
                                        <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Exercises</p>
                                        <p className="text-2xl font-black text-zinc-900 dark:text-white">
                                            {exercises.length}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* ── Scrollable body ── */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-7">

                                {/* Attendees */}
                                <section>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400
                                                   flex items-center gap-2 mb-3">
                                        <Users size={12} /> Attendees
                                    </h3>
                                    {!session.participants?.length ? (
                                        <p className="text-sm text-zinc-400 italic text-center py-4">
                                            No participants recorded.
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {session.participants.map((p, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, scale: 0.85 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: i * 0.03 }}
                                                    className="flex items-center gap-2 px-3 py-1.5 rounded-full
                                                               bg-zinc-100 dark:bg-zinc-800
                                                               border border-zinc-200 dark:border-zinc-700"
                                                >
                                                    <div className={`h-5 w-5 rounded-full flex items-center justify-center
                                                                     text-[9px] font-bold text-white overflow-hidden
                                                                     ${avatarColor(p.client_name)}`}>
                                                        {p.client_photo_url ? (
                                                            <img
                                                                src={p.client_photo_url}
                                                                alt={p.client_name}
                                                                className="h-full w-full object-cover"
                                                                onError={e => { e.target.style.display = 'none'; }}
                                                            />
                                                        ) : initials(p.client_name)}
                                                    </div>
                                                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                                        {p.client_name}
                                                    </span>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* Exercises — minimalist, names only */}
                                <section>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400
                                                   flex items-center gap-2 mb-3">
                                        <Layers size={12} /> Workout Plan
                                    </h3>
                                    {exercises.length === 0 ? (
                                        <div className="text-center py-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                                            <Dumbbell size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                                            <p className="text-sm text-zinc-400">No exercises recorded.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {exercises.map((ex, i) => {
                                                const meta = getCategoryMeta(ex.category || ex.type);
                                                const Icon = meta.icon;
                                                return (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, x: -12 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.04 }}
                                                        className={`flex items-center gap-3 p-3.5 rounded-xl border
                                                                    bg-zinc-50 dark:bg-zinc-900/40
                                                                    border-zinc-100 dark:border-zinc-800
                                                                    hover:border-zinc-200 dark:hover:border-zinc-700
                                                                    transition-colors`}
                                                    >
                                                        {/* Index */}
                                                        <span className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-800
                                                                         flex items-center justify-center text-[10px] font-black
                                                                         text-zinc-500 shrink-0">
                                                            {i + 1}
                                                        </span>

                                                        {/* Category icon */}
                                                        <div className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 ${meta.bg}`}>
                                                            <Icon size={13} className={meta.color} />
                                                        </div>

                                                        {/* Name */}
                                                        <span className="flex-1 text-sm font-bold text-zinc-900 dark:text-white truncate">
                                                            {ex.name}
                                                        </span>

                                                        {/* Category badge */}
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider
                                                                          px-2 py-0.5 rounded-full border shrink-0
                                                                          ${meta.bg} ${meta.color}`}>
                                                            {meta.label}
                                                        </span>

                                                        {/* Sets count */}
                                                        {ex.sets_count > 0 && (
                                                            <span className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 shrink-0">
                                                                {ex.sets_count} sets
                                                            </span>
                                                        )}
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ChildrenHistory = () => {
    const [history,          setHistory]         = useState([]);
    const [loading,          setLoading]         = useState(true);
    const [error,            setError]           = useState(null);
    const [selectedSession,  setSelectedSession] = useState(null);
    const [pagination,       setPagination]      = useState({
        count: 0, next: null, previous: null, currentPage: 1, totalPages: 1,
    });

    const { user } = useContext(AuthContext);

    const fetchHistory = useCallback(async (page = 1) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/group-training/history/?page=${page}`);
            if (res.data.results !== undefined) {
                setHistory(res.data.results);
                setPagination({
                    count:       res.data.count,
                    next:        res.data.next,
                    previous:    res.data.previous,
                    currentPage: page,
                    totalPages:  Math.ceil(res.data.count / PAGE_SIZE),
                });
            } else {
                setHistory(Array.isArray(res.data) ? res.data : []);
            }
        } catch {
            setError('Failed to load session history. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchHistory(1); }, [fetchHistory]);

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        fetchHistory(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Close modal on Escape
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') setSelectedSession(null); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* ── INFO BANNER ─────────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`border rounded-xl p-4 flex gap-3 ${
                    user?.is_superuser
                        ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20'
                        : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20'
                }`}
            >
                {user?.is_superuser ? (
                    <>
                        <Shield size={16} className="text-purple-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-purple-700 dark:text-purple-300">
                            <p className="font-bold mb-0.5">Admin View — All Coaches</p>
                            <p className="text-purple-600 dark:text-purple-400">
                                Showing all group session records. Trainers only see their own.
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-700 dark:text-blue-300">
                            <p className="font-bold mb-0.5">Your Session Records</p>
                            <p className="text-blue-600 dark:text-blue-400">
                                Click any card for a full session breakdown.
                            </p>
                        </div>
                    </>
                )}
            </motion.div>

            {/* ── ERROR ── */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        className="flex items-center gap-3 p-4 rounded-xl border border-red-200 dark:border-red-800
                                   bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm"
                    >
                        <AlertCircle size={16} />
                        <span className="flex-1 font-medium">{error}</span>
                        <button
                            onClick={() => fetchHistory(pagination.currentPage)}
                            className="text-xs font-bold underline underline-offset-2 hover:no-underline"
                        >
                            Retry
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── COUNT LINE ── */}
            {!loading && pagination.count > 0 && (
                <div className="flex items-center justify-between text-sm">
                    <p className="text-zinc-500 dark:text-zinc-400">
                        <span className="font-bold text-zinc-900 dark:text-white">{pagination.count}</span>{' '}
                        sessions recorded
                    </p>
                    {pagination.totalPages > 1 && (
                        <p className="text-xs text-zinc-400">
                            Page {pagination.currentPage} / {pagination.totalPages}
                        </p>
                    )}
                </div>
            )}

            {/* ── GRID ── */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : history.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-24 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl"
                >
                    <div className="relative mx-auto w-16 h-16 mb-5">
                        <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping" />
                        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <Dumbbell size={28} className="text-zinc-400 dark:text-zinc-500" />
                        </div>
                    </div>
                    <h3 className="text-base font-bold text-zinc-600 dark:text-zinc-400 mb-2">
                        No session records yet
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-600 max-w-xs mx-auto">
                        Complete group training sessions and they will appear here.
                    </p>
                </motion.div>
            ) : (
                <>
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                        initial="hidden"
                        animate="visible"
                        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
                    >
                        {history.map(session => (
                            <SessionCard
                                key={session.id}
                                session={session}
                                onClick={() => setSelectedSession(session)}
                            />
                        ))}
                    </motion.div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4 pb-2">
                            <button
                                onClick={() => handlePageChange(pagination.currentPage - 1)}
                                disabled={!pagination.previous}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold
                                           bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800
                                           text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800
                                           disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={16} /> Prev
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: pagination.totalPages }, (_, idx) => {
                                    const p = idx + 1;
                                    const show = p === 1 || p === pagination.totalPages || Math.abs(p - pagination.currentPage) <= 1;
                                    const ellipsis = (p === 2 && pagination.currentPage > 3) || (p === pagination.totalPages - 1 && pagination.currentPage < pagination.totalPages - 2);
                                    if (ellipsis) return <span key={p} className="px-1 text-zinc-400 text-sm">…</span>;
                                    if (!show) return null;
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => handlePageChange(p)}
                                            className={`min-w-[36px] h-9 rounded-xl text-sm font-bold transition-all ${
                                                p === pagination.currentPage
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                                                    : 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => handlePageChange(pagination.currentPage + 1)}
                                disabled={!pagination.next}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold
                                           bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800
                                           text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800
                                           disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                Next <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ── CENTERED MODAL ── */}
            <AnimatePresence>
                {selectedSession && (
                    <SessionModal
                        session={selectedSession}
                        onClose={() => setSelectedSession(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default ChildrenHistory;
