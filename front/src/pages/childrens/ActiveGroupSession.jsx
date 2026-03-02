import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, Save, Dumbbell, UserCheck, CheckCircle2,
    Settings2, ArrowLeft, Trash2, Timer,
    LayoutTemplate, ChevronDown, Loader2,
    History, User, Activity, FileText, MessageSquare,
    Calendar, AlertCircle
} from 'lucide-react';
import api from '../../api';

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type = 'error', onClose }) => (
    <div className={`fixed bottom-6 right-6 z-[400] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-bottom-4 duration-300 ${
        type === 'error'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
    }`}>
        <AlertCircle size={18} />
        <span className="font-semibold text-sm">{message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-70"><X size={16} /></button>
    </div>
);

// ─── getUnits ─────────────────────────────────────────────────────────────────
const getUnits = (type) => {
    if (type === 'cardio') return { u1: 'km', u2: 'min' };
    if (type === 'time') return { u1: 'min', u2: 'kg' };
    return { u1: 'kg', u2: '#' };
};

const getInputConfig = (type) => {
    if (type === 'cardio') return { label1: 'Dist', unit1: 'km', label2: 'Time', unit2: 'min' };
    if (type === 'time') return { label1: 'Time', unit1: 'min', label2: 'Weight', unit2: 'kg' };
    return { label1: 'Weight', unit1: 'kg', label2: 'Reps', unit2: '#' };
};

const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ─── Component ────────────────────────────────────────────────────────────────
const ActiveGroupSession = ({ day, children, onClose, initialExercises }) => {
    const [mode, setMode] = useState('SETUP');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState(null);
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);

    // Data
    const [exercises, setExercises] = useState([
        { id: Date.now(), name: '', type: 'strength', target: '' }
    ]);
    const [performance, setPerformance] = useState({});
    const [sessionNotes, setSessionNotes] = useState({});
    const [expandedNotes, setExpandedNotes] = useState({});
    const [attendance, setAttendance] = useState(
        () => children.reduce((acc, c) => ({ ...acc, [c.client_id]: true }), {})
    );

    // History drawer
    const [historyChild, setHistoryChild] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Templates & Timer
    const [templates, setTemplates] = useState([]);
    const [showTemplates, setShowTemplates] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [timer, setTimer] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    const timerRef = useRef(null);

    const showToast = useCallback((message, type = 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // ── Timer ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (isTimerRunning) {
            timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isTimerRunning]);

    // ── Load initial exercises (repeat session) ──────────────────────────
    useEffect(() => {
        if (initialExercises && initialExercises.length > 0) {
            setExercises(initialExercises.map(e => ({ ...e, id: Date.now() + Math.random() })));
        }
    }, []); // eslint-disable-line

    // ── Templates ────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        api.get('/group-templates/')
            .then(res => { if (!cancelled) setTemplates(res.data.results || res.data); })
            .catch(err => console.error('Template error', err));
        return () => { cancelled = true; };
    }, []);

    const fetchTemplates = useCallback(async () => {
        try {
            const res = await api.get('/group-templates/');
            setTemplates(res.data.results || res.data);
        } catch (e) {
            console.error('Template fetch error', e);
        }
    }, []);

    const handleSaveTemplate = async () => {
        if (!templateName.trim()) return;
        try {
            await api.post('/group-templates/', { name: templateName.trim(), exercises });
            setTemplateName('');
            fetchTemplates();
            showToast('Template saved!', 'success');
        } catch {
            showToast('Failed to save template.');
        }
    };

    const handleDeleteTemplate = async (id, e) => {
        e.stopPropagation();
        try {
            await api.delete(`/group-templates/${id}/`);
            fetchTemplates();
        } catch {
            showToast('Failed to delete template.');
        }
    };

    // ── Child History ────────────────────────────────────────────────────
    const fetchChildHistory = async (child) => {
        setHistoryChild(child);
        setLoadingHistory(true);
        setHistoryData([]);
        try {
            const res = await api.get(`/group-training/client_history/?client_id=${child.client_id}`);
            setHistoryData(res.data.results || res.data);
        } catch {
            showToast('Could not load history.');
        } finally {
            setLoadingHistory(false);
        }
    };

    // ── Exercise helpers ─────────────────────────────────────────────────
    const updateExercise = useCallback((idx, field, value) => {
        setExercises(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    }, []);

    const removeExercise = useCallback((id) => {
        setExercises(prev => prev.filter(e => e.id !== id));
    }, []);

    const addExercise = useCallback(() => {
        setExercises(prev => [...prev, { id: Date.now() + Math.random(), name: '', type: 'strength', target: '' }]);
    }, []);

    // ── Performance helpers ───────────────────────────────────────────────
    const updatePerformance = useCallback((clientId, exId, field, value) => {
        setPerformance(prev => ({
            ...prev,
            [clientId]: {
                ...(prev[clientId] || {}),
                [exId]: {
                    ...(prev[clientId]?.[exId] || {}),
                    [field]: value,
                },
            },
        }));
    }, []);

    const toggleNote = useCallback((clientId, exId) => {
        const key = `${clientId}_${exId}`;
        setExpandedNotes(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const toggleAttendance = useCallback((clientId) => {
        setAttendance(prev => ({ ...prev, [clientId]: !prev[clientId] }));
    }, []);

    // ── Complete Session ─────────────────────────────────────────────────
    const handleComplete = async () => {
        setIsSubmitting(true);
        setShowFinishConfirm(false);
        clearInterval(timerRef.current);

        const summary = exercises.map(ex => ({
            name: ex.name,
            type: ex.type,
            target: ex.target,
            results: children
                .filter(c => attendance[c.client_id])
                .map(c => ({
                    client: c.client_name,
                    ...performance[c.client_id]?.[ex.id],
                })),
        }));

        const participants = children.map(c => ({
            client_id: c.client_id,
            present: attendance[c.client_id],
            note: sessionNotes[c.client_id] || (attendance[c.client_id] ? 'Completed' : 'Absent'),
        }));

        try {
            await api.post('/group-training/complete_session/', {
                day_name: day,
                exercises: summary,
                participants: participants.filter(p => p.present),
            });
            onClose();
        } catch {
            showToast('Error saving session. Please try again.');
            setIsSubmitting(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────
    // SETUP MODE
    // ─────────────────────────────────────────────────────────────────────
    if (mode === 'SETUP') return (
        <div className="fixed inset-0 z-[200] bg-zinc-50 dark:bg-[#09090b] flex flex-col animate-in fade-in duration-300 transition-colors">
            {/* Header */}
            <div className="min-h-[5rem] py-4 bg-white dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-8 gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
                        <span className="bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-500 p-2 rounded-xl">
                            <Settings2 size={22} />
                        </span>
                        Session Planner
                    </h1>
                    <p className="text-zinc-500 font-medium mt-1 ml-1 text-sm">
                        {day} Group • {children.length} Athletes
                    </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className={`flex-1 md:flex-none px-4 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                            showTemplates
                                ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900'
                                : 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                    >
                        <LayoutTemplate size={16} /> Templates
                    </button>
                    <button
                        onClick={onClose}
                        className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Planner */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {exercises.map((ex, idx) => (
                            <div
                                key={ex.id}
                                className="bg-white dark:bg-[#18181b] p-4 md:p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center shadow-lg group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                            >
                                <span className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-400 font-black text-lg border border-zinc-200 dark:border-zinc-800 group-hover:text-blue-500 group-hover:border-blue-500/30 transition-all shrink-0">
                                    {idx + 1}
                                </span>
                                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
                                    <div className="md:col-span-6">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-2 mb-1 block">Exercise Name</label>
                                        <input
                                            value={ex.name}
                                            onChange={e => updateExercise(idx, 'name', e.target.value)}
                                            placeholder="e.g. Barbell Squat"
                                            className="w-full h-12 md:h-14 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 text-lg md:text-xl font-bold text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-700 focus:border-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-[10px] font-bold text-zinc-500 uppercase ml-2 mb-1 block">Type</label>
                                        <div className="relative">
                                            <select
                                                value={ex.type}
                                                onChange={e => updateExercise(idx, 'type', e.target.value)}
                                                className="w-full h-12 md:h-14 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 text-zinc-900 dark:text-white font-bold appearance-none outline-none focus:border-blue-500 cursor-pointer"
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
                                            onChange={e => updateExercise(idx, 'target', e.target.value)}
                                            placeholder="e.g. 4x10"
                                            className="w-full h-12 md:h-14 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 text-blue-600 dark:text-blue-400 font-mono font-bold placeholder-zinc-400 dark:placeholder-zinc-700 outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeExercise(ex.id)}
                                    className="p-3 md:p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-600 hover:bg-red-500/10 hover:text-red-500 transition-all self-end md:self-center"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}

                        <button
                            onClick={addExercise}
                            className="w-full h-16 md:h-20 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-[2rem] text-zinc-500 font-bold text-base flex items-center justify-center gap-3 hover:bg-zinc-200 dark:hover:bg-zinc-900/50 hover:border-zinc-400 dark:hover:border-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all"
                        >
                            <span className="bg-zinc-200 dark:bg-zinc-800 p-2 rounded-full"><Dumbbell size={18} /></span>
                            Add New Exercise
                        </button>
                    </div>
                </div>

                {/* Templates Sidebar */}
                {showTemplates && (
                    <div className="absolute md:relative inset-0 md:inset-auto z-10 md:z-auto w-full md:w-96 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121214] p-6 flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="flex justify-between items-center mb-6 md:hidden">
                            <h3 className="text-xl font-black text-zinc-900 dark:text-white">Templates</h3>
                            <button onClick={() => setShowTemplates(false)}><X size={24} className="text-zinc-500" /></button>
                        </div>
                        <h3 className="hidden md:block text-xl font-black text-zinc-900 dark:text-white mb-6">Template Library</h3>

                        <div className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 mb-6">
                            <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Save Current Setup</label>
                            <div className="flex gap-2">
                                <input
                                    value={templateName}
                                    onChange={e => setTemplateName(e.target.value)}
                                    placeholder="Name (e.g. Leg Day)"
                                    className="flex-1 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-blue-500"
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveTemplate(); } }}
                                />
                                <button onClick={handleSaveTemplate} className="p-3 bg-blue-600 rounded-xl text-white hover:bg-blue-500 transition-colors">
                                    <Save size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3">
                            {templates.length === 0 ? (
                                <p className="text-sm text-zinc-500 text-center py-8">No templates saved yet.</p>
                            ) : templates.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => {
                                        setExercises(t.exercises.map(e => ({ ...e, id: Date.now() + Math.random() })));
                                        setShowTemplates(false);
                                    }}
                                    className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500/50 cursor-pointer group relative transition-all"
                                >
                                    <div className="flex justify-between items-center mb-1 pr-6">
                                        <p className="font-bold text-zinc-900 dark:text-white truncate">{t.name}</p>
                                        <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-1 rounded-lg shrink-0 ml-2">
                                            {t.exercises.length} Ex
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 truncate">{t.exercises.map(e => e.name).join(', ')}</p>
                                    <button
                                        onClick={e => handleDeleteTemplate(t.id, e)}
                                        className="absolute top-3 right-3 p-1.5 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all bg-zinc-200 dark:bg-zinc-800 rounded-lg"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="h-20 md:h-24 bg-white dark:bg-[#121214] border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end px-4 md:px-8">
                <button
                    onClick={() => {
                        if (exercises.filter(e => e.name.trim()).length === 0) {
                            showToast('Add at least one exercise before starting.');
                            return;
                        }
                        setMode('LIVE');
                        setIsTimerRunning(true);
                    }}
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-6 md:px-10 py-3 md:py-4 rounded-2xl font-bold text-base md:text-lg shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
                >
                    Start Session <ArrowLeft className="rotate-180" size={20} />
                </button>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────
    // LIVE MODE
    // ─────────────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[200] bg-zinc-50 dark:bg-[#09090b] flex flex-col text-zinc-900 dark:text-white animate-in slide-in-from-right duration-500 transition-colors">

            {/* Live Header */}
            <div className="h-16 md:h-20 bg-white dark:bg-[#121214] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-3 md:px-6 shadow-xl z-20 shrink-0">
                <div className="flex items-center gap-3 md:gap-6">
                    <button
                        onClick={() => { setMode('SETUP'); setIsTimerRunning(false); }}
                        className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-2.5 md:px-4 md:py-2 rounded-xl flex items-center gap-2 transition-colors"
                        title="Edit Plan"
                    >
                        <Settings2 size={18} />
                        <span className="hidden md:inline text-sm font-bold uppercase tracking-wide">Edit Plan</span>
                    </button>
                    <div className="w-px h-6 md:h-8 bg-zinc-300 dark:bg-zinc-800" />
                    <div
                        onClick={() => setIsTimerRunning(p => !p)}
                        className={`flex items-center gap-2 md:gap-3 px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                            isTimerRunning
                                ? 'bg-green-100 dark:bg-green-500/10 border-green-500/50 text-green-600 dark:text-green-500'
                                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
                        }`}
                    >
                        <Timer size={16} className={isTimerRunning ? 'animate-pulse' : ''} />
                        <span className="font-mono font-black text-lg md:text-2xl tracking-widest leading-none">
                            {formatTime(timer)}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                    <button
                        onClick={() => setShowFinishConfirm(true)}
                        disabled={isSubmitting}
                        className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 md:px-6 md:py-3 rounded-xl font-bold shadow-lg shadow-green-900/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                    >
                        {isSubmitting
                            ? <Loader2 className="animate-spin" size={18} />
                            : <CheckCircle2 size={18} />
                        }
                        <span className="hidden md:inline text-base">Finish Session</span>
                        <span className="md:hidden text-xs">Finish</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2.5 md:p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Live Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-zinc-50 dark:bg-[#09090b]">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6 pb-20">
                    {children.map(child => {
                        const isPresent = attendance[child.client_id];
                        return (
                            <div
                                key={child.client_id}
                                className={`flex flex-col rounded-[1.5rem] border transition-all duration-300 overflow-hidden ${
                                    isPresent
                                        ? 'bg-white dark:bg-[#121214] border-zinc-200 dark:border-zinc-800 shadow-xl'
                                        : 'bg-zinc-100 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-900 opacity-50'
                                }`}
                            >
                                {/* Child Header */}
                                <div className="p-4 md:p-5 flex items-center gap-3 md:gap-4 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50 dark:bg-zinc-900/30">
                                    <button
                                        onClick={() => toggleAttendance(child.client_id)}
                                        className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg shrink-0 ${
                                            isPresent
                                                ? 'bg-blue-600 text-white shadow-blue-500/20 dark:shadow-blue-900/20'
                                                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                                        }`}
                                    >
                                        {isPresent ? <CheckCircle2 size={22} /> : <UserCheck size={22} />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-base md:text-lg text-zinc-900 dark:text-white truncate">{child.client_name}</h3>
                                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${
                                            isPresent
                                                ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-500'
                                                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                                        }`}>
                                            {isPresent ? 'Present' : 'Absent'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => fetchChildHistory(child)}
                                        className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors border border-zinc-300 dark:border-zinc-700"
                                        title="View History"
                                    >
                                        <History size={18} />
                                    </button>
                                </div>

                                {/* Exercises */}
                                {isPresent && (
                                    <div className="flex-1 p-3 space-y-2">
                                        {exercises.map(ex => {
                                            const p = performance[child.client_id]?.[ex.id] || {};
                                            const noteKey = `${child.client_id}_${ex.id}`;
                                            const isNoteOpen = expandedNotes[noteKey] || Boolean(p.note);
                                            const cfg = getInputConfig(ex.type);

                                            return (
                                                <div
                                                    key={ex.id}
                                                    className="p-3 rounded-2xl bg-zinc-100 dark:bg-black border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                                                >
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-400 truncate max-w-[7rem]">{ex.name || '—'}</span>
                                                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-500 bg-blue-100 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">{ex.target || '-'}</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <div className="flex-1 relative">
                                                            <input
                                                                placeholder={cfg.label1}
                                                                value={p.val1 || ''}
                                                                onChange={e => updatePerformance(child.client_id, ex.id, 'val1', e.target.value)}
                                                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg py-2 pl-3 pr-8 text-center text-sm font-bold text-zinc-900 dark:text-white focus:border-blue-500 outline-none"
                                                                inputMode="decimal"
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold uppercase">{cfg.unit1}</span>
                                                        </div>
                                                        <div className="flex-1 relative">
                                                            <input
                                                                placeholder={cfg.label2}
                                                                value={p.val2 || ''}
                                                                onChange={e => updatePerformance(child.client_id, ex.id, 'val2', e.target.value)}
                                                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg py-2 pl-3 pr-8 text-center text-sm font-bold text-zinc-900 dark:text-white focus:border-blue-500 outline-none"
                                                                inputMode="decimal"
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold uppercase">{cfg.unit2}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => toggleNote(child.client_id, ex.id)}
                                                            className={`w-10 rounded-lg border flex items-center justify-center transition-all ${
                                                                isNoteOpen
                                                                    ? 'bg-blue-600 border-blue-500 text-white'
                                                                    : 'bg-zinc-200 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-500 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white'
                                                            }`}
                                                        >
                                                            <MessageSquare size={16} />
                                                        </button>
                                                    </div>
                                                    {isNoteOpen && (
                                                        <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                                                            <input
                                                                placeholder="Exercise note..."
                                                                value={p.note || ''}
                                                                onChange={e => updatePerformance(child.client_id, ex.id, 'note', e.target.value)}
                                                                className="w-full bg-white dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-lg py-2 px-3 text-xs text-zinc-900 dark:text-white focus:border-blue-500 outline-none"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* General session note */}
                                        <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/50 mt-2">
                                            <div className="relative">
                                                <FileText size={14} className="absolute left-3 top-3 text-zinc-400 dark:text-zinc-500" />
                                                <textarea
                                                    placeholder="General session notes..."
                                                    value={sessionNotes[child.client_id] || ''}
                                                    onChange={e => setSessionNotes(prev => ({ ...prev, [child.client_id]: e.target.value }))}
                                                    className="w-full bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 rounded-xl py-2 pl-9 pr-3 text-xs text-zinc-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-900 outline-none resize-none h-16"
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

            {/* ── Finish Confirm Dialog ──────────────────────────────────────────── */}
            {showFinishConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[350] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-600 mb-4">
                            <CheckCircle2 size={30} />
                        </div>
                        <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Finish Session?</h3>
                        <p className="text-sm text-zinc-500 mb-6">
                            This will save the session and deduct from subscriptions for{' '}
                            <span className="font-bold text-zinc-900 dark:text-white">
                                {children.filter(c => attendance[c.client_id]).length}
                            </span>{' '}
                            attending athletes.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowFinishConfirm(false)}
                                className="py-3.5 rounded-xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleComplete}
                                className="py-3.5 rounded-xl font-bold bg-green-600 text-white hover:bg-green-500 transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── History Drawer ─────────────────────────────────────────────────── */}
            {historyChild && (
                <div className="fixed inset-0 z-[300] bg-black/60 dark:bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white dark:bg-[#121214] border-l border-zinc-200 dark:border-zinc-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                        <div className="p-4 md:p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#18181b] flex items-center justify-between">
                            <div className="flex items-center gap-3 md:gap-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden border border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                                    {historyChild.client_photo
                                        ? <img src={historyChild.client_photo} className="w-full h-full object-cover" alt="" />
                                        : <User size={20} className="text-zinc-400 dark:text-zinc-500" />
                                    }
                                </div>
                                <div>
                                    <h2 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white">{historyChild.client_name}</h2>
                                    <p className="text-zinc-500 text-[10px] md:text-xs uppercase font-bold">Performance History</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setHistoryChild(null)}
                                className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                            {loadingHistory ? (
                                <div className="flex flex-col items-center justify-center h-40 text-zinc-500 gap-2">
                                    <Loader2 className="animate-spin" size={32} />
                                    <span className="text-sm font-bold">Loading records...</span>
                                </div>
                            ) : historyData.length === 0 ? (
                                <div className="text-center py-20 text-zinc-500">
                                    <Activity size={48} className="mx-auto mb-4 opacity-30" />
                                    <p>No workout history found.</p>
                                </div>
                            ) : historyData.map(session => (
                                <div key={session.id} className="bg-zinc-100 dark:bg-black border border-zinc-300 dark:border-zinc-800 rounded-2xl overflow-hidden">
                                    <div className="p-4 bg-zinc-200/50 dark:bg-zinc-900/50 flex justify-between items-center border-b border-zinc-300 dark:border-zinc-800/50">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} className="text-blue-500" />
                                            <span className="font-bold text-zinc-700 dark:text-zinc-300">
                                                {new Date(session.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase bg-zinc-300 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500 px-2 py-1 rounded">
                                            {session.day_name}
                                        </span>
                                    </div>
                                    <div className="p-2">
                                        {(!session.performance || session.performance.length === 0) ? (
                                            <p className="text-xs text-zinc-500 p-2 italic">Attended, but no data recorded.</p>
                                        ) : (
                                            <div className="space-y-1">
                                                {session.performance.map((p, pidx) => {
                                                    const units = getUnits(p.type || 'strength');
                                                    return (
                                                        <div key={pidx} className="bg-zinc-50 dark:bg-zinc-900/30 rounded-lg p-2 hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 truncate max-w-[8rem]">{p.exercise}</span>
                                                                <div className="flex gap-2">
                                                                    {p.val1 && p.val1 !== '-' && (
                                                                        <span className="text-xs font-bold text-zinc-800 dark:text-white bg-white dark:bg-zinc-800 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700">
                                                                            {p.val1} {units.u1}
                                                                        </span>
                                                                    )}
                                                                    {p.val2 && p.val2 !== '-' && (
                                                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10 px-2 py-1 rounded border border-blue-200 dark:border-blue-500/20">
                                                                            {p.val2} {units.u2}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {p.note && (
                                                                <div className="text-[10px] text-zinc-500 italic border-t border-zinc-300 dark:border-zinc-800/50 pt-1 mt-1">
                                                                    {p.note}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {session.session_note && (
                                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/10 rounded-lg">
                                                <p className="text-[10px] text-blue-600 dark:text-blue-300 italic">"{session.session_note}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default ActiveGroupSession;
