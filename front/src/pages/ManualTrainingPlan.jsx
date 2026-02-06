import React, { useState, useEffect } from 'react';
import { 
    ArrowLeft, Plus, Trash2, Dumbbell, Activity, Settings, Zap, Layers, 
    TrendingUp, ArrowDown, Grip, X, Minus, FileText, User,
    Save, FolderOpen, History, Smartphone, Search, FilePlus, Calendar, Briefcase
} from 'lucide-react';
import api from '../api';
import toast, { Toaster } from 'react-hot-toast';
import WorkoutPDF_EN from '../utils/WorkoutPDF.jsx';
import { PDFDownloadLink } from '@react-pdf/renderer';

function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

const UserIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
const TECHNIQUE_CONFIG = { 'Regular': { color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800', border: 'border-zinc-200 dark:border-zinc-700', icon: Activity }, 'Drop Set': { color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-100 dark:border-red-500/30', icon: ArrowDown }, 'Super Set': { color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-100 dark:border-purple-500/30', icon: Layers }, 'Pyramid': { color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-500/30', icon: TrendingUp }, 'Negative': { color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-500/30', icon: Zap } };
const EQUIP_CONFIG = { 'Bodyweight': { color: 'text-emerald-500 dark:text-emerald-400', icon: UserIcon }, 'Dumbbell': { color: 'text-blue-500 dark:text-blue-400', icon: Dumbbell }, 'Barbell': { color: 'text-zinc-600 dark:text-zinc-300', icon: Grip }, 'Cable': { color: 'text-cyan-500 dark:text-cyan-400', icon: Zap }, 'Machine': { color: 'text-indigo-500 dark:text-indigo-400', icon: Settings } };

const ManualTrainingPlan = () => {
    const [clientName, setClientName] = useState('');
    const [phone, setPhone] = useState('');
    const [trainerName, setTrainerName] = useState('');
    const [sessionName, setSessionName] = useState('');
    const [brandName, setBrandName] = useState('TFG'); 
    
    const [showIdentity, setShowIdentity] = useState(true);
    const [isClient, setIsClient] = useState(false);
    const [savedWorkouts, setSavedWorkouts] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [historySearch, setHistorySearch] = useState('');

    const [exercises, setExercises] = useState([{ name: '', sets: [{ reps: '', weight: '', technique: 'Regular', equipment: '' }] }]);

    // --- PDF SYNC LOGIC ---
    const debouncedExercises = useDebounce(exercises, 1000);
    const debouncedIdentity = useDebounce({ clientName, trainerName, sessionName, brandName }, 1000);

    const [pdfData, setPdfData] = useState({
        exercises: exercises,
        identity: { clientName, trainerName, sessionName, brandName }
    });

    useEffect(() => {
        setPdfData({
            exercises: debouncedExercises,
            identity: debouncedIdentity
        });
    }, [debouncedExercises, debouncedIdentity]);

    useEffect(() => { setIsClient(true); }, []);

    const updateExercise = (idx, field, val) => { 
        setExercises(prev => prev.map((ex, i) => i === idx ? { ...ex, [field]: val } : ex));
    };
    
    const updateSet = (exIdx, setIdx, field, val) => {
        setExercises(prev => prev.map((ex, i) => {
            if (i !== exIdx) return ex;
            return {
                ...ex,
                sets: ex.sets.map((s, j) => j === setIdx ? { ...s, [field]: val } : s)
            };
        }));
    };
    
    const handleSetCount = (exIdx, delta) => {
        setExercises(prev => prev.map((ex, i) => {
            if (i !== exIdx) return ex;
            const newSets = [...ex.sets];
            if (delta > 0) newSets.push({ reps: '', weight: '', technique: 'Regular', equipment: '' });
            else {
                if (newSets.length > 1) newSets.pop();
                else toast.error("Minimum 1 set required");
            }
            return { ...ex, sets: newSets };
        }));
    };

    const handleExerciseCount = (delta) => {
        setExercises(prev => {
            const newEx = [...prev];
            if (delta > 0) newEx.push({ name: '', sets: [{ reps: '', weight: '', technique: 'Regular', equipment: '' }] });
            else {
                if (newEx.length > 1) {
                    if (newEx[newEx.length - 1].name.trim() !== '' && !confirm("Remove last exercise?")) return prev;
                    newEx.pop();
                } else toast.error("Minimum 1 exercise required");
            }
            return newEx;
        });
    };

    const fetchHistory = async () => {
        try {
            const res = await api.get('/manual-workouts/');
            setSavedWorkouts(res.data);
            setShowHistory(true);
        } catch (e) { toast.error("Failed to load history"); }
    };

    const handleNewPlan = () => {
        setCurrentId(null);
        setClientName('');
        setPhone('');
        setSessionName('');
        setTrainerName('');
        setExercises([{ name: '', sets: [{ reps: '', weight: '', technique: 'Regular', equipment: '' }] }]);
        toast.success("New Session Started");
    };

    const handleSave = async () => {
        const finalClientName = clientName || "Client";
        const payload = {
            client_name: finalClientName,
            phone: phone,
            session_name: sessionName || 'Workout',
            data: { exercises, trainerName, brandName }
        };

        try {
            if (currentId) {
                await api.put(`/manual-workouts/${currentId}/`, payload);
                toast.success("Workout Updated");
            } else {
                const res = await api.post('/manual-workouts/', payload);
                setCurrentId(res.data.id);
                toast.success("Workout Saved");
            }
        } catch (e) { toast.error("Save Failed"); }
    };

    const handleLoad = (w) => {
        setCurrentId(w.id);
        const newClientName = w.client_name;
        const newPhone = w.phone || '';
        const newSessionName = w.session_name;
        const newTrainerName = w.data.trainerName || '';
        const newBrandName = w.data.brandName || '';
        const newExercises = w.data.exercises || [];

        setClientName(newClientName);
        setPhone(newPhone);
        setSessionName(newSessionName);
        setTrainerName(newTrainerName);
        setBrandName(newBrandName);
        setExercises(newExercises);
        
        setPdfData({
            exercises: newExercises,
            identity: { 
                clientName: newClientName, 
                trainerName: newTrainerName, 
                sessionName: newSessionName, 
                brandName: newBrandName 
            }
        });

        setShowHistory(false);
        toast.success("Loaded!");
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if(!confirm("Delete this workout?")) return;
        try {
            await api.delete(`/manual-workouts/${id}/`);
            setSavedWorkouts(prev => prev.filter(p => p.id !== id));
            if (currentId === id) {
                setCurrentId(null);
                setExercises([{ name: '', sets: [{ reps: '', weight: '', technique: 'Regular', equipment: '' }] }]);
            }
            toast.success("Deleted");
        } catch (e) { toast.error("Delete Failed"); }
    };

    const filteredHistory = savedWorkouts.filter(w => 
        (w.session_name || '').toLowerCase().includes(historySearch.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-[#09090B] text-zinc-900 dark:text-zinc-100 flex flex-col relative lg:pl-72 transition-all duration-300 pt-16 lg:pt-0">
            <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fff', border: '1px solid #333' } }} />
            
            {/* HISTORY MODAL */}
            {showHistory && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowHistory(false)}>
                    <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2"><History size={18}/> Saved Workouts</h3>
                                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full"><X size={18}/></button>
                            </div>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type="text" 
                                    placeholder="Search by Workout Name..." 
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-600 outline-none focus:border-orange-500/50"
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {filteredHistory.length === 0 ? <p className="text-zinc-500 text-center py-10">No saved workouts found.</p> : 
                            filteredHistory.map(w => (
                                <div key={w.id} onClick={() => handleLoad(w)} className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-orange-500 cursor-pointer flex justify-between items-center group transition-all">
                                    <div>
                                        <h4 className="font-bold text-zinc-900 dark:text-white text-lg">{w.session_name || "Untitled Workout"}</h4>
                                        <span className="text-xs text-zinc-500">{w.client_name}</span>
                                    </div>
                                    <button onClick={(e) => handleDelete(w.id, e)} className="p-2 text-zinc-500 dark:text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER AREA */}
            <div className="sticky top-16 lg:top-0 z-40 bg-zinc-50/95 dark:bg-[#09090B]/95 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 transition-colors">
                <div className="px-4 py-3 flex items-center justify-between">
                    <button onClick={() => window.history.back()} className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                        <ArrowLeft size={20} /><span className="font-semibold hidden sm:inline">Back</span>
                    </button>
                    <h1 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        <Dumbbell className="text-orange-600 dark:text-orange-500" size={24}/><span className="hidden sm:inline">Manual Training Plan</span>
                    </h1>
                    <div className="flex items-center gap-2">
                         <button onClick={handleNewPlan} className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white" title="New Plan"><FilePlus size={18}/></button>
                         <button onClick={fetchHistory} className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white" title="History"><FolderOpen size={18}/></button>
                         <button onClick={handleSave} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg text-sm flex items-center gap-2 shadow-sm"><Save size={16}/> {currentId ? 'Update' : 'Save'}</button>
                    </div>
                </div>
                
                {/* 1. REDESIGNED INFO FORM */}
                {showIdentity && (
                    <div className="px-3 pb-3 pt-1 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30">
                        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="relative group">
                                <Activity size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-orange-500 transition-colors"/>
                                <input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Session Name" className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all" />
                            </div>
                            <div className="relative group">
                                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-orange-500 transition-colors"/>
                                <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client Name" className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all" />
                            </div>
                            <div className="relative group">
                                <Smartphone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-orange-500 transition-colors"/>
                                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone Number" className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all" />
                            </div>
                            <div className="relative group">
                                <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-orange-500 transition-colors"/>
                                <input value={trainerName} onChange={(e) => setTrainerName(e.target.value)} placeholder="Trainer Name" className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all" />
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="px-4 py-1 flex justify-center">
                    <button onClick={() => setShowIdentity(!showIdentity)} className="text-[10px] font-bold text-zinc-400 hover:text-orange-500 uppercase tracking-widest flex items-center gap-1 transition-colors">
                        {showIdentity ? <ArrowDown size={10} className="rotate-180"/> : <ArrowDown size={10}/>} {showIdentity ? 'Hide Details' : 'Show Details'}
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-32 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-4">
                    
                    {/* Floating Controls */}
                    <div className="flex justify-end items-center sticky top-0 z-10 py-2 -my-2 bg-transparent pointer-events-none">
                        <div className="flex items-center gap-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-full p-1 border border-zinc-200 dark:border-zinc-800 shadow-sm pointer-events-auto">
                            <button onClick={() => handleExerciseCount(-1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-90"><Minus size={14}/></button>
                            <span className="min-w-[90px] text-center text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">{exercises.length} Exercises</span>
                            <button onClick={() => handleExerciseCount(1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 hover:bg-orange-200 dark:hover:bg-orange-500/20 transition-all active:scale-90"><Plus size={14}/></button>
                        </div>
                    </div>

                    {/* 2. REDESIGNED EXERCISE LIST (Matches WorkoutEditor) */}
                    {exercises.map((ex, exIndex) => (
                        <div key={exIndex} className="group relative bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/5 rounded-3xl p-1 shadow-sm transition-all hover:shadow-lg">
                             <div className="p-3 md:p-6 pb-2 flex items-start gap-3">
                                <div className="hidden md:flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 font-black text-xl shadow-inner">{String(exIndex + 1).padStart(2, '0')}</div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm font-black text-zinc-400">{exIndex + 1}</span>
                                        <input value={ex.name || ''} onChange={(e) => updateExercise(exIndex, 'name', e.target.value)} placeholder="Exercise Name..." className="w-full bg-transparent text-lg md:text-2xl font-bold text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-700 outline-none" />
                                        <button onClick={() => { if(exercises.length > 1 && confirm('Delete exercise?')) setExercises(prev => prev.filter((_, i) => i !== exIndex)); }} className="md:hidden p-2 text-zinc-400 hover:text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                    <div className="flex items-center justify-between pl-1">
                                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest hidden md:inline">{ex.sets.length} Sets Configured</span>
                                        <div className="flex items-center gap-1 bg-zinc-50 dark:bg-zinc-950 rounded-lg p-1 border border-zinc-200 dark:border-zinc-800/50 ml-auto md:ml-0">
                                            <button onClick={() => handleSetCount(exIndex, -1)} className="w-7 h-7 flex items-center justify-center rounded bg-zinc-200 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-all active:scale-90"><Minus size={12}/></button>
                                            <span className="min-w-[40px] text-center text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">{ex.sets.length} Sets</span>
                                            <button onClick={() => handleSetCount(exIndex, 1)} className="w-7 h-7 flex items-center justify-center rounded bg-zinc-200 dark:bg-zinc-800 text-orange-600 dark:text-orange-500 hover:text-orange-500 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all active:scale-90"><Plus size={12}/></button>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => { if(exercises.length > 1 && confirm('Delete exercise?')) setExercises(prev => prev.filter((_, i) => i !== exIndex)); }} className="hidden md:block p-2 text-zinc-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                            </div>
                            
                             <div className="mt-2 space-y-2 md:space-y-1 bg-zinc-50 dark:bg-black/20 rounded-2xl p-2 md:p-3">
                                {ex.sets.map((set, setIndex) => {
                                     const tech = TECHNIQUE_CONFIG[set.technique] || TECHNIQUE_CONFIG['Regular'];
                                     const equip = EQUIP_CONFIG[set.equipment] || { icon: Dumbbell, color: 'text-zinc-500' };
                                     const TechIcon = tech.icon; const EquipIcon = equip.icon;
                                    return (
                                        <div key={setIndex} className="relative bg-white dark:bg-zinc-900/60 rounded-xl p-3 md:p-0 md:bg-transparent md:hover:bg-zinc-200 dark:md:hover:bg-zinc-900/30 transition-colors grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 md:items-center border border-zinc-200 dark:border-transparent md:border-0 shadow-sm md:shadow-none">
                                            
                                            <div className="flex md:contents flex-wrap gap-2">
                                                
                                                {/* Top Row on Mobile: Number, Reps, Weight, Delete */}
                                                <div className="flex items-center gap-2 w-full md:w-auto md:contents">
                                                     <div className="md:col-span-1 flex items-center justify-center min-w-[24px]">
                                                        <span className="text-xs font-bold text-zinc-400 dark:text-zinc-600">{setIndex + 1}</span>
                                                    </div>
                                                    
                                                    <div className="flex-1 md:col-span-2 relative">
                                                        <input type="number" placeholder="0" value={set.reps || ''} onChange={(e) => updateSet(exIndex, setIndex, 'reps', e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500/50 rounded-lg py-3 md:py-2.5 text-center text-lg md:text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-800 appearance-none"/>
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 pointer-events-none md:hidden">REPS</span>
                                                    </div>
                                                    
                                                    <span className="md:hidden text-zinc-300">✕</span>
                                                    
                                                    <div className="flex-1 md:col-span-2 relative">
                                                        <input type="number" placeholder="0" value={set.weight || ''} onChange={(e) => updateSet(exIndex, setIndex, 'weight', e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500/50 rounded-lg py-3 md:py-2.5 text-center text-lg md:text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-800 appearance-none"/>
                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 pointer-events-none md:hidden">KG</span>
                                                    </div>

                                                    {ex.sets.length > 1 && (
                                                        <button onClick={() => setExercises(prev => prev.map((e, i) => i !== exIndex ? e : { ...e, sets: e.sets.filter((_, j) => j !== setIndex) }))} className="md:hidden w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-red-500 bg-zinc-100 dark:bg-zinc-800 rounded-lg ml-1">
                                                            <X size={16}/>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Bottom Row on Mobile: Dropdowns */}
                                                <div className="w-full flex gap-2 md:contents mt-1 md:mt-0">
                                                    <div className="flex-1 md:col-span-4">
                                                        <div className={`flex items-center w-full rounded-lg px-2 py-1 md:py-0.5 border transition-all ${tech.bg} ${tech.border}`}>
                                                            <TechIcon size={14} className={`${tech.color} mr-2 shrink-0`} />
                                                            <select value={set.technique || ''} onChange={(e) => updateSet(exIndex, setIndex, 'technique', e.target.value)} className="w-full bg-transparent text-xs font-bold uppercase py-1.5 md:py-2.5 outline-none text-zinc-600 dark:text-zinc-200 cursor-pointer">
                                                                {Object.keys(TECHNIQUE_CONFIG).map(k => <option key={k} value={k} className="bg-white dark:bg-zinc-900">{k}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 md:col-span-3">
                                                        <div className="flex items-center w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 md:py-0.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                                                            <EquipIcon size={14} className={`${equip.color} mr-2 shrink-0`} />
                                                            <select value={set.equipment || ''} onChange={(e) => updateSet(exIndex, setIndex, 'equipment', e.target.value)} className="w-full bg-transparent text-xs font-bold text-zinc-600 dark:text-zinc-300 py-1.5 md:py-2.5 outline-none cursor-pointer">
                                                                <option value="" className="bg-white dark:bg-zinc-900">No Equip</option>
                                                                {Object.keys(EQUIP_CONFIG).map(k => <option key={k} value={k} className="bg-white dark:bg-zinc-900">{k}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    )
                                })}
                             </div>
                        </div>
                     ))}
                </div>
            </div>

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 safe-area-bottom">
                <div className="flex gap-3 bg-zinc-50/90 dark:bg-[#121214]/90 backdrop-blur-xl p-2 rounded-2xl border border-zinc-300 dark:border-white/10 shadow-2xl dark:shadow-black/80">
                    
                    {isClient && (
                         <PDFDownloadLink
                            document={
                                <WorkoutPDF_EN 
                                    sessionName={pdfData.identity.sessionName || 'Workout Session'}
                                    sessionNumber={1}
                                    clientName={pdfData.identity.clientName || 'Client'}
                                    trainerName={pdfData.identity.trainerName || 'Trainer'}
                                    brandName={pdfData.identity.brandName || 'TFG'}
                                    date={new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    exercises={pdfData.exercises} 
                                    hideSessionNumber={true} 
                                />
                            }
                            fileName={`${(pdfData.identity.sessionName || 'Workout').replace(/\s/g, '_')}_EN.pdf`}
                            className="flex-1 py-3.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                            {({ loading }) => (
                                <>{loading ? <><Activity size={16} className="animate-spin"/><span>Generating...</span></> : <><FileText size={16}/><span>Download PDF (EN)</span></>}</>
                            )}
                        </PDFDownloadLink>
                    )}
                </div>
            </div>
        </div>
    );
};
export default ManualTrainingPlan;