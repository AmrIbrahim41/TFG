/**
 * ChildrenHistory.jsx  — UI/UX Elevated
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
    useEffect, useState, useContext, useCallback,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dumbbell, Repeat, Timer, User, Users, Shield, Info,
    ChevronLeft, ChevronRight, X, AlertCircle,
    Calendar, Clock, Layers, Sparkles
} from 'lucide-react';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

const CATEGORY_META = {
    weight:   { label: 'Weight',  labelAr: 'وزن',  color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20', icon: Dumbbell, gradient: 'from-blue-500 to-cyan-500' },
    reps:     { label: 'Reps',    labelAr: 'عدات', color: 'text-violet-500',  bg: 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20', icon: Repeat, gradient: 'from-violet-500 to-purple-500' },
    time:     { label: 'Time',    labelAr: 'وقت',  color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20', icon: Timer, gradient: 'from-emerald-500 to-teal-500' },
    strength: { label: 'Weight',  labelAr: 'وزن',  color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20', icon: Dumbbell, gradient: 'from-blue-500 to-cyan-500' },
    cardio:   { label: 'Time',    labelAr: 'وقت',  color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20', icon: Timer, gradient: 'from-emerald-500 to-teal-500' },
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
        full:    d.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    };
};

const AVATAR_COLORS = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-cyan-500'];
const avatarColor = (name = '') => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};
const initials = (name = '') => name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

const getWorkoutFocus = (exercises) => {
    if (!exercises.length) return { label: 'General', style: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700' };
    const cats = exercises.map(e => e.category || e.type || 'weight');
    const unique = [...new Set(cats)];
    if (unique.length > 1) return { label: 'Mixed', style: 'bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-500/20' };
    return { label: getCategoryMeta(unique[0]).label, style: getCategoryMeta(unique[0]).bg + ' ' + getCategoryMeta(unique[0]).color };
};

// ─── Components ───────────────────────────────────────────────────────────────
const SkeletonCard = () => (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm">
        <div className="animate-pulse space-y-4">
            <div className="flex justify-between items-start">
                <div className="space-y-2">
                    <div className="h-5 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                    <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
                <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
            </div>
            <div className="flex gap-1.5 pt-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded-full ring-2 ring-white dark:ring-zinc-900" />)}
            </div>
            <div className="border-t border-zinc-100 dark:border-zinc-800/50 pt-4 space-y-2">
                <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-3 w-4/5 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
        </div>
    </div>
);

const AvatarStack = ({ participants = [], max = 5 }) => {
    const visible  = participants.slice(0, max);
    const overflow = participants.length - max;
    return (
        <div className="flex items-center">
            <div className="flex -space-x-2.5 hover:space-x-0 transition-all duration-300">
                {visible.map((p, i) => (
                    <motion.div
                        whileHover={{ y: -2, scale: 1.1, zIndex: 10 }}
                        key={i}
                        title={p.client_name}
                        className={`relative h-8 w-8 rounded-full ring-2 ring-white dark:ring-zinc-900
                                    flex items-center justify-center text-[10px] font-bold text-white
                                    overflow-hidden shadow-sm ${avatarColor(p.client_name)}`}
                        style={{ zIndex: visible.length - i }}
                    >
                        {p.client_photo_url ? (
                            <img src={p.client_photo_url} alt={p.client_name} className="h-full w-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                        ) : initials(p.client_name)}
                    </motion.div>
                ))}
            </div>
            {overflow > 0 && <span className="ml-2.5 text-xs text-zinc-500 font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">+{overflow}</span>}
        </div>
    );
};

const SessionCard = ({ session, onClick }) => {
    const { day, month, weekday } = formatDate(session.date);
    const exercises = parseExercises(session.exercises_summary);
    const focus     = getWorkoutFocus(exercises);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5, scale: 1.01 }}
            onClick={onClick}
            className="group relative cursor-pointer overflow-hidden rounded-3xl border
                       border-zinc-200/80 dark:border-zinc-800/80
                       bg-white dark:bg-zinc-900
                       hover:border-blue-300 dark:hover:border-blue-700/50
                       shadow-sm hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-900/20
                       transition-all duration-300 select-none flex flex-col"
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none group-hover:scale-110 transition-transform duration-500" />

            <div className="relative p-5 sm:p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400 group-hover:from-blue-600 group-hover:to-indigo-500 transition-all leading-tight">
                            {session.day_name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                            <Calendar size={12} className="text-blue-500" />
                            <span>{weekday} {day} {month}</span>
                        </div>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border whitespace-nowrap shadow-sm ${focus.style}`}>
                        {focus.label}
                    </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-5 bg-zinc-50 dark:bg-zinc-800/50 w-fit px-3 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-700/50">
                    <User size={12} className="text-violet-500" />
                    <span className="truncate max-w-[100px]">{session.coach_name}</span>
                    <span className="text-zinc-300 dark:text-zinc-600">|</span>
                    <Clock size={12} className="text-emerald-500" />
                    <span>{formatDate(session.date).time}</span>
                </div>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800/60">
                    <AvatarStack participants={session.participants || []} max={4} />
                    <div className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2 py-1 rounded-md">
                        <Layers size={12} /> {exercises.length} Ex
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ─── Elevated Modal ───────────────────────────────────────────────────────────
const SessionModal = ({ session, onClose }) => {
    if (!session) return null;
    const exercises = parseExercises(session.exercises_summary);
    const { full, time } = formatDate(session.date);

    const containerVariants = {
        hidden: { opacity: 0, scale: 0.95, y: 30 },
        visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300, staggerChildren: 0.05, delayChildren: 0.1 } },
        exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } }
    };

    const itemVariants = { hidden: { opacity: 0, x: -15 }, visible: { opacity: 1, x: 0 } };

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
                    {/* ── Gorgeous Header ── */}
                    <div className="relative p-6 sm:p-8 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white shrink-0 overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-400/20 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none" />
                        
                        <div className="relative flex items-start justify-between z-10">
                            <div className="flex-1 pr-4">
                                <motion.div variants={itemVariants} className="flex items-center gap-2 mb-2">
                                    <Sparkles size={16} className="text-blue-200" />
                                    <span className="text-xs font-bold uppercase tracking-widest text-blue-100/80">Session Overview</span>
                                </motion.div>
                                <motion.h2 variants={itemVariants} className="text-3xl sm:text-4xl font-black tracking-tight leading-none mb-4">
                                    {session.day_name}
                                </motion.h2>
                                <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3 text-sm font-medium text-blue-50/90">
                                    <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10">
                                        <Calendar size={14} /> {full}
                                    </span>
                                    <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10">
                                        <Clock size={14} /> {time}
                                    </span>
                                </motion.div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2.5 rounded-full bg-black/20 text-white/80 hover:text-white hover:bg-black/40 hover:rotate-90 transition-all duration-300 backdrop-blur-md border border-white/10"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* ── Scrollable Body ── */}
                    <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 scrollbar-hide">
                        
                        {/* ── Quick Stats Grid ── */}
                        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3 sm:gap-4 -mt-2">
                            <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <Users size={22} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Athletes</p>
                                    <p className="text-2xl font-black text-zinc-900 dark:text-white leading-none">{session.participants?.length ?? 0}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
                                    <Layers size={22} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Exercises</p>
                                    <p className="text-2xl font-black text-zinc-900 dark:text-white leading-none">{exercises.length}</p>
                                </div>
                            </div>
                        </motion.div>

                        {/* ── Attendees List ── */}
                        <motion.section variants={itemVariants}>
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500" /> Attendees
                            </h3>
                            {!session.participants?.length ? (
                                <p className="text-sm text-zinc-500 italic bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl text-center">No participants recorded.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2.5">
                                    {session.participants.map((p, i) => (
                                        <div key={i} className="group flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white overflow-hidden shadow-inner ${avatarColor(p.client_name)}`}>
                                                {p.client_photo_url ? <img src={p.client_photo_url} alt={p.client_name} className="h-full w-full object-cover" onError={e => e.target.style.display = 'none'} /> : initials(p.client_name)}
                                            </div>
                                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 pr-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {p.client_name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.section>

                        {/* ── Exercises List ── */}
                        <motion.section variants={itemVariants}>
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-violet-500" /> Workout Plan
                            </h3>
                            {exercises.length === 0 ? (
                                <div className="text-center py-10 bg-zinc-50 dark:bg-zinc-800/30 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-3xl">
                                    <Dumbbell size={32} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
                                    <p className="text-sm font-medium text-zinc-500">No exercises recorded for this session.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {exercises.map((ex, i) => {
                                        const meta = getCategoryMeta(ex.category || ex.type);
                                        const Icon = meta.icon;
                                        return (
                                            <div key={i} className="group relative flex items-center gap-3 sm:gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all overflow-hidden">
                                                {/* Left Accent Color Line */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${meta.gradient} opacity-80 group-hover:opacity-100 transition-opacity`} />
                                                
                                                <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-400 shrink-0 ml-1">
                                                    {i + 1}
                                                </div>
                                                
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}>
                                                    <Icon size={18} className={meta.color} />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white truncate">
                                                        {ex.name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${meta.color}`}>
                                                            {meta.label}
                                                        </span>
                                                    </div>
                                                </div>

                                                {ex.sets_count > 0 && (
                                                    <div className="text-right shrink-0">
                                                        <span className="text-xs font-bold text-zinc-400 block mb-0.5 uppercase tracking-wider">Sets</span>
                                                        <span className="text-lg font-black font-mono text-zinc-700 dark:text-zinc-200 leading-none">{ex.sets_count}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.section>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ChildrenHistory = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSession, setSelectedSession] = useState(null);
    const [pagination, setPagination] = useState({ count: 0, next: null, previous: null, currentPage: 1, totalPages: 1 });
    const { user } = useContext(AuthContext);

    // FIX F8: The correct endpoint is /group-training/ (the standard paginated list).
    // There is no `history` custom action on GroupTrainingViewSet.
    const fetchHistory = useCallback(async (page = 1) => {
        setLoading(true); setError(null);
        try {
            const res = await api.get(`/group-training/?page=${page}`);
            if (res.data.results !== undefined) {
                setHistory(res.data.results);
                setPagination({ count: res.data.count, next: res.data.next, previous: res.data.previous, currentPage: page, totalPages: Math.ceil(res.data.count / PAGE_SIZE) });
            } else {
                setHistory(Array.isArray(res.data) ? res.data : []);
            }
        } catch { setError('Failed to load session history. Please try again.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchHistory(1); }, [fetchHistory]);

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        fetchHistory(newPage); window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') setSelectedSession(null); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    return (
        <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`border rounded-2xl p-4 sm:p-5 flex items-start gap-4 shadow-sm ${user?.is_superuser ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30' : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30'}`}>
                <div className={`p-2 rounded-xl shrink-0 ${user?.is_superuser ? 'bg-purple-200 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400' : 'bg-blue-200 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
                    {user?.is_superuser ? <Shield size={20} /> : <Info size={20} />}
                </div>
                <div>
                    <p className={`text-sm font-bold mb-1 ${user?.is_superuser ? 'text-purple-900 dark:text-purple-100' : 'text-blue-900 dark:text-blue-100'}`}>
                        {user?.is_superuser ? 'Admin View — All Coaches' : 'Your Session Records'}
                    </p>
                    <p className={`text-xs leading-relaxed ${user?.is_superuser ? 'text-purple-700 dark:text-purple-300' : 'text-blue-700 dark:text-blue-300'}`}>
                        {user?.is_superuser ? 'Showing all group session records. Trainers only see their own.' : 'Click any card below for a detailed breakdown of the session and attendees.'}
                    </p>
                </div>
            </motion.div>

            {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-medium">
                    <AlertCircle size={18} /> <span>{error}</span>
                    <button onClick={() => fetchHistory(pagination.currentPage)} className="ml-auto text-xs font-bold underline hover:no-underline">Retry</button>
                </div>
            )}

            {!loading && pagination.count > 0 && (
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-lg font-black text-zinc-900 dark:text-white">Recent Sessions <span className="text-zinc-400 font-medium text-sm ml-2">({pagination.count})</span></h2>
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
                    {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : history.length === 0 ? (
                <div className="text-center py-24 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                    <div className="relative mx-auto w-16 h-16 mb-5">
                        <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
                            <Dumbbell size={24} className="text-blue-500" />
                        </div>
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">No Records Found</h3>
                    <p className="text-sm text-zinc-500 max-w-sm mx-auto">Complete group training sessions to see them appear here in your history.</p>
                </div>
            ) : (
                <>
                    <motion.div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
                        {history.map(session => <SessionCard key={session.id} session={session} onClick={() => setSelectedSession(session)} />)}
                    </motion.div>

                    {pagination.totalPages > 1 && (
                        <div className="flex justify-center gap-2 pt-8 pb-4">
                            <button onClick={() => handlePageChange(pagination.currentPage - 1)} disabled={!pagination.previous} className="px-4 py-2 rounded-xl text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-sm">Prev</button>
                            <div className="flex gap-1 hidden sm:flex">
                                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.currentPage) <= 1).map((p, i, arr) => (
                                    <React.Fragment key={p}>
                                        {i > 0 && arr[i - 1] !== p - 1 && <span className="px-2 self-center text-zinc-400">...</span>}
                                        <button onClick={() => handlePageChange(p)} className={`w-10 h-10 rounded-xl text-sm font-bold transition-all shadow-sm ${p === pagination.currentPage ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50'}`}>{p}</button>
                                    </React.Fragment>
                                ))}
                            </div>
                            <button onClick={() => handlePageChange(pagination.currentPage + 1)} disabled={!pagination.next} className="px-4 py-2 rounded-xl text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-all shadow-sm">Next</button>
                        </div>
                    )}
                </>
            )}
            <SessionModal session={selectedSession} onClose={() => setSelectedSession(null)} />
        </div>
    );
};

export default ChildrenHistory;