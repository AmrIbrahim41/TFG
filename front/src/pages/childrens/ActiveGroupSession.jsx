/**
 * ActiveGroupSession.jsx  — Premium Refactor (Light/Dark Mode Support)
 * ─────────────────────────────────────────────────────────────────────────────
 * Changes in this refactor:
 * REMOVED:
 * • Timer / Stopwatch entirely (state, ref, effect, UI)
 *
 * PERFORMANCE:
 * • AthleteCard extracted into a React.memo component
 * • ExerciseBlock extracted and memoized
 * • updatePerformance, toggleNote, toggleAttendance, toggleCard are all
 * useCallback-stable so memoized children never re-render on parent state changes
 *
 * UI/UX:
 * • Full Light/Dark Mode integration matching the system sidebar
 * • Softer borders (zinc-200 dark:zinc-800/50) and subtle shadows
 * • Backdrop-blur fixed footers (backdrop-blur-md bg-white/90 dark:bg-zinc-950/80)
 * • Elegant focus rings: focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
 * • History badge repositioned inline beneath inputs (integrated, not floating)
 * • Accordion uses proper Framer Motion height animation (no snap)
 * • Consistent typography scale: label → data → secondary
 * • Generous breathing room without wasting viewport
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
    useState, useEffect, useCallback, useMemo, memo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Save, Dumbbell, Repeat, Timer,
    Settings2, ArrowRight, Trash2,
    LayoutTemplate, ChevronDown, ChevronUp, Loader2,
    History, User, Activity, FileText, MessageSquare,
    Calendar, AlertCircle, CheckCircle2, Sparkles, Zap,
} from 'lucide-react';
import api from '../../api';

// ─── Category config ─────────────────────────────────────────────────────────
const CATEGORIES = [
    { value: 'weight', label: 'Weight',  labelAr: 'وزن',  icon: Dumbbell, color: 'text-blue-500 dark:text-blue-400',   bg: 'bg-blue-500/10',    ring: 'ring-blue-500/20' },
    { value: 'reps',   label: 'Reps',    labelAr: 'عدات', icon: Repeat,   color: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-500/10',  ring: 'ring-violet-500/20' },
    { value: 'time',   label: 'Time',    labelAr: 'وقت',  icon: Timer,    color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
];

const getCategoryConfig = (cat) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];

const getInputFields = (category) => {
    switch (category) {
        case 'reps':
            return {
                f1: { label: 'Reps',    unit: 'reps', placeholder: '0', inputMode: 'numeric' },
                f2: null,
            };
        case 'time':
            return {
                f1: { label: 'Min',  unit: 'min',  placeholder: '0', inputMode: 'numeric' },
                f2: { label: 'Sec',  unit: 'sec',  placeholder: '0', inputMode: 'numeric' },
            };
        default: // weight
            return {
                f1: { label: 'Weight', unit: 'kg',   placeholder: '0', inputMode: 'decimal' },
                f2: { label: 'Reps',   unit: 'reps', placeholder: '0', inputMode: 'numeric' },
            };
    }
};

// ─── Helper: legacy type → category ──────────────────────────────────────────
function _legacyTypeToCategory(type = '') {
    const map = { strength: 'weight', cardio: 'time', time: 'time', weight: 'weight', reps: 'reps' };
    return map[type.toLowerCase()] || 'weight';
}

// ─── Toast ────────────────────────────────────────────────────────────────────
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
        <button onClick={onClose} className="ml-1 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors">
            <X size={14} />
        </button>
    </motion.div>
));

// ─── Previous-performance badge ───────────────────────────────────────────────
const PrevBadge = memo(({ prev, category, loading }) => {
    if (loading) return <Loader2 size={10} className="animate-spin text-zinc-400 dark:text-zinc-500 shrink-0" />;
    if (!prev) return null;

    if (!prev.found) {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold
                             text-violet-600 dark:text-violet-400 bg-violet-500/10 border border-violet-500/20
                             px-2 py-0.5 rounded-full whitespace-nowrap">
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
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400
                         bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50
                         px-2 py-0.5 rounded-full font-mono whitespace-nowrap"
              title="Previous performance">
            <History size={8} /> {parts.join(' / ')}
        </span>
    );
});

// ─── Input Field ──────────────────────────────────────────────────────────────
const PerfInput = memo(({ value, onChange, placeholder, unit, inputMode }) => (
    <div className="relative flex-1">
        <input
            placeholder={placeholder}
            value={value || ''}
            onChange={onChange}
            inputMode={inputMode}
            className="w-full h-10 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/50 rounded-xl
                       px-3 pr-8 text-center text-sm font-bold text-zinc-900 dark:text-white
                       placeholder-zinc-400 dark:placeholder-zinc-600
                       focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60
                       transition-all duration-200"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase pointer-events-none">
            {unit}
        </span>
    </div>
));

// ─── Exercise Block (inside an athlete card) ──────────────────────────────────
const ExerciseBlock = memo(({
    ex,
    clientId,
    perfData,
    noteOpen,
    prevPerf,
    historyLoading,
    onUpdatePerf,
    onToggleNote,
}) => {
    const fields  = getInputFields(ex.category);
    const catCfg  = getCategoryConfig(ex.category);
    const CatIcon = catCfg.icon;
    const p       = perfData || {};

    return (
        <div className="rounded-xl bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50
                        hover:border-zinc-300 dark:hover:border-zinc-700/60 transition-colors duration-200">
            {/* Exercise header */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                <span className={`p-1 rounded-md ${catCfg.bg} shrink-0`}>
                    <CatIcon size={11} className={catCfg.color} />
                </span>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate flex-1">
                    {ex.name}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono shrink-0">
                    {ex.sets_count}×
                </span>
            </div>

            {/* Performance inputs */}
            <div className="px-3 pb-2 space-y-2">
                <div className="flex gap-2 items-center">
                    <PerfInput
                        value={p.val1}
                        placeholder={fields.f1.label}
                        unit={fields.f1.unit}
                        inputMode={fields.f1.inputMode}
                        onChange={e => onUpdatePerf(clientId, ex.id, 'val1', e.target.value)}
                    />
                    {fields.f2 && (
                        <PerfInput
                            value={p.val2}
                            placeholder={fields.f2.label}
                            unit={fields.f2.unit}
                            inputMode={fields.f2.inputMode}
                            onChange={e => onUpdatePerf(clientId, ex.id, 'val2', e.target.value)}
                        />
                    )}
                    {/* Note toggle */}
                    <button
                        onClick={() => onToggleNote(clientId, ex.id)}
                        className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-200 ${
                            noteOpen
                                ? 'bg-blue-50 dark:bg-blue-600/20 border-blue-200 dark:border-blue-500/50 text-blue-600 dark:text-blue-400'
                                : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700/50 text-zinc-500 dark:text-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600'
                        }`}
                    >
                        <MessageSquare size={13} />
                    </button>
                </div>

                {/* Smart history badge — integrated below inputs */}
                <div className="flex items-center">
                    <PrevBadge prev={prevPerf} category={ex.category} loading={historyLoading} />
                </div>

                {/* Note field */}
                <AnimatePresence initial={false}>
                    {noteOpen && (
                        <motion.div
                            key="note"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18, ease: 'easeInOut' }}
                            className="overflow-hidden"
                        >
                            <input
                                placeholder="Note…"
                                value={p.note || ''}
                                onChange={e => onUpdatePerf(clientId, ex.id, 'note', e.target.value)}
                                className="w-full h-9 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-3 text-xs
                                           text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600
                                           focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60
                                           transition-all duration-200"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
});

// ─── Athlete Card (memoized — only re-renders when its own slice changes) ─────
const AthleteCard = memo(({
    child,
    isPresent,
    isExpanded,
    exercises,
    performance,
    sessionNote,
    expandedNotes,
    prevHistory,
    historyLoading,
    onToggleAttendance,
    onToggleCard,
    onUpdatePerformance,
    onToggleNote,
    onUpdateSessionNote,
    onViewHistory,
}) => {
    return (
        <motion.div
            layout
            animate={{
                opacity: isPresent ? 1 : 0.55,
                scale:   isPresent ? 1 : 0.975,
            }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className={`flex flex-col rounded-2xl border overflow-hidden transition-colors duration-300 ${
                isPresent
                    ? 'bg-white dark:bg-[#111113] border-zinc-200 dark:border-zinc-800/60 shadow-lg shadow-zinc-200/50 dark:shadow-black/30'
                    : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-900/60'
            }`}
        >
            {/* ── Card Header ── */}
            <div className="p-4 flex items-center gap-3">
                {/* Photo / Avatar — click to toggle attendance */}
                <button
                    onClick={() => onToggleAttendance(child.client_id)}
                    title={isPresent ? 'Mark absent' : 'Mark present'}
                    className={`relative w-11 h-11 rounded-full overflow-hidden border-2 shrink-0
                                transition-all duration-300 ${
                        isPresent
                            ? 'border-green-500/70 shadow-md shadow-green-500/20'
                            : 'border-zinc-300 dark:border-zinc-700/50'
                    }`}
                >
                    {child.client_photo ? (
                        <img
                            src={child.client_photo}
                            alt={child.client_name}
                            className={`w-full h-full object-cover transition-all duration-300 ${
                                isPresent ? '' : 'grayscale opacity-40'
                            }`}
                        />
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center font-black text-sm transition-all duration-300 ${
                            isPresent ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 grayscale opacity-40'
                        }`}>
                            {child.client_name?.charAt(0).toUpperCase()}
                        </div>
                    )}
                    {isPresent && (
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border border-white dark:border-[#111113] flex items-center justify-center">
                            <CheckCircle2 size={9} className="text-white" strokeWidth={3} />
                        </div>
                    )}
                </button>

                {/* Name + status */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate leading-tight">
                        {child.client_name}
                    </h3>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md ${
                        isPresent
                            ? 'text-green-600 dark:text-green-500 bg-green-500/10'
                            : 'text-zinc-500 dark:text-zinc-600 bg-zinc-200 dark:bg-zinc-800/50'
                    }`}>
                        {isPresent ? 'Present' : 'Absent'}
                    </span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5 shrink-0">
                    <button
                        onClick={() => onViewHistory(child)}
                        className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-600 dark:text-zinc-500
                                   hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center justify-center transition-all
                                   border border-zinc-200 dark:border-zinc-700/40 hover:border-zinc-300 dark:hover:border-zinc-600/60"
                        title="View History"
                    >
                        <History size={15} />
                    </button>
                    {/* Accordion toggle — all screens */}
                    <button
                        onClick={() => onToggleCard(child.client_id)}
                        className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-600 dark:text-zinc-500
                                   hover:text-zinc-900 dark:hover:text-zinc-200 flex items-center justify-center transition-all
                                   border border-zinc-200 dark:border-zinc-700/40 hover:border-zinc-300 dark:hover:border-zinc-600/60"
                    >
                        <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.22 }}
                        >
                            <ChevronDown size={15} />
                        </motion.div>
                    </button>
                </div>
            </div>

            {/* ── Exercise Inputs (accordion) ── */}
            <AnimatePresence initial={false}>
                {isPresent && isExpanded && (
                    <motion.div
                        key="inputs"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 space-y-2 border-t border-zinc-100 dark:border-zinc-800/40 pt-3">
                            {exercises
                                .filter(e => e.name.trim())
                                .map(ex => {
                                    const noteKey = `${child.client_id}_${ex.id}`;
                                    const prevPerf = prevHistory[String(child.client_id)]?.[ex.name];
                                    return (
                                        <ExerciseBlock
                                            key={ex.id}
                                            ex={ex}
                                            clientId={child.client_id}
                                            perfData={performance[child.client_id]?.[ex.id]}
                                            noteOpen={expandedNotes[noteKey] || Boolean(performance[child.client_id]?.[ex.id]?.note)}
                                            prevPerf={prevPerf}
                                            historyLoading={historyLoading}
                                            onUpdatePerf={onUpdatePerformance}
                                            onToggleNote={onToggleNote}
                                        />
                                    );
                                })
                            }

                            {/* General session note */}
                            <div className="pt-1">
                                <div className="relative">
                                    <FileText size={12} className="absolute left-3 top-3 text-zinc-400 dark:text-zinc-600 pointer-events-none" />
                                    <textarea
                                        placeholder="Session note…"
                                        value={sessionNote || ''}
                                        onChange={e => onUpdateSessionNote(child.client_id, e.target.value)}
                                        className="w-full bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 rounded-xl
                                                   py-2.5 pl-8 pr-3 text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600
                                                   focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60
                                                   transition-all duration-200 resize-none h-14"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
});

// ─── Main Component ───────────────────────────────────────────────────────────
const ActiveGroupSession = ({ day, children, onClose, initialExercises }) => {
    const [mode,              setMode]              = useState('SETUP');
    const [isSubmitting,      setIsSubmitting]      = useState(false);
    const [toast,             setToast]             = useState(null);
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);

    // ── Exercise list ─────────────────────────────────────────────────────
    const [exercises, setExercises] = useState([
        { id: Date.now(), name: '', category: 'weight', sets_count: 4 },
    ]);

    // ── Attendance ────────────────────────────────────────────────────────
    const [attendance, setAttendance] = useState(
        () => children.reduce((acc, c) => ({ ...acc, [c.client_id]: true }), {})
    );

    // ── Accordion state ───────────────────────────────────────────────────
    const [expandedCards, setExpandedCards] = useState(
        () => children.reduce((acc, c) => ({ ...acc, [c.client_id]: true }), {})
    );

    // ── Performance data ──────────────────────────────────────────────────
    const [performance,   setPerformance]   = useState({});
    const [sessionNotes,  setSessionNotes]  = useState({});
    const [expandedNotes, setExpandedNotes] = useState({});

    // ── Smart history ─────────────────────────────────────────────────────
    const [prevHistory,    setPrevHistory]   = useState({});
    const [historyLoading, setHistoryLoading] = useState(false);

    // ── Child history drawer ──────────────────────────────────────────────
    const [historyChild,   setHistoryChild]   = useState(null);
    const [historyData,    setHistoryData]    = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // ── Templates ─────────────────────────────────────────────────────────
    const [templates,     setTemplates]     = useState([]);
    const [showTemplates, setShowTemplates] = useState(false);
    const [templateName,  setTemplateName]  = useState('');

    const showToast = useCallback((message, type = 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // ── Load initial exercises (repeat session) ───────────────────────────
    useEffect(() => {
        if (initialExercises?.length > 0) {
            setExercises(initialExercises.map(e => ({
                id:         Date.now() + Math.random(),
                name:       e.name || '',
                category:   e.category || _legacyTypeToCategory(e.type),
                sets_count: e.sets_count || 4,
            })));
        }
    }, []); // eslint-disable-line

    // ── Load templates ────────────────────────────────────────────────────
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

    // ── Fetch smart history when entering LIVE mode ───────────────────────
    const fetchBulkHistory = useCallback(async (exerciseList) => {
        const exerciseNames = exerciseList.map(e => e.name).filter(Boolean);
        const clientIds     = children.map(c => c.client_id);
        if (!exerciseNames.length || !clientIds.length) return;

        setHistoryLoading(true);
        try {
            const res = await api.post('/group-training/bulk_exercise_history/', {
                day_name:       day,
                exercise_names: exerciseNames,
                client_ids:     clientIds,
            });
            setPrevHistory(res.data || {});
        } catch {
            setPrevHistory({});
        } finally {
            setHistoryLoading(false);
        }
    }, [children, day]);

    // ── Template helpers ──────────────────────────────────────────────────
    const handleSaveTemplate = useCallback(async () => {
        if (!templateName.trim()) return;
        try {
            await api.post('/group-templates/', {
                name:      templateName.trim(),
                exercises: exercises.map(({ name, category, sets_count }) => ({ name, category, sets_count })),
            });
            setTemplateName('');
            fetchTemplates();
            showToast('Template saved!', 'success');
        } catch {
            showToast('Failed to save template.');
        }
    }, [templateName, exercises, fetchTemplates, showToast]);

    const handleDeleteTemplate = useCallback(async (id, e) => {
        e.stopPropagation();
        try {
            await api.delete(`/group-templates/${id}/`);
            fetchTemplates();
        } catch {
            showToast('Failed to delete template.');
        }
    }, [fetchTemplates, showToast]);

    // ── Deep-dive child history (side panel) ──────────────────────────────
    const fetchChildHistory = useCallback(async (child) => {
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
    }, [showToast]);

    // ── Exercise helpers ──────────────────────────────────────────────────
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
        setExercises(prev => [
            ...prev,
            { id: Date.now() + Math.random(), name: '', category: 'weight', sets_count: 4 },
        ]);
    }, []);

    // ── Performance helpers (stable refs for memo children) ───────────────
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

    const toggleCard = useCallback((clientId) => {
        setExpandedCards(prev => ({ ...prev, [clientId]: !prev[clientId] }));
    }, []);

    const updateSessionNote = useCallback((clientId, value) => {
        setSessionNotes(prev => ({ ...prev, [clientId]: value }));
    }, []);

    // ── Complete session ──────────────────────────────────────────────────
    const handleComplete = useCallback(async () => {
        setIsSubmitting(true);
        setShowFinishConfirm(false);

        const summary = exercises.map(ex => ({
            name:       ex.name,
            category:   ex.category,
            sets_count: Number(ex.sets_count) || 0,
            results:    children
                .filter(c => attendance[c.client_id])
                .map(c => ({
                    client:    c.client_name,
                    client_id: c.client_id,
                    ...performance[c.client_id]?.[ex.id],
                })),
        }));

        const participants = children
            .filter(c => attendance[c.client_id])
            .map(c => ({
                client_id: c.client_id,
                note:      sessionNotes[c.client_id] || 'Completed',
            }));

        try {
            await api.post('/group-training/complete_session/', {
                day_name:     day,
                exercises:    summary,
                participants,
            });
            onClose();
        } catch {
            showToast('Error saving session. Please try again.');
            setIsSubmitting(false);
        }
    }, [exercises, children, attendance, performance, sessionNotes, day, onClose, showToast]);

    // Memoize valid exercises for LIVE mode
    const validExercises = useMemo(
        () => exercises.filter(e => e.name.trim()),
        [exercises]
    );

    const presentCount = useMemo(
        () => children.filter(c => attendance[c.client_id]).length,
        [children, attendance]
    );

    // ─────────────────────────────────────────────────────────────────────
    // SETUP MODE
    // ─────────────────────────────────────────────────────────────────────
    if (mode === 'SETUP') return (
        <div className="fixed inset-0 z-[200] bg-zinc-50 dark:bg-[#09090b] flex flex-col text-zinc-900 dark:text-white transition-colors duration-300">
            {/* Header */}
            <div className="shrink-0 py-4 px-4 md:px-8 bg-white dark:bg-[#111113] border-b border-zinc-200 dark:border-zinc-800/60
                            flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors duration-300">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
                        <span className="bg-blue-500/10 text-blue-500 dark:text-blue-400 p-2 rounded-xl border border-blue-500/20">
                            <Settings2 size={18} />
                        </span>
                        Session Planner
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1 ml-1">
                        {day} · <span className="text-zinc-600 dark:text-zinc-300 font-medium">{children.length} Athletes</span>
                    </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-semibold text-sm
                                    transition-all duration-200 flex items-center justify-center gap-2
                                    border ${
                            showTemplates
                                ? 'bg-zinc-200 dark:bg-zinc-100 text-zinc-900 border-zinc-300 dark:border-zinc-100'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600'
                        }`}
                    >
                        <LayoutTemplate size={15} /> Templates
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 text-zinc-500 dark:text-zinc-500
                                   hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/30 transition-all duration-200"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Planner */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-28">
                    <div className="max-w-4xl mx-auto space-y-3">
                        <AnimatePresence initial={false}>
                            {exercises.map((ex, idx) => {
                                const catConfig = getCategoryConfig(ex.category);
                                const CatIcon   = catConfig.icon;
                                return (
                                    <motion.div
                                        key={ex.id}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                        transition={{ duration: 0.2 }}
                                        className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 rounded-2xl
                                                   p-4 md:p-5 shadow-sm dark:shadow-none hover:border-zinc-300 dark:hover:border-zinc-700/70
                                                   transition-colors duration-200 group"
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Index */}
                                            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-xl
                                                             bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 text-zinc-500
                                                             font-bold text-xs group-hover:border-zinc-300 dark:group-hover:border-zinc-700 transition-colors">
                                                {idx + 1}
                                            </span>

                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-3">
                                                {/* Category */}
                                                <div className="col-span-1 md:col-span-3">
                                                    <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-wider ml-0.5 mb-1.5 block">
                                                        Category
                                                    </label>
                                                    <div className="relative">
                                                        <select
                                                            value={ex.category}
                                                            onChange={e => updateExercise(idx, 'category', e.target.value)}
                                                            className="w-full h-10 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/50
                                                                       rounded-xl pl-8 pr-3 font-semibold text-sm text-zinc-900 dark:text-white
                                                                       appearance-none focus:outline-none focus:ring-2
                                                                       focus:ring-blue-500/20 focus:border-blue-500/60
                                                                       cursor-pointer transition-all duration-200"
                                                        >
                                                            {CATEGORIES.map(c => (
                                                                <option key={c.value} value={c.value}>
                                                                    {c.label} / {c.labelAr}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <CatIcon size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${catConfig.color}`} />
                                                    </div>
                                                </div>

                                                {/* Sets */}
                                                <div className="col-span-1 md:col-span-2">
                                                    <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-wider ml-0.5 mb-1.5 block">
                                                        Sets
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="20"
                                                        value={ex.sets_count}
                                                        onChange={e => updateExercise(idx, 'sets_count', e.target.value)}
                                                        className="w-full h-10 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/50
                                                                   rounded-xl px-3 text-center font-bold text-zinc-900 dark:text-white text-sm
                                                                   focus:outline-none focus:ring-2 focus:ring-blue-500/20
                                                                   focus:border-blue-500/60 transition-all duration-200"
                                                    />
                                                </div>

                                                {/* Name */}
                                                <div className="col-span-2 md:col-span-7">
                                                    <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-wider ml-0.5 mb-1.5 block">
                                                        Exercise Name
                                                    </label>
                                                    <input
                                                        value={ex.name}
                                                        onChange={e => updateExercise(idx, 'name', e.target.value)}
                                                        placeholder="e.g. Barbell Squat"
                                                        className="w-full h-10 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/50
                                                                   rounded-xl px-4 text-sm font-semibold text-zinc-900 dark:text-white
                                                                   placeholder-zinc-400 dark:placeholder-zinc-600
                                                                   focus:outline-none focus:ring-2 focus:ring-blue-500/20
                                                                   focus:border-blue-500/60 transition-all duration-200"
                                                    />
                                                </div>
                                            </div>

                                            {/* Delete */}
                                            <button
                                                onClick={() => removeExercise(ex.id)}
                                                className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 text-zinc-500 dark:text-zinc-600
                                                           hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/30
                                                           transition-all duration-200 shrink-0 mt-5"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>

                        {/* Add exercise */}
                        <button
                            onClick={addExercise}
                            className="w-full h-14 border border-dashed border-zinc-300 dark:border-zinc-800/80 rounded-2xl
                                       text-zinc-500 dark:text-zinc-600 font-semibold text-sm flex items-center justify-center gap-2.5
                                       hover:bg-zinc-100 dark:hover:bg-zinc-900/40 hover:border-zinc-400 dark:hover:border-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-400
                                       transition-all duration-200"
                        >
                            <span className="bg-zinc-100 dark:bg-zinc-800/60 p-1.5 rounded-lg">
                                <Dumbbell size={14} className="text-zinc-400 dark:text-zinc-500" />
                            </span>
                            Add Exercise
                        </button>
                    </div>
                </div>

                {/* Templates Sidebar */}
                <AnimatePresence>
                    {showTemplates && (
                        <motion.div
                            key="templates"
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                            className="absolute md:relative inset-0 md:inset-auto z-10 md:z-auto
                                       w-full md:w-96 border-l border-zinc-200 dark:border-zinc-800/60
                                       bg-white dark:bg-[#111113] p-6 flex flex-col transition-colors duration-300"
                        >
                            <div className="flex justify-between items-center mb-5">
                                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Workout Templates</h3>
                                <button
                                    onClick={() => setShowTemplates(false)}
                                    className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Save current */}
                            <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 p-4 rounded-xl mb-4">
                                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-wider mb-2 block">
                                    Save Current Plan
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        value={templateName}
                                        onChange={e => setTemplateName(e.target.value)}
                                        placeholder="Template name…"
                                        className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-3 py-2.5
                                                   text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600
                                                   focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60
                                                   transition-all duration-200"
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSaveTemplate(); } }}
                                    />
                                    <button
                                        onClick={handleSaveTemplate}
                                        className="p-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-white transition-colors"
                                    >
                                        <Save size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2.5">
                                {templates.length === 0 ? (
                                    <p className="text-sm text-zinc-500 dark:text-zinc-600 text-center py-10">No templates saved yet.</p>
                                ) : templates.map(t => (
                                    <div
                                        key={t.id}
                                        onClick={() => {
                                            setExercises(t.exercises.map(e => ({
                                                id:         Date.now() + Math.random(),
                                                name:       e.name || '',
                                                category:   e.category || _legacyTypeToCategory(e.type),
                                                sets_count: e.sets_count || 4,
                                            })));
                                            setShowTemplates(false);
                                        }}
                                        className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/60 rounded-xl
                                                   hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer group
                                                   relative transition-all duration-200"
                                    >
                                        <div className="flex justify-between items-start pr-6">
                                            <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-200 truncate">{t.name}</p>
                                            <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500 px-2 py-0.5 rounded-md shrink-0 ml-2">
                                                {t.exercises.length}
                                            </span>
                                        </div>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-600 truncate mt-1">{t.exercises.map(e => e.name).join(', ')}</p>
                                        <button
                                            onClick={e => handleDeleteTemplate(t.id, e)}
                                            className="absolute top-3 right-3 p-1.5 text-zinc-500 dark:text-zinc-600 hover:text-red-600 dark:hover:text-red-400
                                                       opacity-0 group-hover:opacity-100 transition-all bg-zinc-200 dark:bg-zinc-800 rounded-lg"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer — backdrop blur */}
            <div className="fixed bottom-0 left-0 right-0 z-[210] backdrop-blur-md bg-white/90 dark:bg-[#09090b]/90
                            border-t border-zinc-200 dark:border-zinc-800/60 flex items-center justify-end px-4 md:px-8 py-4">
                <button
                    onClick={() => {
                        if (!validExercises.length) {
                            showToast('Add at least one exercise before starting.');
                            return;
                        }
                        setMode('LIVE');
                        fetchBulkHistory(validExercises);
                    }}
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white
                               px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 dark:shadow-blue-900/30
                               flex items-center justify-center gap-2.5 active:scale-95
                               transition-all duration-200"
                >
                    <Zap size={17} />
                    Start Session
                    <ArrowRight size={17} />
                </button>
            </div>

            <AnimatePresence>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </AnimatePresence>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────────
    // LIVE MODE
    // ─────────────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[200] bg-zinc-50 dark:bg-[#09090b] flex flex-col text-zinc-900 dark:text-white transition-colors duration-300">

            {/* Live Header */}
            <div className="shrink-0 h-16 md:h-[4.5rem] bg-white dark:bg-[#111113] border-b border-zinc-200 dark:border-zinc-800/60
                            flex items-center justify-between px-4 md:px-6 z-20 shadow-lg shadow-zinc-200/50 dark:shadow-black/40">
                <div className="flex items-center gap-3">
                    {/* Back to planner */}
                    <button
                        onClick={() => setMode('SETUP')}
                        className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-400
                                   hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600
                                   p-2.5 md:px-4 md:py-2 rounded-xl flex items-center gap-2
                                   transition-all duration-200"
                    >
                        <Settings2 size={16} />
                        <span className="hidden md:inline text-xs font-bold uppercase tracking-wider">Edit Plan</span>
                    </button>

                    <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-800" />

                    {/* Session info */}
                    <div>
                        <span className="text-sm font-bold text-zinc-900 dark:text-white">{day}</span>
                        <span className="text-xs text-zinc-500 ml-2">{validExercises.length} exercises</span>
                    </div>

                    {/* History loading indicator */}
                    {historyLoading && (
                        <span className="flex items-center gap-1.5 text-xs text-zinc-500 ml-2">
                            <Loader2 size={12} className="animate-spin" /> Fetching history…
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    {/* Present count badge */}
                    <span className="hidden md:flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400
                                     bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 px-3 py-1.5 rounded-xl">
                        <CheckCircle2 size={12} className="text-green-500" />
                        {presentCount} / {children.length}
                    </span>

                    <button
                        onClick={() => setShowFinishConfirm(true)}
                        disabled={isSubmitting}
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 md:px-5 md:py-2.5
                                   rounded-xl font-bold text-sm shadow-lg shadow-green-500/20 dark:shadow-green-900/30
                                   flex items-center gap-2 transition-all duration-200 active:scale-95
                                   disabled:opacity-60"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                        <span className="hidden md:inline">Finish Session</span>
                        <span className="md:hidden">Finish</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 rounded-xl text-zinc-500
                                   hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-200"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Live Content — Athlete Grid */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-4">
                    {children.map(child => (
                        <AthleteCard
                            key={child.client_id}
                            child={child}
                            isPresent={attendance[child.client_id]}
                            isExpanded={expandedCards[child.client_id]}
                            exercises={validExercises}
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

            {/* ── Finish Confirm Modal ── */}
            <AnimatePresence>
                {showFinishConfirm && (
                    <>
                        <motion.div
                            key="overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowFinishConfirm(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[340]"
                        />
                        <motion.div
                            key="modal"
                            initial={{ opacity: 0, scale: 0.93, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 8 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className="fixed inset-0 z-[350] flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/60 w-full max-w-sm
                                            rounded-2xl p-6 shadow-2xl text-center pointer-events-auto">
                                <div className="w-14 h-14 mx-auto rounded-full bg-green-500/10 border border-green-500/20
                                                flex items-center justify-center text-green-500 mb-4">
                                    <CheckCircle2 size={26} />
                                </div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1.5">Finish Session?</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-500 mb-6">
                                    Saves session and deducts from subscriptions for{' '}
                                    <span className="font-bold text-zinc-900 dark:text-zinc-200">{presentCount}</span> attending athletes.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setShowFinishConfirm(false)}
                                        className="py-3 rounded-xl font-semibold text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400
                                                   hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleComplete}
                                        className="py-3 rounded-xl font-bold text-sm bg-green-600 text-white
                                                   hover:bg-green-500 transition-all shadow-lg shadow-green-500/20
                                                   flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Confirm'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Child History Drawer ── */}
            <AnimatePresence>
                {historyChild && (
                    <>
                        <motion.div
                            key="hdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setHistoryChild(null)}
                            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm"
                        />
                        <motion.div
                            key="hdrawer"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                            className="fixed inset-y-0 right-0 z-[310] w-full max-w-md bg-white dark:bg-[#111113]
                                       border-l border-zinc-200 dark:border-zinc-800/60 flex flex-col shadow-2xl transition-colors duration-300"
                        >
                            {/* Drawer header */}
                            <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden border border-zinc-200 dark:border-zinc-700/50
                                                    flex items-center justify-center shrink-0">
                                        {historyChild.client_photo
                                            ? <img src={historyChild.client_photo} className="w-full h-full object-cover" alt="" />
                                            : <User size={16} className="text-zinc-400 dark:text-zinc-500" />
                                        }
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-zinc-900 dark:text-white">{historyChild.client_name}</h2>
                                        <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                                            Performance History
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setHistoryChild(null)}
                                    className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                {loadingHistory ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-zinc-500 dark:text-zinc-600 gap-3">
                                        <Loader2 className="animate-spin" size={24} />
                                        <span className="text-sm">Loading records…</span>
                                    </div>
                                ) : historyData.length === 0 ? (
                                    <div className="text-center py-16 text-zinc-400 dark:text-zinc-600">
                                        <Activity size={36} className="mx-auto mb-3 opacity-30" />
                                        <p className="text-sm">No workout history found.</p>
                                    </div>
                                ) : historyData.map(session => (
                                    <div key={session.id}
                                         className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/60 rounded-xl overflow-hidden">
                                        <div className="px-3.5 py-2.5 bg-zinc-100 dark:bg-zinc-900 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800/50">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={12} className="text-blue-500 dark:text-blue-400" />
                                                <span className="font-semibold text-zinc-800 dark:text-zinc-300 text-sm">
                                                    {new Date(session.date).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500 px-2 py-0.5 rounded-md">
                                                {session.day_name}
                                            </span>
                                        </div>
                                        <div className="p-2.5 space-y-1.5">
                                            {(!session.performance || session.performance.length === 0) ? (
                                                <p className="text-xs text-zinc-500 dark:text-zinc-600 italic px-1">Attended — no data recorded.</p>
                                            ) : session.performance.map((p, pidx) => {
                                                const fields = getInputFields(p.category || 'weight');
                                                return (
                                                    <div key={pidx}
                                                         className="flex justify-between items-center bg-white dark:bg-zinc-900/50 rounded-lg p-2.5
                                                                    hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors shadow-sm dark:shadow-none">
                                                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-400 truncate max-w-[9rem]">
                                                            {p.exercise}
                                                        </span>
                                                        <div className="flex gap-1.5">
                                                            {p.val1 && p.val1 !== '-' && (
                                                                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg font-mono border border-zinc-200 dark:border-zinc-700/50">
                                                                    {p.val1} {fields.f1.unit}
                                                                </span>
                                                            )}
                                                            {fields.f2 && p.val2 && p.val2 !== '-' && (
                                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg font-mono border border-blue-500/20">
                                                                    {p.val2} {fields.f2.unit}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {session.session_note && (
                                                <p className="text-[11px] text-zinc-500 italic px-1 pt-1">
                                                    "{session.session_note}"
                                                </p>
                                            )}
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

export default ActiveGroupSession;