/**
 * WorkoutEditor.jsx — Redesigned Premium Edition v3
 * Features:
 * - Fully responsive with an upgraded desktop and mobile UI (Mobile Fixes Applied)
 * - Beautiful Animations & Glassmorphism effects
 * - Dropdown menus instead of pill groups for better space management
 * - Deep Dark Mode and Crisp Light Mode support
 * - Touch-friendly enhancements for mobile users
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

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
  ChevronUp, ChevronDown,
} from 'lucide-react';

import toast, { Toaster } from 'react-hot-toast';

// -----------------------------------------------------------------------------
// PREVIEW MOCKS: 
// The following imports are commented out to allow the code to run in this preview environment.
// Please UNCOMMENT these lines and REMOVE the mock definitions below in your local project.
// -----------------------------------------------------------------------------
import api from '../api';
import WorkoutPDF_EN from '../utils/WorkoutPDF.jsx';
import { PDFDownloadLink } from '@react-pdf/renderer';

const api = {
  get: async (url) => ({ data: url.includes('history') ? [] : { name: 'Sample Session', exercises: [], is_completed: false } }),
  post: async () => ({ data: { success: true } })
};

const WorkoutPDF_EN = () => null;

const PDFDownloadLink = ({ children, className }) => (
  <button type="button" className={className} onClick={() => alert('PDF Download is simulated in this preview.')}>
    {typeof children === 'function' ? children({ loading: false }) : children}
  </button>
);
// -----------------------------------------------------------------------------

// ─────────────────────────────────────────────────────────────────────────────
// DEBOUNCE HOOK
// ─────────────────────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

// ─────────────────────────────────────────────────────────────────────────────
// STABLE DND ID FACTORY
// ─────────────────────────────────────────────────────────────────────────────
let _dndCounter = 0;
const nextDndId = () => `ex-${++_dndCounter}`;

// ─────────────────────────────────────────────────────────────────────────────
// INLINE SVG UserIcon
// ─────────────────────────────────────────────────────────────────────────────
const UserIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG MAPS
// ─────────────────────────────────────────────────────────────────────────────
const TECHNIQUE_CONFIG = {
  Regular:     { color: 'text-zinc-500 dark:text-zinc-400',    icon: Activity   },
  'Drop Set':  { color: 'text-red-500 dark:text-red-400',      icon: ArrowDown  },
  'Super Set': { color: 'text-purple-500 dark:text-purple-400',icon: Layers     },
  Pyramid:     { color: 'text-amber-500 dark:text-amber-400',  icon: TrendingUp },
  Negative:    { color: 'text-blue-500 dark:text-blue-400',    icon: Zap        },
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
// CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────────────────
const ConfirmModal = memo(({ open, title, message, confirmLabel, onConfirm, onCancel, variant = 'default' }) => {
  if (!open) return null;
  const isDestructive = variant === 'destructive';
  const btnCls = isDestructive
    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20'
    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-orange-500/30';
  return (
    <div className="fixed inset-0 z-[400] bg-zinc-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 transition-all">
      <div className="w-full max-w-sm bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 shadow-inner ${isDestructive ? 'bg-red-50 dark:bg-red-500/10 text-red-500' : 'bg-orange-50 dark:bg-orange-500/10 text-orange-500'}`}>
            {isDestructive ? <AlertTriangle size={32} /> : <CheckCircle2 size={32} />}
          </div>
          <h3 className="text-xl font-black text-zinc-900 dark:text-white">{title}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm transition-all active:scale-95">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={`flex-[1.4] py-3.5 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-95 ${btnCls}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonLoader = () => (
  <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-50 dark:bg-[#09090b]">
    <div className="shrink-0 bg-white/95 dark:bg-[#121214]/95 border-b border-zinc-200 dark:border-zinc-800/50 h-[80px]">
      <div className="max-w-5xl mx-auto px-4 h-full flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        <div className="flex-1 flex flex-col items-center gap-3">
          <div className="h-6 w-56 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-3 w-32 rounded-lg bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
        </div>
        <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
      </div>
    </div>
    <div className="flex-1 p-4 space-y-5 max-w-5xl mx-auto w-full mt-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm">
          <div className="flex gap-4 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
            <div className="flex-1 space-y-3 pt-1">
              <div className="h-7 w-3/4 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
              <div className="h-3 w-1/3 rounded-lg bg-zinc-50 dark:bg-zinc-950 animate-pulse" />
            </div>
          </div>
          <div className="space-y-3 bg-zinc-50/50 dark:bg-zinc-900/20 rounded-3xl p-4">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED MOUNT WRAPPER
// ─────────────────────────────────────────────────────────────────────────────
const AnimatedCard = ({ children, delay = 0 }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  return (
    <div className={`transition-all duration-500 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DRAG GHOST CARD
// ─────────────────────────────────────────────────────────────────────────────
const DragGhost = ({ exercise, index }) => (
  <div className="bg-white/95 dark:bg-[#1c1c1f]/95 backdrop-blur-md border border-orange-500/50 rounded-3xl p-5 shadow-2xl shadow-orange-500/20 cursor-grabbing"
    style={{ transform: 'rotate(2deg) scale(1.05)' }}>
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-inner flex items-center justify-center text-white font-black text-lg select-none">
        {String(index + 1).padStart(2, '0')}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-zinc-900 dark:text-white text-base truncate">
          {exercise.name || <span className="text-zinc-400 italic">Unnamed exercise</span>}
        </p>
        <p className="text-xs text-orange-500 font-semibold mt-1">
          {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''} · moving…
        </p>
      </div>
      <GripVertical size={20} className="text-orange-500/70 shrink-0" />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DROP PLACEHOLDER
// ─────────────────────────────────────────────────────────────────────────────
const DropPlaceholder = () => (
  <div className="rounded-[2rem] border-2 border-dashed border-orange-400/50 dark:border-orange-500/30 bg-orange-50/50 dark:bg-orange-500/[0.04] h-[120px] flex flex-col items-center justify-center gap-2 text-orange-400/60 dark:text-orange-500/50 transition-all">
    <GripVertical size={24} className="animate-bounce" />
    <span className="text-xs font-bold uppercase tracking-widest">Drop here</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SORTABLE EXERCISE CARD WRAPPER
// ─────────────────────────────────────────────────────────────────────────────
const SortableExerciseCard = (props) => {
  const { exercise, isReadOnly } = props;
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: exercise.dndId, disabled: isReadOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 250ms cubic-bezier(0.2,0,0,1)',
  };

  if (isDragging) {
    return <div ref={setNodeRef} style={style} className="z-50 relative"><DropPlaceholder /></div>;
  }

  return (
    <div ref={setNodeRef} style={style} className="relative z-10">
      <ExerciseCardContent {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EXERCISE CARD CONTENT
// ─────────────────────────────────────────────────────────────────────────────
const ExerciseCardContent = memo(({
  exercise: ex, exIndex, totalExercises, isReadOnly,
  dragHandleProps,
  onUpdate, onUpdateSet, onSetCount, onDuplicateLastSet, onClearWeights,
  onRemoveSet, onDelete, onMoveUp, onMoveDown,
  activeNoteIndex, onToggleNote,
}) => {
  const tabIdx = (setIdx, field) => 100 + exIndex * 100 + setIdx * 2 + (field === 'weight' ? 1 : 0);
  const isFirst = exIndex === 0;
  const isLast  = exIndex === totalExercises - 1;

  return (
    <div className="group relative bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800/80 rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-black/50 transition-all duration-300 overflow-hidden">
      
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="p-4 md:p-6 pb-4 flex items-start gap-3 md:gap-4 relative overflow-hidden">
        {/* Decorative background accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 dark:bg-orange-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        {/* Drag handle + arrow controls */}
        {!isReadOnly && (
          <div className="flex flex-col items-center gap-1 shrink-0 z-10">
            <button
              {...dragHandleProps}
              className="w-10 h-10 flex items-center justify-center rounded-2xl text-zinc-400 dark:text-zinc-600 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-all cursor-grab active:cursor-grabbing touch-none select-none shadow-sm border border-transparent hover:border-orange-200 dark:hover:border-orange-500/20"
              aria-label="Drag to reorder exercise"
            >
              <GripVertical size={20} />
            </button>
            <div className="flex flex-col gap-0.5 mt-1">
              <button onClick={onMoveUp} disabled={isFirst}
                className="w-8 h-6 flex items-center justify-center rounded-t-lg bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30 transition-all hover:bg-zinc-200 dark:hover:bg-zinc-800 active:scale-90">
                <ChevronUp size={14} />
              </button>
              <button onClick={onMoveDown} disabled={isLast}
                className="w-8 h-6 flex items-center justify-center rounded-b-lg bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-30 transition-all hover:bg-zinc-200 dark:hover:bg-zinc-800 active:scale-90">
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Exercise number badge */}
        <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 border border-zinc-200/50 dark:border-zinc-700 shadow-inner flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-black text-lg md:text-xl z-10">
          {String(exIndex + 1).padStart(2, '0')}
        </div>

        {/* Name input + quick-action row */}
        <div className="flex-1 min-w-0 z-10 pt-0.5">
          <input
            value={ex.name || ''}
            onChange={(e) => onUpdate(exIndex, 'name', e.target.value)}
            disabled={isReadOnly}
            placeholder="Exercise name…"
            tabIndex={2 + exIndex * 200}
            className="w-full bg-transparent text-lg md:text-2xl font-black text-zinc-900 dark:text-white placeholder-zinc-300 dark:placeholder-zinc-700 outline-none border-b-2 border-transparent focus:border-orange-400 dark:focus:border-orange-500/50 transition-all pb-1 disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] md:text-xs px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-100 dark:border-orange-500/20 whitespace-nowrap">
              {ex.sets.length} Set{ex.sets.length !== 1 ? 's' : ''}
            </span>
            {!isReadOnly && (
              <>
                <button onClick={() => onDuplicateLastSet(exIndex)}
                  className="text-[10px] md:text-xs flex items-center gap-1 text-zinc-500 dark:text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors font-semibold px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 whitespace-nowrap">
                  <Copy size={12} /> Duplicate
                </button>
                <button onClick={() => onClearWeights(exIndex)}
                  className="text-[10px] md:text-xs flex items-center gap-1 text-zinc-500 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors font-semibold px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 whitespace-nowrap">
                  <RotateCcw size={12} /> Clear
                </button>
              </>
            )}
          </div>
        </div>

        {/* Delete button */}
        {!isReadOnly && (
          <button onClick={() => onDelete(exIndex)}
            className="shrink-0 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-xl md:rounded-2xl text-zinc-400 hover:text-white hover:bg-red-500 shadow-sm border border-transparent hover:border-red-600 transition-all md:opacity-0 md:group-hover:opacity-100 active:scale-90 z-10">
            <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
          </button>
        )}
      </div>

      {/* Set count stepper */}
      <div className="px-4 md:px-6 pb-4 flex items-center z-10 relative">
        <div className="flex items-center bg-zinc-100/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl p-1.5 border border-zinc-200/80 dark:border-zinc-800 shadow-inner">
          <button onClick={() => onSetCount(exIndex, -1)} disabled={isReadOnly}
            className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:shadow-md transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed">
            <Minus size={14} className="md:w-4 md:h-4" />
          </button>
          <span className="w-14 md:w-16 text-center text-[10px] md:text-xs font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-widest select-none">
            {ex.sets.length} SETS
          </span>
          <button onClick={() => onSetCount(exIndex, 1)} disabled={isReadOnly}
            className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700 text-orange-500 hover:bg-orange-50 hover:border-orange-200 dark:hover:bg-orange-500/20 dark:hover:border-orange-500/30 hover:shadow-md transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed">
            <Plus size={14} className="md:w-4 md:h-4" />
          </button>
        </div>
      </div>

      {/* ── SETS TABLE ──────────────────────────────────────────────────────── */}
      <div className="mx-3 md:mx-6 mb-4 bg-zinc-50 dark:bg-zinc-900/30 rounded-3xl overflow-hidden border border-zinc-200/60 dark:border-zinc-800/60 shadow-inner">
        
        {/* Desktop Header */}
        <div className="hidden md:grid grid-cols-[40px_1fr_1fr_1.5fr_1.5fr_40px] gap-4 px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest select-none">
          <span className="text-center">#</span>
          <span className="text-center">Reps</span>
          <span className="text-center">Weight <span className="text-[9px] opacity-70 lowercase">(kg)</span></span>
          <span>Technique</span>
          <span>Equipment</span>
          <span />
        </div>

        <div className="flex flex-col">
          {ex.sets.map((set, setIndex) => {
            return (
              <div key={set.id ?? `ns-${setIndex}`}
                className="group/row border-b border-zinc-200/50 dark:border-zinc-800/50 last:border-0 hover:bg-white dark:hover:bg-zinc-800/40 transition-colors p-3 md:p-0"
                style={{ animation: 'slideInRow 0.25s ease-out both', animationDelay: `${setIndex * 30}ms` }}>
                
                {/* ── Mobile Layout (Fixed Overlaps) ── */}
                <div className="md:hidden flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[11px] font-black text-zinc-600 dark:text-zinc-300 shrink-0 shadow-inner">
                      {setIndex + 1}
                    </span>
                    
                    <div className="flex-1 flex gap-2">
                      {/* Reps Input (Improved Layout) */}
                      <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 rounded-xl overflow-hidden transition-all">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 text-center pt-1.5 pb-0.5 bg-zinc-50 dark:bg-zinc-800/50">Reps</label>
                        <input type="number" inputMode="numeric" placeholder="0"
                          value={set.reps || ''} disabled={isReadOnly}
                          tabIndex={tabIdx(setIndex, 'reps')}
                          onChange={(e) => onUpdateSet(exIndex, setIndex, 'reps', e.target.value)}
                          className="w-full bg-transparent py-2 text-center text-sm font-bold text-zinc-900 dark:text-white outline-none disabled:opacity-60" />
                      </div>
                      
                      {/* Weight Input (Improved Layout) */}
                      <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 rounded-xl overflow-hidden transition-all">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 text-center pt-1.5 pb-0.5 bg-zinc-50 dark:bg-zinc-800/50">Weight</label>
                        <input type="number" inputMode="decimal" placeholder="0"
                          value={set.weight || ''} disabled={isReadOnly}
                          tabIndex={tabIdx(setIndex, 'weight')}
                          onChange={(e) => onUpdateSet(exIndex, setIndex, 'weight', e.target.value)}
                          className="w-full bg-transparent py-2 text-center text-sm font-bold text-zinc-900 dark:text-white outline-none disabled:opacity-60" />
                      </div>
                    </div>

                    {ex.sets.length > 1 && !isReadOnly && (
                      <button onClick={() => onRemoveSet(exIndex, setIndex)}
                        className="w-9 h-9 shrink-0 flex items-center justify-center text-red-400 hover:text-white hover:bg-red-500 bg-red-50 dark:bg-red-500/10 dark:hover:bg-red-500 rounded-xl transition-all active:scale-90">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  
                  {/* Mobile Dropdowns (Added Truncate to prevent overflowing) */}
                  <div className="grid grid-cols-2 gap-2 pl-9 pr-1">
                    <div className="relative">
                      <select value={set.technique || 'Regular'} disabled={isReadOnly}
                        onChange={(e) => onUpdateSet(exIndex, setIndex, 'technique', e.target.value)}
                        className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-[11px] font-bold rounded-lg py-2 pl-2 pr-6 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all disabled:opacity-60 truncate">
                        {Object.keys(TECHNIQUE_CONFIG).map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={12} />
                    </div>
                    <div className="relative">
                      <select value={set.equipment || ''} disabled={isReadOnly}
                        onChange={(e) => onUpdateSet(exIndex, setIndex, 'equipment', e.target.value)}
                        className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-[11px] font-bold rounded-lg py-2 pl-2 pr-6 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all disabled:opacity-60 truncate">
                        <option value="">No Equip</option>
                        {Object.keys(EQUIP_CONFIG).map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={12} />
                    </div>
                  </div>
                </div>

                {/* ── Desktop Layout ── */}
                <div className="hidden md:grid grid-cols-[40px_1fr_1fr_1.5fr_1.5fr_40px] gap-4 px-4 py-3 items-center">
                  <span className="text-center text-sm font-black text-zinc-400 dark:text-zinc-500">{setIndex + 1}</span>
                  <input type="number" inputMode="numeric" placeholder="0"
                    value={set.reps || ''} disabled={isReadOnly}
                    tabIndex={tabIdx(setIndex, 'reps')}
                    onChange={(e) => onUpdateSet(exIndex, setIndex, 'reps', e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-xl py-2.5 text-center text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all disabled:opacity-60 shadow-sm" />
                  <input type="number" inputMode="decimal" placeholder="0.0"
                    value={set.weight || ''} disabled={isReadOnly}
                    tabIndex={tabIdx(setIndex, 'weight')}
                    onChange={(e) => onUpdateSet(exIndex, setIndex, 'weight', e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 rounded-xl py-2.5 text-center text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all disabled:opacity-60 shadow-sm" />
                  
                  <div className="relative w-full shadow-sm rounded-xl">
                    <select value={set.technique || 'Regular'} disabled={isReadOnly}
                      onChange={(e) => onUpdateSet(exIndex, setIndex, 'technique', e.target.value)}
                      className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-bold rounded-xl py-2.5 pl-4 pr-10 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all disabled:opacity-60 cursor-pointer truncate">
                      {Object.keys(TECHNIQUE_CONFIG).map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                  </div>
                  
                  <div className="relative w-full shadow-sm rounded-xl">
                    <select value={set.equipment || ''} disabled={isReadOnly}
                      onChange={(e) => onUpdateSet(exIndex, setIndex, 'equipment', e.target.value)}
                      className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-bold rounded-xl py-2.5 pl-4 pr-10 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all disabled:opacity-60 cursor-pointer truncate">
                      <option value="">None</option>
                      {Object.keys(EQUIP_CONFIG).map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                  </div>

                  {ex.sets.length > 1 && !isReadOnly ? (
                    <button onClick={() => onRemoveSet(exIndex, setIndex)}
                      className="w-9 h-9 flex items-center justify-center text-red-400 hover:text-white hover:bg-red-500 bg-red-50 dark:bg-red-500/10 dark:hover:bg-red-500 rounded-xl transition-all opacity-0 group-hover/row:opacity-100 focus:opacity-100 shadow-sm active:scale-90 mx-auto">
                      <X size={16} />
                    </button>
                  ) : <div />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── NOTE ─────────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 pb-5">
        <button onClick={() => onToggleNote(exIndex)} disabled={isReadOnly}
          className="flex items-center gap-2 text-[13px] md:text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors py-1 disabled:cursor-default bg-zinc-100 dark:bg-zinc-800/50 px-3 rounded-lg w-fit">
          <MessageSquare size={14} />
          {ex.note ? <span className="text-orange-500 dark:text-orange-400">Edit Note</span> : 'Add Note'}
        </button>
        {(activeNoteIndex === exIndex || ex.note) && (
          <div className={`mt-3 transition-all duration-300 ${activeNoteIndex === exIndex ? 'opacity-100 scale-100' : 'opacity-80 scale-[0.99]'}`}>
            <textarea
              value={ex.note || ''} rows={2}
              onChange={(e) => onUpdate(exIndex, 'note', e.target.value)}
              disabled={isReadOnly}
              readOnly={isReadOnly || activeNoteIndex !== exIndex}
              placeholder="E.g., Seat height 4, slow eccentric phase..."
              className="w-full bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-3 md:p-4 text-sm font-medium text-zinc-800 dark:text-zinc-200 placeholder-amber-400/70 dark:placeholder-amber-700/70 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/10 resize-none transition-all disabled:opacity-70 shadow-inner"
            />
          </div>
        )}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
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
  
  // NOTE: debouncedValues are kept if needed by other logic, but removed from PDF to fix #8
  const debouncedExercises   = useDebounce(exercises, 800);
  const debouncedSessionName = useDebounce(sessionName, 800);

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

  useEffect(() => {
    // For preview purposes, we bypass the subId and sessionNum check
    // if (!subId || !sessionNum) { setLoading(false); return; }
    let cancelled = false;

    const fetchData = async () => {
      try {
        try {
          const meRes = await api.get('/auth/users/me/');
          if (!cancelled) setCurrentUserId(Number(meRes?.data?.id || 1));
        } catch {}

        try {
          const subRes = await api.get(`/client-subscriptions/${subId}/`);
          if (!cancelled) {
            const cId = typeof subRes?.data?.client === 'object' ? subRes.data.client?.id : subRes?.data?.client;
            setClientId(cId ?? null);
            setClientName(subRes?.data?.client_name || (typeof subRes?.data?.client === 'object' && subRes?.data?.client?.name) || 'Client');
            setTrainerName(subRes?.data?.trainer_name || 'TFG Coach');
          }
        } catch {}

        const res = await api.get(`/training-sessions/get-data/?subscription=${subId}&session_number=${sessionNum}`);
        if (cancelled) return;

        const data = res.data || {};
        setSessionName(data.name?.trim() || defaultSessionName || `Session ${sessionNum || 1}`);
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
          .then((r) => { if (!cancelled) setRecentSplits(r.data || []); })
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

  const handleDragStart  = useCallback(({ active })        => setActiveDndId(active.id), []);
  const handleDragCancel = useCallback(()                  => setActiveDndId(null), []);
  const handleDragEnd    = useCallback(({ active, over }) => {
    setActiveDndId(null);
    if (!over || active.id === over.id) return;
    setExercises((prev) => {
      const oldIdx = prev.findIndex((ex) => ex.dndId === active.id);
      const newIdx = prev.findIndex((ex) => ex.dndId === over.id);
      return (oldIdx === -1 || newIdx === -1) ? prev : arrayMove(prev, oldIdx, newIdx);
    });
  }, []);

  const updateExercise = useCallback((idx, field, val) => {
    setExercises((prev) => prev.map((ex, i) => (i === idx ? { ...ex, [field]: val } : ex)));
  }, []);

  const updateSet = useCallback((exIdx, setIdx, field, val) => {
    setExercises((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      return { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: val } : s)) };
    }));
  }, []);

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
    setExercises((prev) => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      return { ...ex, sets: ex.sets.map((s) => ({ ...s, weight: '' })) };
    }));
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
      open: true,
      title: 'Complete Workout?',
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
        open: true, variant: 'destructive',
        title: 'Delete Exercise?',
        message: `"${ex.name || 'This exercise'}" has data that will be removed.`,
        confirmLabel: 'Delete',
        onConfirm: () => { setConfirmModal({ open: false }); removeExercise(idx); },
        onCancel:  () => setConfirmModal({ open: false }),
      });
    } else {
      removeExercise(idx);
    }
  }, [exercises, removeExercise]);

  const loadFromHistory = useCallback((historySession) => {
    setConfirmModal({
      open: true,
      title: 'Load from History?',
      message: `Overwrite current workout with "${historySession.name}"?`,
      confirmLabel: 'Load Data',
      onConfirm: () => {
        setConfirmModal({ open: false });
        setExercises(historySession.exercises.map((ex) => ({
          dndId: nextDndId(),
          name: ex.name, note: ex.note || '',
          sets: ex.sets.map((s) => ({
            reps: s.reps, weight: s.weight,
            technique: s.technique || 'Regular',
            equipment: s.equipment || '',
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
    <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans selection:bg-orange-500/30 transition-colors">
      <Toaster position="top-center"
        toastOptions={{ style: { background: '#18181b', color: '#fff', border: '1px solid #27272a', borderRadius: '16px', fontWeight: 'bold' } }} />

      <ConfirmModal {...confirmModal} />

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 z-50 bg-white/80 dark:bg-[#121214]/80 backdrop-blur-2xl border-b border-zinc-200 dark:border-zinc-800/50 sticky top-0 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-[80px] grid grid-cols-[40px_1fr_auto] md:grid-cols-[48px_1fr_auto] items-center gap-2 md:gap-4">

          <button onClick={handleBack}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-all active:scale-90 shadow-sm">
            <ArrowLeft size={20} className="text-zinc-700 dark:text-white" />
          </button>

          <div className="flex flex-col items-center min-w-0 px-1 md:px-2">
            <input
              value={sessionName || ''} onChange={(e) => setSessionName(e.target.value)}
              onFocus={(e) => e.target.select()} disabled={isReadOnly} placeholder="Workout Name" tabIndex={1}
              className="bg-transparent text-center text-base md:text-2xl font-black text-zinc-900 dark:text-white placeholder-zinc-300 dark:placeholder-zinc-700 outline-none w-full border-b-2 border-transparent focus:border-orange-500 dark:focus:border-orange-500 transition-all pb-1 truncate disabled:opacity-70 disabled:cursor-not-allowed"
            />
            <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-1">
              <span className="flex items-center gap-1 md:gap-1.5 bg-zinc-100 dark:bg-zinc-800/50 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full border border-zinc-200 dark:border-zinc-700 truncate max-w-[100px] md:max-w-none">
                <User size={10} className="text-orange-500 shrink-0" />
                <span className="text-zinc-800 dark:text-zinc-200 truncate">{clientName}</span>
              </span>
              <span className="text-zinc-300 dark:text-zinc-700 shrink-0">•</span>
              <span className="uppercase tracking-widest opacity-80 shrink-0">Sess {sessionNum || 1}</span>
              {isSessionCompleted && (
                <><span className="text-zinc-300 dark:text-zinc-700 hidden md:inline shrink-0">•</span>
                  <span className="hidden md:flex items-center gap-1 text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0"><CheckCircle size={10} /> Done</span></>
              )}
            </div>
          </div>

          <div className="relative flex items-center gap-2 md:gap-3" ref={menuRef}>
            <button onClick={() => setShowHistory(true)} disabled={isReadOnly}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-orange-600 dark:hover:text-orange-500 hover:border-orange-500/50 flex items-center justify-center transition-all active:scale-90 disabled:opacity-40 shadow-sm">
              <History size={18} />
            </button>
            <button onClick={() => setIsMenuOpen((o) => !o)}
              className={`w-10 h-10 md:w-12 md:h-12 rounded-full border flex items-center justify-center transition-all active:scale-90 shadow-sm ${isMenuOpen ? 'bg-orange-500 text-white border-orange-400 shadow-orange-500/30' : 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}>
              <MoreVertical size={18} />
            </button>
            {isMenuOpen && (
              <div className="absolute top-12 md:top-14 right-0 w-56 md:w-64 bg-white/90 dark:bg-[#18181b]/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-700/50 rounded-3xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200 z-50 origin-top-right">
                {isClient && (
                  <button onClick={handleOpenPdfModal}
                    className="w-full px-4 py-3 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-900 dark:text-white font-bold text-sm flex items-center justify-between gap-3 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center border border-orange-100 dark:border-orange-500/20">
                        <FileText size={14} className="text-orange-500" />
                      </div>
                      <span>Export to PDF</span>
                    </div>
                    <ChevronRight size={16} className="text-zinc-400" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 md:px-6 pt-6 pb-40">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Read-only banner */}
          {isReadOnly && (
            <div className="bg-gradient-to-r from-red-50 to-white dark:from-red-950/30 dark:to-[#121214] border border-red-200 dark:border-red-500/20 rounded-3xl p-4 md:p-5 flex items-center gap-3 md:gap-4 shadow-sm mx-2 md:mx-0">
              <div className="p-2 md:p-3 bg-red-100 dark:bg-red-500/20 rounded-2xl text-red-600 dark:text-red-400 shrink-0"><Lock size={18} /></div>
              <div>
                <h4 className="font-black text-sm md:text-base text-red-700 dark:text-red-400">Locked Session</h4>
                <p className="text-xs md:text-sm font-medium text-red-600/80 dark:text-red-300/80 mt-1">
                  Completed by <span className="text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded text-[10px] md:text-xs">{completedByTrainerName}</span>
                </p>
              </div>
            </div>
          )}

          {/* ── DRAG-AND-DROP LIST ────────────────────────────────────────── */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-4 md:space-y-6">
                {exercises.map((ex, exIndex) => (
                  <AnimatedCard key={ex.dndId} delay={exIndex * 50}>
                    <SortableExerciseCard
                      exercise={ex}
                      exIndex={exIndex}
                      totalExercises={exercises.length}
                      isReadOnly={isReadOnly}
                      activeNoteIndex={activeNoteIndex}
                      onToggleNote={(idx) => setActiveNoteIndex((n) => (n === idx ? null : idx))}
                      onUpdate={updateExercise}
                      onUpdateSet={updateSet}
                      onSetCount={handleSetCount}
                      onDuplicateLastSet={duplicateLastSet}
                      onClearWeights={clearWeights}
                      onRemoveSet={removeSet}
                      onDelete={handleDeleteExercise}
                      onMoveUp={() => moveExercise(exIndex, -1)}
                      onMoveDown={() => moveExercise(exIndex, 1)}
                    />
                  </AnimatedCard>
                ))}
              </div>
            </SortableContext>

            <DragOverlay
              dropAnimation={{
                duration: 300,
                easing: 'cubic-bezier(0.2,0,0,1)',
                sideEffects: defaultDropAnimationSideEffects({
                  styles: { active: { opacity: '0.4' } },
                }),
              }}
            >
              {activeDndExercise && (
                <DragGhost exercise={activeDndExercise} index={activeDndIndex} />
              )}
            </DragOverlay>
          </DndContext>

          {/* Add Exercise CTA */}
          {!isReadOnly && (
            <AnimatedCard delay={exercises.length * 50}>
              <button onClick={addExercise}
                className="w-full py-5 md:py-6 rounded-[2rem] border-2 border-dashed border-zinc-300 dark:border-zinc-700/60 text-zinc-500 dark:text-zinc-500 hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-500/5 dark:hover:border-orange-500/50 hover:text-orange-600 dark:hover:text-orange-400 flex items-center justify-center gap-3 font-black text-base md:text-lg transition-all group shadow-sm active:scale-[0.98]">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 group-hover:bg-orange-100 dark:group-hover:bg-orange-500/20 flex items-center justify-center transition-colors">
                  <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                </div>
                Add Exercise
              </button>
            </AnimatedCard>
          )}
        </div>
      </div>

      {/* ── BOTTOM BAR ────────────────────────────────────────────────────── */}
      <div className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] md:w-full max-w-2xl z-50 pointer-events-none animate-in slide-in-from-bottom-6 duration-500">
        {!isReadOnly ? (
          <div className="pointer-events-auto flex gap-2 md:gap-3 bg-white/90 dark:bg-[#18181b]/90 backdrop-blur-xl p-2 md:p-3 rounded-[2rem] border border-zinc-200/50 dark:border-white/[0.05] shadow-2xl shadow-black/10 dark:shadow-black/60">
            <button onClick={() => handleSave(false)} disabled={isSaving}
              className="flex-1 py-3 md:py-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60 shadow-sm border border-zinc-200/50 dark:border-zinc-700">
              {isSaving ? <Activity size={16} className="animate-spin text-orange-500" /> : <Save size={16} />}
              <span className="hidden sm:inline">{isSaving ? 'Saving…' : 'Save Draft'}</span>
              <span className="sm:hidden">{isSaving ? '...' : 'Save'}</span>
            </button>
            {!isSessionCompleted && (
              <button onClick={handleCompleteIntent} disabled={isSaving}
                className="flex-[1.5] py-3 md:py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-black text-sm md:text-base flex items-center justify-center gap-2 shadow-xl shadow-orange-500/25 transition-all active:scale-95 disabled:opacity-60 relative overflow-hidden group">
                <span className="absolute inset-0 rounded-2xl ring-2 ring-white/20 scale-[0.98] group-hover:scale-100 transition-transform" />
                <CheckCircle size={16} /> 
                <span className="hidden sm:inline">Complete Workout</span>
                <span className="sm:hidden">Complete</span>
              </button>
            )}
          </div>
        ) : (
          <div className="pointer-events-auto bg-zinc-900/95 dark:bg-black/90 backdrop-blur-xl p-4 rounded-3xl border border-white/10 shadow-2xl text-center">
            <p className="text-zinc-400 text-xs md:text-sm font-medium">
              Finalized by <span className="text-white font-bold bg-white/10 px-2 py-0.5 rounded-md ml-1">{completedByTrainerName}</span>
            </p>
          </div>
        )}
      </div>

      {/* ── PDF MODAL ─────────────────────────────────────────────────────────── */}
      {showPdfModal && (
        <div className="fixed inset-0 z-[300] bg-zinc-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 transition-all">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-2xl p-6 md:p-8 relative animate-in fade-in zoom-in-95 duration-300">
            <button onClick={() => setShowPdfModal(false)}
              className="absolute top-4 right-4 md:top-5 md:right-5 w-10 h-10 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors active:scale-90">
              <X size={18} />
            </button>
            <div className="flex flex-col items-center text-center mb-6 mt-2">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-3xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mb-4 text-orange-500 shadow-inner"><FileText size={28} /></div>
              <h3 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white">Export PDF</h3>
              <p className="text-xs md:text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">Confirm client name for the document.</p>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] md:text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Client Name</label>
                <div className="relative">
                  <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input autoFocus value={pdfManualClientName} onChange={(e) => setPdfManualClientName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl py-3 pl-11 pr-4 text-zinc-900 dark:text-white text-sm md:text-base font-bold placeholder:font-medium focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all shadow-sm" />
                </div>
              </div>
              {isClient && (
                <PDFDownloadLink
                  document={
                    <WorkoutPDF_EN
                      sessionName={sessionName || defaultSessionName || `Session ${sessionNum}`}
                      sessionNumber={parseInt(sessionNum) || 1}
                      clientName={pdfManualClientName || 'Client'}
                      trainerName={trainerName || 'Trainer'}
                      brandName="TFG"
                      date={new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                      exercises={exercises}
                    />
                  }
                  fileName={`${(sessionName || 'Session').replace(/\s+/g, '_')}_${pdfManualClientName || 'Client'}.pdf`}
                  className={`w-full py-3.5 md:py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm md:text-base shadow-xl transition-all active:scale-95 ${!pdfManualClientName ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed pointer-events-none' : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-400 hover:to-amber-400 shadow-orange-500/30'}`}>
                  {({ loading: pdfLoading }) => (
                    <>{pdfLoading ? <Activity size={18} className="animate-spin" /> : <Download size={18} />}
                      <span>{pdfLoading ? 'Generating...' : 'Download PDF'}</span></>
                  )}
                </PDFDownloadLink>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY DRAWER ──────────────────────────────────────────────────── */}
      {showHistory && (
        <div className="fixed inset-0 z-[250] bg-zinc-900/40 dark:bg-black/60 backdrop-blur-md flex justify-end transition-all">
          <div className="w-full max-w-md bg-white dark:bg-[#121214] h-full border-l border-zinc-200 dark:border-zinc-800/80 animate-in slide-in-from-right duration-500 ease-out flex flex-col shadow-2xl">
            <div className="px-4 py-4 md:px-5 md:py-5 border-b border-zinc-100 dark:border-zinc-800/80 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/20">
              <h3 className="font-black text-base md:text-lg text-zinc-900 dark:text-white flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center"><History size={16} className="text-orange-500" /></div> 
                Workout History
              </h3>
              <button onClick={() => setShowHistory(false)}
                className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors active:scale-90">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {recentSplits.length === 0 ? (
                <div className="text-center py-20 text-zinc-400 dark:text-zinc-600">
                  <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4"><History size={28} className="opacity-40" /></div>
                  <p className="font-bold text-sm md:text-base">No previous workouts</p>
                  <p className="text-xs md:text-sm font-medium opacity-70 mt-1">Completed sessions will appear here.</p>
                </div>
              ) : (
                recentSplits.map((session, idx) => (
                  <div key={session.id ?? idx}
                    className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 md:p-5 hover:border-orange-300 dark:hover:border-orange-500/50 hover:shadow-lg transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-black text-zinc-900 dark:text-white text-sm md:text-base">{session.name}</h4>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] md:text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 font-bold">
                            #{session.session_number}
                          </span>
                          <span className="text-[10px] md:text-[11px] font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(session.date_completed || session.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => loadFromHistory(session)} disabled={isReadOnly}
                        className="text-[10px] md:text-xs font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 px-3 py-1.5 rounded-xl hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 dark:hover:text-white shadow-sm transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed">
                        Load
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {session.exercises?.slice(0, 5).map((ex, i) => (
                        <span key={i} className="text-[10px] md:text-[11px] bg-zinc-50 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg font-semibold border border-zinc-100 dark:border-zinc-800">
                          {ex.name}
                        </span>
                      ))}
                      {session.exercises?.length > 5 && (
                        <span className="text-[10px] md:text-[11px] font-bold text-zinc-400 dark:text-zinc-500 flex items-center px-1">
                          +{session.exercises.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── GLOBAL KEYFRAMES ──────────────────────────────────────────────────── */}
      <style>{`
        @keyframes slideInRow {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
};

export default WorkoutEditor;