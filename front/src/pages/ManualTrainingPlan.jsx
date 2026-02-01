import React, { useState } from 'react';
import { 
    ArrowLeft, Plus, Trash2, 
    Dumbbell, Activity, Settings, Zap, Layers, 
    TrendingUp, ArrowDown, Grip, X, Minus,
    FileText, User, Type 
} from 'lucide-react';
import { generateWorkoutPDF } from '../utils/WorkoutPDF';
import toast, { Toaster } from 'react-hot-toast';

// --- ICONS & VISUAL CONFIG ---
const UserIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

const TECHNIQUE_CONFIG = {
    'Regular':   { color: 'text-zinc-400', bg: 'bg-zinc-800/50', border: 'border-zinc-700', icon: Activity },
    'Drop Set':  { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: ArrowDown },
    'Super Set': { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: Layers },
    'Pyramid':   { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: TrendingUp },
    'Negative':  { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Zap },
};

const EQUIP_CONFIG = {
    'Bodyweight': { color: 'text-emerald-400', icon: UserIcon },
    'Dumbbell':   { color: 'text-blue-400', icon: Dumbbell },
    'Barbell':    { color: 'text-zinc-300', icon: Grip },
    'Cable':      { color: 'text-cyan-400', icon: Zap },
    'Machine':    { color: 'text-indigo-400', icon: Settings },
};

