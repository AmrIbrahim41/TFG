import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    ArrowLeft, Save, Plus, Trash2, CheckCircle, Dumbbell, Activity, Settings, Zap, 
    Layers, TrendingUp, ArrowDown, Grip, History, X, Minus, FileText, MoreVertical, ChevronRight, Calendar, User, Download, Type,
    MessageSquare
} from 'lucide-react';
import api from '../api'; 
import toast, { Toaster } from 'react-hot-toast';

import WorkoutPDF_EN from '../utils/WorkoutPDF.jsx';
import { PDFDownloadLink } from '@react-pdf/renderer';

function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => { const handler = setTimeout(() => setDebouncedValue(value), delay); return () => clearTimeout(handler); }, [value, delay]);
    return debouncedValue;
}

const UserIcon = (props) => (<svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
const TECHNIQUE_CONFIG = {'Regular':{color:'text-zinc-500 dark:text-zinc-400',bg:'bg-zinc-100 dark:bg-zinc-800',border:'border-zinc-200 dark:border-zinc-700',icon:Activity},'Drop Set':{color:'text-red-500 dark:text-red-400',bg:'bg-red-50 dark:bg-red-900/20',border:'border-red-100 dark:border-red-500/30',icon:ArrowDown},'Super Set':{color:'text-purple-500 dark:text-purple-400',bg:'bg-purple-50 dark:bg-purple-900/20',border:'border-purple-100 dark:border-purple-500/30',icon:Layers},'Pyramid':{color:'text-amber-500 dark:text-amber-400',bg:'bg-amber-50 dark:bg-amber-900/20',border:'border-amber-100 dark:border-amber-500/30',icon:TrendingUp},'Negative':{color:'text-blue-500 dark:text-blue-400',bg:'bg-blue-50 dark:bg-blue-900/20',border:'border-blue-100 dark:border-blue-500/30',icon:Zap}};
const EQUIP_CONFIG = {'Bodyweight':{color:'text-emerald-500 dark:text-emerald-400',icon:UserIcon},'Dumbbell':{color:'text-blue-500 dark:text-blue-400',icon:Dumbbell},'Barbell':{color:'text-zinc-600 dark:text-zinc-300',icon:Grip},'Cable':{color:'text-cyan-500 dark:text-cyan-400',icon:Zap},'Machine':{color:'text-indigo-500 dark:text-indigo-400',icon:Settings}};

const WorkoutEditor = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const subId = searchParams.get('sub');
    const sessionNum = searchParams.get('session');
    
    const [loading, setLoading] = useState(true);
    const [sessionName, setSessionName] = useState('');
    const [exercises, setExercises] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isClient, setIsClient] = useState(false);
    
    const [clientId, setClientId] = useState(null);
    const [clientName, setClientName] = useState('Client');
    const [trainerName, setTrainerName] = useState('Trainer');
    
    const debouncedExercises = useDebounce(exercises, 1000);
    const debouncedSessionName = useDebounce(sessionName, 1000);

    const [recentSplits, setRecentSplits] = useState([]); 
    const [showHistory, setShowHistory] = useState(false);

    const [isSessionCompleted, setIsSessionCompleted] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    const [activeNoteIndex, setActiveNoteIndex] = useState(null);

    // --- NEW STATES FOR PDF MODAL ---
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfManualClientName, setPdfManualClientName] = useState('');

    useEffect(() => { setIsClient(true); }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (subId) {
                    try {
                        const subRes = await api.get(`/client-subscriptions/${subId}/`);
                        if (subRes.data.client) {
                             const cId = typeof subRes.data.client === 'object' ? subRes.data.client.id : subRes.data.client;
                             setClientId(cId);
                        }
                        if (subRes.data.client_name) {
                            setClientName(subRes.data.client_name);
                        } else if (subRes.data.client && typeof subRes.data.client === 'object') {
                             setClientName(subRes.data.client.name);
                        }
                        setTrainerName(subRes.data.trainer_name || 'TFG Coach');
                    } catch (e) { console.warn("Meta fetch error", e); }
                }

                const res = await api.get(`/training-sessions/get-data/?subscription=${subId}&session_number=${sessionNum}`);
                const data = res.data;
                setSessionName(data.name || `Session ${sessionNum}`);
                setIsSessionCompleted(data.is_completed || false);
                // Ensure note is initialized
                const loadedExercises = data.exercises?.length 
                    ? data.exercises.map(ex => ({...ex, note: ex.note || ''})) 
                    : [{ name: '', note: '', sets: [{ reps: '', weight: '', technique: 'Regular', equipment: '' }] }];
                
                setExercises(loadedExercises);
                
                api.get(`/training-sessions/history/?subscription=${subId}`).then(r => setRecentSplits(r.data)).catch(() => {});
            } catch (error) { console.error("Load error:", error); toast.error("Failed to load session"); } 
            finally { setLoading(false); }
        };
        if(subId && sessionNum) fetchData(); else setLoading(false);
    }, [subId, sessionNum]);

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
            if (delta > 0) {
                newSets.push({ reps: '', weight: '', technique: 'Regular', equipment: '' });
            } else {
                if (newSets.length > 1) newSets.pop();
                else toast.error("Minimum 1 set required");
            }
            return { ...ex, sets: newSets };
        }));
    };

    const handleExerciseCount = (delta) => {
        if (delta > 0) {
            setExercises(prev => [
                ...prev,
                { name: '', note: '', sets: [{ reps: '', weight: '', technique: 'Regular', equipment: '' }] }
            ]);
        } else {
            setExercises(prev => {
                if (prev.length <= 1) {
                    toast.error("At least 1 exercise is required");
                    return prev;
                }
                const newArr = [...prev];
                newArr.pop(); 
                return newArr;
            });
        }
    };

    const handleBack = () => {
        if (clientId) {
            navigate(`/clients/${clientId}`, { state: { defaultTab: 'training', activeTab: 'training' } });
        } else {
            navigate(-1);
        }
    };

    const handleSave = async (complete = false) => {
        setIsSaving(true);
        try {
            await api.post(`/training-sessions/save-data/`, { subscription: subId, session_number: sessionNum, name: sessionName, exercises: exercises, mark_complete: complete });
            toast.success(complete ? "Workout Completed!" : "Draft Saved");
            if(complete) { 
                setIsSessionCompleted(true); 
                setTimeout(() => handleBack(), 1000); 
            }
        } catch (e) { toast.error("Save failed"); } 
        finally { setIsSaving(false); }
    };

    const loadFromHistory = (historySession) => {
        if (!confirm(`Overwrite current workout with data from "${historySession.name}"?`)) return;
        
        const newExercises = historySession.exercises.map(ex => ({
            name: ex.name,
            note: ex.note || '', // Ensure note is copied
            sets: ex.sets.map(s => ({
                reps: s.reps,
                weight: s.weight,
                technique: s.technique || 'Regular',
                equipment: s.equipment || ''
            }))
        }));
        
        setExercises(newExercises);
        setShowHistory(false);
        toast.success("Workout loaded from history");
    };

    // --- PDF BUTTON HANDLER ---
    const handleOpenPdfModal = () => {
        setIsMenuOpen(false);
        setPdfManualClientName(''); // Reset or set default
        setShowPdfModal(true);
    }

    if (loading) return <div className="h-screen bg-zinc-50 dark:bg-black flex items-center justify-center text-orange-500"><Activity className="animate-spin" /></div>;

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-100 dark:bg-[#09090b] text-zinc-900 dark:text-white font-sans selection:bg-orange-500/30 transition-colors">
            <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fff', border: '1px solid #333' } }} />
            
            {/* Header */}
            <div className="shrink-0 z-50 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800/50 sticky top-0 safe-area-top shadow-sm transition-colors">
                <div className="max-w-4xl mx-auto px-3 h-20 grid grid-cols-[44px_1fr_auto] items-center gap-2">
                    <button onClick={handleBack} className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"><ArrowLeft size={20} className="text-zinc-600 dark:text-white" /></button>
                    
                    <div className="flex flex-col items-center justify-center min-w-0 px-2 pt-1">
                        <input value={sessionName || ''} onChange={(e) => setSessionName(e.target.value)} placeholder="Workout Name" className="bg-transparent text-center text-lg md:text-xl font-black text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-700 outline-none w-full border-b border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 transition-all pb-0.5 truncate" />
                        
                        <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                            <span className="flex items-center gap-1 text-zinc-800 dark:text-zinc-300"><User size={10} className="text-orange-500"/> {clientName}</span>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span className="uppercase tracking-wide">Session : {sessionNum}</span>
                        </div>
                    </div>

                    <div className="relative flex items-center gap-2" ref={menuRef}>
                        <button 
                            onClick={() => setShowHistory(true)} 
                            className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-500 hover:border-orange-500/50 flex items-center justify-center transition-all"
                            title="View History"
                        >
                            <History size={18} />
                        </button>

                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isMenuOpen ? 'bg-orange-600 text-white border-orange-500' : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}><MoreVertical size={20} /></button>
                        
                        {isMenuOpen && (
                            <div className="absolute top-12 right-0 w-64 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200 z-50">
                                <div className="space-y-2">
                                    {isClient && (
                                        // تم تغيير هذا الجزء لفتح النافذة بدلاً من التحميل المباشر
                                        <button 
                                            onClick={handleOpenPdfModal}
                                            className="w-full px-4 py-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-medium text-sm flex items-center justify-between gap-3 transition-all"
                                        >
                                            <div className="flex items-center gap-3"><FileText size={18} className="text-orange-500"/><span>Export PDF</span></div>
                                            <ChevronRight size={16} className="text-zinc-400"/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-32 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-4">
                    
                    <div className="flex justify-end items-center sticky top-0 z-10 py-2 -my-2 bg-transparent">
                        <div className="flex items-center gap-1 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-full p-1 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <button onClick={() => handleExerciseCount(-1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-90"><Minus size={14}/></button>
                            <span className="min-w-[90px] text-center text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">{exercises.length} Exercises</span>
                            <button onClick={() => handleExerciseCount(1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 hover:bg-orange-200 dark:hover:bg-orange-500/20 transition-all active:scale-90"><Plus size={14}/></button>
                        </div>
                    </div>

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

                             {/* --- EXERCISE NOTE FOOTER --- */}
                             <div className="mt-2 px-2 pb-2">
                                <button 
                                    onClick={() => setActiveNoteIndex(activeNoteIndex === exIndex ? null : exIndex)} 
                                    className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-orange-500 transition-colors py-1"
                                >
                                    <MessageSquare size={14} />
                                    {ex.note ? 'Edit Note' : 'Add Note'}
                                </button>
                                
                                {(activeNoteIndex === exIndex || ex.note) && (
                                    <div className={`mt-1 overflow-hidden transition-all ${activeNoteIndex === exIndex ? 'max-h-32 opacity-100' : ex.note ? 'max-h-auto opacity-100' : 'max-h-0 opacity-0'}`}>
                                         <textarea
                                            value={ex.note || ''}
                                            onChange={(e) => updateExercise(exIndex, 'note', e.target.value)}
                                            placeholder="Write notes for this exercise (e.g. Focus on tempo, Seat height 4)..."
                                            className="w-full bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-lg p-2 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-yellow-400 resize-none"
                                            rows={2}
                                         />
                                    </div>
                                )}
                             </div>
                        </div>
                     ))}
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 safe-area-bottom">
                <div className="flex gap-3 bg-zinc-50/90 dark:bg-[#121214]/90 backdrop-blur-xl p-2 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl dark:shadow-black/80">
                    <button onClick={() => handleSave(false)} disabled={isSaving} className="flex-1 py-3.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95">
                        {isSaving ? <Activity size={16} className="animate-spin"/> : <Save size={16} />} Save
                    </button>
                    {!isSessionCompleted && (
                        <button onClick={() => handleSave(true)} disabled={isSaving} className="flex-[1.5] py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20 transition-all active:scale-95">
                            <CheckCircle size={16} /> Complete
                        </button>
                    )}
                </div>
            </div>

            {/* --- PDF DOWNLOAD MODAL (New Cute & Modern Design) --- */}
            {showPdfModal && (
                <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-sm bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
                        
                        <button onClick={() => setShowPdfModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mb-4 text-orange-600 dark:text-orange-500">
                                <FileText size={28} />
                            </div>
                            <h3 className="text-xl font-black text-zinc-900 dark:text-white">Export Workout</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Please enter the client's name in English for the PDF.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase ml-1">Client Name (English)</label>
                                <div className="relative">
                                    <Type className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                    <input 
                                        autoFocus
                                        value={pdfManualClientName}
                                        onChange={(e) => setPdfManualClientName(e.target.value)}
                                        placeholder="e.g. John Doe"
                                        className="w-full bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl py-3 pl-10 pr-4 text-zinc-900 dark:text-white font-bold placeholder:font-normal focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <PDFDownloadLink
                                document={
                                    <WorkoutPDF_EN 
                                        sessionName={debouncedSessionName || `Session ${sessionNum}`}
                                        sessionNumber={parseInt(sessionNum) || 1}
                                        // Use the Manual Name if entered, otherwise default to "Client"
                                        clientName={pdfManualClientName || 'Client'} 
                                        trainerName={trainerName || 'Trainer'}
                                        brandName="TFG"
                                        date={new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        exercises={debouncedExercises}
                                    />
                                }
                                fileName={`${(debouncedSessionName || 'Session').replace(/\s/g, '_')}_${pdfManualClientName || 'Client'}.pdf`}
                                className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-lg shadow-orange-500/20 transition-all active:scale-95 ${
                                    !pdfManualClientName 
                                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:from-orange-500 hover:to-amber-500'
                                }`}
                            >
                                {({ loading }) => (
                                    <>
                                        {loading ? <Activity size={18} className="animate-spin"/> : <Download size={18} />}
                                        <span>{loading ? 'Generating...' : 'Download PDF'}</span>
                                    </>
                                )}
                            </PDFDownloadLink>
                        </div>
                    </div>
                </div>
            )}

            {/* HISTORY SIDE DRAWER */}
            {showHistory && (
                <div className="fixed inset-0 z-[250] bg-black/60 dark:bg-black/80 backdrop-blur-sm flex justify-end">
                    <div className="w-full max-w-md bg-white dark:bg-[#121214] h-full border-l border-zinc-200 dark:border-zinc-800 animate-in slide-in-from-right duration-300 flex flex-col shadow-2xl">
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-[#121214]">
                            <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2"><History size={18} className="text-orange-500"/> Workout History</h3>
                            <button onClick={() => setShowHistory(false)} className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-zinc-50 dark:bg-transparent">
                            {recentSplits.length === 0 ? (
                                <div className="text-center py-10 text-zinc-400 dark:text-zinc-500">
                                    <History size={48} className="mx-auto mb-3 opacity-20" />
                                    <p>No previous workouts found.</p>
                                </div>
                            ) : (
                                recentSplits.map((session, idx) => (
                                    <div key={idx} className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors shadow-sm">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-bold text-zinc-900 dark:text-white text-sm">{session.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">Session {session.session_number}</span>
                                                    <span className="text-[10px] text-zinc-500 flex items-center gap-1"><Calendar size={10}/> {new Date(session.date).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => loadFromHistory(session)}
                                                className="text-[10px] font-bold bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 border border-orange-200 dark:border-orange-500/20 px-2 py-1 rounded hover:bg-orange-500 hover:text-white transition-all"
                                            >
                                                LOAD
                                            </button>
                                        </div>
                                        <div className="space-y-1">
                                            {session.exercises && session.exercises.slice(0, 3).map((ex, i) => (
                                                <div key={i} className="text-xs text-zinc-500 dark:text-zinc-400 flex justify-between">
                                                    <span>• {ex.name}</span>
                                                    <span className="text-zinc-700 dark:text-zinc-600">{ex.sets?.length} sets</span>
                                                </div>
                                            ))}
                                            {session.exercises && session.exercises.length > 3 && (
                                                <div className="text-[10px] text-zinc-500 dark:text-zinc-600 italic pl-2">+ {session.exercises.length - 3} more exercises</div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default WorkoutEditor;