import React, { useEffect, useState } from 'react';
import { Calendar, User, Activity, X, Loader2, StickyNote, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../api'; 

const ChildHistoryTab = ({ clientId }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState(null);
    const [pagination, setPagination] = useState({
        count: 0,
        next: null,
        previous: null,
        currentPage: 1,
        totalPages: 1
    });

    useEffect(() => {
        fetchHistory(1);
    }, [clientId]);

    const fetchHistory = async (page = 1) => {
        setLoading(true);
        try {
            // Backend filters by coach permissions automatically
            const res = await api.get(`/group-training/client_history/?client_id=${clientId}&page=${page}`);
            
            // Handle paginated response structure
            if (res.data.results) {
                setHistory(res.data.results);
                setPagination({
                    count: res.data.count,
                    next: res.data.next,
                    previous: res.data.previous,
                    currentPage: page,
                    totalPages: Math.ceil(res.data.count / 20) // 20 is the page_size from backend
                });
            } else {
                // Fallback for unpaginated response (shouldn't happen)
                setHistory(res.data);
            }
        } catch (err) {
            console.error("Error fetching history", err);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        fetchHistory(newPage);
    };

    const getUnits = (type) => {
        if (type === 'cardio') return { u1: 'km', u2: 'min' };
        if (type === 'time') return { u1: 'min', u2: 'kg' };
        return { u1: 'kg', u2: '#' };
    };

    if (loading) return (
        <div className="flex justify-center p-10">
            <Loader2 className="animate-spin text-blue-500" />
        </div>
    );

    if (history.length === 0 && pagination.count === 0) return (
        <div className="text-center py-20 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl">
            <Activity size={48} className="mx-auto mb-4 text-zinc-400 dark:text-zinc-600"/>
            <p className="text-zinc-600 dark:text-zinc-500 font-bold mb-2">No training records yet</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-600 max-w-md mx-auto">
                This child hasn't participated in any group sessions, or you don't have permission to view their history.
            </p>
        </div>
    );

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Info Banner */}
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 flex gap-3">
                <Info size={18} className="text-blue-600 dark:text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                    <p className="font-bold mb-1">Viewing Training History</p>
                    <p>You can see all sessions you've conducted with this child. Admin users can view all records from all coaches.</p>
                </div>
            </div>

            {/* Pagination Info */}
            {pagination.count > 0 && (
                <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                    <span>
                        <span className="font-bold text-zinc-900 dark:text-white">{pagination.count}</span> total sessions
                    </span>
                    {pagination.totalPages > 1 && (
                        <span className="text-xs">
                            Page {pagination.currentPage} of {pagination.totalPages}
                        </span>
                    )}
                </div>
            )}

            {/* Timeline Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map(session => (
                    <div 
                        key={session.id} 
                        onClick={() => setSelectedSession(session)}
                        className="bg-zinc-100 dark:bg-black/40 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-5 hover:border-blue-500/30 hover:bg-zinc-200 dark:hover:bg-zinc-900/40 cursor-pointer transition-all group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="text-zinc-900 dark:text-white font-bold text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {session.day_name}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                                    <Calendar size={12}/> {new Date(session.date).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                                    <User size={12}/> Coach {session.coach}
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 dark:text-zinc-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <Activity size={14}/>
                            </div>
                        </div>

                        {/* Mini Preview */}
                        <div className="space-y-1 mb-3">
                            {session.performance.slice(0, 2).map((p, i) => {
                                const units = getUnits(p.type || 'strength');
                                return (
                                    <div key={i} className="flex justify-between text-xs">
                                        <span className="text-zinc-600 dark:text-zinc-400 truncate flex-1">
                                            {p.exercise}
                                        </span>
                                        <span className="text-zinc-800 dark:text-zinc-600 font-mono ml-2">
                                            {p.val1 && p.val1 !== '-' ? `${p.val1}${units.u1}` : '-'} / 
                                            {p.val2 && p.val2 !== '-' ? `${p.val2}${units.u2}` : '-'}
                                        </span>
                                    </div>
                                );
                            })}
                            {session.performance.length > 2 && (
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-600 italic">
                                    +{session.performance.length - 2} more exercises
                                </p>
                            )}
                        </div>
                        
                        {/* Note Preview */}
                        {session.session_note && session.session_note !== 'Completed' && session.session_note !== 'Absent' && (
                            <div className="bg-blue-500/10 border border-blue-500/10 rounded-lg p-2 flex gap-2 items-start">
                                <StickyNote size={12} className="text-blue-600 dark:text-blue-500 mt-0.5 shrink-0"/>
                                <p className="text-xs text-blue-700 dark:text-blue-200 line-clamp-1 italic">
                                    {session.session_note}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    {/* Previous Button */}
                    <button
                        onClick={() => handlePageChange(pagination.currentPage - 1)}
                        disabled={!pagination.previous}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronLeft size={16} />
                        Prev
                    </button>

                    {/* Page Numbers (Compact) */}
                    <div className="flex items-center gap-1">
                        {[...Array(Math.min(5, pagination.totalPages))].map((_, idx) => {
                            let pageNum;
                            if (pagination.totalPages <= 5) {
                                pageNum = idx + 1;
                            } else {
                                // Show pages around current page
                                const start = Math.max(1, pagination.currentPage - 2);
                                pageNum = start + idx;
                                if (pageNum > pagination.totalPages) return null;
                            }

                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => handlePageChange(pageNum)}
                                    className={`min-w-[36px] h-9 rounded-lg text-sm font-bold transition-all ${
                                        pageNum === pagination.currentPage
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>

                    {/* Next Button */}
                    <button
                        onClick={() => handlePageChange(pagination.currentPage + 1)}
                        disabled={!pagination.next}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-bold hover:bg-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        Next
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}

            {/* Detail Modal */}
            {selectedSession && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl animate-in zoom-in-95 flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/50 rounded-t-3xl flex-shrink-0">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-zinc-900 dark:text-white">
                                        {selectedSession.day_name}
                                    </h3>
                                    <p className="text-sm text-zinc-500 flex items-center gap-2 mt-1">
                                        <Calendar size={14}/> {new Date(selectedSession.date).toDateString()}
                                        <span className="text-zinc-400 dark:text-zinc-700">•</span>
                                        <User size={14}/> Coach {selectedSession.coach}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setSelectedSession(null)} 
                                    className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                >
                                    <X size={20}/>
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {/* Session Note */}
                            {selectedSession.session_note && (
                                <div className="bg-zinc-200 dark:bg-zinc-900 border-l-4 border-blue-500 p-4 rounded-r-xl">
                                    <h4 className="text-xs font-bold text-blue-600 dark:text-blue-500 uppercase mb-1 flex items-center gap-1">
                                        <StickyNote size={12}/> Coach Note
                                    </h4>
                                    <p className="text-zinc-700 dark:text-zinc-300 text-sm italic">
                                        "{selectedSession.session_note}"
                                    </p>
                                </div>
                            )}

                            {/* Exercises List */}
                            {selectedSession.performance.length === 0 ? (
                                <div className="text-center py-10 text-zinc-500">
                                    <Activity size={32} className="mx-auto mb-2 opacity-30"/>
                                    <p className="text-sm">Child attended but no performance data recorded.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {selectedSession.performance.map((p, i) => {
                                        const units = getUnits(p.type || 'strength');
                                        return (
                                            <div key={i} className="bg-zinc-100 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-xl p-4 hover:border-blue-500/20 transition-colors">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-2">
                                                        <span className="text-zinc-500 dark:text-zinc-600 text-xs">
                                                            {String(i + 1).padStart(2, '0')}
                                                        </span> 
                                                        {p.exercise}
                                                    </h4>
                                                    <span className="text-[10px] font-bold uppercase bg-zinc-200 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-500 px-2 py-1 rounded">
                                                        {p.type}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <div className="flex-1 bg-zinc-200 dark:bg-zinc-900 rounded-lg p-3 text-center">
                                                        <span className="block text-xs text-zinc-500 uppercase font-bold mb-1">
                                                            {p.type === 'cardio' ? 'Distance' : 'Weight'}
                                                        </span>
                                                        <span className="text-lg font-mono font-bold text-zinc-900 dark:text-white">
                                                            {p.val1 && p.val1 !== '-' ? `${p.val1} ${units.u1}` : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 bg-zinc-200 dark:bg-zinc-900 rounded-lg p-3 text-center">
                                                        <span className="block text-xs text-zinc-500 uppercase font-bold mb-1">
                                                            {p.type === 'cardio' ? 'Time' : 'Reps'}
                                                        </span>
                                                        <span className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">
                                                            {p.val2 && p.val2 !== '-' ? `${p.val2} ${units.u2}` : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Per-exercise note */}
                                                {p.note && (
                                                    <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 border-t border-zinc-300 dark:border-zinc-800 pt-2 italic">
                                                        Note: {p.note}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChildHistoryTab;