const ManualTrainingPlan = () => {
    // Identity State
    const [clientName, setClientName] = useState('');
    const [trainerName, setTrainerName] = useState('');
    const [sessionName, setSessionName] = useState('');
    const [brandName, setBrandName] = useState(''); // Changed from logoUrl to brandName
    const [showIdentity, setShowIdentity] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    // Exercise State
    const [exercises, setExercises] = useState([
        { name: '', sets: [{ reps: '', weight: '', technique: 'Regular', equipment: '' }] }
    ]);

    // --- HANDLERS ---
    const updateExercise = (idx, field, val) => {
        const newEx = [...exercises];
        newEx[idx][field] = val;
        setExercises(newEx);
    };

    const updateSet = (exIdx, setIdx, field, val) => {
        const newEx = [...exercises];
        newEx[exIdx].sets[setIdx][field] = val;
        setExercises(newEx);
    };

    const handleSetCount = (exIdx, delta) => {
        const newEx = [...exercises];
        const currentSets = newEx[exIdx].sets;
        if (delta > 0) {
            const last = currentSets[currentSets.length - 1];
            currentSets.push({ ...last, reps: '', weight: '' });
        } else {
            if (currentSets.length > 1) currentSets.pop();
            else toast.error("Minimum 1 set required");
        }
        setExercises(newEx);
    };

    const handleExerciseCount = (delta) => {
        const newEx = [...exercises];
        if (delta > 0) {
            newEx.push({ name: '', sets: [{ reps: '', weight: '', technique: 'Regular', equipment: '' }] });
        } else {
            if (newEx.length > 1) {
                const lastEx = newEx[newEx.length - 1];
                if (lastEx.name.trim() !== '' && !confirm("Remove last exercise?")) return;
                newEx.pop();
            } else {
                toast.error("Minimum 1 exercise required");
            }
        }
        setExercises(newEx);
    };

    // PDF Generation Handler
    const handleDownload = async () => {
        const validEx = exercises.filter(ex => ex.name.trim());
        if (validEx.length === 0) return toast.error("Add at least one exercise");

        setIsGenerating(true);
        try {
            await generateWorkoutPDF({
                sessionName: sessionName || 'Manual Workout',
                sessionNum: 1,
                exercises: validEx,
                clientName: clientName || 'Client',
                trainerName: trainerName || 'Trainer',
                date: new Date().toLocaleDateString(),
                brand: brandName.trim() || 'TFG' // Sends the custom text or defaults to TFG
            });
            toast.success("PDF Generated Successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate PDF");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#09090b] text-white font-sans selection:bg-orange-500/30">
            <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fff', border: '1px solid #333' } }} />

            {/* --- SMART HEADER (Editable Identity) --- */}
            <div className="shrink-0 z-50 bg-[#09090b]/95 backdrop-blur-xl border-b border-zinc-800/50 sticky top-0 safe-area-top shadow-md">
                <div className="max-w-4xl mx-auto px-3 py-3">
                    
                    {/* Collapsible Identity Inputs */}
                    {showIdentity && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 animate-in slide-in-from-top-2 duration-300">
                            <input 
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                placeholder="Client Name"
                                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-orange-500"
                            />
                            <input 
                                value={trainerName}
                                onChange={(e) => setTrainerName(e.target.value)}
                                placeholder="Trainer Name"
                                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-orange-500"
                            />
                            <input 
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                                placeholder="Workout Title"
                                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-orange-500"
                            />
                            <div className="relative">
                                <input 
                                    value={brandName}
                                    onChange={(e) => setBrandName(e.target.value)}
                                    placeholder="Brand Name (e.g. MyGym)"
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm font-bold outline-none focus:border-orange-500 truncate"
                                />
                                <Type size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => window.history.back()} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 flex items-center justify-center transition-colors">
                                <ArrowLeft size={20} className="text-white" />
                            </button>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Quick Builder</span>
                                <h1 className="text-lg font-bold leading-none">{sessionName || 'New Workout'}</h1>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => setShowIdentity(!showIdentity)} 
                            className="text-xs font-bold text-zinc-500 hover:text-white flex items-center gap-1 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800"
                        >
                            <User size={14} /> {showIdentity ? 'Hide Info' : 'Edit Info'}
                        </button>
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT SCROLLABLE --- */}
            <div className="flex-1 overflow-y-auto p-4 pb-32 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6">
                    
                    {/* CONTROLS HEADER */}
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Dumbbell className="text-orange-500" size={20}/>
                            Exercises
                        </h2>
                        
                        <div className="flex items-center gap-3 bg-zinc-900 rounded-full p-1 border border-zinc-800 shadow-lg">
                            <button onClick={() => handleExerciseCount(-1)} className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white flex items-center justify-center transition-all active:scale-90"><Minus size={14} strokeWidth={3}/></button>
                            <span className="w-8 text-center font-black text-lg text-white">{exercises.length}</span>
                            <button onClick={() => handleExerciseCount(1)} className="w-8 h-8 rounded-full bg-orange-600 text-white hover:bg-orange-500 flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-orange-900/50"><Plus size={14} strokeWidth={3}/></button>
                        </div>
                    </div>

                    {/* EXERCISE LIST */}
                    {exercises.map((ex, exIndex) => (
                        <div key={exIndex} className="group relative bg-[#121214] border border-white/5 rounded-3xl p-1 shadow-2xl transition-all hover:border-white/10 animate-in fade-in duration-300">
                            
                            <div className="p-4 md:p-6 pb-2 flex items-start gap-4">
                                <div className="hidden md:flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500 font-black text-xl shadow-inner">
                                    {String(exIndex + 1).padStart(2, '0')}
                                </div>
                                
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <span className="md:hidden text-lg font-black text-zinc-600">{String(exIndex + 1).padStart(2, '0')}</span>
                                        <input 
                                            value={ex.name} 
                                            onChange={(e) => updateExercise(exIndex, 'name', e.target.value)}
                                            placeholder="Exercise Name..." 
                                            className="w-full bg-transparent text-xl md:text-2xl font-bold text-white placeholder-zinc-700 outline-none" 
                                        />
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest hidden md:inline">
                                            {ex.sets.length} Sets Configured
                                        </span>

                                        <div className="flex items-center gap-1 bg-zinc-950 rounded-lg p-1 border border-zinc-800/50">
                                            <button onClick={() => handleSetCount(exIndex, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-zinc-900 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all active:scale-90"><Minus size={12}/></button>
                                            <span className="min-w-[40px] text-center text-xs font-bold text-zinc-300 uppercase tracking-wider">{ex.sets.length} Sets</span>
                                            <button onClick={() => handleSetCount(exIndex, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 text-orange-500 hover:text-orange-400 hover:bg-zinc-700 transition-all active:scale-90"><Plus size={12}/></button>
                                        </div>
                                    </div>
                                </div>

                                <button onClick={() => {
                                    if(exercises.length > 1 && confirm('Delete exercise?')) {
                                        setExercises(exercises.filter((_, i) => i !== exIndex));
                                    }
                                }} className="p-2 text-zinc-700 hover:text-red-500 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100">
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            {/* Sets Grid */}
                            <div className="mt-2 space-y-1 bg-black/20 rounded-2xl p-2 md:p-3">
                                <div className="hidden md:grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                                    <div className="col-span-1 text-center">Set</div>
                                    <div className="col-span-2 text-center">Reps</div>
                                    <div className="col-span-2 text-center">KG</div>
                                    <div className="col-span-4">Technique</div>
                                    <div className="col-span-3">Equipment</div>
                                </div>

                                {ex.sets.map((set, setIndex) => {
                                    const tech = TECHNIQUE_CONFIG[set.technique] || TECHNIQUE_CONFIG['Regular'];
                                    const equip = EQUIP_CONFIG[set.equipment] || { icon: Dumbbell, color: 'text-zinc-500' };
                                    const TechIcon = tech.icon;
                                    const EquipIcon = equip.icon;

                                    return (
                                        <div key={setIndex} className="relative bg-zinc-900/40 rounded-xl p-3 md:p-0 md:bg-transparent md:hover:bg-zinc-900/30 transition-colors grid grid-cols-1 md:grid-cols-12 gap-3 md:items-center">
                                            {/* Mobile: Header */}
                                            <div className="md:col-span-1 flex justify-between items-center md:justify-center mb-2 md:mb-0">
                                                <span className="md:hidden text-[10px] font-black text-zinc-500 bg-zinc-900 px-2 py-1 rounded">SET {setIndex + 1}</span>
                                                <span className="hidden md:inline text-xs font-bold text-zinc-600">{setIndex + 1}</span>
                                                {ex.sets.length > 1 && (
                                                    <button onClick={() => {
                                                        const newEx = [...exercises];
                                                        newEx[exIndex].sets.splice(setIndex, 1);
                                                        setExercises(newEx);
                                                    }} className="md:hidden text-zinc-600 hover:text-red-500"><X size={14}/></button>
                                                )}
                                            </div>

                                            {/* Inputs */}
                                            <div className="flex gap-2 md:contents">
                                                <div className="flex-1 md:col-span-2">
                                                    <input type="number" placeholder="0" value={set.reps} onChange={(e) => updateSet(exIndex, setIndex, 'reps', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-500/50 rounded-lg py-3 md:py-2.5 text-center text-sm font-bold text-white outline-none transition-all placeholder:text-zinc-800 appearance-none"/>
                                                    <span className="md:hidden text-[9px] text-zinc-600 font-bold block text-center mt-1">REPS</span>
                                                </div>
                                                <div className="flex-1 md:col-span-2">
                                                    <input type="number" placeholder="0" value={set.weight} onChange={(e) => updateSet(exIndex, setIndex, 'weight', e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 focus:border-orange-500/50 rounded-lg py-3 md:py-2.5 text-center text-sm font-bold text-white outline-none transition-all placeholder:text-zinc-800 appearance-none"/>
                                                    <span className="md:hidden text-[9px] text-zinc-600 font-bold block text-center mt-1">KG</span>
                                                </div>
                                            </div>

                                            {/* Selects */}
                                            <div className="md:col-span-4 mt-1 md:mt-0">
                                                <div className={`flex items-center w-full rounded-lg px-3 py-0.5 border transition-all ${tech.bg} ${tech.border}`}>
                                                    <TechIcon size={14} className={`${tech.color} mr-2`} />
                                                    <select value={set.technique} onChange={(e) => updateSet(exIndex, setIndex, 'technique', e.target.value)} className="w-full bg-transparent text-[11px] md:text-xs font-bold uppercase py-2.5 outline-none text-zinc-200 cursor-pointer">
                                                        {Object.keys(TECHNIQUE_CONFIG).map(k => <option key={k} value={k} className="bg-zinc-900">{k}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="md:col-span-3 mt-1 md:mt-0">
                                                <div className="flex items-center w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-0.5 hover:border-zinc-700 transition-colors">
                                                    <EquipIcon size={14} className={`${equip.color} mr-2`} />
                                                    <select value={set.equipment} onChange={(e) => updateSet(exIndex, setIndex, 'equipment', e.target.value)} className="w-full bg-transparent text-[11px] md:text-xs font-bold text-zinc-300 py-2.5 outline-none cursor-pointer">
                                                        <option value="" className="bg-zinc-900">No Equip</option>
                                                        {Object.keys(EQUIP_CONFIG).map(k => <option key={k} value={k} className="bg-zinc-900">{k}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- FLOATING ACTION BAR --- */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 safe-area-bottom">
                <div className="flex gap-3 bg-[#121214]/90 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl shadow-black/80">
                    <button 
                        onClick={handleDownload}
                        disabled={isGenerating}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20 transition-all active:scale-95"
                    >
                        {isGenerating ? <Activity size={16} className="animate-spin"/> : <FileText size={16} />} 
                        Download PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManualTrainingPlan;