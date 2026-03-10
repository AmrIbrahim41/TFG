import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Save, Dumbbell, Repeat, Timer,
    Settings2, ArrowRight, Trash2,
    LayoutTemplate, AlertCircle, CheckCircle2, Zap
} from 'lucide-react';
import api from '../../api';

// ─── Category config ─────────────────────────────────────────────────────────
const CATEGORIES = [
    { value: 'weight', label: 'Weight', labelAr: 'وزن', icon: Dumbbell, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/20' },
    { value: 'reps', label: 'Reps', labelAr: 'عدات', icon: Repeat, color: 'text-violet-500 dark:text-violet-400', bg: 'bg-violet-500/10', ring: 'ring-violet-500/20' },
    { value: 'time', label: 'Time', labelAr: 'وقت', icon: Timer, color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20' },
];

const getCategoryConfig = (cat) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];

function _legacyTypeToCategory(type = '') {
    const map = { strength: 'weight', cardio: 'time', time: 'time', weight: 'weight', reps: 'reps' };
    return map[type.toLowerCase()] || 'weight';
}

// ─── Toast Component ─────────────────────────────────────────────────────────
const Toast = React.memo(({ message, type = 'error', onClose }) => (
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

// ─── Main Component ──────────────────────────────────────────────────────────
const SessionPlanner = ({ day, childrenCount, initialExercises = [], onClose, onStartLiveSession }) => {
    const [toast, setToast] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [showTemplates, setShowTemplates] = useState(false);
    const [templateName, setTemplateName] = useState('');

    // Initialize exercises securely
    const [exercises, setExercises] = useState(() => {
        if (initialExercises && initialExercises.length > 0) {
            return initialExercises.map(e => ({
                id: Date.now() + Math.random(),
                name: e.name || '',
                category: e.category || _legacyTypeToCategory(e.type),
                sets_count: e.sets_count || 4,
            }));
        }
        return [{ id: Date.now(), name: '', category: 'weight', sets_count: 4 }];
    });

    const showToast = useCallback((message, type = 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // ── Load templates ────────────────────────────────────────────────────
    const fetchTemplates = useCallback(async () => {
        try {
            const res = await api.get('/group-templates/');
            setTemplates(res.data.results || res.data);
        } catch (e) {
            console.error('Template fetch error', e);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        api.get('/group-templates/')
            .then(res => { if (!cancelled) setTemplates(res.data.results || res.data); })
            .catch(err => console.error('Template error', err));
        return () => { cancelled = true; };
    }, []);

    // ── Template Handlers ─────────────────────────────────────────────────
    const handleSaveTemplate = useCallback(async () => {
        if (!templateName.trim()) return;
        try {
            await api.post('/group-templates/', {
                name: templateName.trim(),
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

    // ── Exercise Handlers ─────────────────────────────────────────────────
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

    const handleStartSession = () => {
        const validExercises = exercises.filter(e => e.name.trim());
        if (!validExercises.length) {
            showToast('Add at least one exercise before starting.');
            return;
        }
        onStartLiveSession(validExercises);
    };

    return (
        // التعديل الرئيسي هنا: تحويل الـ div إلى motion.div وإضافة الأنيميشن
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-zinc-50 dark:bg-[#09090b] flex flex-col text-zinc-900 dark:text-white transition-colors duration-300"
        >
            {/* Header */}
            <div className="shrink-0 py-4 px-4 md:px-8 bg-white dark:bg-[#111113] border-b border-zinc-200 dark:border-zinc-800/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors duration-300">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
                        <span className="bg-blue-500/10 text-blue-500 dark:text-blue-400 p-2 rounded-xl border border-blue-500/20">
                            <Settings2 size={18} />
                        </span>
                        Session Planner
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1 ml-1">
                        {day} · <span className="text-zinc-600 dark:text-zinc-300 font-medium">{childrenCount} Athletes</span>
                    </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 border ${
                            showTemplates
                                ? 'bg-zinc-200 dark:bg-zinc-100 text-zinc-900 border-zinc-300 dark:border-zinc-100'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600'
                        }`}
                    >
                        <LayoutTemplate size={15} /> Templates
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 text-zinc-500 dark:text-zinc-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/30 transition-all duration-200"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Planner Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-28">
                    <div className="max-w-4xl mx-auto space-y-3">
                        <AnimatePresence initial={false}>
                            {exercises.map((ex, idx) => {
                                const catConfig = getCategoryConfig(ex.category);
                                const CatIcon = catConfig.icon;
                                return (
                                    <motion.div
                                        key={ex.id}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                        transition={{ duration: 0.2 }}
                                        className="bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800/60 rounded-2xl p-4 md:p-5 shadow-sm dark:shadow-none hover:border-zinc-300 dark:hover:border-zinc-700/70 transition-colors duration-200 group"
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Index Badge */}
                                            <span className="w-8 h-8 shrink-0 flex items-center justify-center rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 text-zinc-500 font-bold text-xs group-hover:border-zinc-300 dark:group-hover:border-zinc-700 transition-colors">
                                                {idx + 1}
                                            </span>

                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-3">
                                                {/* Category Selector */}
                                                <div className="col-span-1 md:col-span-3">
                                                    <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-wider ml-0.5 mb-1.5 block">
                                                        Category
                                                    </label>
                                                    <div className="relative">
                                                        <select
                                                            value={ex.category}
                                                            onChange={e => updateExercise(idx, 'category', e.target.value)}
                                                            className="w-full h-10 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/50 rounded-xl pl-8 pr-3 font-semibold text-sm text-zinc-900 dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60 cursor-pointer transition-all duration-200"
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

                                                {/* Sets Input */}
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
                                                        className="w-full h-10 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-3 text-center font-bold text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60 transition-all duration-200"
                                                    />
                                                </div>

                                                {/* Name Input */}
                                                <div className="col-span-2 md:col-span-7">
                                                    <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-wider ml-0.5 mb-1.5 block">
                                                        Exercise Name
                                                    </label>
                                                    <input
                                                        value={ex.name}
                                                        onChange={e => updateExercise(idx, 'name', e.target.value)}
                                                        placeholder="e.g. Barbell Squat"
                                                        className="w-full h-10 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-4 text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60 transition-all duration-200"
                                                    />
                                                </div>
                                            </div>

                                            {/* Delete Button */}
                                            <button
                                                onClick={() => removeExercise(ex.id)}
                                                className="p-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 text-zinc-500 dark:text-zinc-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/30 transition-all duration-200 shrink-0 mt-5"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>

                        {/* Add Exercise Button */}
                        <button
                            onClick={addExercise}
                            className="w-full h-14 border border-dashed border-zinc-300 dark:border-zinc-800/80 rounded-2xl text-zinc-500 dark:text-zinc-600 font-semibold text-sm flex items-center justify-center gap-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-900/40 hover:border-zinc-400 dark:hover:border-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-400 transition-all duration-200"
                        >
                            <span className="bg-zinc-100 dark:bg-zinc-800/60 p-1.5 rounded-lg">
                                <Dumbbell size={14} className="text-zinc-400 dark:text-zinc-500" />
                            </span>
                            Add Exercise
                        </button>
                    </div>
                </div>

                {/* Templates Sidebar Drawer */}
                <AnimatePresence>
                    {showTemplates && (
                        <motion.div
                            key="templates"
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                            className="absolute md:relative inset-0 md:inset-auto z-10 md:z-auto w-full md:w-96 border-l border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-[#111113] p-6 flex flex-col transition-colors duration-300"
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

                            {/* Save Current Template */}
                            <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 p-4 rounded-xl mb-4">
                                <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-wider mb-2 block">
                                    Save Current Plan
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        value={templateName}
                                        onChange={e => setTemplateName(e.target.value)}
                                        placeholder="Template name…"
                                        className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/50 rounded-xl px-3 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/60 transition-all duration-200"
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
                                                id: Date.now() + Math.random(),
                                                name: e.name || '',
                                                category: e.category || _legacyTypeToCategory(e.type),
                                                sets_count: e.sets_count || 4,
                                            })));
                                            setShowTemplates(false);
                                        }}
                                        className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/60 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer group relative transition-all duration-200"
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
                                            className="absolute top-3 right-3 p-1.5 text-zinc-500 dark:text-zinc-600 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all bg-zinc-200 dark:bg-zinc-800 rounded-lg"
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

            {/* Sticky Frosted Footer */}
            <div className="fixed bottom-0 left-0 right-0 z-[210] backdrop-blur-md bg-white/90 dark:bg-[#09090b]/90 border-t border-zinc-200 dark:border-zinc-800/60 flex items-center justify-end px-4 md:px-8 py-4">
                <button
                    onClick={handleStartSession}
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 dark:shadow-blue-900/30 flex items-center justify-center gap-2.5 active:scale-95 transition-all duration-200"
                >
                    <Zap size={17} />
                    Start Session
                    <ArrowRight size={17} />
                </button>
            </div>

            <AnimatePresence>
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </AnimatePresence>
        {/* التعديل هنا أيضاً بإغلاق التاج الجديد */}
        </motion.div>
    );
};

export default SessionPlanner;