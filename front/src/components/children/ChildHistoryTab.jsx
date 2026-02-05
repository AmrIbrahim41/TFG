import React, { useEffect, useState } from 'react';
import { Calendar, User, Activity, X, Loader2, StickyNote } from 'lucide-react';
import api from '../../api'; 

const ChildHistoryTab = ({ clientId }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                // Ensure backend has the 'client_history' action in views.py
                const res = await api.get(`/group-training/client_history/?client_id=${clientId}`);
                setHistory(res.data);
            } catch (err) {
                console.error("Error fetching history", err);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [clientId]);

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-500" /></div>;

    if (history.length === 0) return (
        <div className="text-center py-20 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl opacity-50">
            <Activity size={48} className="mx-auto mb-4 text-zinc-400 dark:text-zinc-600"/>
            <p className="text-zinc-500 font-bold">No training records yet.</p>
        </div>
    );

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
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
                                <h4 className="text-zinc-900 dark:text-white font-bold text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{session.day_name}</h4>
                                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                                    <Calendar size={12}/> {new Date(session.date).toLocaleDateString()}
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 dark:text-zinc-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <Activity size={14}/>
                            </div>
                        </div>

                        {/* Mini Preview */}
                        <div className="space-y-1 mb-3">
                            {session.performance.slice(0, 2).map((p, i) => (
                                <div key={i} className="flex justify-between text-xs">
                                    <span className="text-zinc-600 dark:text-zinc-400">{p.exercise}</span>
                                    <span className="text-zinc-800 dark:text-zinc-600 font-mono">
                                        {p.val1 ? `${p.val1}` : '-'}/{p.val2 ? `${p.val2}` : '-'}
                                    </span>
                                </div>
                            ))}
                            {session.performance.length > 2 && (
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-600 italic">+{session.performance.length - 2} more exercises</p>
                            )}
                        </div>
                        
                        {/* Note Preview */}
                        {session.session_note && session.session_note !== 'Completed' && session.session_note !== 'Absent' && (
                            <div className="bg-blue-500/10 border border-blue-500/10 rounded-lg p-2 flex gap-2 items-start">
                                <StickyNote size={12} className="text-blue-600 dark:text-blue-500 mt-0.5 shrink-0"/>
                                <p className="text-xs text-blue-700 dark:text-blue-200 line-clamp-1 italic">{session.session_note}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Detail Modal */}
            {selectedSession && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-black text-zinc-900 dark:text-white">{selectedSession.day_name}</h3>
                                <p className="text-sm text-zinc-500 flex items-center gap-2">
                                    <Calendar size={14}/> {new Date(selectedSession.date).toDateString()}
                                    <span className="text-zinc-400 dark:text-zinc-700">•</span>
                                    <User size={14}/> Coach {selectedSession.coach}
                                </p>
                            </div>
                            <button onClick={() => setSelectedSession(null)} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X size={20}/></button>
                        </div>

                        {/* Session Note */}
                        {selectedSession.session_note && (
                            <div className="bg-zinc-200 dark:bg-zinc-900 border-l-2 border-blue-500 p-4 rounded-r-xl mb-6">
                                <h4 className="text-xs font-bold text-blue-600 dark:text-blue-500 uppercase mb-1 flex items-center gap-1">
                                    <StickyNote size={12}/> Coach Note
                                </h4>
                                <p className="text-zinc-700 dark:text-zinc-300 text-sm italic">"{selectedSession.session_note}"</p>
                            </div>
                        )}

                        {/* Exercises List */}
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {selectedSession.performance.map((p, i) => (
                                <div key={i} className="bg-zinc-100 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-xl p-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-2">
                                            <span className="text-zinc-500 dark:text-zinc-600 text-xs">0{i+1}</span> {p.exercise}
                                        </h4>
                                        <span className="text-[10px] font-bold uppercase bg-zinc-200 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-500 px-2 py-1 rounded">{p.type}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-zinc-200 dark:bg-zinc-900 rounded-lg p-2 text-center">
                                            <span className="block text-xs text-zinc-500 uppercase font-bold">{p.type === 'cardio' ? 'Dist' : 'Weight'}</span>
                                            <span className="text-lg font-mono font-bold text-zinc-900 dark:text-white">{p.val1 || '-'}</span>
                                        </div>
                                        <div className="flex-1 bg-zinc-200 dark:bg-zinc-900 rounded-lg p-2 text-center">
                                            <span className="block text-xs text-zinc-500 uppercase font-bold">{p.type === 'cardio' ? 'Time' : 'Reps'}</span>
                                            <span className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">{p.val2 || '-'}</span>
                                        </div>
                                    </div>
                                    {/* Per-exercise note if it exists */}
                                    {p.note && (
                                        <div className="mt-2 text-xs text-zinc-500 border-t border-zinc-300 dark:border-zinc-800 pt-2">
                                            Note: {p.note}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChildHistoryTab;