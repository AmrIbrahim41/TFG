import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Dumbbell, User, ArrowRight, Clock, Users,
    Info, Shield, ChevronLeft, ChevronRight, AlertCircle, X
} from 'lucide-react';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';

const PAGE_SIZE = 20;

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
    <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-2xl p-5 animate-pulse">
        <div className="flex justify-between items-start mb-4">
            <div className="h-16 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
            <div className="h-7 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        </div>
        <div className="space-y-3">
            <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-4 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 my-4" />
        <div className="space-y-2">
            <div className="h-3 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-3 w-5/6 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-3 w-4/6 bg-zinc-200 dark:bg-zinc-800 rounded" />
        </div>
    </div>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, onClose }) => (
    <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-bottom-4 duration-300 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
        <AlertCircle size={18} />
        <span className="font-semibold text-sm">{message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-70"><X size={16} /></button>
    </div>
);

// ─── Component ────────────────────────────────────────────────────────────────
const ChildrenHistory = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        count: 0,
        next: null,
        previous: null,
        currentPage: 1,
        totalPages: 1,
    });

    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const fetchHistory = useCallback(async (page = 1) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/group-training/history/?page=${page}`);
            if (res.data.results !== undefined) {
                setHistory(res.data.results);
                setPagination({
                    count: res.data.count,
                    next: res.data.next,
                    previous: res.data.previous,
                    currentPage: page,
                    totalPages: Math.ceil(res.data.count / PAGE_SIZE),
                });
            } else {
                setHistory(Array.isArray(res.data) ? res.data : []);
            }
        } catch (err) {
            console.error('Error fetching history:', err);
            setError('Failed to load session history. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!cancelled) await fetchHistory(1);
        };
        run();
        return () => { cancelled = true; };
    }, [fetchHistory]);

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        fetchHistory(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return {
            day: date.getDate(),
            month: date.toLocaleString('default', { month: 'short' }),
            year: date.getFullYear(),
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
    };

    const parseExercises = (raw) => {
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return []; }
        }
        return [];
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">

            {/* Info Banner */}
            <div className={`border rounded-xl p-4 flex gap-3 ${
                user?.is_superuser
                    ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20'
                    : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20'
            }`}>
                {user?.is_superuser ? (
                    <>
                        <Shield size={18} className="text-purple-600 dark:text-purple-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-purple-700 dark:text-purple-300">
                            <p className="font-bold mb-1">Admin View</p>
                            <p>Showing all group session records from all coaches. Regular trainers only see their own sessions.</p>
                        </div>
                    </>
                ) : (
                    <>
                        <Info size={18} className="text-blue-600 dark:text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-700 dark:text-blue-300">
                            <p className="font-bold mb-1">Your Session Records</p>
                            <p>Showing group sessions you've conducted. Click any session for detailed performance data.</p>
                        </div>
                    </>
                )}
            </div>

            {/* Count info */}
            {!loading && pagination.count > 0 && (
                <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                    <span>
                        Showing{' '}
                        <span className="font-bold text-zinc-900 dark:text-white">
                            {((pagination.currentPage - 1) * PAGE_SIZE) + 1}
                        </span>{' '}–{' '}
                        <span className="font-bold text-zinc-900 dark:text-white">
                            {Math.min(pagination.currentPage * PAGE_SIZE, pagination.count)}
                        </span>{' '}of{' '}
                        <span className="font-bold text-zinc-900 dark:text-white">{pagination.count}</span> sessions
                    </span>
                    <span className="text-xs">Page {pagination.currentPage} / {pagination.totalPages}</span>
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
            ) : error ? (
                <div className="text-center py-20 border border-dashed border-red-300 dark:border-red-800 rounded-3xl bg-red-50 dark:bg-red-900/10">
                    <AlertCircle size={40} className="mx-auto mb-4 text-red-400" />
                    <p className="text-red-600 dark:text-red-400 font-bold mb-4">{error}</p>
                    <button
                        onClick={() => fetchHistory(pagination.currentPage)}
                        className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all"
                    >
                        Retry
                    </button>
                </div>
            ) : history.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl">
                    <Dumbbell size={48} className="mx-auto mb-4 text-zinc-400 dark:text-zinc-600" />
                    <p className="text-zinc-600 dark:text-zinc-500 font-bold mb-2">No session records yet</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-600 max-w-md mx-auto">
                        Complete group training sessions to see them appear here.
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {history.map(session => {
                            const { day, month, time } = formatDate(session.date);
                            const exercises = parseExercises(session.exercises_summary);

                            return (
                                <div
                                    key={session.id}
                                    onClick={() => navigate(`/children/history/${session.id}`)}
                                    className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-2xl p-5 cursor-pointer group hover:border-zinc-400 dark:hover:border-zinc-600 transition-all hover:-translate-y-1 hover:shadow-xl"
                                >
                                    {/* Date + Day Badge */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-center min-w-[60px]">
                                            <span className="block text-xs text-zinc-600 dark:text-zinc-500 uppercase font-bold">{month}</span>
                                            <span className="block text-2xl font-black text-zinc-900 dark:text-white leading-none">{day}</span>
                                        </div>
                                        <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                                            {session.day_name}
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                                            <User size={14} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
                                            <span className="font-medium text-zinc-700 dark:text-zinc-200 truncate">{session.coach_name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                                            <Clock size={14} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
                                            <span>{time}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                                            <Users size={14} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
                                            <span>{session.participants?.length ?? 0} Athletes</span>
                                        </div>
                                    </div>

                                    <div className="border-t border-zinc-200 dark:border-zinc-800 my-4" />

                                    {/* Exercises Preview */}
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-zinc-500 uppercase mb-2 flex items-center gap-1">
                                            <Dumbbell size={12} /> Workout Preview
                                        </p>
                                        {exercises.length === 0 ? (
                                            <p className="text-xs text-zinc-400 italic">No exercises recorded.</p>
                                        ) : (
                                            <>
                                                {exercises.slice(0, 3).map((ex, i) => (
                                                    <p key={i} className="text-sm text-zinc-600 dark:text-zinc-300 truncate pl-2 border-l-2 border-zinc-300 dark:border-zinc-800">
                                                        {ex.name}
                                                    </p>
                                                ))}
                                                {exercises.length > 3 && (
                                                    <p className="text-xs text-zinc-500 italic pl-2">
                                                        + {exercises.length - 3} more...
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    <div className="mt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowRight className="text-blue-500" size={20} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-8 pb-4">
                            <button
                                onClick={() => handlePageChange(pagination.currentPage - 1)}
                                disabled={!pagination.previous}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={18} />
                                <span className="hidden sm:inline">Previous</span>
                            </button>

                            <div className="flex items-center gap-1">
                                {Array.from({ length: pagination.totalPages }, (_, idx) => {
                                    const pageNum = idx + 1;
                                    const showPage =
                                        pageNum === 1 ||
                                        pageNum === pagination.totalPages ||
                                        Math.abs(pageNum - pagination.currentPage) <= 1;
                                    const showEllipsis =
                                        (pageNum === 2 && pagination.currentPage > 3) ||
                                        (pageNum === pagination.totalPages - 1 && pagination.currentPage < pagination.totalPages - 2);

                                    if (showEllipsis) return <span key={pageNum} className="px-2 text-zinc-400">…</span>;
                                    if (!showPage) return null;

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => handlePageChange(pageNum)}
                                            className={`min-w-[40px] h-10 rounded-xl font-bold transition-all ${
                                                pageNum === pagination.currentPage
                                                    ? 'bg-blue-600 text-white shadow-lg'
                                                    : 'bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-800'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => handlePageChange(pagination.currentPage + 1)}
                                disabled={!pagination.next}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <span className="hidden sm:inline">Next</span>
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ChildrenHistory;
