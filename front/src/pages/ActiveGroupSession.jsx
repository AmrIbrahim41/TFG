import React, { useState, useEffect } from 'react';
import { 
    X, Save, Dumbbell, UserCheck, CheckCircle2, 
    Settings2, ArrowLeft, Trash2, Timer, 
    LayoutTemplate, ChevronDown, Loader2, 
    History, User, Activity, FileText, MessageSquare, 
    Calendar // <--- ADDED THIS BACK
} from 'lucide-react';
import api, { BASE_URL } from '../api';

const ActiveGroupSession = ({ day, children, onClose, initialExercises }) => {
    // --- STATE ---
    const [mode, setMode] = useState('SETUP'); 
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Data
    const [exercises, setExercises] = useState([
        { id: Date.now(), name: '', type: 'strength', target: '' }
    ]);
    const [performance, setPerformance] = useState({});
    const [sessionNotes, setSessionNotes] = useState({}); // General Session Notes

    // Track which exercise notes are expanded { [clientId_exerciseId]: true }
    const [expandedNotes, setExpandedNotes] = useState({});

    const [attendance, setAttendance] = useState(
        children.reduce((acc, c) => ({ ...acc, [c.client_id]: true }), {})
    );

    // History Modal State
    const [historyChild, setHistoryChild] = useState(null); 
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Templates & Timer
    const [templates, setTemplates] = useState([]);
    const [showTemplates, setShowTemplates] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [timer, setTimer] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    // --- EFFECTS ---
    useEffect(() => {
        let interval;
        if (isTimerRunning) interval = setInterval(() => setTimer(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [isTimerRunning]);

    useEffect(() => { fetchTemplates(); }, []);

    useEffect(() => {
        if (initialExercises && initialExercises.length > 0) {
            const loaded = initialExercises.map(e => ({ ...e, id: Date.now() + Math.random() }));
            setExercises(loaded);
        }
    }, [initialExercises]);

    // --- API CALLS ---
    const fetchTemplates = async () => {
        try {
            const res = await api.get('/group-templates/');
            setTemplates(res.data.results || res.data);
        } catch (e) { console.error("Template error", e); }
    };

    const fetchChildHistory = async (child) => {
        setHistoryChild(child);
        setLoadingHistory(true);
        setHistoryData([]);
        try {
            const res = await api.get(`/group-training/client_history/?client_id=${child.client_id}`);
            setHistoryData(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleSaveTemplate = async () => {
        if (!templateName.trim()) return;
        try {
            await api.post('/group-templates/', { name: templateName, exercises });
            setTemplateName('');
            fetchTemplates();
            setShowTemplates(false);
        } catch (e) { alert("Failed to save template"); }
    };

    const handleComplete = async () => {
        if (!confirm("Finish Session?")) return;
        setIsSubmitting(true);
        
        const summary = exercises.map(ex => ({
            name: ex.name,
            type: ex.type,
            target: ex.target,
            results: children.filter(c => attendance[c.client_id]).map(c => ({
                client: c.client_name,
                // Include the NOTE from performance state here
                ...performance[c.client_id]?.[ex.id] 
            }))
        }));

        const participants = children.map(c => ({
            client_id: c.client_id,
            present: attendance[c.client_id],
            note: sessionNotes[c.client_id] || (attendance[c.client_id] ? 'Completed' : 'Absent')
        }));

        try {
            await api.post('/group-training/complete_session/', {
                day_name: day,
                exercises: summary,
                participants: participants.filter(p => p.present)
            });
            onClose();
        } catch (e) { alert("Error saving session"); }
        setIsSubmitting(false);
    };

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
    const getImageUrl = (path) => path ? (path.startsWith('http') ? path : `${BASE_URL}${path}`) : null;

    const toggleNote = (clientId, exId) => {
        const key = `${clientId}_${exId}`;
        setExpandedNotes(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // --- RENDER: SETUP MODE (PLANNER) ---
    if (mode === 'SETUP') return (
        <div className="fixed inset-0 z-[200] bg-[#09090b] flex flex-col animate-in fade-in duration-300">
            {/* Header */}
            <div className="h-24 bg-[#121214] border-b border-zinc-800 flex items-center justify-between px-8">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <span className="bg-blue-600/20 text-blue-500 p-2 rounded-xl"><Settings2 size={24} /></span>
                        Session Planner
                    </h1>
                    <p className="text-zinc-500 font-medium mt-1 ml-1">{day} Group • {children.length} Athletes</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={() => setShowTemplates(!showTemplates)}
                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${showTemplates ? 'bg-zinc-800 text-white' : 'bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white'}`}
                    >
                        <LayoutTemplate size={18}/> Templates
                    </button>
                    <button onClick={onClose} className="p-3 bg-zinc-900 rounded-full text-zinc-400 hover:bg-red-500/20 hover:text-red-500 transition-colors"><X size={24}/></button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Planner Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {exercises.map((ex, idx) => (
                            <div key={ex.id} className="bg-[#18181b] p-6 rounded-[2rem] border border-zinc-800 flex flex-col md:flex-row gap-6 items-start md:items-center shadow-2xl shadow-black/50 group hover:border-zinc-700 transition-all">
                                <span className="w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-900 text-zinc-500 font-black text-xl border border-zinc-800 group-hover:text-blue-500 group-hover:border-blue-500/30 transition-all">
                                    {idx + 1}
                                </span>
                                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div className="md:col-span-6">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-2 mb-1 block">Exercise Name</label>
                                        <input 
                                            value={ex.name} 
                                            onChange={e => {
                                                const newEx = [...exercises];
                                                newEx[idx].name = e.target.value;
                                                setExercises(newEx);
                                            }}
                                            placeholder="e.g. Barbell Squat" 
                                            className="w-full h-14 bg-black border border-zinc-800 rounded-2xl px-5 text-xl font-bold text-white placeholder-zinc-700 focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-2 mb-1 block">Type</label>
                                        <div className="relative">
                                            <select 
                                                value={ex.type}
                                                onChange={e => {
                                                    const newEx = [...exercises];
                                                    newEx[idx].type = e.target.value;
                                                    setExercises(newEx);
                                                }}
                                                className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 text-white font-bold appearance-none outline-none focus:border-blue-500 cursor-pointer"
                                            >
                                                <option value="strength">Strength</option>
                                                <option value="cardio">Cardio</option>
                                                <option value="time">Timed</option>
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" size={16} />
                                        </div>
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-2 mb-1 block">Target</label>
                                        <input 
                                            value={ex.target} 
                                            onChange={e => {
                                                const newEx = [...exercises];
                                                newEx[idx].target = e.target.value;
                                                setExercises(newEx);
                                            }}
                                            placeholder="e.g. 4x10" 
                                            className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 text-blue-400 font-mono font-bold placeholder-zinc-700 outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setExercises(exercises.filter(e => e.id !== ex.id))}
                                    className="p-4 rounded-2xl bg-zinc-900 text-zinc-600 hover:bg-red-500/10 hover:text-red-500 transition-all self-end md:self-center"
                                >
                                    <Trash2 size={20}/>
                                </button>
                            </div>
                        ))}
                        
                        <button 
                            onClick={() => setExercises([...exercises, { id: Date.now(), name: '', type: 'strength', target: '' }])}
                            className="w-full h-20 border-2 border-dashed border-zinc-800 rounded-[2rem] text-zinc-500 font-bold text-lg flex items-center justify-center gap-3 hover:bg-zinc-900/50 hover:border-zinc-700 hover:text-zinc-300 transition-all"
                        >
                            <span className="bg-zinc-800 p-2 rounded-full"><Dumbbell size={20}/></span> 
                            Add New Exercise
                        </button>
                    </div>
                </div>

                {/* Templates Sidebar */}
                {showTemplates && (
                    <div className="w-96 border-l border-zinc-800 bg-[#121214] p-6 flex flex-col animate-in slide-in-from-right">
                        <h3 className="text-xl font-black text-white mb-6">Template Library</h3>
                        <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 mb-6">
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Save Current Setup</label>
                            <div className="flex gap-2">
                                <input 
                                    value={templateName} onChange={e => setTemplateName(e.target.value)}
                                    placeholder="Name (e.g. Leg Day)" 
                                    className="flex-1 bg-black border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                                />
                                <button onClick={handleSaveTemplate} className="p-3 bg-blue-600 rounded-xl text-white hover:bg-blue-500"><Save size={20}/></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3">
                            {templates.map(t => (
                                <div key={t.id} className="p-4 bg-zinc-900 rounded-2xl border border-zinc-800 hover:border-blue-500/50 cursor-pointer group relative transition-all">
                                    <div onClick={() => {
                                        if(confirm("Load Template?")) {
                                            setExercises(t.exercises.map(e => ({...e, id: Date.now() + Math.random()})));
                                            setShowTemplates(false);
                                        }
                                    }}>
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="font-bold text-white">{t.name}</p>
                                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg">{t.exercises.length} Ex</span>
                                        </div>
                                        <p className="text-xs text-zinc-500 truncate">{t.exercises.map(e => e.name).join(', ')}</p>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); if(confirm("Delete?")) api.delete(`/group-templates/${t.id}/`).then(fetchTemplates); }}
                                        className="absolute top-3 right-3 p-1.5 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all bg-zinc-800 rounded-lg"
                                    >
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="h-24 bg-[#121214] border-t border-zinc-800 flex items-center justify-end px-8">
                <button 
                    onClick={() => {
                        if (exercises.filter(e => e.name).length === 0) return alert("Add at least one exercise");
                        setMode('LIVE');
                    }} 
                    className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-900/20 flex items-center gap-3 active:scale-95 transition-all"
                >
                    Start Session <ArrowLeft className="rotate-180" size={20}/>
                </button>
            </div>
        </div>
    );

    // --- RENDER: LIVE MODE ---
    return (
        <div className="fixed inset-0 z-[200] bg-[#09090b] flex flex-col text-white animate-in slide-in-from-right duration-500">
            {/* Live Header */}
            <div className="h-20 bg-[#121214] border-b border-zinc-800 flex items-center justify-between px-6 shadow-2xl z-20">
                <div className="flex items-center gap-6">
                    <button onClick={() => setMode('SETUP')} className="text-zinc-500 hover:text-white flex items-center gap-2 text-sm font-bold uppercase tracking-wide bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800 transition-colors">
                        <Settings2 size={16}/> Edit Plan
                    </button>
                    <div className="w-px h-8 bg-zinc-800"></div>
                    <div onClick={() => setIsTimerRunning(!isTimerRunning)} className={`flex items-center gap-3 px-5 py-2.5 rounded-xl border cursor-pointer select-none transition-all ${isTimerRunning ? 'bg-green-500/10 border-green-500/50 text-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)]' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                        <Timer size={20} className={isTimerRunning ? "animate-pulse" : ""} />
                        <span className="font-mono font-black text-2xl tracking-widest">{formatTime(timer)}</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={handleComplete} disabled={isSubmitting} className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold text-base shadow-lg shadow-green-900/20 flex items-center gap-2 transition-all active:scale-95">
                        {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>}
                        Finish Session
                    </button>
                    <button onClick={onClose} className="p-3 bg-zinc-800 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"><X size={20}/></button>
                </div>
            </div>

            {/* Live Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#09090b]">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {children.map(child => {
                        const isPresent = attendance[child.client_id];
                        return (
                            <div key={child.client_id} className={`flex flex-col rounded-[1.5rem] border transition-all duration-300 overflow-hidden ${isPresent ? 'bg-[#121214] border-zinc-800 shadow-xl' : 'bg-zinc-950 border-zinc-900 opacity-50'}`}>
                                {/* Child Card Header */}
                                <div className="p-5 flex items-center gap-4 border-b border-zinc-800/50 bg-zinc-900/30">
                                    <div onClick={() => setAttendance(prev => ({...prev, [child.client_id]: !prev[child.client_id]}))} className={`w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer transition-all shadow-lg ${isPresent ? 'bg-blue-600 text-white shadow-blue-900/20' : 'bg-zinc-800 text-zinc-500'}`}>
                                        {isPresent ? <CheckCircle2 size={24}/> : <UserCheck size={24}/>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-lg text-white truncate">{child.client_name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${isPresent ? 'bg-green-500/10 text-green-500' : 'bg-zinc-800 text-zinc-500'}`}>
                                                {isPresent ? 'Present' : 'Absent'}
                                            </span>
                                        </div>
                                    </div>
                                    {/* History Button */}
                                    <button 
                                        onClick={() => fetchChildHistory(child)}
                                        className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors border border-zinc-700"
                                        title="View History"
                                    >
                                        <History size={18} />
                                    </button>
                                </div>

                                {/* Exercises List */}
                                {isPresent && (
                                    <div className="flex-1 p-3 space-y-2">
                                        {exercises.map((ex, i) => {
                                            const p = performance[child.client_id]?.[ex.id] || { val1: '', val2: '', note: '' };
                                            
                                            const handleChange = (f, v) => setPerformance(prev => ({
                                                ...prev,
                                                [child.client_id]: { ...(prev[child.client_id] || {}), [ex.id]: { ...(prev[child.client_id]?.[ex.id] || {}), [f]: v } }
                                            }));

                                            const noteKey = `${child.client_id}_${ex.id}`;
                                            const isNoteOpen = expandedNotes[noteKey] || (p.note && p.note.length > 0);

                                            return (
                                                <div key={ex.id} className="p-3 rounded-2xl bg-black border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xs font-bold text-zinc-400 truncate w-32">{ex.name}</span>
                                                        <span className="text-[10px] font-mono text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">{ex.target || '-'}</span>
                                                    </div>
                                                    
                                                    <div className="flex gap-2">
                                                        <div className="flex-1 relative">
                                                            <input 
                                                                placeholder={ex.type === 'cardio' ? "Dist" : "Weight"}
                                                                value={p.val1 || ''}
                                                                onChange={e => handleChange('val1', e.target.value)}
                                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-3 pr-8 text-center text-sm font-bold text-white focus:border-blue-500 outline-none"
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-bold uppercase">{ex.type === 'cardio' ? 'km' : 'kg'}</span>
                                                        </div>
                                                        <div className="flex-1 relative">
                                                            <input 
                                                                placeholder={ex.type === 'cardio' ? "Time" : "Reps"}
                                                                value={p.val2 || ''}
                                                                onChange={e => handleChange('val2', e.target.value)}
                                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 pl-3 pr-8 text-center text-sm font-bold text-white focus:border-blue-500 outline-none"
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-bold uppercase">#</span>
                                                        </div>
                                                        {/* NEW: Note Button */}
                                                        <button 
                                                            onClick={() => toggleNote(child.client_id, ex.id)}
                                                            className={`w-10 rounded-lg border flex items-center justify-center transition-all ${isNoteOpen || p.note ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-white'}`}
                                                        >
                                                            <MessageSquare size={16}/>
                                                        </button>
                                                    </div>

                                                    {/* NEW: Exercise Note Input (Conditional) */}
                                                    {isNoteOpen && (
                                                        <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                                                            <input 
                                                                placeholder="Notes (e.g. Form correction)..."
                                                                value={p.note || ''}
                                                                onChange={e => handleChange('note', e.target.value)}
                                                                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg py-2 px-3 text-xs text-white focus:border-blue-500 outline-none"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        
                                        {/* General Session Note */}
                                        <div className="pt-2 border-t border-zinc-800/50 mt-2">
                                            <div className="relative">
                                                <FileText size={14} className="absolute left-3 top-3 text-zinc-500"/>
                                                <textarea 
                                                    placeholder="General session notes..."
                                                    value={sessionNotes[child.client_id] || ''}
                                                    onChange={e => setSessionNotes(prev => ({...prev, [child.client_id]: e.target.value}))}
                                                    className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:border-blue-500 focus:bg-zinc-900 outline-none resize-none h-16"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Child History Modal */}
            {historyChild && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-[#121214] border-l border-zinc-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-zinc-800 bg-[#18181b] flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-zinc-800 overflow-hidden border border-zinc-700">
                                    {historyChild.client_photo ? (
                                        <img src={getImageUrl(historyChild.client_photo)} className="w-full h-full object-cover"/>
                                    ) : (
                                        <User className="w-full h-full p-3 text-zinc-500"/>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white">{historyChild.client_name}</h2>
                                    <p className="text-zinc-500 text-xs uppercase font-bold">Performance History</p>
                                </div>
                            </div>
                            <button onClick={() => setHistoryChild(null)} className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white"><X size={20}/></button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {loadingHistory ? (
                                <div className="flex flex-col items-center justify-center h-40 text-zinc-500 gap-2">
                                    <Loader2 className="animate-spin" size={32}/>
                                    <span className="text-sm font-bold">Loading records...</span>
                                </div>
                            ) : historyData.length === 0 ? (
                                <div className="text-center py-20 text-zinc-600">
                                    <Activity size={48} className="mx-auto mb-4 opacity-50"/>
                                    <p>No workout history found.</p>
                                </div>
                            ) : (
                                historyData.map((session) => (
                                    <div key={session.id} className="bg-black border border-zinc-800 rounded-2xl overflow-hidden">
                                        <div className="p-4 bg-zinc-900/50 flex justify-between items-center border-b border-zinc-800/50">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-blue-500"/>
                                                <span className="font-bold text-zinc-300">{new Date(session.date).toLocaleDateString()}</span>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase bg-zinc-800 text-zinc-500 px-2 py-1 rounded">{session.day_name}</span>
                                        </div>
                                        <div className="p-2">
                                            {session.performance.length === 0 ? (
                                                <p className="text-xs text-zinc-600 p-2 italic">Attended, but no data recorded.</p>
                                            ) : (
                                                <div className="space-y-1">
                                                    {session.performance.map((p, idx) => (
                                                        <div key={idx} className="bg-zinc-900/30 mb-2 last:mb-0 rounded-lg p-2 hover:bg-zinc-900 transition-colors">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-sm font-medium text-zinc-400">{p.exercise}</span>
                                                                <div className="flex gap-2">
                                                                    {(p.val1 && p.val1 !== '-') && (
                                                                        <span className="text-xs font-bold text-white bg-zinc-800 px-2 py-1 rounded border border-zinc-700">
                                                                            {p.val1} {p.type === 'cardio' ? 'km' : 'kg'}
                                                                        </span>
                                                                    )}
                                                                    {(p.val2 && p.val2 !== '-') && (
                                                                        <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                                                                            {p.val2} {p.type === 'cardio' ? 'min' : 'reps'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Exercise Note Display in History */}
                                                            {p.note && (
                                                                <div className="text-[10px] text-zinc-500 italic border-t border-zinc-800/50 pt-1 mt-1">
                                                                    {p.note}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {/* Session Note Display */}
                                            {session.session_note && (
                                                <div className="mt-2 p-2 bg-blue-900/10 border border-blue-500/10 rounded-lg">
                                                    <p className="text-[10px] text-blue-300 italic">"{session.session_note}"</p>
                                                </div>
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

export default ActiveGroupSession;