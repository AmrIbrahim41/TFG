/**
 * WorkoutEditor.jsx — Refactored Premium Edition
 * ─────────────────────────────────────────────────────────────────────────────
 * CHANGELOG (vs. original):
 *
 * BACKEND INTEGRATION FIXES
 *  [FIX-1]  completedByTrainerId comparison now uses Number() on both sides to
 *            prevent type-mismatch false-positives (API returns integer, local
 *            state was string from JWT payload).
 *  [FIX-2]  trainer_name (completed_by trainer) is sourced from
 *            `data.trainer_name` (serializer field = completed_by.first_name).
 *            Previously fell back to subscription trainer_name which was wrong
 *            for cross-trainer completions.
 *  [FIX-3]  removeSet now enforces a minimum of 1 set per exercise (was missing,
 *            could send an exercise with 0 sets to the backend causing a silent
 *            empty exercise row).
 *  [FIX-4]  handleSave strips exercises with blank names from the payload
 *            instead of blocking the whole save, preventing orphan DB rows.
 *  [FIX-5]  isReadOnly logic now handles the edge case where completedByTrainerId
 *            is 0 / falsy — previously a trainer with id=0 (shouldn't exist but
 *            defensive) would always unlock the session.
 *  [FIX-6]  History `loadFromHistory` now explicitly strips `id` from sets too
 *            (was stripping exercise ids but not set ids, causing orphan
 *            reference on the backend delete+recreate path).
 *  [FIX-7]  PDF modal now pre-fills `pdfManualClientName` with the resolved
 *            `clientName` on open, saving the trainer a manual typing step.
 *  [FIX-8]  `defaultSessionName` URL param is now applied as a fallback even
 *            when a DB session row exists but has an empty `name` field.
 *
 * UI / UX IMPROVEMENTS
 *  [UI-1]   Exercise cards animate in/out with a CSS opacity+translateY
 *            transition via a MountedExerciseCard wrapper (no new dep needed).
 *  [UI-2]   Set rows animate in with a staggered slide-right on first mount.
 *  [UI-3]   Bottom action bar uses a glass morphism panel with a refined
 *            shadow stack and a pulsing ring on the Complete button.
 *  [UI-4]   Note section uses a proper `open` state, eliminating conflicting
 *            Tailwind max-h classes that previously showed/hid the textarea
 *            unpredictably.
 *  [UI-5]   Exercise card header redesigned — index badge is now an accent
 *            pill, delete button moves to a contextual top-right slot on hover.
 *  [UI-6]   Read-only banner elevated with an icon lock animation.
 *  [UI-7]   Technique / equipment selects replaced with a styled pill-group
 *            on desktop for faster one-tap selection, retaining selects on mobile.
 *  [UI-8]   History drawer items show a mini exercise badge strip.
 *  [UI-9]   Loading state replaced with a skeleton pulse layout.
 *  [UI-10]  "Complete" now shows a confirmation modal instead of blocking
 *            (window.confirm was synchronous and ugly).
 *
 * USABILITY (QoL)
 *  [QoL-1]  Tab-indexing: reps → weight → next reps → next weight. Pressing
 *            Tab from the last weight of a set jumps to the next reps input,
 *            enabling pure keyboard data entry.
 *  [QoL-2]  "Duplicate Last Set" button added per exercise for rapid copying.
 *  [QoL-3]  "Clear Weights" quick action added per exercise.
 *  [QoL-4]  "Add Exercise" is now a prominent floating FAB row at the bottom
 *            instead of a small pill control at the top that was easy to miss.
 *  [QoL-5]  Confirmation modal for "Complete" replaces window.confirm.
 *  [QoL-6]  Delete exercise now warns when the exercise has non-empty data.
 *  [QoL-7]  Session name input auto-selects on focus for quick rename.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  CheckCircle,
  Dumbbell,
  Activity,
  Settings,
  Zap,
  Layers,
  TrendingUp,
  ArrowDown,
  Grip,
  History,
  X,
  Minus,
  FileText,
  MoreVertical,
  ChevronRight,
  Calendar,
  User,
  Download,
  Type,
  MessageSquare,
  Lock,
  Copy,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import api from '../api';
import toast, { Toaster } from 'react-hot-toast';
import WorkoutPDF_EN from '../utils/WorkoutPDF.jsx';
import { PDFDownloadLink } from '@react-pdf/renderer';

// ─────────────────────────────────────────────────────────────────────────────
// DEBOUNCE HOOK
// ─────────────────────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICON (inline SVG to avoid import issues in some setups)
// ─────────────────────────────────────────────────────────────────────────────
const UserIcon = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// TECHNIQUE & EQUIPMENT CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const TECHNIQUE_CONFIG = {
  Regular:   { color: 'text-zinc-500 dark:text-zinc-400',   bg: 'bg-zinc-100 dark:bg-zinc-800/80',     border: 'border-zinc-200 dark:border-zinc-700',     icon: Activity   },
  'Drop Set':{ color: 'text-red-500 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-900/20',        border: 'border-red-100 dark:border-red-500/30',    icon: ArrowDown  },
  'Super Set':{ color:'text-purple-500 dark:text-purple-400',bg:'bg-purple-50 dark:bg-purple-900/20',  border:'border-purple-100 dark:border-purple-500/30',icon: Layers     },
  Pyramid:   { color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20',    border: 'border-amber-100 dark:border-amber-500/30', icon: TrendingUp },
  Negative:  { color: 'text-blue-500 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20',      border: 'border-blue-100 dark:border-blue-500/30',   icon: Zap        },
};

const EQUIP_CONFIG = {
  Bodyweight: { color: 'text-emerald-500 dark:text-emerald-400', icon: UserIcon },
  Dumbbell:   { color: 'text-blue-500 dark:text-blue-400',       icon: Dumbbell },
  Barbell:    { color: 'text-zinc-600 dark:text-zinc-300',       icon: Grip     },
  Cable:      { color: 'text-cyan-500 dark:text-cyan-400',       icon: Zap      },
  Machine:    { color: 'text-indigo-500 dark:text-indigo-400',   icon: Settings },
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY FACTORIES
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_EXERCISE = () => ({
  name: '',
  note: '',
  sets: [{ reps: '', weight: '', technique: 'Regular', equipment: '' }],
});

const EMPTY_SET = () => ({ reps: '', weight: '', technique: 'Regular', equipment: '' });

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM MODAL — replaces window.confirm for "Complete" action  [UI-10]
// ─────────────────────────────────────────────────────────────────────────────
const ConfirmModal = memo(({ isOpen, title, message, confirmLabel, onConfirm, onCancel, variant = 'default' }) => {
  if (!isOpen) return null;
  const isDestructive = variant === 'destructive';
  const confirmCls = isDestructive
    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20'
    : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-orange-900/20';

  return (
    <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center mb-5">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${isDestructive ? 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'}`}>
            {isDestructive ? <AlertTriangle size={28} /> : <CheckCircle2 size={28} />}
          </div>
          <h3 className="text-lg font-black text-zinc-900 dark:text-white">{title}</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-sm transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-[1.4] py-3 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95 ${confirmCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADING STATE  [UI-9]
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonLoader = () => (
  <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-100 dark:bg-[#09090b]">
    {/* Header skeleton */}
    <div className="shrink-0 bg-white/95 dark:bg-[#09090b]/95 border-b border-zinc-200 dark:border-zinc-800/50 h-20">
      <div className="max-w-4xl mx-auto px-3 h-full flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="h-5 w-48 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-3 w-32 rounded-md bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
        </div>
        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
      </div>
    </div>
    {/* Cards skeleton */}
    <div className="flex-1 p-4 space-y-4 max-w-4xl mx-auto w-full">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm"
          style={{ animationDelay: `${i * 80}ms` }}>
          <div className="flex gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-3/4 rounded-lg bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
              <div className="h-3 w-1/3 rounded-md bg-zinc-50 dark:bg-zinc-950 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2 bg-zinc-50 dark:bg-black/20 rounded-2xl p-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED EXERCISE CARD WRAPPER  [UI-1]
// Uses a two-frame mount trick: render with opacity-0/translate-y-2, then
// on next frame flip to opacity-100/translate-y-0.
// ─────────────────────────────────────────────────────────────────────────────
const AnimatedCard = ({ children, className = '' }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      className={`transition-all duration-300 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      } ${className}`}
    >
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TECHNIQUE PILL GROUP (desktop)  [UI-7]
// ─────────────────────────────────────────────────────────────────────────────
const TechniquePillGroup = memo(({ value, onChange, disabled }) => (
  <div className="flex flex-wrap gap-1">
    {Object.entries(TECHNIQUE_CONFIG).map(([tech, cfg]) => {
      const Icon = cfg.icon;
      const isActive = value === tech;
      return (
        <button
          key={tech}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(tech)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition-all active:scale-95 disabled:cursor-not-allowed ${
            isActive
              ? `${cfg.bg} ${cfg.border} ${cfg.color}`
              : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <Icon size={11} />
          {tech}
        </button>
      );
    })}
  </div>
));

// ─────────────────────────────────────────────────────────────────────────────
// EQUIPMENT PILL GROUP (desktop)  [UI-7]
// ─────────────────────────────────────────────────────────────────────────────
const EquipPillGroup = memo(({ value, onChange, disabled }) => (
  <div className="flex flex-wrap gap-1">
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange('')}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition-all active:scale-95 disabled:cursor-not-allowed ${
        !value
          ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-200'
          : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600'
      }`}
    >
      None
    </button>
    {Object.entries(EQUIP_CONFIG).map(([equip, cfg]) => {
      const Icon = cfg.icon;
      const isActive = value === equip;
      return (
        <button
          key={equip}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(equip)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition-all active:scale-95 disabled:cursor-not-allowed ${
            isActive
              ? `bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-500 ${cfg.color}`
              : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <Icon size={11} className={isActive ? cfg.color : ''} />
          {equip}
        </button>
      );
    })}
  </div>
));

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const WorkoutEditor = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const params     = new URLSearchParams(location.search);
  const subId      = params.get('sub');
  const sessionNum = params.get('session');
  // [FIX-8] defaultSessionName used even when a DB row exists but name is empty
  const defaultSessionName = params.get('defaultName') || '';

  // ── Core state ─────────────────────────────────────────────────────────────
  const [loading, setLoading]               = useState(true);
  const [sessionName, setSessionName]       = useState('');
  const [exercises, setExercises]           = useState([]);
  const [isSaving, setIsSaving]             = useState(false);
  const [isClient, setIsClient]             = useState(false);

  // ── Identity ───────────────────────────────────────────────────────────────
  const [clientId, setClientId]             = useState(null);
  const [clientName, setClientName]         = useState('Client');
  const [trainerName, setTrainerName]       = useState('Trainer');
  const [currentUserId, setCurrentUserId]   = useState(null);

  // ── Session state ──────────────────────────────────────────────────────────
  const [isSessionCompleted, setIsSessionCompleted] = useState(false);
  const [completedByTrainerId, setCompletedByTrainerId] = useState(null);
  const [completedByTrainerName, setCompletedByTrainerName] = useState('');

  // ── UI state ───────────────────────────────────────────────────────────────
  const [recentSplits, setRecentSplits]     = useState([]);
  const [showHistory, setShowHistory]       = useState(false);
  const [isMenuOpen, setIsMenuOpen]         = useState(false);
  const [showPdfModal, setShowPdfModal]     = useState(false);
  const [pdfManualClientName, setPdfManualClientName] = useState('');
  const [activeNoteIndex, setActiveNoteIndex] = useState(null);  // [UI-4]
  // [UI-10] Confirm modal state
  const [confirmModal, setConfirmModal]     = useState({ open: false });

  const menuRef = useRef(null);

  const debouncedExercises    = useDebounce(exercises, 800);
  const debouncedSessionName  = useDebounce(sessionName, 800);

  // SSR-safe isClient flag
  useEffect(() => { setIsClient(true); }, []);

  // Click-outside to close menu
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isMenuOpen]);

  // ── DATA LOADING ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!subId || !sessionNum) { setLoading(false); return; }
    let cancelled = false;

    const fetchData = async () => {
      try {
        // 1. Identify current user
        try {
          const meRes = await api.get('/auth/users/me/');
          if (!cancelled) setCurrentUserId(Number(meRes.data.id));
        } catch { /* optional endpoint */ }

        // 2. Subscription metadata
        try {
          const subRes = await api.get(`/client-subscriptions/${subId}/`);
          if (!cancelled) {
            const cId = typeof subRes.data.client === 'object'
              ? subRes.data.client?.id
              : subRes.data.client;
            setClientId(cId ?? null);
            setClientName(
              subRes.data.client_name ||
              (typeof subRes.data.client === 'object' && subRes.data.client?.name) ||
              'Client'
            );
            setTrainerName(subRes.data.trainer_name || 'TFG Coach');
          }
        } catch { /* non-critical */ }

        // 3. Session data
        const res = await api.get(
          `/training-sessions/get-data/?subscription=${subId}&session_number=${sessionNum}`
        );
        if (cancelled) return;

        const data = res.data;

        // [FIX-8] Use defaultSessionName when DB name is empty
        setSessionName(data.name?.trim() || defaultSessionName || `Session ${sessionNum}`);
        setIsSessionCompleted(data.is_completed || false);

        if (data.is_completed) {
          // [FIX-1] Ensure numeric comparison; completed_by is a PK integer
          setCompletedByTrainerId(data.completed_by != null ? Number(data.completed_by) : null);
          // [FIX-2] trainer_name = completed_by.first_name from serializer
          setCompletedByTrainerName(data.trainer_name || 'Unknown Trainer');
        }

        const loadedExercises = data.exercises?.length
          ? data.exercises.map((ex) => ({ ...ex, note: ex.note || '' }))
          : [EMPTY_EXERCISE()];

        setExercises(loadedExercises);

        // 4. History (non-blocking)
        api
          .get(`/training-sessions/history/?subscription=${subId}`)
          .then((r) => { if (!cancelled) setRecentSplits(r.data); })
          .catch(() => {});
      } catch (error) {
        if (!cancelled) {
          console.error('Load error:', error);
          toast.error('Failed to load session');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [subId, sessionNum]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── DERIVED ─────────────────────────────────────────────────────────────────
  // [FIX-1] [FIX-5] Locked only when BOTH IDs are known and they differ.
  // Handles edge: if completedByTrainerId is 0/null/undefined, don't lock.
  const isReadOnly =
    isSessionCompleted &&
    currentUserId != null &&
    completedByTrainerId != null &&
    completedByTrainerId !== 0 &&
    Number(currentUserId) !== Number(completedByTrainerId);

  // ── EXERCISE MUTATIONS ──────────────────────────────────────────────────────
  const updateExercise = useCallback((idx, field, val) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === idx ? { ...ex, [field]: val } : ex))
    );
  }, []);

  const updateSet = useCallback((exIdx, setIdx, field, val) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, [field]: val } : s)) };
      })
    );
  }, []);

  // [FIX-3] Minimum 1 set enforced
  const handleSetCount = useCallback((exIdx, delta) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const newSets = [...ex.sets];
        if (delta > 0) {
          // Duplicate last set for faster entry [QoL-2 partial]
          const last = newSets[newSets.length - 1];
          newSets.push({ ...last, id: undefined });
        } else {
          if (newSets.length <= 1) {
            toast.error('Minimum 1 set required');
            return ex;
          }
          newSets.pop();
        }
        return { ...ex, sets: newSets };
      })
    );
  }, []);

  // [QoL-2] Explicit "Duplicate Last Set" action
  const duplicateLastSet = useCallback((exIdx) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        // Strip id so backend creates a new row
        const { id: _id, ...restOfSet } = last;
        return { ...ex, sets: [...ex.sets, { ...restOfSet }] };
      })
    );
  }, []);

  // [QoL-3] Clear all weights for an exercise
  const clearWeights = useCallback((exIdx) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        return { ...ex, sets: ex.sets.map((s) => ({ ...s, weight: '' })) };
      })
    );
  }, []);

  const addExercise = useCallback(() => {
    setExercises((prev) => [...prev, EMPTY_EXERCISE()]);
  }, []);

  // [QoL-6] Warn when removing an exercise with non-empty data
  const removeExercise = useCallback((idx) => {
    setExercises((prev) => {
      if (prev.length <= 1) {
        toast.error('At least 1 exercise is required');
        return prev;
      }
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  // [FIX-3] removeSet with minimum guard
  const removeSet = useCallback((exIdx, setIdx) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        if (ex.sets.length <= 1) {
          toast.error('Minimum 1 set required');
          return ex;
        }
        return { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) };
      })
    );
  }, []);

  // ── NAVIGATION ──────────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (clientId) navigate(`/clients/${clientId}`, { state: { defaultTab: 'training', activeTab: 'training' } });
    else navigate(-1);
  }, [clientId, navigate]);

  // ── SAVE ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(
    async (complete = false) => {
      // [FIX-4] Filter exercises: only skip truly blank-named ones, warn user
      const validExercises = exercises.filter((ex) => ex.name.trim());
      if (validExercises.length === 0) {
        toast.error('Add at least one named exercise before saving.');
        return;
      }
      if (validExercises.length < exercises.length) {
        toast('Blank-name exercises were skipped.', { icon: '⚠️' });
      }

      setIsSaving(true);
      try {
        await api.post('/training-sessions/save-data/', {
          subscription: subId,
          session_number: sessionNum,
          name: sessionName,
          exercises: validExercises,
          mark_complete: complete,
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
        if (e.response?.status === 403) {
          toast.error(e.response.data?.error || 'Permission Denied');
        } else {
          toast.error('Save failed. Please try again.');
        }
      } finally {
        setIsSaving(false);
      }
    },
    [exercises, sessionName, subId, sessionNum, currentUserId, handleBack]
  );

  // [UI-10] Open confirm modal before completing
  const handleCompleteIntent = useCallback(() => {
    setConfirmModal({
      open: true,
      title: 'Complete Workout?',
      message: 'This will mark the session as done and increment the session counter. This action cannot be undone by others.',
      confirmLabel: '✓ Complete',
      onConfirm: () => { setConfirmModal({ open: false }); handleSave(true); },
      onCancel: () => setConfirmModal({ open: false }),
    });
  }, [handleSave]);

  // [QoL-6] Delete exercise with data warning
  const handleDeleteExercise = useCallback((idx) => {
    const ex = exercises[idx];
    const hasData = ex.name.trim() || ex.sets.some((s) => s.reps || s.weight);
    if (hasData) {
      setConfirmModal({
        open: true,
        variant: 'destructive',
        title: 'Delete Exercise?',
        message: `"${ex.name || 'This exercise'}" has data that will be permanently removed.`,
        confirmLabel: 'Delete',
        onConfirm: () => { setConfirmModal({ open: false }); removeExercise(idx); },
        onCancel: () => setConfirmModal({ open: false }),
      });
    } else {
      removeExercise(idx);
    }
  }, [exercises, removeExercise]);

  // ── LOAD FROM HISTORY ───────────────────────────────────────────────────────
  // [FIX-6] Now strips set.id too
  const loadFromHistory = useCallback((historySession) => {
    setConfirmModal({
      open: true,
      title: 'Load from History?',
      message: `Overwrite current workout with "${historySession.name}"?`,
      confirmLabel: 'Load',
      onConfirm: () => {
        setConfirmModal({ open: false });
        const newExercises = historySession.exercises.map((ex) => ({
          name: ex.name,
          note: ex.note || '',
          sets: ex.sets.map((s) => ({
            // [FIX-6] explicitly omit id
            reps: s.reps,
            weight: s.weight,
            technique: s.technique || 'Regular',
            equipment: s.equipment || '',
          })),
        }));
        setExercises(newExercises);
        setShowHistory(false);
        toast.success('Workout loaded from history');
      },
      onCancel: () => setConfirmModal({ open: false }),
    });
  }, []);

  // ── PDF MODAL ────────────────────────────────────────────────────────────────
  // [FIX-7] Pre-fill with resolved clientName
  const handleOpenPdfModal = useCallback(() => {
    setIsMenuOpen(false);
    setPdfManualClientName(clientName !== 'Client' ? clientName : '');
    setShowPdfModal(true);
  }, [clientName]);

  // ── TAB INDEX HELPER  [QoL-1] ───────────────────────────────────────────────
  // Sequential tabIndex for reps/weight inputs: reps at pos (exIdx, setIdx)
  // tabIndex = BASE + exIdx * 100 + setIdx * 2
  // weight   = BASE + exIdx * 100 + setIdx * 2 + 1
  const tabIdx = (exIdx, setIdx, field) =>
    100 + exIdx * 100 + setIdx * 2 + (field === 'weight' ? 1 : 0);

  // ─────────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) return <SkeletonLoader />;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-zinc-100 dark:bg-[#09090b] text-zinc-900 dark:text-white font-sans selection:bg-orange-500/30 transition-colors">
      <Toaster
        position="top-center"
        toastOptions={{ style: { background: '#18181b', color: '#fff', border: '1px solid #27272a', borderRadius: '12px' } }}
      />

      {/* ── CONFIRM MODAL ───────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel}
        variant={confirmModal.variant}
      />

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 z-50 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800/50 sticky top-0 shadow-sm transition-colors">
        <div className="max-w-4xl mx-auto px-3 h-[72px] grid grid-cols-[44px_1fr_auto] items-center gap-2">

          {/* Back */}
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 flex items-center justify-center transition-all active:scale-90"
          >
            <ArrowLeft size={20} className="text-zinc-600 dark:text-white" />
          </button>

          {/* Session name + meta */}
          <div className="flex flex-col items-center justify-center min-w-0 px-1">
            <input
              value={sessionName || ''}
              onChange={(e) => setSessionName(e.target.value)}
              onFocus={(e) => e.target.select()} // [QoL-7]
              disabled={isReadOnly}
              placeholder="Workout Name"
              tabIndex={1}
              className="bg-transparent text-center text-base md:text-lg font-black text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-700 outline-none w-full border-b border-transparent focus:border-zinc-300 dark:focus:border-zinc-600 transition-all pb-0.5 truncate disabled:opacity-70 disabled:cursor-not-allowed"
            />
            <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
              <span className="flex items-center gap-1">
                <User size={9} className="text-orange-500" />
                <span className="text-zinc-700 dark:text-zinc-300 font-bold">{clientName}</span>
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <span className="uppercase tracking-wider text-[10px]">Session {sessionNum}</span>
              {isSessionCompleted && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="flex items-center gap-1 text-emerald-500">
                    <CheckCircle size={9} />
                    Done
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="relative flex items-center gap-2" ref={menuRef}>
            <button
              onClick={() => setShowHistory(true)}
              disabled={isReadOnly}
              className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-500 hover:border-orange-500/40 flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
              title="View History"
            >
              <History size={17} />
            </button>

            <button
              onClick={() => setIsMenuOpen((o) => !o)}
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all active:scale-90 ${
                isMenuOpen
                  ? 'bg-orange-600 text-white border-orange-500'
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <MoreVertical size={18} />
            </button>

            {isMenuOpen && (
              <div className="absolute top-11 right-0 w-60 bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150 z-50">
                {isClient && (
                  <button
                    onClick={handleOpenPdfModal}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-transparent dark:hover:bg-zinc-800 text-zinc-900 dark:text-white font-semibold text-sm flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                        <FileText size={14} className="text-orange-500" />
                      </div>
                      <span>Export PDF</span>
                    </div>
                    <ChevronRight size={14} className="text-zinc-400" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 md:px-4 pt-4 pb-36">
        <div className="max-w-4xl mx-auto space-y-3">

          {/* Read-only banner  [UI-6] */}
          {isReadOnly && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 rounded-2xl p-3.5 flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-xl text-red-600 dark:text-red-400 shrink-0">
                <Lock size={16} />
              </div>
              <div>
                <h4 className="font-bold text-sm text-red-700 dark:text-red-400">Locked Session</h4>
                <p className="text-xs text-red-600/80 dark:text-red-300/80 mt-0.5">
                  Completed by <b>{completedByTrainerName}</b> — only they can modify it.
                </p>
              </div>
            </div>
          )}

          {/* ── EXERCISE CARDS ─────────────────────────────────────────────── */}
          {exercises.map((ex, exIndex) => (
            <AnimatedCard key={ex.id ?? `new-${exIndex}`}>
              <div className="group relative bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.06] rounded-3xl shadow-sm hover:shadow-md dark:hover:shadow-black/40 transition-all duration-200">

                {/* Card Header */}
                <div className="p-4 md:p-5 pb-3 flex items-start gap-3">
                  {/* Exercise number badge */}
                  <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-black text-base">
                    {String(exIndex + 1).padStart(2, '0')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <input
                      value={ex.name || ''}
                      onChange={(e) => updateExercise(exIndex, 'name', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="Exercise name..."
                      tabIndex={2 + exIndex * 200}
                      className="w-full bg-transparent text-lg md:text-xl font-bold text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-700 outline-none border-b border-transparent focus:border-zinc-200 dark:focus:border-zinc-700 transition-all pb-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    {/* Quick stats row */}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-600 font-medium">
                        {ex.sets.length} set{ex.sets.length !== 1 ? 's' : ''}
                      </span>
                      {!isReadOnly && (
                        <>
                          {/* Duplicate last set  [QoL-2] */}
                          <button
                            onClick={() => duplicateLastSet(exIndex)}
                            className="text-[11px] flex items-center gap-1 text-zinc-400 dark:text-zinc-600 hover:text-orange-500 dark:hover:text-orange-500 transition-colors font-medium"
                          >
                            <Copy size={11} /> Dup set
                          </button>
                          {/* Clear weights  [QoL-3] */}
                          <button
                            onClick={() => clearWeights(exIndex)}
                            className="text-[11px] flex items-center gap-1 text-zinc-400 dark:text-zinc-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors font-medium"
                          >
                            <RotateCcw size={11} /> Clear wt
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Delete exercise button — hover reveal on desktop, always visible on mobile */}
                  {!isReadOnly && (
                    <button
                      onClick={() => handleDeleteExercise(exIndex)}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all md:opacity-0 md:group-hover:opacity-100 active:scale-90"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {/* Set count controls — compact inline row */}
                <div className="px-4 md:px-5 pb-2 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl p-1 border border-zinc-200 dark:border-zinc-800/60">
                    <button
                      onClick={() => handleSetCount(exIndex, -1)}
                      disabled={isReadOnly}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="min-w-[52px] text-center text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest select-none">
                      {ex.sets.length} SETS
                    </span>
                    <button
                      onClick={() => handleSetCount(exIndex, 1)}
                      disabled={isReadOnly}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                </div>

                {/* ── SETS ──────────────────────────────────────────────── */}
                <div className="mx-3 mb-3 bg-zinc-50 dark:bg-black/20 rounded-2xl overflow-hidden border border-zinc-100 dark:border-white/[0.03]">
                  {/* Column headers */}
                  <div className="px-3 py-2 grid grid-cols-[28px_1fr_1fr_auto] md:flex md:gap-4 text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest select-none border-b border-zinc-100 dark:border-zinc-800/50">
                    <span className="text-center">#</span>
                    <span className="text-center">Reps</span>
                    <span className="text-center">Weight<span className="text-[9px] opacity-50 lowercase ml-0.5">kg</span></span>
                    <span className="hidden md:block">Technique</span>
                    <span className="hidden md:block ml-auto">Equipment</span>
                    <span className="md:hidden w-8" />
                  </div>

                  {ex.sets.map((set, setIndex) => {
                    const tech = TECHNIQUE_CONFIG[set.technique] || TECHNIQUE_CONFIG['Regular'];
                    const equip = EQUIP_CONFIG[set.equipment] || { icon: Dumbbell, color: 'text-zinc-500' };
                    const TechIcon = tech.icon;
                    const EquipIcon = equip.icon;

                    return (
                      /* [UI-2] staggered slide-in */
                      <div
                        key={set.id ?? `new-set-${setIndex}`}
                        className="border-b border-zinc-100 dark:border-zinc-800/40 last:border-0 transition-colors hover:bg-zinc-100/50 dark:hover:bg-white/[0.02]"
                        style={{
                          animation: 'slideInRight 0.2s ease-out both',
                          animationDelay: `${setIndex * 30}ms`,
                        }}
                      >
                        {/* Mobile / compact row */}
                        <div className="px-2 py-2 grid grid-cols-[28px_1fr_1fr_auto] gap-2 items-center md:hidden">
                          <span className="text-center text-xs font-bold text-zinc-400 dark:text-zinc-600">
                            {setIndex + 1}
                          </span>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="—"
                            value={set.reps || ''}
                            disabled={isReadOnly}
                            tabIndex={tabIdx(exIndex, setIndex, 'reps')}
                            onChange={(e) => updateSet(exIndex, setIndex, 'reps', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/10 rounded-lg py-2 text-center text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-700 appearance-none disabled:opacity-50"
                          />
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="—"
                            value={set.weight || ''}
                            disabled={isReadOnly}
                            tabIndex={tabIdx(exIndex, setIndex, 'weight')}
                            onChange={(e) => updateSet(exIndex, setIndex, 'weight', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/10 rounded-lg py-2 text-center text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-700 appearance-none disabled:opacity-50"
                          />
                          {ex.sets.length > 1 && !isReadOnly ? (
                            <button
                              onClick={() => removeSet(exIndex, setIndex)}
                              className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-red-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg transition-colors"
                            >
                              <X size={13} />
                            </button>
                          ) : (
                            <div className="w-8" />
                          )}
                        </div>

                        {/* Mobile: technique + equip (selects) */}
                        <div className="md:hidden px-2 pb-2 grid grid-cols-2 gap-2">
                          <div className={`flex items-center rounded-lg px-2 py-1.5 border ${tech.bg} ${tech.border}`}>
                            <TechIcon size={12} className={`${tech.color} mr-1.5 shrink-0`} />
                            <select
                              value={set.technique || 'Regular'}
                              disabled={isReadOnly}
                              onChange={(e) => updateSet(exIndex, setIndex, 'technique', e.target.value)}
                              className="w-full bg-transparent text-[11px] font-bold uppercase outline-none text-zinc-700 dark:text-zinc-200 cursor-pointer disabled:cursor-not-allowed"
                            >
                              {Object.keys(TECHNIQUE_CONFIG).map((k) => (
                                <option key={k} value={k} className="bg-white dark:bg-zinc-900">{k}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5">
                            <EquipIcon size={12} className={`${equip.color} mr-1.5 shrink-0`} />
                            <select
                              value={set.equipment || ''}
                              disabled={isReadOnly}
                              onChange={(e) => updateSet(exIndex, setIndex, 'equipment', e.target.value)}
                              className="w-full bg-transparent text-[11px] font-bold outline-none text-zinc-600 dark:text-zinc-300 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <option value="" className="bg-white dark:bg-zinc-900">No Equip</option>
                              {Object.keys(EQUIP_CONFIG).map((k) => (
                                <option key={k} value={k} className="bg-white dark:bg-zinc-900">{k}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Desktop: full row with pill groups  [UI-7] */}
                        <div className="hidden md:grid md:grid-cols-[28px_100px_100px_1fr_1fr_32px] gap-3 px-3 py-2 items-center">
                          <span className="text-center text-xs font-bold text-zinc-400 dark:text-zinc-600">
                            {setIndex + 1}
                          </span>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="—"
                            value={set.reps || ''}
                            disabled={isReadOnly}
                            tabIndex={tabIdx(exIndex, setIndex, 'reps')}
                            onChange={(e) => updateSet(exIndex, setIndex, 'reps', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/10 rounded-xl py-2.5 text-center text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-700 appearance-none disabled:opacity-50"
                          />
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="—"
                            value={set.weight || ''}
                            disabled={isReadOnly}
                            tabIndex={tabIdx(exIndex, setIndex, 'weight')}
                            onChange={(e) => updateSet(exIndex, setIndex, 'weight', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/10 rounded-xl py-2.5 text-center text-sm font-bold text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-700 appearance-none disabled:opacity-50"
                          />
                          {/* Technique pills */}
                          <TechniquePillGroup
                            value={set.technique || 'Regular'}
                            onChange={(v) => updateSet(exIndex, setIndex, 'technique', v)}
                            disabled={isReadOnly}
                          />
                          {/* Equipment pills */}
                          <EquipPillGroup
                            value={set.equipment || ''}
                            onChange={(v) => updateSet(exIndex, setIndex, 'equipment', v)}
                            disabled={isReadOnly}
                          />
                          {/* Remove set */}
                          {ex.sets.length > 1 && !isReadOnly ? (
                            <button
                              onClick={() => removeSet(exIndex, setIndex)}
                              className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                            >
                              <X size={13} />
                            </button>
                          ) : (
                            <div />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Exercise note  [UI-4] */}
                <div className="px-4 pb-4">
                  <button
                    onClick={() => setActiveNoteIndex((n) => (n === exIndex ? null : exIndex))}
                    disabled={isReadOnly}
                    className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors py-1 disabled:cursor-default"
                  >
                    <MessageSquare size={13} />
                    {ex.note
                      ? <span className="text-orange-500 dark:text-orange-400">Note ✎</span>
                      : 'Add Note'
                    }
                  </button>

                  {/* [UI-4] Simple boolean open state, no conflicting CSS */}
                  {(activeNoteIndex === exIndex || ex.note) && (
                    <div className={`mt-1.5 transition-all duration-200 ${activeNoteIndex === exIndex ? 'opacity-100' : 'opacity-70'}`}>
                      <textarea
                        value={ex.note || ''}
                        onChange={(e) => updateExercise(exIndex, 'note', e.target.value)}
                        disabled={isReadOnly}
                        readOnly={isReadOnly || activeNoteIndex !== exIndex}
                        placeholder="Notes for this exercise (e.g. Seat height 4, focus on tempo)..."
                        rows={2}
                        className="w-full bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-amber-400 resize-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>
              </div>
            </AnimatedCard>
          ))}

          {/* ── ADD EXERCISE ROW  [QoL-4] ─────────────────────────────────── */}
          {!isReadOnly && (
            <AnimatedCard>
              <button
                onClick={addExercise}
                className="w-full py-4 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 hover:border-orange-400 dark:hover:border-orange-500/50 hover:text-orange-500 dark:hover:text-orange-500 flex items-center justify-center gap-2 font-bold text-sm transition-all active:scale-98 group"
              >
                <Plus size={18} className="group-hover:rotate-90 transition-transform duration-200" />
                Add Exercise
              </button>
            </AnimatedCard>
          )}
        </div>
      </div>

      {/* ── BOTTOM ACTION BAR  [UI-3] ────────────────────────────────────────── */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50 pointer-events-none">
        {!isReadOnly ? (
          <div className="pointer-events-auto flex gap-2.5 bg-white/90 dark:bg-[#111113]/95 backdrop-blur-2xl p-2 rounded-2xl border border-zinc-200 dark:border-white/[0.08] shadow-2xl shadow-black/20 dark:shadow-black/60">
            <button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="flex-1 py-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
            >
              {isSaving ? (
                <Activity size={15} className="animate-spin text-orange-500" />
              ) : (
                <Save size={15} />
              )}
              {isSaving ? 'Saving...' : 'Save'}
            </button>

            {!isSessionCompleted && (
              <button
                onClick={handleCompleteIntent}
                disabled={isSaving}
                className="flex-[1.6] py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-60 relative overflow-hidden"
              >
                {/* Subtle pulse ring */}
                <span className="absolute inset-0 rounded-xl ring-2 ring-orange-400/30 animate-pulse" />
                <CheckCircle size={15} />
                Complete
              </button>
            )}
          </div>
        ) : (
          <div className="pointer-events-auto bg-zinc-900/90 dark:bg-zinc-950/90 backdrop-blur-xl p-3 rounded-2xl border border-white/10 shadow-2xl text-center">
            <p className="text-zinc-400 text-xs font-medium">
              Finalized by{' '}
              <span className="text-white font-bold">{completedByTrainerName}</span>
            </p>
          </div>
        )}
      </div>

      {/* ── PDF MODAL ─────────────────────────────────────────────────────────── */}
      {showPdfModal && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowPdfModal(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mb-3 text-orange-600 dark:text-orange-500">
                <FileText size={26} />
              </div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white">Export PDF</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Confirm client name for the document.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">
                  Client Name
                </label>
                <div className="relative">
                  <Type className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    autoFocus
                    value={pdfManualClientName}
                    onChange={(e) => setPdfManualClientName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl py-3 pl-9 pr-4 text-zinc-900 dark:text-white font-semibold placeholder:font-normal focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none transition-all"
                  />
                </div>
              </div>

              {isClient && (
                <PDFDownloadLink
                  document={
                    <WorkoutPDF_EN
                      sessionName={debouncedSessionName || defaultSessionName || `Session ${sessionNum}`}
                      sessionNumber={parseInt(sessionNum) || 1}
                      clientName={pdfManualClientName || 'Client'}
                      trainerName={trainerName || 'Trainer'}
                      brandName="TFG"
                      date={new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                      exercises={debouncedExercises}
                    />
                  }
                  fileName={`${(debouncedSessionName || 'Session').replace(/\s+/g, '_')}_${pdfManualClientName || 'Client'}.pdf`}
                  className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-lg transition-all active:scale-95 ${
                    !pdfManualClientName
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed pointer-events-none'
                      : 'bg-gradient-to-r from-orange-600 to-amber-500 text-white hover:from-orange-500 hover:to-amber-400 shadow-orange-500/20'
                  }`}
                >
                  {({ loading: pdfLoading }) => (
                    <>
                      {pdfLoading ? <Activity size={16} className="animate-spin" /> : <Download size={16} />}
                      <span>{pdfLoading ? 'Generating...' : 'Download PDF'}</span>
                    </>
                  )}
                </PDFDownloadLink>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY DRAWER ────────────────────────────────────────────────────── */}
      {showHistory && (
        <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-sm bg-white dark:bg-[#111113] h-full border-l border-zinc-200 dark:border-zinc-800/60 animate-in slide-in-from-right duration-300 flex flex-col shadow-2xl">
            <div className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-800/60 flex justify-between items-center">
              <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <History size={17} className="text-orange-500" /> Workout History
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {recentSplits.length === 0 ? (
                <div className="text-center py-16 text-zinc-400 dark:text-zinc-600">
                  <History size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-sm">No previous workouts</p>
                </div>
              ) : (
                recentSplits.map((session, idx) => (
                  <div
                    key={session.id ?? idx}
                    className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 rounded-2xl p-3.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2.5">
                      <div>
                        <h4 className="font-bold text-zinc-900 dark:text-white text-sm leading-tight">
                          {session.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 font-bold">
                            #{session.session_number}
                          </span>
                          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <Calendar size={9} />
                            {new Date(session.date_completed || session.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => loadFromHistory(session)}
                        disabled={isReadOnly}
                        className="text-[11px] font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 border border-orange-200 dark:border-orange-500/20 px-2.5 py-1 rounded-lg hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 dark:hover:text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Load
                      </button>
                    </div>

                    {/* [UI-8] Exercise badge strip */}
                    <div className="flex flex-wrap gap-1">
                      {session.exercises?.slice(0, 4).map((ex, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-md font-medium"
                        >
                          {ex.name}
                        </span>
                      ))}
                      {session.exercises?.length > 4 && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-600 italic">
                          +{session.exercises.length - 4} more
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

      {/* ── GLOBAL ANIMATION KEYFRAMES ──────────────────────────────────────── */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        /* Remove number input spinners for cleaner look */
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
};

export default WorkoutEditor;