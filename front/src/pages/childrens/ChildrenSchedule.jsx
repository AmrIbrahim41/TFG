import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Play, Loader2, Clock, Calendar, User, MoreHorizontal, X, Users, ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router-dom'; 
import api, { BASE_URL } from '../../api';
import ActiveGroupSession from './ActiveGroupSession'; 

const ChildrenSchedule = () => {
    const [trainers, setTrainers] = useState([]);
    const [selectedCoach, setSelectedCoach] = useState(null);
    const [scheduleData, setScheduleData] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);
    const [activeChildren, setActiveChildren] = useState([]);
    const [childToAdd, setChildToAdd] = useState('');
    const [sessionTime, setSessionTime] = useState('');

    // Workout Mode
    const [activeWorkoutDay, setActiveWorkoutDay] = useState(null); 
    const [initialExercises, setInitialExercises] = useState([]); 

    const location = useLocation(); 
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Get current day name to highlight it
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    useEffect(() => {
        fetchTrainers();
        fetchActiveChildren();
    }, []);

    useEffect(() => {
        if (selectedCoach) fetchSchedule();
    }, [selectedCoach]);

    useEffect(() => {
        if (location.state && location.state.action === 'repeat_session') {
            setSelectedDay(location.state.day); 
            setInitialExercises(location.state.exercises); 
            setActiveWorkoutDay(location.state.day); 
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const fetchTrainers = async () => {
        const res = await api.get('/manage-trainers/');
        setTrainers(res.data.results || res.data);
        if (res.data.length > 0) setSelectedCoach(res.data[0].id);
    };

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/group-training/schedule/?coach_id=${selectedCoach}`);
            setScheduleData(res.data);
        } finally {
            setLoading(false);
        }
    };

    const fetchActiveChildren = async () => {
        const res = await api.get('/clients/?is_child=true&page_size=100');
        const active = (res.data.results || res.data).filter(c => c.is_subscribed);
        setActiveChildren(active);
    };

    const handleAdd = async () => {
        if (!childToAdd || !selectedDay) return;
        try {
            await api.post('/group-training/add_to_schedule/', {
                coach: parseInt(selectedCoach),
                client: parseInt(childToAdd),
                day: selectedDay,
                session_time: sessionTime || null
            });
            setIsAddModalOpen(false);
            setChildToAdd('');
            setSessionTime('');
            fetchSchedule();
        } catch (error) {
            alert("Could not add child. They might already be in this class.");
        }
    };

    const handleSetGroupTime = async () => {
        if (!sessionTime || !selectedDay) return;
        try {
            const kidsInDay = getChildrenForDay(selectedDay);
            for (const kid of kidsInDay) {
                await api.post('/group-training/add_to_schedule/', {
                    coach: parseInt(selectedCoach),
                    client: kid.client_id,
                    day: selectedDay,
                    session_time: sessionTime
                });
            }
            setIsTimeModalOpen(false);
            setSessionTime('');
            fetchSchedule();
        } catch (error) {
            alert("Error setting group time");
        }
    };

    const handleRemove = async (id) => {
        if (!window.confirm("Remove child?")) return;
        await api.delete(`/group-training/remove_from_schedule/?id=${id}`);
        fetchSchedule();
    };

    const getChildrenForDay = (day) => scheduleData.filter(i => i.day === day);
    const getImageUrl = (path) => path ? (path.startsWith('http') ? path : `${BASE_URL}${path}`) : null;
    
    // --- Helper: Get most common time for the header ---
    const getCommonTime = (day) => {
        const kids = getChildrenForDay(day);
        const times = kids.map(k => k.session_time).filter(Boolean);
        if (times.length === 0) return null;
        const timeCount = {};
        times.forEach(t => timeCount[t] = (timeCount[t] || 0) + 1);
        const mostCommon = Object.keys(timeCount).reduce((a, b) => timeCount[a] > timeCount[b] ? a : b);
        return formatTime12Hour(mostCommon); // Return formatted
    };

    // --- NEW: Helper to Format Time to 12H (AM/PM) ---
    const formatTime12Hour = (time24) => {
        if (!time24) return null;
        // Check if it already has AM/PM (just in case)
        if (time24.toLowerCase().includes('m')) return time24;

        const [hours, minutes] = time24.split(':');
        let h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        
        h = h % 12;
        h = h ? h : 12; // the hour '0' should be '12'
        
        return `${h}:${minutes} ${ampm}`;
    };

    if (activeWorkoutDay) {
        return <ActiveGroupSession 
            day={activeWorkoutDay} 
            children={getChildrenForDay(activeWorkoutDay)} 
            initialExercises={initialExercises} 
            onClose={() => { 
                setActiveWorkoutDay(null); 
                setInitialExercises([]); 
                fetchSchedule(); 
            }} 
        />
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-10">
            {/* Header & Coach Selector */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
                        Kids Schedule
                    </h1>
                    <p className="text-zinc-500 font-medium">Manage weekly group sessions</p>
                </div>

                {/* Coach Tabs */}
                <div className="bg-white dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex gap-1 shadow-sm overflow-x-auto max-w-full">
                    {trainers.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setSelectedCoach(t.id)}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-200 ${
                                selectedCoach === t.id 
                                ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-md transform scale-[1.02]' 
                                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            {t.first_name || t.username}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-32">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-orange-500 w-12 h-12" />
                        <span className="text-zinc-400 font-medium text-sm animate-pulse">Loading schedule...</span>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {daysOfWeek.map(day => {
                        const kids = getChildrenForDay(day);
                        const commonTime = getCommonTime(day);
                        const isToday = day === todayName;

                        return (
                            <div 
                                key={day} 
                                className={`
                                    relative flex flex-col h-[520px] rounded-[32px] overflow-hidden transition-all duration-300 group
                                    ${isToday 
                                        ? 'bg-white dark:bg-zinc-900 ring-4 ring-orange-500/20 shadow-2xl shadow-orange-500/10 z-10 scale-[1.02]' 
                                        : 'bg-white dark:bg-[#121214] border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xl shadow-zinc-200/50 dark:shadow-none'
                                    }
                                `}
                            >
                                {/* Card Header */}
                                <div className={`p-5 pb-4 ${isToday ? 'bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/10 dark:to-transparent' : 'bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-transparent'} border-b border-zinc-100 dark:border-zinc-800/50`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className={`text-xl font-black tracking-tight ${isToday ? 'text-orange-600 dark:text-orange-500' : 'text-zinc-800 dark:text-zinc-100'}`}>
                                                {day}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                {kids.length > 0 && (
                                                    <div className="flex -space-x-2">
                                                        {kids.slice(0, 3).map(k => (
                                                            <div key={k.id} className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-200 overflow-hidden">
                                                                <img src={getImageUrl(k.client_photo)} className="w-full h-full object-cover" alt=""/>
                                                            </div>
                                                        ))}
                                                        {kids.length > 3 && (
                                                            <div className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                                                                +{kids.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <span className={`text-xs font-bold ${isToday ? 'text-orange-600/70' : 'text-zinc-400'}`}>
                                                    {kids.length} {kids.length === 1 ? 'Athlete' : 'Athletes'}
                                                </span>
                                            </div>
                                        </div>
                                        {commonTime && (
                                            <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-sm ${isToday ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                                                <Clock size={12} />
                                                {commonTime}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Grid */}
                                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                        <button 
                                            onClick={() => { setSelectedDay(day); setIsAddModalOpen(true); }}
                                            className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-black hover:opacity-90 transition-all text-xs font-bold"
                                        >
                                            <Plus size={14} strokeWidth={3} />
                                            <span>Add</span>
                                        </button>
                                        <button 
                                            onClick={() => { setSelectedDay(day); setIsTimeModalOpen(true); }}
                                            disabled={kids.length === 0}
                                            className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors text-xs font-bold"
                                        >
                                            <Clock size={14} />
                                            <span>Time</span>
                                        </button>
                                        <button 
                                            onClick={() => setActiveWorkoutDay(day)}
                                            disabled={kids.length === 0}
                                            className="w-10 flex items-center justify-center rounded-2xl bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:shadow-none transition-all"
                                            title="Start Session"
                                        >
                                            <Play size={16} fill="currentColor" />
                                        </button>
                                    </div>
                                </div>

                                {/* List Body */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-zinc-50/50 dark:bg-zinc-900/20">
                                    {kids.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
                                            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 text-zinc-400">
                                                <Calendar size={20} />
                                            </div>
                                            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">No sessions yet</span>
                                            <button 
                                                onClick={() => { setSelectedDay(day); setIsAddModalOpen(true); }}
                                                className="mt-2 text-xs font-bold text-orange-600 hover:underline"
                                            >
                                                Add First Athlete
                                            </button>
                                        </div>
                                    ) : (
                                        kids.map(k => (
                                            <div key={k.id} className="group relative flex items-center gap-3.5 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-orange-200 dark:hover:border-orange-900/50 transition-all duration-200">
                                                <div className="relative">
                                                    <img 
                                                        src={getImageUrl(k.client_photo)} 
                                                        className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 object-cover ring-2 ring-white dark:ring-zinc-800" 
                                                        alt=""
                                                    />
                                                    {/* Status Dot (Just visual decoration) */}
                                                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full"></div>
                                                </div>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                                                        {k.client_name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {k.session_time ? (
                                                            <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300 px-1.5 py-0.5 rounded-md">
                                                                <Clock size={10} />
                                                                {formatTime12Hour(k.session_time)}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-zinc-400 italic">No time set</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <button 
                                                    onClick={() => handleRemove(k.id)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                                                    title="Remove"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* --- ADD MODAL --- */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-5 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                            <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                                Add to <span className="text-orange-500">{selectedDay}</span>
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Select Athlete</label>
                                <div className="relative">
                                    <select 
                                        className="w-full appearance-none bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-4 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
                                        onChange={(e) => setChildToAdd(e.target.value)}
                                        value={childToAdd}
                                    >
                                        <option value="">Choose an active child...</option>
                                        {activeChildren.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                        <ChevronRight size={16} className="rotate-90" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Time (Optional)</label>
                                <input 
                                    type="time"
                                    value={sessionTime}
                                    onChange={(e) => setSessionTime(e.target.value)}
                                    className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-4 text-zinc-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                />
                                <p className="text-[10px] text-zinc-400 ml-1">Time will be displayed in 12H format automatically.</p>
                            </div>

                            <button 
                                onClick={handleAdd} 
                                disabled={!childToAdd}
                                className="w-full py-4 rounded-2xl font-bold text-lg bg-zinc-900 dark:bg-white text-white dark:text-black hover:opacity-90 shadow-xl shadow-zinc-900/20 disabled:opacity-50 disabled:shadow-none transition-all mt-2"
                            >
                                Add Athlete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TIME MODAL --- */}
            {isTimeModalOpen && (
                <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                            <Clock size={32} strokeWidth={2.5} />
                        </div>
                        
                        <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-1">Set Group Time</h3>
                        <p className="text-sm text-zinc-500 font-medium mb-6">Update time for all athletes in <span className="text-zinc-900 dark:text-white font-bold">{selectedDay}</span></p>

                        <div className="relative mb-6">
                            <input 
                                type="time"
                                value={sessionTime}
                                onChange={(e) => setSessionTime(e.target.value)}
                                className="w-full bg-zinc-100 dark:bg-zinc-950 border-2 border-transparent focus:border-blue-500 rounded-2xl p-4 text-center text-4xl font-black text-zinc-900 dark:text-white font-mono outline-none transition-colors"
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setIsTimeModalOpen(false)} className="py-3.5 rounded-xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSetGroupTime} className="py-3.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all">
                                Update All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChildrenSchedule;