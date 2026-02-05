import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Dumbbell, Repeat, Users, CheckCircle2 } from 'lucide-react';
import api from '../api';

const SessionDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/group-training/${id}/`)
            .then(res => setSession(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [id]);

    const handleRepeat = () => {
        if (!session) return;
        const exercisesData = typeof session.exercises_summary === 'string' 
            ? JSON.parse(session.exercises_summary) 
            : session.exercises_summary;

        const cleanExercises = exercisesData.map(e => ({
            id: Date.now() + Math.random(),
            name: e.name,
            type: e.type || 'strength',
            target: e.target
        }));

        navigate('/children', { 
            state: { 
                action: 'repeat_session',
                day: session.day_name,
                exercises: cleanExercises
            }
        });
    };

    if (loading) return <div className="p-10 text-zinc-900 dark:text-white">Loading...</div>;
    if (!session) return <div className="p-10 text-zinc-900 dark:text-white">Session not found</div>;

    const exercises = typeof session.exercises_summary === 'string' 
        ? JSON.parse(session.exercises_summary) 
        : session.exercises_summary;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-white p-6 pt-24 lg:pl-80 animate-in slide-in-from-right transition-colors">
            <div className="max-w-4xl mx-auto">
                
                {/* Header */}
                <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    <ArrowLeft size={18}/> Back to History
                </button>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-zinc-300 dark:border-zinc-800 pb-8">
                    <div>
                        <h1 className="text-3xl font-black mb-2">{session.day_name} Session</h1>
                        <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400 text-sm">
                            <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(session.date).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1"><User size={14}/> Coach {session.coach_name}</span>
                        </div>
                    </div>
                    <button 
                        onClick={handleRepeat}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                    >
                        <Repeat size={18}/> Repeat This Session
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    
                    {/* Left Col: Exercises */}
                    <div className="md:col-span-2 space-y-6">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                            <Dumbbell className="text-blue-500"/> Workout Plan
                        </h2>
                        <div className="space-y-3">
                            {exercises.map((ex, i) => (
                                <div key={i} className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex justify-between items-center shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <span className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-zinc-500 text-sm border border-zinc-200 dark:border-zinc-800">
                                            {i + 1}
                                        </span>
                                        <div>
                                            <p className="font-bold text-lg">{ex.name}</p>
                                            <p className="text-xs text-zinc-500 uppercase font-bold">{ex.type || 'Strength'}</p>
                                        </div>
                                    </div>
                                    {ex.target && (
                                        <div className="bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg font-mono font-bold text-sm">
                                            {ex.target}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Col: Participants */}
                    <div className="space-y-6">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                            <Users className="text-green-500"/> Athletes ({session.participants.length})
                        </h2>
                        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                            {session.participants.map((p, i) => (
                                <div key={i} className="p-4 border-b border-zinc-200 dark:border-zinc-800 last:border-0 flex items-center justify-between group hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                                            <User size={14}/>
                                        </div>
                                        <span className="font-bold text-sm">{p.client_name}</span>
                                    </div>
                                    <CheckCircle2 size={16} className="text-green-500"/>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SessionDetail;