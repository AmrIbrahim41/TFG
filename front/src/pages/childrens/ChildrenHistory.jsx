import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, User, ArrowRight, Clock, Users, Info, Shield, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';

const ChildrenHistory = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        count: 0,
        next: null,
        previous: null,
        currentPage: 1,
        totalPages: 1
    });
    
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    
    useEffect(() => {
        fetchHistory(1);
    }, []);

    const fetchHistory = async (page = 1) => {
        setLoading(true);
        try {
            const res = await api.get(`/group-training/history/?page=${page}`);
            
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
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        fetchHistory(newPage);
        // Scroll to top when page changes
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return {
            day: date.getDate(),
            month: date.toLocaleString('default', { month: 'short' }),
            year: date.getFullYear(),
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Info Banner */}
            <div className={`${user?.is_superuser ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20' : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20'} border rounded-xl p-4 flex gap-3`}>
                {user?.is_superuser ? (
                    <>
                        <Shield size={18} className="text-purple-600 dark:text-purple-500 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-purple-700 dark:text-purple-300">
                            <p className="font-bold mb-1">Admin View</p>
                            <p>You're viewing all group session records from all coaches. Regular trainers only see their own sessions.</p>
                        </div>
                    </>
                ) : (
                    <>
                        <Info size={18} className="text-blue-600 dark:text-blue-500 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-700 dark:text-blue-300">
                            <p className="font-bold mb-1">Your Session Records</p>
                            <p>Showing only the group sessions you've conducted. Click any session to see detailed performance data.</p>
                        </div>
                    </>
                )}
            </div>

            {/* Pagination Info */}
            {!loading && pagination.count > 0 && (
                <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                    <span>
                        Showing <span className="font-bold text-zinc-900 dark:text-white">{((pagination.currentPage - 1) * 20) + 1}</span> to{' '}
                        <span className="font-bold text-zinc-900 dark:text-white">{Math.min(pagination.currentPage * 20, pagination.count)}</span> of{' '}
                        <span className="font-bold text-zinc-900 dark:text-white">{pagination.count}</span> sessions
                    </span>
                    <span className="text-xs">
                        Page {pagination.currentPage} of {pagination.totalPages}
                    </span>
                </div>
            )}

            {/* Loading State */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
                    <p className="text-zinc-600 dark:text-zinc-400 font-medium">Loading sessions...</p>
                </div>
            ) : history.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl">
                    <Dumbbell size={48} className="mx-auto mb-4 text-zinc-400 dark:text-zinc-600"/>
                    <p className="text-zinc-600 dark:text-zinc-500 font-bold mb-2">No session records yet</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-600 max-w-md mx-auto">
                        Complete group training sessions to see them appear here.
                    </p>
                </div>
            ) : (
                <>
                    {/* Session Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {history.map(session => {
                            const { day, month, time } = formatDate(session.date);
                            const exercises = typeof session.exercises_summary === 'string' 
                                ? JSON.parse(session.exercises_summary) 
                                : session.exercises_summary;

                            return (
                                <div 
                                    key={session.id} 
                                    onClick={() => navigate(`/children/history/${session.id}`)}
                                    className="
                                        bg-zinc-50 dark:bg-[#121214] 
                                        border border-zinc-300 dark:border-zinc-800 
                                        rounded-2xl p-5 cursor-pointer group 
                                        hover:border-zinc-400 dark:hover:border-zinc-600 
                                        transition-all hover:-translate-y-1 hover:shadow-xl
                                    "
                                >
                                    {/* Date Badge & Status */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-center min-w-[60px]">
                                            <span className="block text-xs text-zinc-600 dark:text-zinc-500 uppercase font-bold">
                                                {month}
                                            </span>
                                            <span className="block text-2xl font-black text-zinc-900 dark:text-white">
                                                {day}
                                            </span>
                                        </div>
                                        <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                                            {session.day_name}
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm">
                                            <User size={14} className="text-zinc-400 dark:text-zinc-500"/> 
                                            <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                                {session.coach_name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm">
                                            <Clock size={14} className="text-zinc-400 dark:text-zinc-500"/> 
                                            <span>{time}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm">
                                            <Users size={14} className="text-zinc-400 dark:text-zinc-500"/> 
                                            <span>{session.participants.length} Athletes</span>
                                        </div>
                                    </div>

                                    <div className="border-t border-zinc-200 dark:border-zinc-800 my-4"></div>

                                    {/* Exercises Preview */}
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-zinc-500 uppercase mb-2 flex items-center gap-1">
                                            <Dumbbell size={12}/> Workout Preview
                                        </p>
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
                                    </div>

                                    {/* Hover Arrow */}
                                    <div className="mt-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowRight className="text-blue-500" size={20}/>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination Controls */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-8 pb-4">
                            {/* Previous Button */}
                            <button
                                onClick={() => handlePageChange(pagination.currentPage - 1)}
                                disabled={!pagination.previous}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={18} />
                                <span className="hidden sm:inline">Previous</span>
                            </button>

                            {/* Page Numbers */}
                            <div className="flex items-center gap-1">
                                {[...Array(pagination.totalPages)].map((_, idx) => {
                                    const pageNum = idx + 1;
                                    // Show first page, last page, current page, and pages around current
                                    const showPage = pageNum === 1 || 
                                                    pageNum === pagination.totalPages || 
                                                    Math.abs(pageNum - pagination.currentPage) <= 1;
                                    
                                    const showEllipsis = (pageNum === 2 && pagination.currentPage > 3) ||
                                                        (pageNum === pagination.totalPages - 1 && pagination.currentPage < pagination.totalPages - 2);

                                    if (showEllipsis) {
                                        return (
                                            <span key={pageNum} className="px-2 text-zinc-400">
                                                ...
                                            </span>
                                        );
                                    }

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

                            {/* Next Button */}
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
