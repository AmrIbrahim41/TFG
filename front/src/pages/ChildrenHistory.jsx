import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, Dumbbell, User, ArrowRight, Clock } from 'lucide-react';
import api from '../api';

const ChildrenHistory = () => {
    const [history, setHistory] = useState([]);
    const navigate = useNavigate();
    
    useEffect(() => {
        // Fetch history (ensure your backend 'history' action returns paginated data or a list)
        api.get('/group-training/history/').then(res => setHistory(res.data.results || res.data));
    }, []);

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {history.map(session => {
                    const { day, month, year, time } = formatDate(session.date);
                    // Parse exercises if string, or use directly if JSON
                    const exercises = typeof session.exercises_summary === 'string' 
                        ? JSON.parse(session.exercises_summary) 
                        : session.exercises_summary;

                    return (
                        <div 
                            key={session.id} 
                            onClick={() => navigate(`/children/history/${session.id}`)}
                            className="bg-[#121214] border border-zinc-800 rounded-2xl p-5 cursor-pointer group hover:border-zinc-600 transition-all hover:-translate-y-1 hover:shadow-xl"
                        >
                            {/* Date Badge & Status */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-center min-w-[60px]">
                                    <span className="block text-xs text-zinc-500 uppercase font-bold">{month}</span>
                                    <span className="block text-2xl font-black text-white">{day}</span>
                                </div>
                                <div className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider">
                                    {session.day_name}
                                </div>
                            </div>

                            {/* Details */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                                    <User size={14} className="text-zinc-500"/> 
                                    <span className="font-medium text-zinc-200">{session.coach_name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                                    <Clock size={14} className="text-zinc-500"/> 
                                    <span>{time}</span>
                                </div>
                                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                                    <Users size={14} className="text-zinc-500"/> 
                                    <span>{session.participants.length} Athletes</span>
                                </div>
                            </div>

                            <div className="border-t border-zinc-800 my-4"></div>

                            {/* Exercises Preview */}
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-zinc-500 uppercase mb-2 flex items-center gap-1">
                                    <Dumbbell size={12}/> Workout Preview
                                </p>
                                {exercises.slice(0, 3).map((ex, i) => (
                                    <p key={i} className="text-sm text-zinc-300 truncate pl-2 border-l-2 border-zinc-800">
                                        {ex.name}
                                    </p>
                                ))}
                                {exercises.length > 3 && (
                                    <p className="text-xs text-zinc-600 italic pl-2">
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
        </div>
    );
};

export default ChildrenHistory;