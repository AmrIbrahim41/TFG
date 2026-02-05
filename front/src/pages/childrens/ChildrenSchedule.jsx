import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Play, Loader2 } from 'lucide-react';
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
    const [selectedDay, setSelectedDay] = useState(null);
    const [activeChildren, setActiveChildren] = useState([]);
    const [childToAdd, setChildToAdd] = useState('');

    // Workout Mode
    const [activeWorkoutDay, setActiveWorkoutDay] = useState(null); 
    const [initialExercises, setInitialExercises] = useState([]); 

    const location = useLocation(); 
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
                day: selectedDay
            });
            setIsAddModalOpen(false);
            fetchSchedule();
        } catch (error) {
            alert("Could not add child. They might already be in this class.");
        }
    };

    const handleRemove = async (id) => {
        if (!window.confirm("Remove child?")) return;
        await api.delete(`/group-training/remove_from_schedule/?id=${id}`);
        fetchSchedule();
    };

    const getChildrenForDay = (day) => scheduleData.filter(i => i.day === day);
    const getImageUrl = (path) => path ? (path.startsWith('http') ? path : `${BASE_URL}${path}`) : null;

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
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* Coach Selector */}
            <div className="flex gap-3 overflow-x-auto pb-2">
                {trainers.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setSelectedCoach(t.id)}
                        className={`px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all border ${
                            selectedCoach === t.id 
                            ? 'bg-blue-600 border-blue-500 text-white shadow-lg' 
                            : 'bg-zinc-200 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                    >
                        {t.first_name || t.username}
                    </button>
                ))}
            </div>

            {loading ? <Loader2 className="animate-spin text-blue-500 mx-auto" /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    {daysOfWeek.map(day => {
                        const kids = getChildrenForDay(day);
                        return (
                            <div key={day} className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[500px]">
                                <div className="p-3 bg-zinc-200/90 dark:bg-zinc-900/90 border-b border-zinc-300 dark:border-zinc-800 flex justify-between items-center sticky top-0 backdrop-blur-md z-10">
                                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{day}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => { setSelectedDay(day); setIsAddModalOpen(true); }} className="w-8 h-8 rounded-lg bg-zinc-300 dark:bg-zinc-800 hover:bg-zinc-400 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-400 transition-colors">
                                            <Plus size={16} />
                                        </button>
                                        <button 
                                            onClick={() => setActiveWorkoutDay(day)}
                                            disabled={kids.length === 0}
                                            className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                                        >
                                            <Play size={14} fill="currentColor" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                    {kids.map(k => (
                                        <div key={k.id} className="flex items-center gap-3 p-2 rounded-xl bg-zinc-200/50 dark:bg-zinc-900/50 border border-zinc-300/50 dark:border-zinc-800/50 group">
                                            <img src={getImageUrl(k.client_photo)} className="w-8 h-8 rounded-full bg-zinc-300 dark:bg-zinc-800 object-cover" />
                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate flex-1">{k.client_name}</span>
                                            <button onClick={() => handleRemove(k.id)} className="text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Add Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-50 dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-700 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Add to {selectedDay}</h3>
                        <select 
                            className="w-full bg-zinc-200 dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-zinc-900 dark:text-white mb-4"
                            onChange={(e) => setChildToAdd(e.target.value)}
                        >
                            <option value="">Select Child</option>
                            {activeChildren.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="flex gap-2">
                            <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700">Cancel</button>
                            <button onClick={handleAdd} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500">Add</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChildrenSchedule;