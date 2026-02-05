import React, { useState, useEffect } from 'react';
import { 
    ArrowLeft, Plus, Trash2, Dumbbell, Activity, Settings, Zap, Layers, 
    TrendingUp, ArrowDown, Grip, X, Minus, FileText, User,
    Save, FolderOpen, History, Smartphone, Search, FilePlus
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
const TECHNIQUE_CONFIG = { 'Regular': { color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-200 dark:bg-zinc-800/50', border: 'border-zinc-300 dark:border-zinc-700', icon: Activity }, 'Drop Set': { color: 'text-red-500 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20', icon: ArrowDown }, 'Super Set': { color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/10', border: 'border-purple-200 dark:border-purple-500/20', icon: Layers }, 'Pyramid': { color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', icon: TrendingUp }, 'Negative': { color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20', icon: Zap } };
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
            <Toaster position="top-center" />
            
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

            <div className="sticky top-16 lg:top-0 z-40 bg-zinc-50/95 dark:bg-[#09090B]/95 backdrop-blur-xl border-b border-zinc-200 dark:border-white/5 transition-colors">
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
                {showIdentity && (
                    <div className="px-4 pb-4 pt-2 border-t border-zinc-200 dark:border-white/5 bg-zinc-100 dark:bg-zinc-950/50">
                        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <input value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Session Name..." className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-600 outline-none focus:border-orange-500/50 transition-all" />
                            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client Name..." className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-600 outline-none focus:border-orange-500/50 transition-all" />
                            <div className="relative">
                                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (Internal)" className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg pl-3 pr-8 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-600 outline-none focus:border-orange-500/50 transition-all" />
                                <Smartphone size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                            </div>
                            <input value={trainerName} onChange={(e) => setTrainerName(e.target.value)} placeholder="Trainer Name..." className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-600 outline-none focus:border-orange-500/50 transition-all" />
                        </div>
                    </div>
                )}
                <div className="px-4 pb-2">
                    <div className="max-w-4xl mx-auto flex justify-end">
                        <button onClick={() => setShowIdentity(!showIdentity)} className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 bg-zinc-200 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-800">
                            <User size={14} /> {showIdentity ? 'Hide Info' : 'Edit Info'}
                        </button>
                    </div>
                </div>
            </div>

             <div className="flex-1 overflow-y-auto p-4 pb-32 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Dumbbell className="text-orange-500" size={20}/> Exercises</h2>
                        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 rounded-full p-1 border border-zinc-300 dark:border-zinc-800 shadow-lg">
                            <button onClick={() => handleExerciseCount(-1)} className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-all active:scale-90"><Minus size={14} strokeWidth={3}/></button>
                            <span className="w-8 text-center font-black text-lg text-zinc-900 dark:text-white">{exercises.length}</span>
                            <button onClick={() => handleExerciseCount(1)} className="w-8 h-8 rounded-full bg-orange-600 text-white hover:bg-orange-500 flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-orange-900/50"><Plus size={14} strokeWidth={3}/></button>
                        </div>
                    </div>

                    {exercises.map((ex, exIndex) => (
                        <div key={exIndex} className="group relative bg-white dark:bg-[#121214] border border-zinc-200 dark:border-white/5 rounded-3xl p-1 shadow-lg dark:shadow-2xl transition-all hover:border-orange-500/30 animate-in fade-in duration-300">
                            <div className="p-4 md:p-6 pb-2 flex items-start gap-4">
                                <div className="hidden md:flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 font-black text-xl shadow-inner">{String(exIndex + 1).padStart(2, '0')}</div>
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <span className="md:hidden text-lg font-black text-zinc-400">{String(exIndex + 1).padStart(2, '0')}</span>
                                        <input value={ex.name} onChange={(e) => updateExercise(exIndex, 'name', e.target.value)} placeholder="Exercise Name..." className="w-full bg-transparent text-xl md:text-2xl font-bold text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-700 outline-none" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-widest hidden md:inline">{ex.sets.length} Sets Configured</span>
                                        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg p-1 border border-zinc-200 dark:border-zinc-800/50">
                                            <button onClick={() => handleSetCount(exIndex, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-zinc-200 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-all active:scale-90"><Minus size={12}/></button>
                                            <span className="min-w-[40px] text-center text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">{ex.sets.length} Sets</span>
                                            <button onClick={() => handleSetCount(exIndex, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-zinc-200 dark:bg-zinc-800 text-orange-600 dark:text-orange-500 hover:text-orange-500 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all active:scale-90"><Plus size={12}/></button>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => { if(exercises.length > 1 && confirm('Delete exercise?')) setExercises(prev => prev.filter((_, i) => i !== exIndex)); }} className="p-2 text-zinc-400 hover:text-red-500 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"><Trash2 size={18} /></button>
                            </div>

                            <div className="mt-2 space-y-1 bg-zinc-100 dark:bg-black/20 rounded-2xl p-2 md:p-3">
                                {ex.sets.map((set, setIndex) => {
                                    const tech = TECHNIQUE_CONFIG[set.technique] || TECHNIQUE_CONFIG['Regular'];
                                    const equip = EQUIP_CONFIG[set.equipment] || { icon: Dumbbell, color: 'text-zinc-500' };
                                    const TechIcon = tech.icon; const EquipIcon = equip.icon;
                                    return (
                                        <div key={setIndex} className="relative bg-white dark:bg-zinc-900/40 rounded-xl p-3 md:p-0 md:bg-transparent md:hover:bg-zinc-200 dark:md:hover:bg-zinc-900/30 transition-colors grid grid-cols-1 md:grid-cols-12 gap-3 md:items-center border border-zinc-200 dark:border-transparent md:border-0 shadow-sm md:shadow-none">
                                            <div className="md:col-span-1 flex justify-between items-center md:justify-center mb-2 md:mb-0">
                                                <span className="md:hidden text-[10px] font-black text-zinc-500 bg-zinc-200 dark:bg-zinc-900 px-2 py-1 rounded">SET {setIndex + 1}</span>
                                                <span className="hidden md:inline text-xs font-bold text-zinc-500 dark:text-zinc-600">{setIndex + 1}</span>
                                                {ex.sets.length > 1 && (<button onClick={() => { 
                                                    setExercises(prev => prev.map((e, i) => i !== exIndex ? e : { ...e, sets: e.sets.filter((_, j) => j !== setIndex) }));
                                                }} className="md:hidden text-zinc-600 hover:text-red-500"><X size={14}/></button>)}
                                            </div>
                                            <div className="flex gap-2 md:contents">
                                                <div className="flex-1 md:col-span-2"><input type="number" placeholder="0" value={set.reps} onChange={(e) => updateSet(exIndex, setIndex, 'reps', e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-orange-500/50 rounded-lg py-3 md:py-2.5 text-center text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-800 appearance-none"/></div>
                                                <div className="flex-1 md:col-span-2"><input type="number" placeholder="0" value={set.weight} onChange={(e) => updateSet(exIndex, setIndex, 'weight', e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-orange-500/50 rounded-lg py-3 md:py-2.5 text-center text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-800 appearance-none"/></div>
                                            </div>
                                            <div className="md:col-span-4 mt-1 md:mt-0"><div className={`flex items-center w-full rounded-lg px-3 py-0.5 border transition-all ${tech.bg} ${tech.border}`}><TechIcon size={14} className={`${tech.color} mr-2`} /><select value={set.technique} onChange={(e) => updateSet(exIndex, setIndex, 'technique', e.target.value)} className="w-full bg-transparent text-[11px] md:text-xs font-bold uppercase py-2.5 outline-none text-zinc-700 dark:text-zinc-200 cursor-pointer">{Object.keys(TECHNIQUE_CONFIG).map(k => <option key={k} value={k} className="bg-white dark:bg-zinc-900">{k}</option>)}</select></div></div>
                                            <div className="md:col-span-3 mt-1 md:mt-0"><div className="flex items-center w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-0.5 hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors"><EquipIcon size={14} className={`${equip.color} mr-2`} /><select value={set.equipment} onChange={(e) => updateSet(exIndex, setIndex, 'equipment', e.target.value)} className="w-full bg-transparent text-[11px] md:text-xs font-bold text-zinc-700 dark:text-zinc-300 py-2.5 outline-none cursor-pointer"><option value="" className="bg-white dark:bg-zinc-900">No Equip</option>{Object.keys(EQUIP_CONFIG).map(k => <option key={k} value={k} className="bg-white dark:bg-zinc-900">{k}</option>)}</select></div></div>
                                        </div>
                                    );
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
                                <>{loading ? <><Activity size={16} className="animate-spin"/><span>Generating...</span></> : <><FileText size={16}/><span>PDF (EN)</span></>}</>
                            )}
                        </PDFDownloadLink>
                    )}
                </div>
            </div>
        </div>
    );
};
export default ManualTrainingPlan;