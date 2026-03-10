import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Dumbbell, Repeat, Timer,
    Settings2, History, User, Activity,
    FileText, MessageSquare, Calendar,
    AlertCircle, CheckCircle2, Sparkles, Loader2
} from 'lucide-react';
import api from '../../api';

// ─── Category & Input Config ─────────────────────────────────────────────────
const CATEGORIES = [
    { value: 'weight', label: 'Weight', labelAr: 'وزن', icon: Dumbbell, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/20' },
    { value: 'reps', label: 'Reps', labelAr: 'عدات', icon: Repeat, color: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-500/10', ring: 'ring-violet-500/20' },
    { value: 'time', label: 'Time', labelAr: 'وقت', icon: Timer, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
];

const getCategoryConfig = (cat) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];

const getInputFields = (category) => {
    switch (category) {
        case 'reps':
            return { f1: { label: 'Reps', unit: 'reps', placeholder: '0', inputMode: 'numeric' }, f2: null };
        case 'time':
            return { f1: { label: 'Min', unit: 'min', placeholder: '0', inputMode: 'numeric' }, f2: { label: 'Sec', unit: 'sec', placeholder: '0', inputMode: 'numeric' } };
        default: // weight
            return { f1: { label: 'Weight', unit: 'kg', placeholder: '0', inputMode: 'decimal' }, f2: { label: 'Reps', unit: 'reps', placeholder: '0', inputMode: 'numeric' } };
    }
};

// ─── Shared UI Components ────────────────────────────────────────────────────
const Toast = memo(({ message, type = 'error', onClose }) => (
    <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        className={`fixed bottom-6 right-6 z-[400] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border ${
            type === 'error'
                ? 'bg-white dark:bg-zinc-900 border-red-500/30 text-red-600 dark:text-red-400'
                : 'bg-white dark:bg-zinc-900 border-green-500/30 text-green-600 dark:text-green-400'
        }`}
    >
        {type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{message}</span>
        <button onClick={onClose} className="ml-1 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 transition-colors">
            <X size={14} />
        </button>
    </motion.div>
));

const PrevBadge = memo(({ prev, category, loading }) => {
    if (loading) return <Loader2 size={10} className="animate-spin text-zinc-400 dark:text-zinc-500 shrink-0" />;
    if (!prev) return null;

    if (!prev.found) {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                <Sparkles size={8} /> New
            </span>
        );
    }

    const fields = getInputFields(category);
    const parts = [];
    if (prev.val1 && prev.val1 !== '-') parts.push(`${prev.val1} ${fields.f1.unit}`);
    if (fields.f2 && prev.val2 && prev.val2 !== '-') parts.push(`${prev.val2} ${fields.f2.unit}`);
    if (!parts.length) return null;

    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 px-2 py-0.5 rounded-full font-mono whitespace-nowrap" title="Previous performance">
            <History size={8} /> {parts.join(' / ')}
        </span>
    );
});

const PerfInput = memo(({ value, onChange, placeholder, unit, inputMode }) => (
    <div className="relative flex-1">
        <input
            placeholder={placeholder}
            value={value || ''}
            onChange={onChange}
            inputMode={inputMode}
            className="w-full h-10 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-3 pr-8 text-center text-sm font-bold text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60 transition-all duration-200"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase pointer-events-none">
            {unit}
        </span>
    </div>
));

const ExerciseBlock = memo(({ ex, clientId, perfData, noteOpen, prevPerf, historyLoading, onUpdatePerf, onToggleNote }) => {
    const fields = getInputFields(ex.category);
    const catCfg = getCategoryConfig(ex.category);
    const CatIcon = catCfg.icon;
    const p = perfData || {};

    return (
        <div className="rounded-xl bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700/60 transition-colors duration-200">
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                <span className={`p-1 rounded-md ${catCfg.bg} shrink-0`}><CatIcon size={11} className={catCfg.color} /></span>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate flex-1">{ex.name}</span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono shrink-0">{ex.sets_count}×</span>
            </div>
            <div className="px-3 pb-2 space-y-2">
                <div className="flex gap-2 items-center">
                    <PerfInput value={p.val1} placeholder={fields.f1.label} unit={fields.f1.unit} inputMode={fields.f1.inputMode} onChange={e => onUpdatePerf(clientId, ex.id, 'val1', e.target.value)} />
                    {fields.f2 && <PerfInput value={p.val2} placeholder={fields.f2.label} unit={fields.f2.unit} inputMode={fields.f2.inputMode} onChange={e => onUpdatePerf(clientId, ex.id, 'val2', e.target.value)} />}
                    <button onClick={() => onToggleNote(clientId, ex.id)} className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-200 ${noteOpen ? 'bg-blue-50 dark:bg-blue-600/20 border-blue-200 dark:border-blue-500/50 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700/50 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600'}`}>
                        <MessageSquare size={13} />
                    </button>
                </div>
                <div className="flex items-center">
                    <PrevBadge prev={prevPerf} category={ex.category} loading={historyLoading} />
                </div>
                <AnimatePresence initial={false}>
                    {noteOpen && (
                        <motion.div key="note" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18, ease: 'easeInOut' }} className="overflow-hidden">
                            <input placeholder="Note…" value={p.note || ''} onChange={e => onUpdatePerf(clientId, ex.id, 'note', e.target.value)} className="w-full h-9 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-3 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60 transition-all duration-200" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
});

const AthleteCard = memo(({ child, isPresent, isExpanded, exercises, performance, sessionNote, expandedNotes, prevHistory, historyLoading, onToggleAttendance, onToggleCard, onUpdatePerformance, onToggleNote, onUpdateSessionNote, onViewHistory }) => {
    return (
        <motion.div layout animate={{ opacity: isPresent ? 1 : 0.55, scale: isPresent ? 1 : 0.975 }} transition={{ duration: 0.22, ease: 'easeOut' }} className={`flex flex-col rounded-2xl border overflow-hidden transition-colors duration-300 ${isPresent ? 'bg-white dark:bg-[#111113] border-zinc-200 dark:border-zinc-800/60 shadow-lg shadow-zinc-200/50 dark:shadow-black/30' : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-900/60'}`}>
            <div className="p-4 flex items-center gap-3">
                <button onClick={() => onToggleAttendance(child.client_id)} title={isPresent ? 'Mark absent' : 'Mark present'} className={`relative w-11 h-11 rounded-full overflow-hidden border-2 shrink-0 transition-all duration-300 ${isPresent ? 'border-green-500/70 shadow-md shadow-green-500/20' : 'border-zinc-300 dark:border-zinc-700/50'}`}>
                    {child.client_photo ? (
                        <img src={child.client_photo} alt={child.client_name} className={`w-full h-full object-cover transition-all duration-300 ${isPresent ? '' : 'grayscale opacity-40'}`} />
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center font-black text-sm transition-all duration-300 ${isPresent ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 grayscale opacity-40'}`}>
                            {child.client_name?.charAt(0).toUpperCase()}
                        </div>
                    )}
                    {isPresent && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border border-white dark:border-[#111113] flex items-center justify-center"><CheckCircle2 size={9} className="text-white" strokeWidth={3} /></div>}
                </button>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate leading-tight">{child.client_name}</h3>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md ${isPresent ? 'text-green-600 dark:text-green-500 bg-green-500/10' : 'text-zinc-500 dark:text-zinc-600 bg-zinc-200 dark:bg-zinc-800/50'}`}>{isPresent ? 'Present' : 'Absent'}</span>
                </div>
                <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => onViewHistory(child)} className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center justify-center transition-all border border-zinc-200 dark:border-zinc-700/40 hover:border-zinc-300 dark:hover:border-zinc-600/60" title="View History"><History size={15} /></button>
                    <button onClick={() => onToggleCard(child.client_id)} className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center justify-center transition-all border border-zinc-200 dark:border-zinc-700/40 hover:border-zinc-300 dark:hover:border-zinc-600/60"><motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.22 }}><Settings2 size={15} /></motion.div></button>
                </div>
            </div>
            <AnimatePresence initial={false}>
                {isPresent && isExpanded && (
                    <motion.div key="inputs" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }} className="overflow-hidden">
                        <div className="px-3 pb-3 space-y-2 border-t border-zinc-100 dark:border-zinc-800/40 pt-3">
                            {exercises.filter(e => e.name.trim()).map(ex => {
                                const noteKey = `${child.client_id}_${ex.id}`;
                                const prevPerf = prevHistory[String(child.client_id)]?.[ex.name];
                                return <ExerciseBlock key={ex.id} ex={ex} clientId={child.client_id} perfData={performance[child.client_id]?.[ex.id]} noteOpen={expandedNotes[noteKey] || Boolean(performance[child.client_id]?.[ex.id]?.note)} prevPerf={prevPerf} historyLoading={historyLoading} onUpdatePerf={onUpdatePerformance} onToggleNote={onToggleNote} />;
                            })}
                            <div className="pt-1">
                                <div className="relative">
                                    <FileText size={12} className="absolute left-3 top-3 text-zinc-400 dark:text-zinc-600 pointer-events-none" />
                                    <textarea placeholder="Session note…" value={sessionNote || ''} onChange={e => onUpdateSessionNote(child.client_id, e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 rounded-xl py-2.5 pl-8 pr-3 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60 transition-all duration-200 resize-none h-14" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
});

// ─── Main Component ──────────────────────────────────────────────────────────
const LiveSession = ({ day, children, exercises, onClose, onEditPlan }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);
    const [toast, setToast] = useState(null);

    // State Initialization
    const [attendance, setAttendance] = useState(() => children.reduce((acc, c) => ({ ...acc, [c.client_id]: true }), {}));
    const [expandedCards, setExpandedCards] = useState(() => children.reduce((acc, c) => ({ ...acc, [c.client_id]: true }), {}));
    const [performance, setPerformance] = useState({});
    const [sessionNotes, setSessionNotes] = useState({});
    const [expandedNotes, setExpandedNotes] = useState({});
    
    // History State
    const [prevHistory, setPrevHistory] = useState({});
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyChild, setHistoryChild] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const showToast = useCallback((message, type = 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // ── Data Fetching: Bulk History on Mount ─────────────────────────────
    useEffect(() => {
        let isMounted = true;
        const fetchBulkHistory = async () => {
            const exerciseNames = exercises.map(e => e.name).filter(Boolean);
            const clientIds = children.map(c => c.client_id);
            if (!exerciseNames.length || !clientIds.length) return;

            setHistoryLoading(true);
            try {
                const res = await api.post('/group-training/bulk_exercise_history/', {
                    day_name: day,
                    exercise_names: exerciseNames,
                    client_ids: clientIds,
                });
                if (isMounted) setPrevHistory(res.data || {});
            } catch {
                if (isMounted) setPrevHistory({});
            } finally {
                if (isMounted) setHistoryLoading(false);
            }
        };

        fetchBulkHistory();
        return () => { isMounted = false; };
    }, [exercises, children, day]);

    // ── Individual History Drawer ────────────────────────────────────────
    const fetchChildHistory = useCallback(async (child) => {
        setHistoryChild(child);
        setLoadingHistory(true);
        setHistoryData([]);
        try {
            const res = await api.get(`/group-training/child_history/?client_id=${child.client_id}`);
            setHistoryData(res.data.results || res.data);
        } catch {
            showToast('Could not load history.');
        } finally {
            setLoadingHistory(false);
        }
    }, [showToast]);

    // ── Stable State Updaters ────────────────────────────────────────────
    const updatePerformance = useCallback((clientId, exId, field, value) => {
        setPerformance(prev => ({
            ...prev,
            [clientId]: {
                ...(prev[clientId] || {}),
                [exId]: { ...(prev[clientId]?.[exId] || {}), [field]: value },
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

    const toggleCard = useCallback((clientId) => {
        setExpandedCards(prev => ({ ...prev, [clientId]: !prev[clientId] }));
    }, []);

    const updateSessionNote = useCallback((clientId, value) => {
        setSessionNotes(prev => ({ ...prev, [clientId]: value }));
    }, []);

    // ── Final Submission ─────────────────────────────────────────────────
    const handleComplete = useCallback(async () => {
        setIsSubmitting(true);
        setShowFinishConfirm(false);

        const summary = exercises.map(ex => ({
            name: ex.name,
            category: ex.category,
            sets_count: Number(ex.sets_count) || 0,
            results: children
                .filter(c => attendance[c.client_id])
                .map(c => ({
                    client: c.client_name,
                    client_id: c.client_id,
                    ...performance[c.client_id]?.[ex.id],
                })),
        }));

        const participants = children
            .filter(c => attendance[c.client_id])
            .map(c => ({
                client_id: c.client_id,
                note: sessionNotes[c.client_id] || 'Completed',
            }));

        try {
            await api.post('/group-training/complete_session/', {
                day_name: day,
                exercises_summary: summary,
                participants,
            });
            onClose();
        } catch {
            showToast('Error saving session. Please try again.');
            setIsSubmitting(false);
        }
    }, [exercises, children, attendance, performance, sessionNotes, day, onClose, showToast]);

    const presentCount = useMemo(() => children.filter(c => attendance[c.client_id]).length, [children, attendance]);

    return (
        <div className="fixed inset-0 z-[200] bg-zinc-50 dark:bg-[#09090b] flex flex-col text-zinc-900 dark:text-white transition-colors duration-300">
            {/* Header */}
            <div className="shrink-0 h-16 md:h-[4.5rem] bg-white dark:bg-[#111113] border-b border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between px-4 md:px-6 z-20 shadow-lg shadow-zinc-200/50 dark:shadow-black/40">
                <div className="flex items-center gap-3">
                    <button onClick={onEditPlan} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600 p-2.5 md:px-4 md:py-2 rounded-xl flex items-center gap-2 transition-all duration-200">
                        <Settings2 size={16} />
                        <span className="hidden md:inline text-xs font-bold uppercase tracking-wider">Edit Plan</span>
                    </button>
                    <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-800" />
                    <div>
                        <span className="text-sm font-bold text-zinc-900 dark:text-white">{day}</span>
                        <span className="text-xs text-zinc-500 ml-2">{exercises.length} exercises</span>
                    </div>
                    {historyLoading && <span className="flex items-center gap-1.5 text-xs text-zinc-500 ml-2"><Loader2 size={12} className="animate-spin" /> Fetching history…</span>}
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                    <span className="hidden md:flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 px-3 py-1.5 rounded-xl">
                        <CheckCircle2 size={12} className="text-green-500" />
                        {presentCount} / {children.length}
                    </span>
                    <button onClick={() => setShowFinishConfirm(true)} disabled={isSubmitting} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 md:px-5 md:py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-green-500/20 dark:shadow-green-900/30 flex items-center gap-2 transition-all duration-200 active:scale-95 disabled:opacity-60">
                        {isSubmitting ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                        <span className="hidden md:inline">Finish Session</span>
                        <span className="md:hidden">Finish</span>
                    </button>
                    <button onClick={onClose} className="p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-200">
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Athlete Grid */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-4">
                    {children.map(child => (
                        <AthleteCard
                            key={child.client_id}
                            child={child}
                            isPresent={attendance[child.client_id]}
                            isExpanded={expandedCards[child.client_id]}
                            exercises={exercises}
                            performance={performance}
                            sessionNote={sessionNotes[child.client_id]}
                            expandedNotes={expandedNotes}
                            prevHistory={prevHistory}
                            historyLoading={historyLoading}
                            onToggleAttendance={toggleAttendance}
                            onToggleCard={toggleCard}
                            onUpdatePerformance={updatePerformance}
                            onToggleNote={toggleNote}
                            onUpdateSessionNote={updateSessionNote}
                            onViewHistory={fetchChildHistory}
                        />
                    ))}
                </div>
            </div>

            {/* Finish Confirm Modal */}
            <AnimatePresence>
                {showFinishConfirm && (
                    <>
                        <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFinishConfirm(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[340]" />
                        <motion.div key="modal" initial={{ opacity: 0, scale: 0.93, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} className="fixed inset-0 z-[350] flex items-center justify-center p-4 pointer-events-none">
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/60 w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center pointer-events-auto">
                                <div className="w-14 h-14 mx-auto rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-500 mb-4"><CheckCircle2 size={26} /></div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1.5">Finish Session?</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-500 mb-6">Saves session and deducts from subscriptions for <span className="font-bold text-zinc-900 dark:text-zinc-200">{presentCount}</span> attending athletes.</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => setShowFinishConfirm(false)} className="py-3 rounded-xl font-semibold text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">Cancel</button>
                                    <button onClick={handleComplete} className="py-3 rounded-xl font-bold text-sm bg-green-600 text-white hover:bg-green-500 transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2">
                                        {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Confirm'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Child History Drawer */}
            <AnimatePresence>
                {historyChild && (
                    <>
                        <motion.div key="hdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setHistoryChild(null)} className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm" />
                        <motion.div key="hdrawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 340, damping: 32 }} className="fixed inset-y-0 right-0 z-[310] w-full max-w-md bg-white dark:bg-[#111113] border-l border-zinc-200 dark:border-zinc-800/60 flex flex-col shadow-2xl transition-colors duration-300">
                            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-center shrink-0">
                                        {historyChild.client_photo ? <img src={historyChild.client_photo} className="w-full h-full object-cover" alt="" /> : <User size={16} className="text-zinc-400 dark:text-zinc-500" />}
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-zinc-900 dark:text-white">{historyChild.client_name}</h2>
                                        <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Performance History</p>
                                    </div>
                                </div>
                                <button onClick={() => setHistoryChild(null)} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"><X size={16} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                {loadingHistory ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-zinc-500 gap-3"><Loader2 className="animate-spin" size={24} /><span className="text-sm">Loading records…</span></div>
                                ) : historyData.length === 0 ? (
                                    <div className="text-center py-16 text-zinc-400 dark:text-zinc-600"><Activity size={36} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No workout history found.</p></div>
                                ) : historyData.map(session => (
                                    <div key={session.id} className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/60 rounded-xl overflow-hidden">
                                        <div className="px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-900 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800/50">
                                            <div className="flex items-center gap-2"><Calendar size={12} className="text-blue-500 dark:text-blue-400" /><span className="font-semibold text-zinc-800 dark:text-zinc-300 text-sm">{new Date(session.date).toLocaleDateString()}</span></div>
                                            <span className="text-[10px] font-bold uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500 px-2 py-0.5 rounded-md">{session.day_name}</span>
                                        </div>
                                        <div className="p-2.5 space-y-1.5">
                                            {(!session.performance || session.performance.length === 0) ? (
                                                <p className="text-xs text-zinc-500 dark:text-zinc-600 italic px-1">Attended — no data recorded.</p>
                                            ) : session.performance.map((p, pidx) => {
                                                const fields = getInputFields(p.category || 'weight');
                                                return (
                                                    <div key={pidx} className="flex justify-between items-center bg-white dark:bg-zinc-900/50 rounded-lg p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors shadow-sm dark:shadow-none">
                                                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-400 truncate max-w-[9rem]">{p.exercise}</span>
                                                        <div className="flex gap-1.5">
                                                            {p.val1 && p.val1 !== '-' && <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg font-mono border border-zinc-200 dark:border-zinc-700/50">{p.val1} {fields.f1.unit}</span>}
                                                            {fields.f2 && p.val2 && p.val2 !== '-' && <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg font-mono border border-blue-500/20">{p.val2} {fields.f2.unit}</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {session.session_note && <p className="text-[11px] text-zinc-500 italic px-1 pt-1">"{session.session_note}"</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </AnimatePresence>
        </div>
    );
};

export default LiveSession;