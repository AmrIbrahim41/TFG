/**
 * WorkoutEditor.jsx — Premium Elite Edition v7 (Refactored)
 * UI/UX Redesign: Accessible Touch Targets, CSS Grid Layouts, Refined Framer Motion
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, sortableKeyboardCoordinates,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  ArrowLeft, Save, Plus, Trash2, CheckCircle, Dumbbell, Activity, Settings,
  Zap, Layers, TrendingUp, ArrowDown, Grip, History, X, FileText,
  MoreVertical, Calendar, User, Download, Type, MessageSquare,
  Lock, Copy, RotateCcw, AlertTriangle, CheckCircle2, GripVertical,
  ChevronDown, BarChart2, Flame,
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
  Regular:     { color: 'text-zinc-600 dark:text-zinc-300', accent: 'border-l-zinc-300 dark:border-l-zinc-700', bg: 'bg-zinc-50 dark:bg-zinc-900/50', badge: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700', icon: Activity },
  'Drop Set':  { color: 'text-red-600 dark:text-red-400', accent: 'border-l-red-500', bg: 'bg-red-50/50 dark:bg-red-900/10', badge: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30', icon: ArrowDown },
  'Super Set': { color: 'text-purple-600 dark:text-purple-400', accent: 'border-l-purple-500', bg: 'bg-purple-50/50 dark:bg-purple-900/10', badge: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30', icon: Layers },
  Pyramid:     { color: 'text-amber-600 dark:text-amber-400', accent: 'border-l-amber-500', bg: 'bg-amber-50/50 dark:bg-amber-900/10', badge: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30', icon: TrendingUp },
  Negative:    { color: 'text-blue-600 dark:text-blue-400', accent: 'border-l-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-900/10', badge: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30', icon: Zap },
};

const EQUIP_CONFIG = {
  Bodyweight: { color: 'text-emerald-600 dark:text-emerald-400', icon: UserIcon },
  Dumbbell:   { color: 'text-blue-600 dark:text-blue-400',       icon: Dumbbell },
  Barbell:    { color: 'text-zinc-700 dark:text-zinc-300',       icon: Grip     },
  Cable:      { color: 'text-cyan-600 dark:text-cyan-400',       icon: Zap      },
  Machine:    { color: 'text-indigo-600 dark:text-indigo-400',   icon: Settings },
};

const EMPTY_EXERCISE = () => ({
  dndId: nextDndId(),
  name: '',
  note: '',
  sets: [{ reps: '', weight: '', technique: 'Regular', equipment: '' }],
});

const InputHideArrows = " [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield] ";

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const ConfirmModal = memo(({ open, title, message, confirmLabel, onConfirm, onCancel, variant = 'default' }) => {
  const isDestructive = variant === 'destructive';
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/70 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0, y: 15 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 15 }} className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 md:p-8">
            <div className="flex flex-col items-center text-center mb-6 md:mb-8">
              <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mb-5 ring-8", isDestructive ? "bg-red-100 text-red-600 ring-red-50 dark:bg-red-500/20 dark:text-red-400 dark:ring-red-500/10" : "bg-orange-100 text-orange-600 ring-orange-50 dark:bg-orange-500/20 dark:text-orange-400 dark:ring-orange-500/10")}>
                {isDestructive ? <AlertTriangle size={28} strokeWidth={2.5} /> : <CheckCircle2 size={28} strokeWidth={2.5} />}
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white">{title}</h3>
              <p className="text-base text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">{message}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-base transition-all active:scale-95">Cancel</button>
              <button onClick={onConfirm} className={cn("flex-1 py-3.5 rounded-2xl font-bold text-base transition-all active:scale-95 text-white shadow-lg", isDestructive ? "bg-red-600 hover:bg-red-500 shadow-red-500/25" : "bg-orange-600 hover:bg-orange-500 shadow-orange-500/25")}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

const StatPill = ({ icon: Icon, value, label, color = 'text-zinc-700 dark:text-zinc-200' }) => (
  <span className={cn("flex items-center gap-1.5 text-sm font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 rounded-full shadow-sm", color)}>
    <Icon size={16} className="opacity-70" />
    <span>{value}</span>
    {label && <span className="opacity-60 font-medium">{label}</span>}
  </span>
);

const DropPlaceholder = () => (
  <div className="rounded-3xl border-2 border-dashed border-orange-400 dark:border-orange-500/50 bg-orange-50 dark:bg-orange-500/10 h-[140px] flex items-center justify-center">
    <div className="w-12 h-12 rounded-full border border-orange-200 dark:border-orange-500/30 bg-white dark:bg-orange-500/20 flex items-center justify-center text-orange-500 animate-pulse">
      <ArrowDown size={24} />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// EXERCISE CARDS & SET ROWS
// ─────────────────────────────────────────────────────────────────────────────

const SetRow = memo(({ set, setIndex, exIndex, isReadOnly, onUpdateSet, onRemoveSet, showRemove }) => {
  const tech = TECHNIQUE_CONFIG[set.technique] || TECHNIQUE_CONFIG['Regular'];
  
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, height: 0, overflow: 'hidden' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn("group/set border-l-[4px] rounded-xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 transition-colors", tech.accent)}
    >
      {/* GRID LAYOUT 
        Mobile: 2 Rows. Top row (Inputs + Delete), Bottom row (Dropdowns).
        Desktop: 1 Row, properly spaced.
      */}
      <div className="p-3 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center">
        
        {/* Set Number & Inputs Container */}
        <div className="md:col-span-5 flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0", tech.badge)}>
            {setIndex + 1}
          </div>
          
          <div className="flex-1 grid grid-cols-2 gap-2">
            <div className="relative group/input">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase text-zinc-400 select-none">Reps</span>
              <input type="number" inputMode="numeric" placeholder="0" value={set.reps || ''} disabled={isReadOnly} 
                onChange={(e) => onUpdateSet(exIndex, setIndex, 'reps', e.target.value)} 
                className={cn("w-full h-11 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-14 pr-3 text-right text-base font-bold text-zinc-900 dark:text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all disabled:opacity-60", InputHideArrows)} />
            </div>
            <div className="relative group/input">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase text-zinc-400 select-none">Kg</span>
              <input type="number" inputMode="decimal" placeholder="0.0" value={set.weight || ''} disabled={isReadOnly} 
                onChange={(e) => onUpdateSet(exIndex, setIndex, 'weight', e.target.value)} 
                className={cn("w-full h-11 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-3 text-right text-base font-bold text-zinc-900 dark:text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all disabled:opacity-60", InputHideArrows)} />
            </div>
          </div>

          {/* Mobile Only Delete Button */}
          {showRemove && !isReadOnly && (
            <button onClick={() => onRemoveSet(exIndex, setIndex)} className="md:hidden w-11 h-11 shrink-0 flex items-center justify-center text-zinc-400 hover:text-red-500 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 active:scale-95">
              <Trash2 size={18} />
            </button>
          )}
        </div>

        {/* Dropdowns Container */}
        <div className="md:col-span-6 grid grid-cols-2 gap-2">
          <div className="relative">
            <tech.icon size={16} className={cn("absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none", tech.color)} />
            <select value={set.technique || 'Regular'} disabled={isReadOnly} 
              onChange={(e) => onUpdateSet(exIndex, setIndex, 'technique', e.target.value)} 
              className="w-full h-11 appearance-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-sm font-semibold rounded-lg pl-10 pr-8 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all disabled:opacity-60">
              {Object.keys(TECHNIQUE_CONFIG).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
          </div>
          
          <div className="relative">
            <select value={set.equipment || ''} disabled={isReadOnly} 
              onChange={(e) => onUpdateSet(exIndex, setIndex, 'equipment', e.target.value)} 
              className="w-full h-11 appearance-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-sm font-semibold rounded-lg pl-3 pr-8 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all disabled:opacity-60">
              <option value="">Equipment...</option>
              {Object.keys(EQUIP_CONFIG).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
          </div>
        </div>

        {/* Desktop Only Delete Button */}
        {showRemove && !isReadOnly && (
          <div className="hidden md:flex md:col-span-1 justify-end">
            <button onClick={() => onRemoveSet(exIndex, setIndex)} className="w-10 h-10 shrink-0 flex items-center justify-center text-zinc-400 hover:text-red-500 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 active:scale-95 opacity-0 group-hover/set:opacity-100 transition-all">
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
});

const SortableExerciseCard = (props) => {
  const { exercise, isReadOnly } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exercise.dndId, disabled: isReadOnly });
  const style = { transform: CSS.Transform.toString(transform), transition: transition || 'transform 250ms ease' };

  if (isDragging) return <div ref={setNodeRef} style={style} className="z-50 relative"><DropPlaceholder /></div>;
  return <div ref={setNodeRef} style={style} className="relative z-10"><ExerciseCardContent {...props} dragHandleProps={{ ...attributes, ...listeners }} /></div>;
};

const ExerciseCardContent = memo(({ exercise: ex, exIndex, isReadOnly, dragHandleProps, onUpdate, onUpdateSet, onSetCount, onDuplicateLastSet, onClearWeights, onRemoveSet, onDelete, activeNoteIndex, onToggleNote }) => {
  const dominantTechnique = useMemo(() => {
    const counts = {};
    ex.sets.forEach((s) => { const t = s.technique || 'Regular'; counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Regular';
  }, [ex.sets]);

  const techCfg = TECHNIQUE_CONFIG[dominantTechnique] || TECHNIQUE_CONFIG['Regular'];

  return (
    <div className="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col">
      
      {/* Header Section */}
      <div className="p-4 md:p-6 pb-2 flex items-start gap-3 md:gap-4 relative z-10 bg-zinc-50/50 dark:bg-zinc-900/50">
        {!isReadOnly && (
          <button {...dragHandleProps} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors cursor-grab active:cursor-grabbing touch-none">
            <GripVertical size={20} />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
             <div className="shrink-0 w-11 h-11 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black font-black text-lg select-none shadow-sm">
              {exIndex + 1}
            </div>
            <input
              value={ex.name || ''} 
              onChange={(e) => onUpdate(exIndex, 'name', e.target.value)} 
              disabled={isReadOnly}
              placeholder="Exercise name..."
              className="w-full bg-transparent text-xl md:text-2xl font-black text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-600 outline-none border-b-2 border-transparent focus:border-orange-500 transition-all pb-1 disabled:opacity-80"
            />
          </div>
          
          <div className="flex items-center gap-2 mt-3 ml-[3.5rem] flex-wrap">
            <span className="text-sm px-3 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
              {ex.sets.length} Set{ex.sets.length !== 1 ? 's' : ''}
            </span>
            {dominantTechnique !== 'Regular' && (
              <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md", techCfg.badge)}>
                <techCfg.icon size={14} />{dominantTechnique}
              </span>
            )}
          </div>
        </div>

        {!isReadOnly && (
          <button onClick={() => onDelete(exIndex)} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all active:scale-90">
            <Trash2 size={20} />
          </button>
        )}
      </div>

      {/* Sets Area */}
      <div className="p-4 md:p-6 pt-4 flex-1 relative z-10 border-t border-zinc-100 dark:border-zinc-800/50">
        <LayoutGroup>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {ex.sets.map((set, setIndex) => (
                <SetRow 
                  key={`set-${ex.dndId}-${setIndex}`} 
                  set={set} setIndex={setIndex} exIndex={exIndex} 
                  isReadOnly={isReadOnly} 
                  onUpdateSet={onUpdateSet} onRemoveSet={onRemoveSet} 
                  showRemove={ex.sets.length > 1} 
                />
              ))}
            </AnimatePresence>
          </div>
        </LayoutGroup>

        {/* Action Bar (Below Sets) */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-800/30 p-2 md:p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex gap-2">
            {!isReadOnly && (
              <button onClick={() => onSetCount(exIndex, 1)} className="flex items-center gap-2 text-sm font-bold bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 px-4 py-2.5 rounded-xl transition-all hover:bg-orange-200 dark:hover:bg-orange-500/30 active:scale-95">
                <Plus size={16} /> Add Set
              </button>
            )}
            {!isReadOnly && (
              <button onClick={() => onToggleNote(exIndex)} className={cn("flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-all active:scale-95", ex.note ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-transparent text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700')}>
                <MessageSquare size={16} /> {ex.note ? 'Edit Note' : 'Add Note'}
              </button>
            )}
          </div>
          
          <div className="flex gap-2">
             {!isReadOnly && (
              <>
                <button title="Duplicate Last Set" onClick={() => onDuplicateLastSet(exIndex)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-800 text-zinc-500 hover:text-orange-500 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-all active:scale-95"><Copy size={16} /></button>
                <button title="Clear Weights" onClick={() => onClearWeights(exIndex)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-zinc-800 text-zinc-500 hover:text-red-500 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-all active:scale-95"><RotateCcw size={16} /></button>
              </>
            )}
          </div>
        </div>

        {/* Notes Expansion */}
        <AnimatePresence>
          {(activeNoteIndex === exIndex || ex.note) && (
            <motion.div initial={{ height: 0, opacity: 0, marginTop: 0 }} animate={{ height: 'auto', opacity: 1, marginTop: 16 }} exit={{ height: 0, opacity: 0, marginTop: 0 }} className="overflow-hidden">
              <div className="relative">
                <MessageSquare className="absolute left-4 top-4 text-blue-500 dark:text-blue-400" size={18} />
                <textarea
                  value={ex.note || ''} rows={3} 
                  onChange={(e) => onUpdate(exIndex, 'note', e.target.value)} 
                  disabled={isReadOnly}
                  placeholder="Technique notes, seat height, tempo..."
                  className="w-full bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl py-3 pl-12 pr-4 text-base font-medium text-zinc-800 dark:text-zinc-200 placeholder-blue-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all"
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
    useSensor(TouchSensor,    { activationConstraint: { delay: 150, tolerance: 8 } }),
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
        newSets.push({ ...rest, weight: '', reps: '' }); 
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
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="flex flex-col items-center gap-5">
          <Activity size={40} className="text-orange-500 animate-pulse" />
          <p className="text-zinc-600 dark:text-zinc-400 font-bold text-lg tracking-wide">Loading Editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-orange-500/30">
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fff', border: '1px solid #27272a', borderRadius: '12px', padding: '16px', fontWeight: '600' } }} />
      <ConfirmModal {...confirmModal} />

      {/* ── HEADER (Sticky & Clean) ── */}
      <div className="shrink-0 z-50 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 sticky top-0 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          
          <button onClick={handleBack} className="w-12 h-12 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center justify-center transition-all active:scale-95 shadow-sm shrink-0">
            <ArrowLeft size={22} />
          </button>
          
          <div className="flex-1 flex flex-col items-center justify-center min-w-0">
            <input 
              value={sessionName || ''} onChange={(e) => setSessionName(e.target.value)} onFocus={(e) => e.target.select()} disabled={isReadOnly} 
              placeholder="Workout Title..." 
              className="bg-transparent text-center text-xl md:text-3xl font-black text-zinc-900 dark:text-white placeholder-zinc-400 outline-none w-full truncate disabled:opacity-80 transition-colors" 
            />
            <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
              <StatPill icon={User} value={clientName} />
              <StatPill icon={BarChart2} value={workoutStats.exercises} label="Ex" />
              <StatPill icon={Flame} value={workoutStats.sets} label="Sets" color="text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          
          <div className="relative flex items-center gap-2 shrink-0" ref={menuRef}>
            <button onClick={() => setShowHistory(true)} className="w-12 h-12 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-orange-600 dark:hover:text-orange-400 flex items-center justify-center transition-all active:scale-95 shadow-sm relative">
              <History size={22} />
              {recentSplits.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full text-[11px] font-black text-white flex items-center justify-center ring-2 ring-white dark:ring-zinc-900">{Math.min(recentSplits.length, 9)}</span>}
            </button>
            <button onClick={() => setIsMenuOpen((o) => !o)} className={cn("w-12 h-12 rounded-full border flex items-center justify-center transition-all active:scale-95 shadow-sm", isMenuOpen ? "bg-zinc-900 text-white dark:bg-white dark:text-black border-transparent" : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300")}>
              <MoreVertical size={22} />
            </button>

            <AnimatePresence>
              {isMenuOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="absolute top-[60px] right-0 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-2 z-50 origin-top-right">
                  {isClient && (
                    <button onClick={handleOpenPdfModal} className="w-full px-4 py-3.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white font-bold text-base flex items-center gap-3 transition-colors">
                      <FileText size={20} className="text-orange-500" />
                      <span>Export PDF</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── BODY (Padded properly for bottom floating bar) ── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8 pb-[140px] relative z-10">
        <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
          
          <AnimatePresence>
            {isReadOnly && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden mb-6">
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl p-5 flex items-center gap-4">
                  <div className="p-3 bg-red-100 dark:bg-red-500/20 rounded-xl text-red-600 dark:text-red-400 shrink-0"><Lock size={24} /></div>
                  <div>
                    <h4 className="font-bold text-red-900 dark:text-red-300 text-base">Session Locked</h4>
                    <p className="text-sm text-red-700 dark:text-red-400/90 mt-1 font-medium">Completed by <span className="font-bold underline decoration-red-400/40 underline-offset-4">{completedByTrainerName}</span>. Editing is disabled.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-6 md:space-y-8">
                <AnimatePresence>
                  {exercises.map((ex, exIndex) => (
                    <motion.div key={ex.dndId} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3, delay: exIndex * 0.05 }}>
                      <SortableExerciseCard
                        exercise={ex} exIndex={exIndex} isReadOnly={isReadOnly}
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
            <DragOverlay dropAnimation={{ duration: 250, easing: 'ease' }}>
              {activeDndExercise && (
                <div className="opacity-95 scale-105 rotate-1 shadow-2xl">
                  <ExerciseCardContent exercise={activeDndExercise} exIndex={activeDndIndex} isReadOnly={isReadOnly} dragHandleProps={{}} onUpdate={()=>{}} onUpdateSet={()=>{}} onSetCount={()=>{}} onDuplicateLastSet={()=>{}} onClearWeights={()=>{}} onRemoveSet={()=>{}} onDelete={()=>{}} onToggleNote={()=>{}} />
                </div>
              )}
            </DragOverlay>
          </DndContext>

          {!isReadOnly && (
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={addExercise} className="w-full py-8 mt-10 rounded-3xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 flex flex-col items-center justify-center gap-4 font-bold text-lg transition-all group">
              <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-orange-100 dark:group-hover:bg-orange-500/20 group-hover:scale-110 transition-all"><Plus size={28} /></div>
              Add New Exercise
            </motion.button>
          )}
        </div>
      </div>

      {/* ── BOTTOM ACTION BAR (Floating) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border-t border-zinc-200 dark:border-zinc-800 p-4 pb-safe pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.6)]">
          <div className="max-w-4xl mx-auto flex gap-4">
            {!isReadOnly ? (
              <>
                <button onClick={() => handleSave(false)} disabled={isSaving} className="flex-1 py-4 md:py-5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                  {isSaving ? <Activity size={20} className="animate-spin" /> : <Save size={20} />} Save Draft
                </button>
                {!isSessionCompleted && (
                  <button onClick={handleCompleteIntent} disabled={isSaving} className="flex-[1.5] py-4 md:py-5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 transition-all active:scale-95 disabled:opacity-50">
                    <CheckCircle size={20} /> Finish Workout
                  </button>
                )}
              </>
            ) : (
              <div className="w-full bg-zinc-900 dark:bg-black text-white px-6 py-5 rounded-2xl border border-zinc-800 flex items-center justify-center gap-3 font-bold text-base shadow-xl">
                <CheckCircle2 size={24} className="text-emerald-500" />
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistory(false)} className="fixed inset-0 z-[250] bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-y-0 right-0 z-[260] w-full max-w-md bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-2xl">
              <div className="px-6 py-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900">
                <h3 className="font-black text-2xl text-zinc-900 dark:text-white flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400"><History size={24} /></div>
                  History
                </h3>
                <button onClick={() => setShowHistory(false)} className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center active:scale-90 transition-transform text-zinc-700 dark:text-zinc-300"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {recentSplits.length === 0 ? (
                  <div className="text-center py-20 text-zinc-500 flex flex-col items-center">
                    <History size={64} className="mb-6 opacity-20" />
                    <p className="font-bold text-xl">No history found</p>
                    <p className="text-base mt-2">Completed sessions will appear here.</p>
                  </div>
                ) : (
                  recentSplits.map((session, idx) => (
                    <div key={session.id ?? idx} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-5 hover:border-orange-400 dark:hover:border-orange-500/80 transition-all shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-zinc-900 dark:text-white text-lg">{session.name}</h4>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs uppercase tracking-wider bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded font-bold">Session {session.session_number}</span>
                            <span className="text-sm font-semibold text-zinc-500 flex items-center gap-1.5"><Calendar size={14} /> {new Date(session.date_completed || session.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button onClick={() => loadFromHistory(session)} disabled={isReadOnly} className="text-sm font-bold bg-orange-100 hover:bg-orange-600 hover:text-white dark:bg-orange-500/20 dark:hover:bg-orange-500 text-orange-700 dark:text-white px-5 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-40">Load</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {session.exercises?.slice(0, 4).map((ex, i) => <span key={i} className="text-xs bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-700 dark:text-zinc-300">{ex.name}</span>)}
                        {session.exercises?.length > 4 && <span className="text-xs font-bold text-zinc-500 self-center ml-1">+{session.exercises.length - 4} more</span>}
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, y: 15, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 15, opacity: 0 }} className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-8 relative">
              <button onClick={() => setShowPdfModal(false)} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 active:scale-90 transition-transform"><X size={20} /></button>
              
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-20 h-20 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mb-5 text-orange-500 ring-8 ring-orange-50 dark:ring-orange-500/5"><FileText size={36} /></div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">Export Workout</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-zinc-600 dark:text-zinc-400 pl-1">Target Client Name</label>
                  <div className="relative">
                    <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                    <input autoFocus value={pdfManualClientName} onChange={(e) => setPdfManualClientName(e.target.value)} placeholder="e.g. John Doe" className="w-full h-14 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-12 pr-4 font-bold text-lg outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-zinc-900 dark:text-white" />
                  </div>
                </div>

                {isClient && (
                  <PDFDownloadLink document={<WorkoutPDF_EN sessionName={sessionName || defaultSessionName || `Session ${sessionNum}`} sessionNumber={parseInt(sessionNum) || 1} clientName={pdfManualClientName || 'Client'} trainerName={trainerName || 'Trainer'} brandName="TFG" date={new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} exercises={exercises} />} fileName={`${(sessionName || 'Session').replace(/\s+/g, '_')}_${pdfManualClientName || 'Client'}.pdf`} className={cn("w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-base shadow-xl transition-all active:scale-95", !pdfManualClientName ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed pointer-events-none shadow-none" : "bg-orange-600 hover:bg-orange-500 text-white shadow-orange-500/30")}>
                    {({ loading: pdfLoading }) => (<>{pdfLoading ? <Activity size={22} className="animate-spin" /> : <Download size={22} />} <span>{pdfLoading ? 'Generating PDF...' : 'Download PDF'}</span></>)}
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