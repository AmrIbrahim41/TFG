/**
 * WorkoutEditor.jsx — Premium Elite Edition v6
 * UI/UX Redesign: Glassmorphism, Advanced Framer Motion, Mobile-First Grid
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter, defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, sortableKeyboardCoordinates,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  ArrowLeft, Save, Plus, Trash2, CheckCircle, Dumbbell, Activity, Settings,
  Zap, Layers, TrendingUp, ArrowDown, Grip, History, X, FileText,
  MoreVertical, ChevronRight, Calendar, User, Download, Type, MessageSquare,
  Lock, Copy, RotateCcw, AlertTriangle, CheckCircle2, GripVertical,
  ChevronUp, ChevronDown, BarChart2, Flame,
} from 'lucide-react';

import api from '../api';
import toast, { Toaster } from 'react-hot-toast';
import WorkoutPDF_EN from '../utils/WorkoutPDF.jsx';
import { PDFDownloadLink } from '@react-pdf/renderer';

// ─────────────────────────────────────────────────────────────────────────────
// UTILS & CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

let _dndCounter = 0;
const nextDndId = () => `ex-${++_dndCounter}`;

const UserIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const TECHNIQUE_CONFIG = {
  Regular:     { color: 'text-zinc-500 dark:text-zinc-400', accent: 'border-l-transparent', bg: 'bg-zinc-50/50 dark:bg-zinc-900/30', badge: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700', icon: Activity },
  'Drop Set':  { color: 'text-red-500 dark:text-red-400', accent: 'border-l-red-500', bg: 'bg-red-50/30 dark:bg-red-900/10', badge: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30', icon: ArrowDown },
  'Super Set': { color: 'text-purple-500 dark:text-purple-400', accent: 'border-l-purple-500', bg: 'bg-purple-50/30 dark:bg-purple-900/10', badge: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30', icon: Layers },
  Pyramid:     { color: 'text-amber-500 dark:text-amber-400', accent: 'border-l-amber-500', bg: 'bg-amber-50/30 dark:bg-amber-900/10', badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30', icon: TrendingUp },
  Negative:    { color: 'text-blue-500 dark:text-blue-400', accent: 'border-l-blue-500', bg: 'bg-blue-50/30 dark:bg-blue-900/10', badge: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30', icon: Zap },
};

const EQUIP_CONFIG = {
  Bodyweight: { color: 'text-emerald-500 dark:text-emerald-400', icon: UserIcon },
  Dumbbell:   { color: 'text-blue-500 dark:text-blue-400',       icon: Dumbbell },
  Barbell:    { color: 'text-zinc-600 dark:text-zinc-300',       icon: Grip     },
  Cable:      { color: 'text-cyan-500 dark:text-cyan-400',       icon: Zap      },
  Machine:    { color: 'text-indigo-500 dark:text-indigo-400',   icon: Settings },
};

const EMPTY_EXERCISE = () => ({
  dndId: nextDndId(),
  name: '',
  note: '',
  sets: [{ reps: '', weight: '', technique: 'Regular', equipment: '' }],
});

// ─────────────────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const InputHideArrows = " [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield] ";

const ConfirmModal = memo(({ open, title, message, confirmLabel, onConfirm, onCancel, variant = 'default' }) => {
  const isDestructive = variant === 'destructive';
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/60 backdrop-blur-md">
          <motion.div initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }} className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 rounded-3xl shadow-2xl p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className={cn("w-14 h-14 rounded-full flex items-center justify-center mb-4 ring-4", isDestructive ? "bg-red-100 text-red-600 ring-red-50 dark:bg-red-500/20 dark:text-red-400 dark:ring-red-500/10" : "bg-orange-100 text-orange-600 ring-orange-50 dark:bg-orange-500/20 dark:text-orange-400 dark:ring-orange-500/10")}>
                {isDestructive ? <AlertTriangle size={24} strokeWidth={2.5} /> : <CheckCircle2 size={24} strokeWidth={2.5} />}
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{title}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">{message}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm transition-all active:scale-95">Cancel</button>
              <button onClick={onConfirm} className={cn("flex-1 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 text-white shadow-lg", isDestructive ? "bg-red-600 hover:bg-red-500 shadow-red-500/25" : "bg-orange-600 hover:bg-orange-500 shadow-orange-500/25")}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

const StatPill = ({ icon: Icon, value, label, color = 'text-zinc-600 dark:text-zinc-300' }) => (
  <span className={cn("flex items-center gap-1.5 text-xs font-bold bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-white/[0.08] px-3 py-1.5 rounded-full backdrop-blur-md shadow-sm", color)}>
    <Icon size={14} className="opacity-80" /><span>{value}</span>{label && <span className="opacity-50 font-medium ml-[-2px]">{label}</span>}
  </span>
);

const DropPlaceholder = () => (
  <div className="rounded-3xl border-2 border-dashed border-orange-400/50 dark:border-orange-500/30 bg-orange-50/50 dark:bg-orange-500/5 h-[120px] flex flex-col items-center justify-center gap-3">
    <div className="w-10 h-10 rounded-full border border-orange-200 dark:border-orange-500/30 bg-white dark:bg-orange-500/10 flex items-center justify-center text-orange-500 animate-pulse">
      <ArrowDown size={20} />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// EXERCISE CARDS & SET ROWS
// ─────────────────────────────────────────────────────────────────────────────

const SetRow = memo(({ set, setIndex, exIndex, isReadOnly, dominantTech, onUpdateSet, onRemoveSet, showRemove }) => {
  const tech = TECHNIQUE_CONFIG[set.technique] || TECHNIQUE_CONFIG['Regular'];
  
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, height: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      className={cn("relative group/set overflow-hidden border-l-[3px] rounded-2xl md:rounded-xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200/60 dark:border-zinc-800", tech.accent)}
    >
      {/* Mobile Layout: 2 Rows. Desktop Layout: 1 Row */}
      <div className="p-3 md:p-2 flex flex-col md:flex-row gap-3 md:items-center">
        
        {/* Row 1 (Mobile) / Left Side (Desktop): Set #, Reps, Weight, Delete */}
        <div className="flex items-center gap-3 w-full md:w-auto md:flex-1">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0", tech.badge)}>
            {setIndex + 1}
          </div>
          
          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-zinc-400 select-none">Reps</span>
              <input type="number" inputMode="numeric" placeholder="0" value={set.reps || ''} disabled={isReadOnly} onChange={(e) => onUpdateSet(exIndex, setIndex, 'reps', e.target.value)} 
                className={cn("w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-xl py-2 pl-12 pr-3 text-right text-sm font-black text-zinc-900 dark:text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all disabled:opacity-60", InputHideArrows)} />
            </div>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-zinc-400 select-none">Kg</span>
              <input type="number" inputMode="decimal" placeholder="0.0" value={set.weight || ''} disabled={isReadOnly} onChange={(e) => onUpdateSet(exIndex, setIndex, 'weight', e.target.value)} 
                className={cn("w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-xl py-2 pl-9 pr-3 text-right text-sm font-black text-zinc-900 dark:text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all disabled:opacity-60", InputHideArrows)} />
            </div>
          </div>

          {/* Mobile Delete Button */}
          {showRemove && !isReadOnly && (
            <button onClick={() => onRemoveSet(exIndex, setIndex)} className="md:hidden w-10 h-10 shrink-0 flex items-center justify-center text-zinc-400 hover:text-red-500 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800 active:scale-95">
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* Row 2 (Mobile) / Right Side (Desktop): Technique, Equipment */}
        <div className="flex items-center gap-2 w-full md:w-auto md:flex-[1.2]">
          <div className="relative flex-1">
            <tech.icon size={14} className={cn("absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none", tech.color)} />
            <select value={set.technique || 'Regular'} disabled={isReadOnly} onChange={(e) => onUpdateSet(exIndex, setIndex, 'technique', e.target.value)} className="w-full appearance-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl py-2 pl-9 pr-8 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all disabled:opacity-60">
              {Object.keys(TECHNIQUE_CONFIG).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={14} />
          </div>
          <div className="relative flex-1">
            <select value={set.equipment || ''} disabled={isReadOnly} onChange={(e) => onUpdateSet(exIndex, setIndex, 'equipment', e.target.value)} className="w-full appearance-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl py-2 pl-3 pr-8 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all disabled:opacity-60">
              <option value="">Equip...</option>
              {Object.keys(EQUIP_CONFIG).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={14} />
          </div>
        </div>

        {/* Desktop Delete Button */}
        {showRemove && !isReadOnly && (
          <button onClick={() => onRemoveSet(exIndex, setIndex)} className="hidden md:flex w-9 h-9 shrink-0 items-center justify-center text-zinc-400 hover:text-red-500 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800 active:scale-95 opacity-0 group-hover/set:opacity-100 transition-all">
            <X size={16} />
          </button>
        )}
      </div>
    </motion.div>
  );
});

