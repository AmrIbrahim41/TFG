/**
 * WorkoutEditor.jsx — Premium Edition v5 (Full Version)
 * * Includes:
 * - Full original API logic & state management
 * - Framer Motion for spring animations and layout transitions
 * - clsx & tailwind-merge for clean class management
 * - Improved mobile touch targets and glassmorphism design
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  Zap, Layers, TrendingUp, ArrowDown, Grip, History, X, Minus, FileText,
  MoreVertical, ChevronRight, Calendar, User, Download, Type, MessageSquare,
  Lock, Copy, RotateCcw, AlertTriangle, CheckCircle2, GripVertical,
  ChevronUp, ChevronDown, BarChart2, Flame,
} from 'lucide-react';

import api from '../api';
import toast, { Toaster } from 'react-hot-toast';
import WorkoutPDF_EN from '../utils/WorkoutPDF.jsx';
import { PDFDownloadLink } from '@react-pdf/renderer';

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

let _dndCounter = 0;
const nextDndId = () => `ex-${++_dndCounter}`;

const UserIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const TECHNIQUE_CONFIG = {
  Regular:     { color: 'text-zinc-500 dark:text-zinc-400', accent: 'border-l-zinc-300 dark:border-l-zinc-700', bg: 'bg-zinc-50 dark:bg-zinc-900/20', badge: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300', icon: Activity },
  'Drop Set':  { color: 'text-red-500 dark:text-red-400', accent: 'border-l-red-400 dark:border-l-red-500', bg: 'bg-red-50/40 dark:bg-red-900/10', badge: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400', icon: ArrowDown },
  'Super Set': { color: 'text-purple-500 dark:text-purple-400', accent: 'border-l-purple-400 dark:border-l-purple-500', bg: 'bg-purple-50/40 dark:bg-purple-900/10', badge: 'bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400', icon: Layers },
  Pyramid:     { color: 'text-amber-500 dark:text-amber-400', accent: 'border-l-amber-400 dark:border-l-amber-500', bg: 'bg-amber-50/40 dark:bg-amber-900/10', badge: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400', icon: TrendingUp },
  Negative:    { color: 'text-blue-500 dark:text-blue-400', accent: 'border-l-blue-400 dark:border-l-blue-500', bg: 'bg-blue-50/40 dark:bg-blue-900/10', badge: 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400', icon: Zap },
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
// REUSABLE UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
const ConfirmModal = memo(({ open, title, message, confirmLabel, onConfirm, onCancel, variant = 'default' }) => {
  const isDestructive = variant === 'destructive';
  return (
    <AnimatePresence>
      {open && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-sm bg-white dark:bg-[#1a1a1f] border border-zinc-200/80 dark:border-white/[0.07] rounded-[2rem] shadow-2xl p-8"
          >
            <div className="flex flex-col items-center text-center mb-6">
              <div className={cn("w-16 h-16 rounded-3xl flex items-center justify-center mb-4 ring-1", isDestructive ? "bg-red-500/10 text-red-500 ring-red-500/20" : "bg-orange-500/10 text-orange-500 ring-orange-500/20")}>
                {isDestructive ? <AlertTriangle size={28} /> : <CheckCircle2 size={28} />}
              </div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">{title}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">{message}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} className="flex-1 py-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm transition-all active:scale-95">Cancel</button>
              <button onClick={onConfirm} className={cn("flex-[1.4] py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 text-white shadow-lg", isDestructive ? "bg-gradient-to-r from-red-600 to-red-500 shadow-red-500/20 hover:from-red-500 hover:to-red-400" : "bg-gradient-to-r from-orange-500 to-amber-500 shadow-orange-500/25 hover:from-orange-400 hover:to-amber-400")}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

const SkeletonLoader = () => (
  <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-50 dark:bg-[#0a0a0f]">
    <div className="shrink-0 bg-white/95 dark:bg-[#111116]/95 border-b border-zinc-200 dark:border-white/[0.06] h-[80px]">
      <div className="max-w-5xl mx-auto px-4 h-full flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        <div className="flex-1 flex flex-col items-center gap-3">
          <div className="h-6 w-56 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-3 w-32 rounded-lg bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
        </div>
      </div>
    </div>
    <div className="flex-1 p-4 space-y-5 max-w-5xl mx-auto w-full mt-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-[#111116] border border-zinc-200 dark:border-white/[0.06] rounded-[2rem] p-6" style={{ animationDelay: `${i * 100}ms` }}>
          <div className="flex gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
            <div className="flex-1 space-y-3 pt-1">
              <div className="h-7 w-3/4 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
              <div className="h-3 w-1/3 rounded-lg bg-zinc-50 dark:bg-zinc-950 animate-pulse" />
            </div>
          </div>
          <div className="space-y-3 bg-zinc-50/50 dark:bg-zinc-900/20 rounded-3xl p-4">
            {[1, 2, 3].map((j) => (<div key={j} className="h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const StatPill = ({ icon: Icon, value, label, color = 'text-zinc-600 dark:text-zinc-300' }) => (
  <span className={cn("flex items-center gap-1.5 text-[11px] font-bold bg-white/60 dark:bg-white/[0.06] border border-zinc-200/80 dark:border-white/[0.08] px-2.5 py-1.5 rounded-full backdrop-blur-sm", color)}>
    <Icon size={11} /><span>{value}</span><span className="opacity-60 font-medium">{label}</span>
  </span>
);

const DragGhost = ({ exercise, index }) => (
  <div className="bg-white/98 dark:bg-[#1c1c22]/98 backdrop-blur-xl border-2 border-orange-500/60 rounded-[2rem] p-5 shadow-2xl shadow-orange-500/30 cursor-grabbing" style={{ transform: 'rotate(1.5deg) scale(1.04)' }}>
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/30 flex items-center justify-center text-white font-black text-lg select-none">
        {String(index + 1).padStart(2, '0')}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black text-zinc-900 dark:text-white text-base truncate">{exercise.name || <span className="text-zinc-400 italic font-medium">Unnamed exercise</span>}</p>
        <p className="text-xs text-orange-500 font-bold mt-0.5">{exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''} · moving…</p>
      </div>
    </div>
  </div>
);

const DropPlaceholder = () => (
  <div className="rounded-[2rem] border-2 border-dashed border-orange-400/60 dark:border-orange-500/40 bg-gradient-to-b from-orange-50/60 to-amber-50/30 dark:from-orange-500/[0.06] dark:to-amber-500/[0.03] h-[100px] flex flex-col items-center justify-center gap-2">
    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="w-8 h-8 rounded-full border-2 border-dashed border-orange-400/60 dark:border-orange-500/40 flex items-center justify-center">
      <Plus size={16} className="text-orange-400" />
    </motion.div>
    <span className="text-xs font-black uppercase tracking-widest text-orange-400/70 dark:text-orange-500/50">Drop here</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// EXERCISE CARD WRAPPERS
// ─────────────────────────────────────────────────────────────────────────────
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
    <div className={cn("group relative bg-white dark:bg-[#111116] border border-zinc-200/80 dark:border-white/[0.07] rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-zinc-200/60 dark:hover:shadow-black/50 transition-all duration-300 overflow-hidden border-l-4", techCfg.accent)}>
      <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/[0.03] dark:bg-orange-500/[0.06] rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />

      {/* Header */}
      <div className="p-5 md:p-6 pb-3 flex items-start gap-3 md:gap-4 relative">
        {!isReadOnly && (
          <div className="flex flex-col items-center gap-1 shrink-0 z-10 mt-1">
            <button {...dragHandleProps} className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-all cursor-grab active:cursor-grabbing touch-none">
              <GripVertical size={18} />
            </button>
            <div className="flex flex-col gap-0.5">
              <button onClick={onMoveUp} disabled={exIndex === 0} className="w-9 h-6 flex items-center justify-center rounded-t-lg bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-20 transition-all active:scale-90"><ChevronUp size={13} /></button>
              <button onClick={onMoveDown} disabled={exIndex === totalExercises - 1} className="w-9 h-6 flex items-center justify-center rounded-b-lg bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-20 transition-all active:scale-90"><ChevronDown size={13} /></button>
            </div>
          </div>
        )}

        <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/20 flex items-center justify-center text-white font-black text-xl z-10 select-none">
          {String(exIndex + 1).padStart(2, '0')}
        </div>

        <div className="flex-1 min-w-0 z-10 pt-0.5">
          <input
            value={ex.name || ''} onChange={(e) => onUpdate(exIndex, 'name', e.target.value)} disabled={isReadOnly}
            placeholder="Exercise name…"
            className="w-full bg-transparent text-xl md:text-2xl font-black text-zinc-900 dark:text-white placeholder-zinc-300 dark:placeholder-zinc-700 outline-none border-b-2 border-transparent focus:border-orange-400 dark:focus:border-orange-500/60 transition-all pb-1 disabled:opacity-60"
          />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-lg bg-orange-500/10 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-black border border-orange-200/60 dark:border-orange-500/20">
              {ex.sets.length} Set{ex.sets.length !== 1 ? 's' : ''}
            </span>
            {dominantTechnique !== 'Regular' && (
              <span className={cn("inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md", techCfg.badge)}>
                <techCfg.icon size={10} />{dominantTechnique}
              </span>
            )}
            {!isReadOnly && (
              <>
                <button onClick={() => onDuplicateLastSet(exIndex)} className="text-xs flex items-center gap-1 text-zinc-500 dark:text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors font-semibold px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/80 active:scale-95"><Copy size={11} /> Copy</button>
                <button onClick={() => onClearWeights(exIndex)} className="text-xs flex items-center gap-1 text-zinc-500 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors font-semibold px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/80 active:scale-95"><RotateCcw size={11} /> Clear</button>
              </>
            )}
          </div>
        </div>

        {!isReadOnly && (
          <button onClick={() => onDelete(exIndex)} className="shrink-0 w-10 h-10 flex items-center justify-center rounded-2xl text-zinc-400 hover:text-white hover:bg-red-500 transition-all md:opacity-0 md:group-hover:opacity-100 active:scale-90 z-10">
            <Trash2 size={17} />
          </button>
        )}
      </div>

      {/* Sets Table */}
      <div className="mx-4 md:mx-6 mb-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-3xl overflow-hidden border border-zinc-200/50 dark:border-white/[0.05] shadow-inner">
        <div className="flex flex-col divide-y divide-zinc-200/40 dark:divide-white/[0.04]">
          <AnimatePresence initial={false}>
            {ex.sets.map((set, setIndex) => {
              const tech = TECHNIQUE_CONFIG[set.technique] || TECHNIQUE_CONFIG['Regular'];
              const TIcon = tech.icon;

              return (
                <motion.div 
                  key={`set-${ex.dndId}-${setIndex}`}
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={cn("group/row transition-colors", tech.bg)}
                >
                  <div className="flex flex-col md:flex-row gap-3 p-3 md:px-4 items-center">
                    <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0", tech.badge)}>{setIndex + 1}</span>
                    
                    <div className="flex-1 flex w-full gap-2">
                      <div className="flex-1 relative">
                        <label className="absolute -top-2 left-2.5 bg-white dark:bg-[#111116] px-1 text-[9px] font-black uppercase tracking-wider text-zinc-400 rounded z-10">Reps</label>
                        <input type="number" inputMode="numeric" placeholder="0" value={set.reps || ''} disabled={isReadOnly} onChange={(e) => onUpdateSet(exIndex, setIndex, 'reps', e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl py-3 md:py-2.5 text-center text-sm font-black text-zinc-900 dark:text-white outline-none transition-all disabled:opacity-60" />
                      </div>
                      <div className="flex-1 relative">
                        <label className="absolute -top-2 left-2.5 bg-white dark:bg-[#111116] px-1 text-[9px] font-black uppercase tracking-wider text-zinc-400 rounded z-10">kg</label>
                        <input type="number" inputMode="decimal" placeholder="0.0" value={set.weight || ''} disabled={isReadOnly} onChange={(e) => onUpdateSet(exIndex, setIndex, 'weight', e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl py-3 md:py-2.5 text-center text-sm font-black text-zinc-900 dark:text-white outline-none transition-all disabled:opacity-60" />
                      </div>
                    </div>

                    <div className="flex-1 flex w-full gap-2">
                      <div className="flex-1 relative">
                        <TIcon size={12} className={cn("absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none", tech.color)} />
                        <select value={set.technique || 'Regular'} disabled={isReadOnly} onChange={(e) => onUpdateSet(exIndex, setIndex, 'technique', e.target.value)} className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl py-3 md:py-2.5 pl-7 pr-6 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all disabled:opacity-60">
                          {Object.keys(TECHNIQUE_CONFIG).map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={12} />
                      </div>
                      <div className="flex-1 relative">
                        <select value={set.equipment || ''} disabled={isReadOnly} onChange={(e) => onUpdateSet(exIndex, setIndex, 'equipment', e.target.value)} className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl py-3 md:py-2.5 pl-3 pr-6 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all disabled:opacity-60">
                          <option value="">None</option>
                          {Object.keys(EQUIP_CONFIG).map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={12} />
                      </div>
                    </div>

                    {ex.sets.length > 1 && !isReadOnly && (
                      <button onClick={() => onRemoveSet(exIndex, setIndex)} className="w-10 h-10 md:w-8 md:h-8 shrink-0 flex items-center justify-center text-red-400 hover:text-white hover:bg-red-500 bg-red-50/80 dark:bg-red-500/10 rounded-xl transition-all active:scale-90">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="px-5 md:px-6 pb-5 flex items-center justify-between">
        {!isReadOnly && (
          <button onClick={() => onSetCount(exIndex, 1)} className="flex items-center gap-1.5 text-xs font-black bg-zinc-100 hover:bg-orange-50 dark:bg-zinc-800/80 dark:hover:bg-orange-500/20 text-zinc-600 dark:text-zinc-300 hover:text-orange-500 px-3 py-2 rounded-xl transition-colors">
            <Plus size={14} /> Add Set
          </button>
        )}
        
        {!isReadOnly && (
          <button onClick={() => onToggleNote(exIndex)} className={cn("flex items-center gap-1.5 text-xs font-bold transition-colors py-2 px-3 rounded-xl", ex.note ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10' : 'text-zinc-500 hover:text-amber-600 bg-transparent')}>
            <MessageSquare size={13} />{ex.note ? 'Edit Note' : 'Add Note'}
          </button>
        )}
      </div>

      <AnimatePresence>
        {(activeNoteIndex === exIndex || ex.note) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-5 md:px-6 pb-5 pt-0 overflow-hidden">
            <textarea
              value={ex.note || ''} rows={2} onChange={(e) => onUpdate(exIndex, 'note', e.target.value)} disabled={isReadOnly}
              placeholder="E.g., Seat height 4, slow eccentric phase…"
              className="w-full bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/80 dark:border-amber-600/25 rounded-2xl p-3.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 placeholder-amber-400/60 dark:placeholder-amber-700/60 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 resize-none transition-all"
            />
          </motion.div>
        )}
      </AnimatePresence>
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
    useSensor(TouchSensor,    { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setIsMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [isMenuOpen]);

  // FULL API INTEGRATION
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

  const handleDragStart  = useCallback(({ active }) => setActiveDndId(active.id), []);
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
        newSets.push({ ...rest });
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
  }, []);

  const clearWeights = useCallback((exIdx) => {
    setExercises((prev) => prev.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s) => ({ ...s, weight: '' })) }));
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

  const moveExercise = useCallback((idx, dir) => {
    setExercises((prev) => {
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      return arrayMove(prev, idx, next);
    });
  }, []);

  const handleBack = useCallback(() => {
    if (clientId) navigate(`/clients/${clientId}`, { state: { defaultTab: 'training', activeTab: 'training' } });
    else navigate(-1);
  }, [clientId, navigate]);

  const handleSave = useCallback(async (complete = false) => {
    const validExercises = exercises.filter((ex) => ex.name.trim());
    if (!validExercises.length) { toast.error('Add at least one named exercise before saving.'); return; }
    if (validExercises.length < exercises.length) toast('Blank-name exercises were skipped.', { icon: '⚠️' });

    const payload = validExercises.map(({ dndId: _d, ...ex }) => ex);
    setIsSaving(true);
    try {
      await api.post('/training-sessions/save-data/', {
        subscription: subId, session_number: sessionNum,
        name: sessionName, exercises: payload, mark_complete: complete,
      });
      if (complete) {
        toast.success('Workout Completed! 🎉');
        setIsSessionCompleted(true);
        if (currentUserId) setCompletedByTrainerId(Number(currentUserId));
        setTimeout(handleBack, 1000);
      } else {
        toast.success('Draft saved ✓');
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
      message: 'Marks this session as done and increments the session counter. This cannot be undone by others.',
      confirmLabel: 'Complete',
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
        message: `"${ex.name || 'This exercise'}" has data that will be removed.`,
        confirmLabel: 'Delete',
        onConfirm: () => { setConfirmModal({ open: false }); removeExercise(idx); },
        onCancel:  () => setConfirmModal({ open: false }),
      });
    } else removeExercise(idx);
  }, [exercises, removeExercise]);

  const loadFromHistory = useCallback((historySession) => {
    setConfirmModal({
      open: true, title: 'Load from History?',
      message: `Overwrite current workout with "${historySession.name}"?`,
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

  if (loading) return <SkeletonLoader />;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-50 dark:bg-[#0a0a0f] text-zinc-900 dark:text-zinc-100 selection:bg-orange-500/30">
      <div className="fixed inset-0 pointer-events-none dark:opacity-100 opacity-0 transition-opacity" style={{ background: 'radial-gradient(ellipse 80% 40% at 20% 0%, rgba(251,146,60,0.05) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(245,158,11,0.03) 0%, transparent 60%)' }} />
      <Toaster position="top-center" toastOptions={{ style: { background: '#1a1a1f', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', fontWeight: '700' } }} />
      <ConfirmModal {...confirmModal} />

      {/* ── HEADER ── */}
      <div className="shrink-0 z-50 bg-white/85 dark:bg-[#111116]/90 backdrop-blur-2xl border-b border-zinc-200/80 dark:border-white/[0.06] sticky top-0 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-[76px] grid grid-cols-[48px_1fr_auto] items-center gap-3">
          <button onClick={handleBack} className="w-11 h-11 rounded-2xl bg-zinc-100 dark:bg-white/[0.07] border border-zinc-200 dark:border-white/[0.08] hover:bg-zinc-200 dark:hover:bg-white/[0.12] flex items-center justify-center transition-all active:scale-90 shadow-sm">
            <ArrowLeft size={20} className="text-zinc-700 dark:text-white" />
          </button>
          <div className="flex flex-col items-center min-w-0 px-1">
            <input value={sessionName || ''} onChange={(e) => setSessionName(e.target.value)} onFocus={(e) => e.target.select()} disabled={isReadOnly} placeholder="Workout Name" className="bg-transparent text-center text-lg md:text-xl font-black text-zinc-900 dark:text-white placeholder-zinc-300 dark:placeholder-zinc-700 outline-none w-full border-b-2 border-transparent focus:border-orange-500 transition-all pb-0.5 truncate disabled:opacity-70 disabled:cursor-not-allowed leading-tight" />
            <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-center">
              <StatPill icon={User} value={clientName} label="" color="text-zinc-700 dark:text-zinc-200" />
              <StatPill icon={BarChart2} value={workoutStats.exercises} label="ex" />
              <StatPill icon={Flame} value={workoutStats.sets} label="sets" color="text-orange-600 dark:text-orange-400" />
              {workoutStats.volume > 0 && <StatPill icon={TrendingUp} value={`${workoutStats.volume}kg`} label="vol" color="text-emerald-600 dark:text-emerald-400" />}
            </div>
          </div>
          <div className="relative flex items-center gap-2" ref={menuRef}>
            <button onClick={() => setShowHistory(true)} className="w-11 h-11 rounded-2xl bg-zinc-100 dark:bg-white/[0.07] border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-300 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-300 dark:hover:border-orange-500/30 flex items-center justify-center transition-all active:scale-90 shadow-sm relative">
              <History size={19} />
              {recentSplits.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">{Math.min(recentSplits.length, 9)}</span>}
            </button>
            <button onClick={() => setIsMenuOpen((o) => !o)} className={cn("w-11 h-11 rounded-2xl border flex items-center justify-center transition-all active:scale-90 shadow-sm", isMenuOpen ? "bg-orange-500 text-white border-orange-400 shadow-orange-500/30" : "bg-zinc-100 dark:bg-white/[0.07] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-300")}>
              <MoreVertical size={19} />
            </button>
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }} className="absolute top-14 right-0 w-60 bg-white/95 dark:bg-[#1a1a1f]/95 backdrop-blur-2xl border border-zinc-200/80 dark:border-white/[0.08] rounded-3xl shadow-2xl p-2 z-50 origin-top-right">
                  {isClient && (
                    <button onClick={handleOpenPdfModal} className="w-full px-3.5 py-3 rounded-2xl hover:bg-zinc-50 dark:hover:bg-white/[0.06] text-zinc-900 dark:text-white font-bold text-sm flex items-center justify-between gap-3 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-500/15 flex items-center justify-center border border-orange-100 dark:border-orange-500/20"><FileText size={15} className="text-orange-500" /></div>
                        <span>Export to PDF</span>
                      </div>
                      <ChevronRight size={15} className="text-zinc-400" />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pt-5 pb-40 relative z-10">
        <div className="max-w-5xl mx-auto space-y-5">
          {isReadOnly && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-red-50 to-white dark:from-red-950/30 dark:to-transparent border border-red-200 dark:border-red-500/20 rounded-3xl p-4 flex items-center gap-4 shadow-sm">
              <div className="p-2.5 bg-red-100 dark:bg-red-500/20 rounded-2xl text-red-600 dark:text-red-400 shrink-0"><Lock size={18} /></div>
              <div>
                <h4 className="font-black text-sm text-red-700 dark:text-red-400">Locked Session</h4>
                <p className="text-xs font-medium text-red-600/80 dark:text-red-300/70 mt-0.5">Completed by <span className="text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 rounded text-[11px] font-bold">{completedByTrainerName}</span> — only they can modify it.</p>
              </div>
            </motion.div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-5">
                <AnimatePresence>
                  {exercises.map((ex, exIndex) => (
                    <motion.div key={ex.dndId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3, delay: exIndex * 0.05 }}>
                      <SortableExerciseCard
                        exercise={ex} exIndex={exIndex} totalExercises={exercises.length} isReadOnly={isReadOnly}
                        activeNoteIndex={activeNoteIndex} onToggleNote={(idx) => setActiveNoteIndex((n) => (n === idx ? null : idx))}
                        onUpdate={updateExercise} onUpdateSet={updateSet} onSetCount={handleSetCount}
                        onDuplicateLastSet={duplicateLastSet} onClearWeights={clearWeights}
                        onRemoveSet={removeSet} onDelete={handleDeleteExercise}
                        onMoveUp={() => moveExercise(exIndex, -1)} onMoveDown={() => moveExercise(exIndex, 1)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={{ duration: 280, easing: 'cubic-bezier(0.2,0,0,1)', sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.35' } } }) }}>
              {activeDndExercise && <DragGhost exercise={activeDndExercise} index={activeDndIndex} />}
            </DragOverlay>
          </DndContext>

          {!isReadOnly && (
            <motion.button whileTap={{ scale: 0.98 }} onClick={addExercise} className="w-full py-6 rounded-[2rem] border-2 border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-500/5 flex flex-col items-center justify-center gap-3 font-black transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-orange-100 dark:group-hover:bg-orange-500/20 group-hover:text-orange-500 transition-colors"><Plus size={24} /></div>
              Add Exercise
            </motion.button>
          )}
        </div>
      </div>

      {/* ── BOTTOM ACTION BAR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="h-10 bg-gradient-to-t from-zinc-50 dark:from-[#0a0a0f] to-transparent pointer-events-none" />
        <div className="bg-white/90 dark:bg-[#0a0a0f]/90 backdrop-blur-2xl border-t border-zinc-200/50 dark:border-white/[0.05] pb-5 pt-3 px-4 pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="max-w-2xl mx-auto flex gap-3">
            {!isReadOnly ? (
              <>
                <button onClick={() => handleSave(false)} disabled={isSaving} className="flex-1 py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-white/[0.06] hover:bg-zinc-200 dark:hover:bg-zinc-800 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60">
                  {isSaving ? <Activity size={16} className="animate-spin text-orange-500" /> : <Save size={16} />} Save Draft
                </button>
                {!isSessionCompleted && (
                  <button onClick={handleCompleteIntent} disabled={isSaving} className="flex-[1.6] py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-orange-500/30 transition-all active:scale-95 disabled:opacity-60 relative overflow-hidden">
                    <CheckCircle size={16} /> Complete Workout
                  </button>
                )}
              </>
            ) : (
              <div className="w-full bg-zinc-900/95 dark:bg-black/80 backdrop-blur-2xl px-6 py-4 rounded-3xl border border-white/[0.08] flex items-center justify-center gap-3">
                <Lock size={14} className="text-zinc-500" />
                <p className="text-zinc-400 text-sm font-medium">Finalized by <span className="text-white font-black">{completedByTrainerName}</span></p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── HISTORY DRAWER ── */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistory(false)} className="fixed inset-0 z-[250] bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-y-0 right-0 z-[260] w-full max-w-md bg-white dark:bg-[#111116] border-l border-zinc-200/80 dark:border-white/[0.06] flex flex-col shadow-2xl">
              <div className="px-5 py-4 border-b border-zinc-100 dark:border-white/[0.06] flex justify-between items-center bg-zinc-50/80 dark:bg-white/[0.02]">
                <h3 className="font-black text-lg text-zinc-900 dark:text-white flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-500/15 flex items-center justify-center"><History size={15} className="text-orange-500" /></div>
                  Workout History
                </h3>
                <button onClick={() => setShowHistory(false)} className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-white/[0.07] flex items-center justify-center active:scale-90"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {recentSplits.length === 0 ? (
                  <div className="text-center py-16 text-zinc-400 dark:text-zinc-600">
                    <History size={40} className="mx-auto mb-4 opacity-30" />
                    <p className="font-black text-base">No previous workouts</p>
                  </div>
                ) : (
                  recentSplits.map((session, idx) => (
                    <div key={session.id ?? idx} className="bg-zinc-50/80 dark:bg-white/[0.03] border border-zinc-200/80 dark:border-white/[0.06] rounded-3xl p-4 hover:border-orange-300 dark:hover:border-orange-500/30 transition-all group">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-black text-zinc-900 dark:text-white text-sm">{session.name}</h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-md font-bold">#{session.session_number}</span>
                            <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1"><Calendar size={11} /> {new Date(session.date_completed || session.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button onClick={() => loadFromHistory(session)} disabled={isReadOnly} className="text-xs font-black bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/25 px-3 py-1.5 rounded-xl hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 dark:hover:text-white transition-all active:scale-90 disabled:opacity-40">Load</button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {session.exercises?.slice(0, 4).map((ex, i) => <span key={i} className="text-[11px] bg-white dark:bg-zinc-800/60 px-2 py-0.5 rounded-lg font-semibold border border-zinc-100 dark:border-white/[0.06]">{ex.name}</span>)}
                        {session.exercises?.length > 4 && <span className="text-[11px] font-bold text-zinc-400 px-1">+{session.exercises.length - 4} more</span>}
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="w-full max-w-sm bg-white dark:bg-[#1a1a1f] border border-zinc-200/80 dark:border-white/[0.07] rounded-[2rem] shadow-2xl p-7 relative">
              <button onClick={() => setShowPdfModal(false)} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-white/[0.08] active:scale-90"><X size={16} /></button>
              <div className="flex flex-col items-center text-center mb-6 mt-1">
                <div className="w-14 h-14 rounded-3xl bg-orange-500/10 ring-1 ring-orange-500/20 flex items-center justify-center mb-4 text-orange-500"><FileText size={26} /></div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white">Export PDF</h3>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Client Name</label>
                  <div className="relative">
                    <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input autoFocus value={pdfManualClientName} onChange={(e) => setPdfManualClientName(e.target.value)} placeholder="e.g. John Doe" className="w-full bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/[0.08] rounded-2xl py-3.5 pl-11 pr-4 font-bold outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" />
                  </div>
                </div>
                {isClient && (
                  <PDFDownloadLink document={<WorkoutPDF_EN sessionName={sessionName || defaultSessionName || `Session ${sessionNum}`} sessionNumber={parseInt(sessionNum) || 1} clientName={pdfManualClientName || 'Client'} trainerName={trainerName || 'Trainer'} brandName="TFG" date={new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} exercises={exercises} />} fileName={`${(sessionName || 'Session').replace(/\s+/g, '_')}_${pdfManualClientName || 'Client'}.pdf`} className={cn("w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-sm shadow-xl transition-all active:scale-95", !pdfManualClientName ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed pointer-events-none" : "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-400 shadow-orange-500/30")}>
                    {({ loading: pdfLoading }) => (<>{pdfLoading ? <Activity size={16} className="animate-spin" /> : <Download size={16} />} <span>{pdfLoading ? 'Generating…' : 'Download PDF'}</span></>)}
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