const SortableExerciseCard = (props) => {
  const { exercise, isReadOnly } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exercise.dndId, disabled: isReadOnly });
  const style = { transform: CSS.Transform.toString(transform), transition: transition || 'transform 250ms cubic-bezier(0.2,0,0,1)' };

  if (isDragging) return <div ref={setNodeRef} style={style} className="z-50 relative"><DropPlaceholder /></div>;
  return <div ref={setNodeRef} style={style} className="relative z-10"><ExerciseCardContent {...props} dragHandleProps={{ ...attributes, ...listeners }} /></div>;
};

const ExerciseCardContent = memo(({ exercise: ex, exIndex, totalExercises, isReadOnly, dragHandleProps, onUpdate, onUpdateSet, onSetCount, onDuplicateLastSet, onClearWeights, onRemoveSet, onDelete, onMoveUp, onMoveDown, activeNoteIndex, onToggleNote }) => {
  const dominantTechnique = useMemo(() => {
    const counts = {};
    ex.sets.forEach((s) => { const t = s.technique || 'Regular'; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Regular';
  }, [ex.sets]);

  const techCfg = TECHNIQUE_CONFIG[dominantTechnique] || TECHNIQUE_CONFIG['Regular'];

  return (
    <div className="group relative bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col">
      {/* Visual Accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      {/* Header */}
      <div className="p-5 md:p-6 pb-4 flex items-start gap-4 relative z-10">
        {!isReadOnly && (
          <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
            <button {...dragHandleProps} className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors cursor-grab active:cursor-grabbing touch-none">
              <GripVertical size={18} />
            </button>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
             <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 dark:from-white dark:to-zinc-200 flex items-center justify-center text-white dark:text-black font-black text-lg select-none shadow-sm">
              {exIndex + 1}
            </div>
            <input
              value={ex.name || ''} onChange={(e) => onUpdate(exIndex, 'name', e.target.value)} disabled={isReadOnly}
              placeholder="Exercise name..."
              className="w-full bg-transparent text-xl md:text-2xl font-black text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 outline-none border-b-2 border-transparent focus:border-orange-500 transition-all pb-1 disabled:opacity-80"
            />
          </div>
          
          <div className="flex items-center gap-2 mt-3 ml-14 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold">
              {ex.sets.length} Set{ex.sets.length !== 1 ? 's' : ''}
            </span>
            {dominantTechnique !== 'Regular' && (
              <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg", techCfg.badge)}>
                <techCfg.icon size={12} />{dominantTechnique}
              </span>
            )}
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex flex-col gap-1 shrink-0">
            <button onClick={() => onDelete(exIndex)} className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all active:scale-90">
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Sets Area */}
      <div className="px-4 md:px-6 md:pl-[5.5rem] pb-5 flex-1 relative z-10">
        <LayoutGroup>
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {ex.sets.map((set, setIndex) => (
                <SetRow 
                  key={`set-${ex.dndId}-${setIndex}`} 
                  set={set} setIndex={setIndex} exIndex={exIndex} 
                  isReadOnly={isReadOnly} dominantTech={dominantTechnique}
                  onUpdateSet={onUpdateSet} onRemoveSet={onRemoveSet} 
                  showRemove={ex.sets.length > 1} 
                />
              ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>

        {/* Action Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-2xl border border-zinc-200/60 dark:border-white/5">
          <div className="flex gap-1.5">
            {!isReadOnly && (
              <button onClick={() => onSetCount(exIndex, 1)} className="flex items-center gap-1.5 text-xs font-bold bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 px-3 py-2 rounded-xl transition-all hover:bg-orange-200 dark:hover:bg-orange-500/30 active:scale-95">
                <Plus size={14} /> Add Set
              </button>
            )}
            {!isReadOnly && (
              <button onClick={() => onToggleNote(exIndex)} className={cn("flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95", ex.note ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-transparent text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700')}>
                <MessageSquare size={14} /> {ex.note ? 'Edit Note' : 'Add Note'}
              </button>
            )}
          </div>
          
          <div className="flex gap-1.5">
             {!isReadOnly && (
              <>
                <button title="Duplicate Last Set" onClick={() => onDuplicateLastSet(exIndex)} className="w-9 h-9 flex items-center justify-center bg-white dark:bg-zinc-800 text-zinc-500 hover:text-orange-500 rounded-xl border border-zinc-200 dark:border-white/10 transition-all active:scale-95"><Copy size={14} /></button>
                <button title="Clear Weights" onClick={() => onClearWeights(exIndex)} className="w-9 h-9 flex items-center justify-center bg-white dark:bg-zinc-800 text-zinc-500 hover:text-red-500 rounded-xl border border-zinc-200 dark:border-white/10 transition-all active:scale-95"><RotateCcw size={14} /></button>
              </>
            )}
          </div>
        </div>

        {/* Notes Expansion */}
        <AnimatePresence>
          {(activeNoteIndex === exIndex || ex.note) && (
            <motion.div initial={{ height: 0, opacity: 0, marginTop: 0 }} animate={{ height: 'auto', opacity: 1, marginTop: 12 }} exit={{ height: 0, opacity: 0, marginTop: 0 }} className="overflow-hidden">
              <div className="relative">
                <MessageSquare className="absolute left-4 top-4 text-blue-500 dark:text-blue-400" size={16} />
                <textarea
                  value={ex.note || ''} rows={2} onChange={(e) => onUpdate(exIndex, 'note', e.target.value)} disabled={isReadOnly}
                  placeholder="Technique notes, seat height, tempo..."
                  className="w-full bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/60 dark:border-blue-500/20 rounded-2xl py-3 pl-12 pr-4 text-sm font-medium text-zinc-800 dark:text-zinc-200 placeholder-blue-300 dark:placeholder-blue-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 resize-none transition-all"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EDITOR COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const WorkoutEditor = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const params     = new URLSearchParams(location.search);
  const subId      = params.get('sub');
  const sessionNum = params.get('session');
  const defaultSessionName = params.get('defaultName') || '';

  const [loading, setLoading]             = useState(true);
  const [sessionName, setSessionName]     = useState('');
  const [exercises, setExercises]         = useState([]);
  const [isSaving, setIsSaving]           = useState(false);
  const [isClient, setIsClient]           = useState(false);

  const [clientId, setClientId]           = useState(null);
  const [clientName, setClientName]       = useState('Client');
  const [trainerName, setTrainerName]     = useState('Trainer');
  const [currentUserId, setCurrentUserId] = useState(null);

  const [isSessionCompleted, setIsSessionCompleted]         = useState(false);
  const [completedByTrainerId, setCompletedByTrainerId]     = useState(null);
  const [completedByTrainerName, setCompletedByTrainerName] = useState('');

  const [recentSplits, setRecentSplits]         = useState([]);
  const [showHistory, setShowHistory]           = useState(false);
  const [isMenuOpen, setIsMenuOpen]             = useState(false);
  const [showPdfModal, setShowPdfModal]         = useState(false);
  const [pdfManualClientName, setPdfManualClientName] = useState('');
  const [activeNoteIndex, setActiveNoteIndex]   = useState(null);
  const [confirmModal, setConfirmModal]         = useState({ open: false });
  const [activeDndId, setActiveDndId]           = useState(null);

  const menuRef = useRef(null);

  const workoutStats = useMemo(() => {
    const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
    const totalWeight = exercises.reduce((acc, ex) => acc + ex.sets.reduce((a, s) => a + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0), 0);
    return { exercises: exercises.length, sets: totalSets, volume: Math.round(totalWeight) };
  }, [exercises]);

  const sensors = useSensors(
    useSensor(PointerSensor,  { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,    { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setIsMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isMenuOpen]);

  // API Integration
  useEffect(() => {
    if (!subId || !sessionNum) { setLoading(false); return; }
    let cancelled = false;

    const fetchData = async () => {
      try {
        try {
          const meRes = await api.get('/auth/users/me/');
          if (!cancelled) setCurrentUserId(Number(meRes.data.id));
        } catch {}

        try {
          const subRes = await api.get(`/client-subscriptions/${subId}/`);
          if (!cancelled) {
            const cId = typeof subRes.data.client === 'object' ? subRes.data.client?.id : subRes.data.client;
            setClientId(cId ?? null);
            setClientName(subRes.data.client_name || (typeof subRes.data.client === 'object' && subRes.data.client?.name) || 'Client');
            setTrainerName(subRes.data.trainer_name || 'TFG Coach');
          }
        } catch {}

        const res = await api.get(`/training-sessions/get-data/?subscription=${subId}&session_number=${sessionNum}`);
        if (cancelled) return;

        const data = res.data;
        setSessionName(data.name?.trim() || defaultSessionName || `Session ${sessionNum}`);
        setIsSessionCompleted(data.is_completed || false);

        if (data.is_completed) {
          setCompletedByTrainerId(data.completed_by != null ? Number(data.completed_by) : null);
          setCompletedByTrainerName(data.trainer_name || 'Unknown Trainer');
        }

        const loadedExercises = data.exercises?.length
          ? data.exercises.map((ex) => ({ ...ex, note: ex.note || '', dndId: nextDndId() }))
          : [EMPTY_EXERCISE()];
        setExercises(loadedExercises);

        api.get(`/training-sessions/history/?subscription=${subId}`)
          .then((r) => { if (!cancelled) setRecentSplits(r.data); })
          .catch(() => {});
      } catch (error) {
        if (!cancelled) { console.error(error); toast.error('Failed to load session'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [subId, sessionNum, defaultSessionName]);

  const isReadOnly =
    isSessionCompleted &&
    currentUserId != null &&
    completedByTrainerId != null &&
    completedByTrainerId !== 0 &&
    Number(currentUserId) !== Number(completedByTrainerId);

  const sortableIds = useMemo(() => exercises.map((ex) => ex.dndId), [exercises]);
  const activeDndExercise = useMemo(() => (activeDndId ? exercises.find((ex) => ex.dndId === activeDndId) : null), [activeDndId, exercises]);
  const activeDndIndex = useMemo(() => (activeDndId ? exercises.findIndex((ex) => ex.dndId === activeDndId) : -1), [activeDndId, exercises]);

  const handleDragStart  = useCallback(({ active }) => {
    setActiveDndId(active.id);
    if(window.navigator && window.navigator.vibrate) window.navigator.vibrate(50);
  }, []);
  const handleDragCancel = useCallback(() => setActiveDndId(null), []);
  const handleDragEnd    = useCallback(({ active, over }) => {
    setActiveDndId(null);
    if (!over || active.id === over.id) return;
    setExercises((prev) => {
      const oldIdx = prev.findIndex((ex) => ex.dndId === active.id);
      const newIdx = prev.findIndex((ex) => ex.dndId === over.id);
      return (oldIdx === -1 || newIdx === -1) ? prev : arrayMove(prev, oldIdx, newIdx);
    });
  }, []);

  const updateExercise = useCallback((idx, field, val) => setExercises((prev) => prev.map((ex, i) => (i === idx ? { ...ex, [field]: val } : ex))), []);
  const updateSet = useCallback((exIdx, setIdx, field, val) => setExercises((prev) => prev.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: val } : s)) })), []);
  
  const handleSetCount = useCallback((exIdx, delta) => {
    setExercises((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const newSets = [...ex.sets];
      if (delta > 0) {
        const { id: _id, ...rest } = newSets[newSets.length - 1];
        newSets.push({ ...rest, weight: '', reps: '' }); // Clean slate for new set
      } else {
        if (newSets.length <= 1) { toast.error('Minimum 1 set required'); return ex; }
        newSets.pop();
      }
      return { ...ex, sets: newSets };
    }));
  }, []);

  const duplicateLastSet = useCallback((exIdx) => {
    setExercises((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const { id: _id, ...rest } = ex.sets[ex.sets.length - 1];
      return { ...ex, sets: [...ex.sets, { ...rest }] };
    }));
    toast.success('Set duplicated');
  }, []);

  const clearWeights = useCallback((exIdx) => {
    setExercises((prev) => prev.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s) => ({ ...s, weight: '', reps: '' })) }));
    toast.success('Values cleared');
  }, []);

  const addExercise = useCallback(() => setExercises((prev) => [...prev, EMPTY_EXERCISE()]), []);

  const removeExercise = useCallback((idx) => {
    setExercises((prev) => {
      if (prev.length <= 1) { toast.error('At least 1 exercise is required'); return prev; }
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const removeSet = useCallback((exIdx, setIdx) => {
    setExercises((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      if (ex.sets.length <= 1) { toast.error('Minimum 1 set required'); return ex; }
      return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) };
    }));
  }, []);

  const handleBack = useCallback(() => {
    if (clientId) navigate(`/clients/${clientId}`, { state: { defaultTab: 'training', activeTab: 'training' } });
    else navigate(-1);
  }, [clientId, navigate]);

  const handleSave = useCallback(async (complete = false) => {
    const validExercises = exercises.filter((ex) => ex.name.trim());
    if (!validExercises.length) { toast.error('Add at least one named exercise before saving.'); return; }
    
    const payload = validExercises.map(({ dndId: _d, ...ex }) => ex);
    setIsSaving(true);
    try {
      await api.post('/training-sessions/save-data/', {
        subscription: subId, session_number: sessionNum,
        name: sessionName, exercises: payload, mark_complete: complete,
      });
      if (complete) {
        toast.success('Workout Completed! 🎉', { duration: 3000 });
        setIsSessionCompleted(true);
        if (currentUserId) setCompletedByTrainerId(Number(currentUserId));
        setTimeout(handleBack, 1500);
      } else {
        toast.success('Draft saved securely ✓');
      }
    } catch (e) {
      if (e.response?.status === 403) toast.error(e.response.data?.error || 'Permission Denied');
      else toast.error('Save failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [exercises, sessionName, subId, sessionNum, currentUserId, handleBack]);

  const handleCompleteIntent = useCallback(() => {
    setConfirmModal({
      open: true, title: 'Complete Workout?',
      message: 'This locks the session and records it as completed. It cannot be easily undone.',
      confirmLabel: 'Mark Completed',
      onConfirm: () => { setConfirmModal({ open: false }); handleSave(true); },
      onCancel:  () => setConfirmModal({ open: false }),
    });
  }, [handleSave]);

  const handleDeleteExercise = useCallback((idx) => {
    const ex = exercises[idx];
    const hasData = ex.name.trim() || ex.sets.some((s) => s.reps || s.weight);
    if (hasData) {
      setConfirmModal({
        open: true, variant: 'destructive', title: 'Delete Exercise?',
        message: `Remove "${ex.name || 'Unnamed Exercise'}" and all its sets?`,
        confirmLabel: 'Delete',
        onConfirm: () => { setConfirmModal({ open: false }); removeExercise(idx); },
        onCancel:  () => setConfirmModal({ open: false }),
      });
    } else removeExercise(idx);
  }, [exercises, removeExercise]);

  const loadFromHistory = useCallback((historySession) => {
    setConfirmModal({
      open: true, title: 'Load History',
      message: `Overwrite current draft with "${historySession.name}"?`,
      confirmLabel: 'Load Data',
      onConfirm: () => {
        setConfirmModal({ open: false });
        setExercises(historySession.exercises.map((ex) => ({
          dndId: nextDndId(), name: ex.name, note: ex.note || '',
          sets: ex.sets.map((s) => ({
            reps: s.reps, weight: s.weight,
            technique: s.technique || 'Regular', equipment: s.equipment || '',
          })),
        })));
        setShowHistory(false);
        toast.success('Workout loaded from history');
      },
      onCancel: () => setConfirmModal({ open: false }),
    });
  }, []);

  const handleOpenPdfModal = useCallback(() => {
    setIsMenuOpen(false);
    setPdfManualClientName(clientName !== 'Client' ? clientName : '');
    setShowPdfModal(true);
  }, [clientName]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-50 dark:bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-4">
          <Activity size={32} className="text-orange-500 animate-pulse" />
          <p className="text-zinc-500 font-medium tracking-wide">Loading Workout Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-50/50 dark:bg-[#0a0a0f] text-zinc-900 dark:text-zinc-100 selection:bg-orange-500/30 font-sans">
      <div className="fixed inset-0 pointer-events-none opacity-40 dark:opacity-20" style={{ background: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(249,115,22,0.1) 0%, transparent 80%)' }} />
      <Toaster position="top-center" toastOptions={{ style: { background: '#1a1a1f', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontWeight: '600' } }} />
      <ConfirmModal {...confirmModal} />

      {/* ── HEADER ── */}
      <div className="shrink-0 z-50 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border-b border-zinc-200/50 dark:border-white/5 sticky top-0">
        <div className="max-w-4xl mx-auto px-4 h-[80px] flex items-center justify-between gap-4">
          
          <button onClick={handleBack} className="w-12 h-12 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center justify-center transition-all active:scale-90 shadow-sm shrink-0">
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex-1 flex flex-col items-center justify-center min-w-0">
            <input 
              value={sessionName || ''} onChange={(e) => setSessionName(e.target.value)} onFocus={(e) => e.target.select()} disabled={isReadOnly} 
              placeholder="Workout Title..." 
              className="bg-transparent text-center text-xl md:text-2xl font-black text-zinc-900 dark:text-white placeholder-zinc-400 outline-none w-full truncate disabled:opacity-80 transition-colors" 
            />
            <div className="flex items-center gap-2 mt-1 flex-wrap justify-center overflow-hidden">
              <StatPill icon={User} value={clientName} />
              <StatPill icon={BarChart2} value={workoutStats.exercises} label="Ex" />
              <StatPill icon={Flame} value={workoutStats.sets} label="Sets" color="text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          
          <div className="relative flex items-center gap-2 shrink-0" ref={menuRef}>
            <button onClick={() => setShowHistory(true)} className="w-12 h-12 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:text-orange-600 dark:hover:text-orange-400 flex items-center justify-center transition-all active:scale-90 shadow-sm relative">
              <History size={20} />
              {recentSplits.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-orange-500 rounded-full text-[10px] font-black text-white flex items-center justify-center ring-2 ring-white dark:ring-zinc-900">{Math.min(recentSplits.length, 9)}</span>}
            </button>
            <button onClick={() => setIsMenuOpen((o) => !o)} className={cn("w-12 h-12 rounded-full border flex items-center justify-center transition-all active:scale-90 shadow-sm", isMenuOpen ? "bg-zinc-900 text-white dark:bg-white dark:text-black" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300")}>
              <MoreVertical size={20} />
            </button>

            <AnimatePresence>
              {isMenuOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="absolute top-[60px] right-0 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl shadow-xl p-2 z-50 origin-top-right">
                  {isClient && (
                    <button onClick={handleOpenPdfModal} className="w-full px-4 py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white font-bold text-sm flex items-center gap-3 transition-colors">
                      <FileText size={18} className="text-orange-500" />
                      <span>Export PDF</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pt-6 pb-40 relative z-10">
        <div className="max-w-3xl mx-auto space-y-6">
          
          <AnimatePresence>
            {isReadOnly && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                <div className="bg-red-50/50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4 flex items-center gap-4 mb-2 backdrop-blur-sm">
                  <div className="p-3 bg-red-100 dark:bg-red-500/20 rounded-xl text-red-600 dark:text-red-400 shrink-0"><Lock size={20} /></div>
                  <div>
                    <h4 className="font-bold text-red-800 dark:text-red-300 text-sm">Session Locked</h4>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1 font-medium">Completed by <span className="font-bold underline decoration-red-400/30 underline-offset-2">{completedByTrainerName}</span>. Editing is disabled.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-6">
                <AnimatePresence>
                  {exercises.map((ex, exIndex) => (
                    <motion.div key={ex.dndId} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3, delay: exIndex * 0.05 }}>
                      <SortableExerciseCard
                        exercise={ex} exIndex={exIndex} totalExercises={exercises.length} isReadOnly={isReadOnly}
                        activeNoteIndex={activeNoteIndex} onToggleNote={(idx) => setActiveNoteIndex((n) => (n === idx ? null : idx))}
                        onUpdate={updateExercise} onUpdateSet={updateSet} onSetCount={handleSetCount}
                        onDuplicateLastSet={duplicateLastSet} onClearWeights={clearWeights}
                        onRemoveSet={removeSet} onDelete={handleDeleteExercise}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
              {activeDndExercise && (
                <div className="opacity-90 scale-105 rotate-2">
                  <ExerciseCardContent exercise={activeDndExercise} exIndex={activeDndIndex} isReadOnly={isReadOnly} dragHandleProps={{}} onUpdate={()=>{}} onUpdateSet={()=>{}} onSetCount={()=>{}} onDuplicateLastSet={()=>{}} onClearWeights={()=>{}} onRemoveSet={()=>{}} onDelete={()=>{}} onToggleNote={()=>{}} />
                </div>
              )}
            </DragOverlay>
          </DndContext>

          {!isReadOnly && (
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={addExercise} className="w-full py-6 rounded-3xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-500/5 flex flex-col items-center justify-center gap-3 font-bold transition-all group mt-8">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-orange-100 dark:group-hover:bg-orange-500/20 group-hover:scale-110 transition-all"><Plus size={24} /></div>
              Add New Exercise
            </motion.button>
          )}
        </div>
      </div>

      {/* ── BOTTOM ACTION BAR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="h-16 bg-gradient-to-t from-zinc-50 dark:from-[#0a0a0f] to-transparent pointer-events-none" />
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border-t border-zinc-200/50 dark:border-white/10 pb-6 pt-4 px-4 pointer-events-auto shadow-[0_-20px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-20px_40px_rgba(0,0,0,0.4)]">
          <div className="max-w-3xl mx-auto flex gap-4">
            {!isReadOnly ? (
              <>
                <button onClick={() => handleSave(false)} disabled={isSaving} className="flex-1 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                  {isSaving ? <Activity size={18} className="animate-spin" /> : <Save size={18} />} Save Draft
                </button>
                {!isSessionCompleted && (
                  <button onClick={handleCompleteIntent} disabled={isSaving} className="flex-[1.8] py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all active:scale-95 hover:brightness-110 disabled:opacity-50 relative overflow-hidden">
                    <CheckCircle size={18} /> Finish Workout
                  </button>
                )}
              </>
            ) : (
              <div className="w-full bg-zinc-900 dark:bg-black text-white px-6 py-4 rounded-2xl border border-white/10 flex items-center justify-center gap-3 font-medium text-sm shadow-xl">
                <CheckCircle2 size={18} className="text-emerald-500" />
                Session Completed 
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── HISTORY DRAWER ── */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistory(false)} className="fixed inset-0 z-[250] bg-zinc-900/60 dark:bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-y-0 right-0 z-[260] w-full max-w-md bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-white/10 flex flex-col shadow-2xl">
              <div className="px-6 py-5 border-b border-zinc-100 dark:border-white/5 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                <h3 className="font-black text-xl text-zinc-900 dark:text-white flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400"><History size={20} /></div>
                  History
                </h3>
                <button onClick={() => setShowHistory(false)} className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center active:scale-90 transition-transform text-zinc-600 dark:text-zinc-300"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {recentSplits.length === 0 ? (
                  <div className="text-center py-20 text-zinc-400 dark:text-zinc-600 flex flex-col items-center">
                    <History size={48} className="mb-4 opacity-20" />
                    <p className="font-bold text-lg">No history found</p>
                    <p className="text-sm font-medium mt-1">Completed sessions will appear here.</p>
                  </div>
                ) : (
                  recentSplits.map((session, idx) => (
                    <div key={session.id ?? idx} className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 hover:border-orange-300 dark:hover:border-orange-500/50 transition-all group shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-zinc-900 dark:text-white text-base">{session.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] uppercase tracking-wider bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 px-2 py-1 rounded font-bold">Session {session.session_number}</span>
                            <span className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5"><Calendar size={12} /> {new Date(session.date_completed || session.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button onClick={() => loadFromHistory(session)} disabled={isReadOnly} className="text-sm font-bold bg-orange-50 hover:bg-orange-500 hover:text-white dark:bg-orange-500/20 dark:hover:bg-orange-500 text-orange-600 dark:text-orange-400 px-4 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-40">Load</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {session.exercises?.slice(0, 4).map((ex, i) => <span key={i} className="text-[11px] bg-zinc-50 dark:bg-zinc-900 px-2.5 py-1 rounded border border-zinc-200 dark:border-white/5 font-semibold text-zinc-600 dark:text-zinc-300">{ex.name}</span>)}
                        {session.exercises?.length > 4 && <span className="text-[11px] font-bold text-zinc-400 self-center ml-1">+{session.exercises.length - 4} more</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── PDF MODAL ── */}
      <AnimatePresence>
        {showPdfModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 10, opacity: 0 }} className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-3xl shadow-2xl p-7 relative">
              <button onClick={() => setShowPdfModal(false)} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 active:scale-90"><X size={18} /></button>
              
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mb-4 text-orange-500 ring-4 ring-orange-50 dark:ring-orange-500/5"><FileText size={28} /></div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Export Workout</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 pl-1">Target Client Name</label>
                  <div className="relative">
                    <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input autoFocus value={pdfManualClientName} onChange={(e) => setPdfManualClientName(e.target.value)} placeholder="e.g. John Doe" className="w-full bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-white/10 rounded-2xl py-3.5 pl-12 pr-4 font-bold outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-zinc-900 dark:text-white" />
                  </div>
                </div>

                {isClient && (
                  <PDFDownloadLink document={<WorkoutPDF_EN sessionName={sessionName || defaultSessionName || `Session ${sessionNum}`} sessionNumber={parseInt(sessionNum) || 1} clientName={pdfManualClientName || 'Client'} trainerName={trainerName || 'Trainer'} brandName="TFG" date={new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} exercises={exercises} />} fileName={`${(sessionName || 'Session').replace(/\s+/g, '_')}_${pdfManualClientName || 'Client'}.pdf`} className={cn("w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-[15px] shadow-xl transition-all active:scale-95", !pdfManualClientName ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed pointer-events-none shadow-none" : "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110 shadow-orange-500/30")}>
                    {({ loading: pdfLoading }) => (<>{pdfLoading ? <Activity size={20} className="animate-spin" /> : <Download size={20} />} <span>{pdfLoading ? 'Generating PDF...' : 'Download PDF'}</span></>)}
                  </PDFDownloadLink>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkoutEditor;