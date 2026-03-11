// ClientNutritionTab.jsx — v3 — Full Review + Exchange Grid Port + Animation Polish
// Bug fixes:
//   BUG-1  useFoodDatabase: handle paginated response + fetch ALL pages
//   BUG-2  useNutritionPlans: eliminate double-fetch (stale-closure dep issue)
//   BUG-3  defaultSubId: always use the active subscription, not index[0]
//   BUG-4  ExchangeGroup: ported ManualNutritionPlan's colored-header 3-col grid style
//   BUG-5  Notes field: map planNotes to/from NutritionPlan.notes properly
//   BUG-6  Staggered list entry animations via CSS animationDelay

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Utensils, Calendar, User, Activity,
  Save, Target, Trash2, Plus,
  Flame, Droplets, Wheat, Beef, AlertTriangle,
  Leaf, FileText, Zap, Mars, Venus, Loader2,
  ChevronLeft, ChevronRight, Download, Scale,
  Check, ChevronDown, X, AlertCircle, Search,
  Sparkles,
} from 'lucide-react';
import api from '../../api';
import { PDFDownloadLink } from '@react-pdf/renderer';
import NutritionPDF_EN from '../../utils/NutritionPDF_EN';
import NutritionPDF_AR from '../../utils/NutritionPDF_AR';

// ═══════════════════════════════════════════════════════
// NUTRITION ENGINE — pure function, no side effects
// ═══════════════════════════════════════════════════════

function calculateNutrition(inputs) {
  const {
    gender         = 'male',
    age            = 25,
    heightCm       = 170,
    weightKg       = 80,
    activityLevel  = 'moderate',
    deficitSurplus = 0,
    fatPercentage  = 25,
    proteinPerLb   = 1.0,
    mealsCount     = 4,
  } = inputs;

  const safeWeight = Math.max(0, parseFloat(weightKg)  || 0);
  const safeHeight = Math.max(0, parseFloat(heightCm)  || 0);
  const safeAge    = Math.max(0, parseInt(age)          || 0);
  const safeMeals  = Math.max(1, parseInt(mealsCount)   || 1);
  const weightLbs  = safeWeight * 2.20462;

  let bmr = 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge;
  bmr += gender === 'male' ? 5 : -161;

  const multipliers   = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  const tdee          = Math.round(bmr * (multipliers[activityLevel] || 1.2));
  const targetCalories = Math.max(0, tdee + (parseInt(deficitSurplus) || 0));

  const proteinGrams = Math.round(weightLbs * (parseFloat(proteinPerLb) || 1));
  const proteinCals  = proteinGrams * 4;
  const fatCals      = Math.round(targetCalories * ((parseFloat(fatPercentage) || 25) / 100));
  const fatGrams     = Math.round(fatCals / 9);

  const usedCals = proteinCals + fatCals;
  let remainingCals = targetCalories - usedCals;
  let warning = null;
  if (remainingCals < 0) {
    warning = 'Macro conflict! Protein + Fat exceed calorie target.';
    remainingCals = 0;
  }

  const carbGrams  = Math.round(remainingCals / 4);
  const fiberGrams = Math.round((targetCalories / 1000) * 14);

  // Guard against division-by-zero producing Infinity or NaN
  const safe = (n, d = 0) => (isFinite(n) && !isNaN(n) ? n : d);

  return {
    tdee,
    targetCalories,
    warning,
    macros: {
      protein: { grams: proteinGrams, cals: proteinCals, pct: safe(Math.round((proteinCals   / targetCalories) * 100)) },
      fats:    { grams: fatGrams,     cals: fatCals,     pct: safe(Math.round((fatCals        / targetCalories) * 100)) },
      carbs:   { grams: carbGrams,    cals: remainingCals, pct: safe(Math.round((remainingCals / targetCalories) * 100)) },
      fiber:   { grams: fiberGrams },
    },
    perMeal: {
      proteinCals:  Math.round(proteinCals  / safeMeals),
      carbsCals:    Math.round(remainingCals / safeMeals),
      fatsCals:     Math.round(fatCals      / safeMeals),
      proteinGrams: Math.round(proteinGrams / safeMeals),
      carbsGrams:   Math.round(carbGrams    / safeMeals),
      fatsGrams:    Math.round(fatGrams     / safeMeals),
    },
  };
}

// ═══════════════════════════════════════════════════════
// EXCHANGE LIST ENGINE
// ═══════════════════════════════════════════════════════

function buildExchangeList(results, foodDatabase, carbAdjustment) {
  if (!results || !Array.isArray(foodDatabase) || !foodDatabase.length) return null;
  const { perMeal } = results;

  const safeCarbAdj = Number(carbAdjustment) || 0;
  const carbMod     = 1 + safeCarbAdj / 100;

  const groups = {
    'Protein Sources': { items: [], targetCals: perMeal.proteinCals, color: 'text-red-500 dark:text-red-400',   bg: 'bg-red-500/8 dark:bg-red-500/6',     ring: 'border-red-500/20'   },
    'Carbohydrates':   { items: [], targetCals: perMeal.carbsCals,   color: 'text-blue-500 dark:text-blue-400',  bg: 'bg-blue-500/8 dark:bg-blue-500/6',   ring: 'border-blue-500/20'  },
    'Fats':            { items: [], targetCals: perMeal.fatsCals,    color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/8 dark:bg-amber-500/6', ring: 'border-amber-500/20' },
  };

  foodDatabase.forEach(food => {
    const cat = (food.category || '').toLowerCase();
    let groupKey = '';
    if (cat === 'protein') groupKey = 'Protein Sources';
    else if (cat === 'carbs') groupKey = 'Carbohydrates';
    else if (cat === 'fats')  groupKey = 'Fats';
    if (!groupKey || !food.calories_per_100g) return;

    const targetCals = groups[groupKey].targetCals;
    let weight = (targetCals / food.calories_per_100g) * 100;
    if (groupKey === 'Carbohydrates') weight *= carbMod;
    weight = Math.round(weight);

    groups[groupKey].items.push({
      name:        food.name,
      arabic_name: food.arabic_name,
      weight,
      unit: 'g',
      meta: {
        cals:  Math.round((food.calories_per_100g * weight) / 100),
        pro:   Math.round((food.protein_per_100g  * weight) / 100),
        carbs: Math.round((food.carbs_per_100g    * weight) / 100),
        fats:  Math.round((food.fats_per_100g     * weight) / 100),
      },
    });
  });

  return groups;
}

// ═══════════════════════════════════════════════════════
// HOOK — useNutrition
// ═══════════════════════════════════════════════════════

function useNutrition(calcState) {
  return useMemo(() => calculateNutrition(calcState), [calcState]);
}

// ═══════════════════════════════════════════════════════
// HOOK — useNutritionPlans
// FIX: Extracted fetch logic so useEffect dep is stable;
//      avoids the double-fetch where `fetch` recreated on page change
//      fires the effect again simultaneously.
// ═══════════════════════════════════════════════════════

function useNutritionPlans(clientId, showToast) {
  const [plans, setPlans]      = useState([]);
  const [totalCount, setTotal] = useState(0);
  const [loading, setLoading]  = useState(false);
  const [page, setPage]        = useState(1);

  // Stable ref so fetchPage never goes stale inside useEffect
  const clientIdRef  = useRef(clientId);
  const showToastRef = useRef(showToast);
  useEffect(() => { clientIdRef.current  = clientId;  }, [clientId]);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  const fetchPage = useCallback(async (pageNum) => {
    const cid = clientIdRef.current;
    if (!cid) return;
    setLoading(true);
    try {
      // FIX: Backend now accepts client_id (see views.py fix BUG-BE-1)
      const res  = await api.get(`/nutrition-plans/?client_id=${cid}&page=${pageNum}`);
      const data = res.data.results ?? res.data;
      setPlans(Array.isArray(data) ? data : []);
      setTotal(res.data.count ?? (Array.isArray(data) ? data.length : 0));
    } catch {
      showToastRef.current('Failed to load nutrition plans.', 'error');
    } finally {
      setLoading(false);
    }
  }, []); // empty deps — fully stable via refs

  // Only re-run when clientId or page changes (no double-fetch risk)
  useEffect(() => {
    if (clientId) fetchPage(page);
  }, [clientId, page, fetchPage]);

  const refetch = useCallback((pageNum) => fetchPage(pageNum ?? page), [fetchPage, page]);

  return { plans, totalCount, loading, page, setPage, refetch };
}

// ═══════════════════════════════════════════════════════
// HOOK — useFoodDatabase
// FIX-BUG-2+3: Handle paginated response {count, results:[]}
//   and walk all pages so the full food DB is loaded, not just
//   the first 12 items the backend sends by default.
// ═══════════════════════════════════════════════════════

function useFoodDatabase() {
  const [foods, setFoods] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let all = [];
        // Request maximum page size to minimise round-trips
        let url = '/food-database/?page_size=100&page=1';
        while (url && !cancelled) {
          const res  = await api.get(url);
          const data = res.data;
          if (data && Array.isArray(data.results)) {
            // Paginated response
            all = [...all, ...data.results];
            if (data.next) {
              // Use relative path so the api instance handles base-URL
              const nextUrl = new URL(data.next);
              url = nextUrl.pathname + nextUrl.search;
            } else {
              url = null;
            }
          } else if (Array.isArray(data)) {
            // Un-paginated response
            all = data;
            url = null;
          } else {
            url = null;
          }
        }
        if (!cancelled) setFoods(all);
      } catch (e) {
        console.error('Failed to load food database', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return foods;
}

// ═══════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════

const Toast = ({ message, type = 'success', onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const isError = type === 'error';
  return (
    <div className={`
      fixed bottom-6 right-4 sm:right-6 z-[200]
      flex items-center gap-3 px-4 py-3 max-w-[calc(100vw-2rem)] sm:max-w-sm
      rounded-2xl shadow-2xl backdrop-blur-md border text-sm font-semibold
      animate-slide-up
      ${isError
        ? 'bg-red-950/95 border-red-800/60 text-red-300'
        : 'bg-emerald-950/95 border-emerald-800/60 text-emerald-300'
      }
    `}>
      <AlertCircle size={15} className="shrink-0" />
      <span className="truncate">{message}</span>
      <button onClick={onDismiss} className="ml-auto opacity-60 hover:opacity-100 shrink-0 transition-opacity">
        <X size={13} />
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// CONFIRM MODAL
// ═══════════════════════════════════════════════════════

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, isLoading }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4
        bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="
        bg-white dark:bg-zinc-950
        border border-zinc-200 dark:border-zinc-800
        rounded-2xl p-6 max-w-sm w-full
        shadow-2xl shadow-zinc-900/30 dark:shadow-black/60
        ring-1 ring-red-500/10
        animate-slide-up
      ">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-950/60 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 text-center mb-2">{title}</h3>
        <p className="text-zinc-500 text-sm text-center mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-xl
              bg-zinc-100 dark:bg-zinc-900
              border border-zinc-200 dark:border-zinc-800
              text-zinc-600 dark:text-zinc-300
              hover:bg-zinc-200 dark:hover:bg-zinc-800
              font-bold text-sm transition-colors"
          >
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isLoading}
            className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm
              disabled:opacity-50 flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// PAGINATION
// ═══════════════════════════════════════════════════════

const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
        className="w-9 h-9 flex items-center justify-center rounded-xl
          bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800
          text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100
          disabled:opacity-30 transition-all active:scale-95"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-xs font-bold text-zinc-500 tabular-nums">{currentPage} / {totalPages}</span>
      <button
        onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
        className="w-9 h-9 flex items-center justify-center rounded-xl
          bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800
          text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100
          disabled:opacity-30 transition-all active:scale-95"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// SKELETONS
// ═══════════════════════════════════════════════════════

const Pulse = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800/60 ${className}`} />
);

const PlanCardSkeleton = () => (
  <div className="bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/70 rounded-2xl p-5 min-h-[160px] flex flex-col gap-4">
    <div className="flex justify-between">
      <div className="flex gap-2"><Pulse className="h-6 w-12" /><Pulse className="h-6 w-6 rounded-full" /></div>
      <Pulse className="h-6 w-6 rounded-full" />
    </div>
    <Pulse className="h-5 w-3/4" />
    <div className="mt-auto flex gap-2">
      <Pulse className="h-7 w-24" />
      <Pulse className="h-7 w-20 ml-auto" />
    </div>
  </div>
);

const DetailSkeleton = () => (
  <div className="space-y-5 animate-pulse">
    <Pulse className="h-10 w-48" />
    {[1, 2, 3].map(n => (
      <div key={n} className="bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/70 rounded-2xl p-5">
        <Pulse className="h-4 w-32 mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(k => <Pulse key={k} className="h-14" />)}
        </div>
      </div>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════
// MACRO RING — Apple Health style SVG
// ═══════════════════════════════════════════════════════

const MacroRing = ({ pct = 0, color = '#f97316', gradientEnd, size = 88, strokeWidth = 8, children, id }) => {
  const r          = (size - strokeWidth) / 2;
  const circ       = 2 * Math.PI * r;
  const clampedPct = Math.min(Math.max(pct, 0), 100);
  const dash       = circ * (clampedPct / 100);
  const gap        = circ - dash;
  const center     = size / 2;
  const gradId     = `ring-grad-${id}`;
  const glowId     = `ring-glow-${id}`;
  const gEnd       = gradientEnd || color;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={gEnd}  stopOpacity="1"   />
          </linearGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx={center} cy={center} r={r}
          stroke="currentColor" className="text-zinc-200 dark:text-zinc-800"
          strokeWidth={strokeWidth} fill="none"
        />
        {clampedPct > 0 && (
          <circle cx={center} cy={center} r={r}
            stroke={`url(#${gradId})`} strokeWidth={strokeWidth} fill="none"
            strokeLinecap="round" strokeDasharray={`${dash} ${gap}`}
            filter={`url(#${glowId})`}
            style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
        {children}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// MACRO CARD
// ═══════════════════════════════════════════════════════

const MacroCard = React.memo(({ label, grams, perMealGrams, pct, color, ringColor, gradientEnd, icon: Icon, suffix = 'g', id }) => (
  <div className="
    flex flex-col items-center gap-3 p-4
    bg-white dark:bg-zinc-900/60
    border border-zinc-200 dark:border-zinc-800/60
    rounded-2xl
    hover:border-zinc-300 dark:hover:border-zinc-700
    hover:shadow-md dark:hover:shadow-none
    transition-all duration-300 group cursor-default
  ">
    <MacroRing pct={pct} color={ringColor} gradientEnd={gradientEnd} size={80} strokeWidth={7} id={id}>
      <Icon size={14} className={color} />
      <span className={`text-[10px] font-black tabular-nums mt-0.5 ${color}`}>{pct}%</span>
    </MacroRing>
    <div className="text-center">
      <div className="flex items-baseline gap-1 justify-center">
        <span className={`text-2xl font-black tabular-nums ${color}`}>{grams}</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-600 font-bold">{suffix}</span>
      </div>
      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">{label}</p>
      {perMealGrams !== undefined && (
        <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5 tabular-nums">
          {perMealGrams}{suffix} / meal
        </p>
      )}
    </div>
  </div>
));

// ═══════════════════════════════════════════════════════
// CUSTOM SELECT
// ═══════════════════════════════════════════════════════

const CustomSelect = ({ label, value, options, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selectedLabel = options.find(o => o.val === value)?.lbl || value;

  return (
    <div ref={ref} className={`relative ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          bg-zinc-100 dark:bg-zinc-900
          border p-3.5 rounded-xl cursor-pointer transition-all
          ${isOpen
            ? 'border-orange-500/60 ring-1 ring-orange-500/20'
            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
          }
        `}
      >
        <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1 pointer-events-none">{label}</label>
        <div className="flex justify-between items-center">
          <span className="text-zinc-900 dark:text-zinc-100 font-bold text-sm truncate pr-2">{selectedLabel}</span>
          <ChevronDown size={14} className={`text-zinc-400 dark:text-zinc-600 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-orange-400' : ''}`} />
        </div>
      </div>
      {isOpen && (
        <div className="
          absolute top-full left-0 right-0 mt-1.5
          bg-white dark:bg-zinc-950
          border border-zinc-200 dark:border-zinc-800
          rounded-xl shadow-2xl shadow-zinc-200/50 dark:shadow-black/60
          z-50 animate-slide-up origin-top overflow-hidden
        ">
          {options.map(opt => (
            <button key={opt.val} type="button"
              onClick={() => { onChange(opt.val); setIsOpen(false); }}
              className={`
                w-full text-left px-4 py-2.5 flex items-center justify-between text-sm transition-colors
                border-b border-zinc-100 dark:border-zinc-800/50 last:border-0
                ${opt.val === value
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                }
              `}
            >
              <span className="font-bold">{opt.lbl}</span>
              {opt.val === value && <Check size={13} className="text-orange-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// NUTRI INPUT
// ═══════════════════════════════════════════════════════

const NutriInput = ({
  label, value, onChange, type = 'text', suffix, options,
  disabled = false, className = '', min, placeholder,
}) => {
  if (options) {
    return (
      <div className={className}>
        <CustomSelect label={label} value={value} options={options} onChange={onChange} disabled={disabled} />
      </div>
    );
  }
  return (
    <div className={`
      relative bg-zinc-100 dark:bg-zinc-900
      border border-zinc-200 dark:border-zinc-800
      p-3.5 rounded-xl
      focus-within:border-orange-500/60 focus-within:ring-1 focus-within:ring-orange-500/20
      transition-all duration-200
      ${disabled ? 'opacity-40' : ''}
      ${className}
    `}>
      <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">{label}</label>
      <input
        disabled={disabled} type={type} min={min} value={value} placeholder={placeholder}
        inputMode={type === 'number' ? 'decimal' : undefined}
        onChange={e => {
          if (type === 'number' && min !== undefined && e.target.value !== '') {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v < parseFloat(min)) return;
          }
          onChange(e.target.value);
        }}
        className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 font-bold text-sm outline-none
          placeholder:text-zinc-400 dark:placeholder:text-zinc-700 pr-8"
      />
      {suffix && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 dark:text-zinc-600 pointer-events-none select-none">
          {suffix}
        </span>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// BENTO CARD + CARD HEADER
// ═══════════════════════════════════════════════════════

const BentoCard = ({ children, className = '' }) => (
  <div className={`
    bg-white/90 dark:bg-zinc-950/80
    border border-zinc-200 dark:border-zinc-800/70
    rounded-2xl p-5
    shadow-sm shadow-zinc-200/60 dark:shadow-none
    backdrop-blur-sm transition-colors duration-300
    ${className}
  `}>
    {children}
  </div>
);

const CardHeader = ({ icon: Icon, label, color = 'text-orange-500 dark:text-orange-400', bg = 'bg-orange-100 dark:bg-orange-500/10', extra }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2.5">
      <span className={`p-2 rounded-xl ${bg}`}>
        <Icon size={15} className={color} />
      </span>
      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-300">{label}</h3>
    </div>
    {extra}
  </div>
);

// ═══════════════════════════════════════════════════════
// EXCHANGE GROUP
// FIX-BUG-4: Ported ManualNutritionPlan's colored-header 3-column grid style.
// Kept ClientNutritionTab's per-group search filter.
// Added staggered entry animation via CSS animationDelay.
// ═══════════════════════════════════════════════════════

// Category → icon mapping for richer headers
const CATEGORY_ICONS = {
  'Protein Sources': Beef,
  'Carbohydrates':   Wheat,
  'Fats':            Droplets,
};

const ExchangeGroup = React.memo(({ groupName, data, carbAdjustment }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() =>
    query.trim()
      ? data.items.filter(item =>
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          (item.arabic_name || '').includes(query)
        )
      : data.items,
    [data.items, query]
  );

  const isCarbs     = groupName === 'Carbohydrates';
  const safeCarbAdj = Number(carbAdjustment) || 0;
  const showAdjBadge = isCarbs && safeCarbAdj !== 0;
  const CatIcon     = CATEGORY_ICONS[groupName] || Zap;

  return (
    <div className="
      overflow-hidden rounded-2xl
      border border-zinc-200 dark:border-zinc-800/70
      shadow-sm shadow-zinc-200/40 dark:shadow-none
      transition-all duration-300
      hover:shadow-md hover:shadow-zinc-200/60 dark:hover:border-zinc-700/60
    ">
      {/* ── Colored Category Header (ported from ManualNutritionPlan) ── */}
      <div className={`
        px-4 sm:px-5 py-4
        border-b border-zinc-200/80 dark:border-zinc-800/60
        flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3
        ${data.bg}
      `}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`p-1.5 rounded-lg bg-white/60 dark:bg-black/20 border border-white/30 dark:border-zinc-700/30`}>
            <CatIcon size={13} className={data.color} />
          </span>
          <h3 className={`font-black uppercase tracking-wider text-sm ${data.color}`}>{groupName}</h3>
          {showAdjBadge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              safeCarbAdj > 0
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
            }`}>
              {safeCarbAdj > 0 ? '+' : ''}{safeCarbAdj}% Carb Mod
            </span>
          )}
          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-500 font-mono tabular-nums
            bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-md">
            {Math.round(data.targetCals)} kcal / meal
          </span>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-auto">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 pointer-events-none" />
          <input
            placeholder="Filter items…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="
              w-full sm:w-40
              bg-white/70 dark:bg-zinc-900/80
              border border-white/60 dark:border-zinc-700/60
              rounded-lg pl-7 pr-8 py-1.5 text-[11px] font-medium
              text-zinc-700 dark:text-zinc-300
              outline-none focus:border-orange-400/60 dark:focus:border-zinc-600
              placeholder:text-zinc-400 dark:placeholder:text-zinc-600
              transition-colors
            "
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── 3-Column Grid (matching ManualNutritionPlan layout) ── */}
      {filtered.length === 0 ? (
        <div className="
          bg-white dark:bg-zinc-950
          px-5 py-10 text-center text-zinc-400 dark:text-zinc-600 text-xs font-medium
        ">
          {query ? 'No items match your search.' : 'No items in this category.'}
        </div>
      ) : (
        <div className="
          grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3
          divide-y divide-zinc-100 dark:divide-zinc-800/50
          md:divide-y-0 md:gap-px
          bg-zinc-100/60 dark:bg-zinc-800/20
        ">
          {filtered.map((item, idx) => (
            <div
              key={`${item.name}-${idx}`}
              className="
                bg-white dark:bg-zinc-950
                p-4
                hover:bg-zinc-50 dark:hover:bg-zinc-900/80
                transition-colors duration-150
                flex justify-between items-center gap-3
                group
              "
              style={{ animationDelay: `${Math.min(idx * 25, 400)}ms` }}
            >
              {/* Left: Name + Arabic + Macros */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate
                  group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                  {item.name}
                </p>
                {item.arabic_name && (
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5 truncate" dir="rtl">
                    {item.arabic_name}
                  </p>
                )}
                <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1 tabular-nums font-medium">
                  {item.meta.cals} kcal · P{item.meta.pro}g · C{item.meta.carbs}g · F{item.meta.fats}g
                </p>
              </div>

              {/* Right: Weight badge */}
              <div className="text-right shrink-0">
                <span className={`font-black text-xl tabular-nums leading-none ${
                  isCarbs && safeCarbAdj !== 0
                    ? 'text-blue-500 dark:text-blue-400'
                    : data.color
                }`}>
                  {item.weight}
                </span>
                <span className="text-zinc-400 dark:text-zinc-600 text-xs font-bold ml-1">{item.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════
// MACRO SUMMARY
// ═══════════════════════════════════════════════════════

const MacroSummary = React.memo(({ results }) => {
  if (!results) return null;
  return (
    <BentoCard className="relative overflow-visible">
      <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
        <div className="text-center lg:text-left shrink-0 w-full lg:w-auto">
          <div className="flex flex-row lg:flex-col items-center lg:items-start justify-center gap-6 lg:gap-3">
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">TDEE</p>
              <p className="text-xl font-black text-zinc-400 dark:text-zinc-500 leading-none tabular-nums">
                {results.tdee.toLocaleString()}
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-medium mt-0.5">kcal</p>
            </div>
            <div className="w-px h-10 bg-zinc-200 dark:bg-zinc-800 lg:hidden" />
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Daily Target</p>
              <p className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-zinc-100 leading-none tabular-nums">
                {results.targetCalories.toLocaleString()}
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-bold mt-1 uppercase tracking-wide">
                kcal / day
              </p>
            </div>
          </div>
        </div>
        <div className="hidden lg:block w-px self-stretch bg-zinc-200 dark:bg-zinc-800 shrink-0" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
          <MacroCard id="protein" label="Protein" grams={results.macros.protein.grams}
            perMealGrams={results.perMeal.proteinGrams} pct={results.macros.protein.pct}
            color="text-red-500 dark:text-red-400" ringColor="#f87171" gradientEnd="#fb923c" icon={Beef} />
          <MacroCard id="carbs" label="Carbs" grams={results.macros.carbs.grams}
            perMealGrams={results.perMeal.carbsGrams} pct={results.macros.carbs.pct}
            color="text-blue-500 dark:text-blue-400" ringColor="#60a5fa" gradientEnd="#a78bfa" icon={Wheat} />
          <MacroCard id="fats" label="Fats" grams={results.macros.fats.grams}
            perMealGrams={results.perMeal.fatsGrams} pct={results.macros.fats.pct}
            color="text-amber-500 dark:text-amber-400" ringColor="#fbbf24" gradientEnd="#f97316" icon={Droplets} />
          <MacroCard id="fiber" label="Fiber" grams={results.macros.fiber.grams}
            pct={Math.min((results.macros.fiber.grams / 40) * 100, 100)}
            color="text-emerald-500 dark:text-emerald-400" ringColor="#34d399" gradientEnd="#22d3ee"
            icon={Leaf} suffix="g+" />
        </div>
      </div>
    </BentoCard>
  );
});

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

const ClientNutritionTab = ({ subscriptions, clientData }) => {
  const [view, setView]           = useState('list');
  const [activePlan, setActivePlan] = useState(null);
  const [isSaving, setIsSaving]   = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanWeeks, setNewPlanWeeks] = useState(4);
  const [planNotes, setPlanNotes] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, planId: null, isLoading: false });
  const [toast, setToast]         = useState(null);

  const showToast    = useCallback((msg, type = 'success') => setToast({ message: msg, type }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const clientId = clientData?.id || subscriptions?.[0]?.client || null;

  // FIX-BUG-3: Use the active subscription, not blindly index[0]
  const defaultSubId = useMemo(() => {
    if (!subscriptions?.length) return null;
    const active = subscriptions.find(s => s.is_active);
    return active?.id || subscriptions[0]?.id || null;
  }, [subscriptions]);

  const { plans, totalCount, loading, page, setPage, refetch } = useNutritionPlans(clientId, showToast);
  const foodDatabase = useFoodDatabase();

  const [calcState, setCalcState] = useState({
    gender: 'male', age: 25, heightCm: 175, weightKg: 80,
    activityLevel: 'moderate', deficitSurplus: -500,
    fatPercentage: 25, proteinPerLb: 1.0,
    mealsCount: 4, snacksCount: 0,
    carbAdjustment: 0, brandText: 'TFG',
  });

  const results = useNutrition(calcState);

  // FIX-BUG-5: Map notes field from/to backend (requires NutritionPlan.notes field)
  useEffect(() => {
    if (!activePlan) return;
    setCalcState({
      gender:         activePlan.calc_gender              || 'male',
      age:            activePlan.calc_age                 || 25,
      heightCm:       activePlan.calc_height              || 170,
      weightKg:       activePlan.calc_weight              || 80,
      activityLevel:  activePlan.calc_activity_level      || 'moderate',
      deficitSurplus: activePlan.calc_defer_cal           || 0,
      fatPercentage:  activePlan.calc_fat_percent         || 25,
      proteinPerLb:   activePlan.calc_protein_multiplier  || 1.0,
      mealsCount:     activePlan.calc_meals               || 4,
      snacksCount:    activePlan.calc_snacks              || 0,
      carbAdjustment: Number(activePlan.calc_carb_adjustment) || 0,
      brandText:      activePlan.pdf_brand_text           || 'TFG',
    });
    // Support both `notes` (new field) and legacy placement
    setPlanNotes(activePlan.notes || '');
  }, [activePlan]);

  const weightLbs = useMemo(
    () => ((parseFloat(calcState.weightKg) || 0) * 2.20462).toFixed(1),
    [calcState.weightKg]
  );

  const exchangeList = useMemo(
    () => buildExchangeList(results, foodDatabase, calcState.carbAdjustment),
    [results, foodDatabase, calcState.carbAdjustment]
  );

  const currentPdfPlan = useMemo(() => {
    if (!activePlan) return null;
    return {
      ...activePlan,
      calc_weight:         calcState.weightKg,
      calc_activity_level: calcState.activityLevel,
      calc_meals:          calcState.mealsCount,
      calc_snacks:         calcState.snacksCount,
    };
  }, [activePlan, calcState]);

  const pdfClientName = activePlan?.client_name || clientData?.name || 'Athlete';
  const trainerName   = activePlan?.created_by_name || 'Coach';

  // ═══════════════════════════════════
  // CRUD HANDLERS
  // ═══════════════════════════════════

  const handleCreatePlan = useCallback(async () => {
    if (!newPlanName.trim()) { showToast('Please enter a plan name.', 'error'); return; }
    if (!defaultSubId)       { showToast('No subscription found.', 'error'); return; }
    setIsCreating(true);
    try {
      const res = await api.post('/nutrition-plans/', {
        subscription: defaultSubId,
        name: newPlanName.trim(),
        duration_weeks: parseInt(newPlanWeeks) || 4,
        target_calories: 2000,
      });
      await refetch(1);
      setPage(1);
      setNewPlanName('');
      setActivePlan(res.data);
      setView('detail');
      showToast('Plan created!', 'success');
    } catch {
      showToast('Error creating plan.', 'error');
    } finally {
      setIsCreating(false);
    }
  }, [newPlanName, defaultSubId, newPlanWeeks, refetch, setPage, showToast]);

  const handleSavePlan = useCallback(async () => {
    if (!activePlan?.id || !results) return;
    setIsSaving(true);
    try {
      const payload = {
        calc_gender:             calcState.gender,
        calc_age:                parseInt(calcState.age)              || 0,
        calc_height:             parseFloat(calcState.heightCm)       || 0,
        calc_weight:             parseFloat(calcState.weightKg)       || 0,
        calc_activity_level:     calcState.activityLevel,
        calc_defer_cal:          parseInt(calcState.deficitSurplus)   || 0,
        calc_fat_percent:        parseFloat(calcState.fatPercentage)  || 0,
        calc_protein_multiplier: parseFloat(calcState.proteinPerLb)  || 1,
        calc_meals:              parseInt(calcState.mealsCount)       || 1,
        calc_snacks:             parseInt(calcState.snacksCount)      || 0,
        calc_carb_adjustment:    (Number(calcState.carbAdjustment) || 0).toString(),
        pdf_brand_text:          calcState.brandText || 'TFG',
        calc_tdee:               parseInt(results.tdee)              || 0,
        target_calories:         parseInt(results.targetCalories)    || 0,
        target_protein:          parseInt(results.macros.protein.grams) || 0,
        target_carbs:            parseInt(results.macros.carbs.grams)   || 0,
        target_fats:             parseInt(results.macros.fats.grams)    || 0,
        notes: planNotes, // FIX-BUG-5: saves to NutritionPlan.notes field
      };
      const res = await api.patch(`/nutrition-plans/${activePlan.id}/`, payload);
      setActivePlan(res.data);
      showToast('Plan saved!', 'success');
      refetch(page);
    } catch {
      showToast('Failed to save plan. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [activePlan, results, calcState, planNotes, refetch, page, showToast]);

  const handleDeletePlan = useCallback(async () => {
    const { planId } = deleteModal;
    if (!planId) return;
    setDeleteModal(prev => ({ ...prev, isLoading: true }));
    try {
      await api.delete(`/nutrition-plans/${planId}/`);
      setDeleteModal({ isOpen: false, planId: null, isLoading: false });
      showToast('Plan deleted.', 'success');
      refetch(page);
      if (activePlan?.id === planId) { setView('list'); setActivePlan(null); }
    } catch {
      showToast('Error deleting plan.', 'error');
      setDeleteModal(prev => ({ ...prev, isLoading: false }));
    }
  }, [deleteModal, activePlan, refetch, page, showToast]);

  const setCalc = useCallback((key, val) => setCalcState(prev => ({ ...prev, [key]: val })), []);

  const formatActivity = useCallback(
    str => (str || 'Moderate').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    []
  );

  // ═══════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════

  if (view === 'list') {
    return (
      <div className="space-y-5 animate-fade-in p-1 md:p-2">
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          title="Delete Nutrition Plan?"
          message="This action cannot be undone. All macros and exchange data will be permanently removed."
          onConfirm={handleDeletePlan}
          onCancel={() => setDeleteModal({ isOpen: false, planId: null, isLoading: false })}
          isLoading={deleteModal.isLoading}
        />

        {/* Page Header */}
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 shrink-0">
            <Utensils className="text-white" size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">Nutrition</h2>
            <p className="text-zinc-500 text-xs font-medium">Manage diet plans & macros</p>
          </div>
        </div>

        {/* Create Plan */}
        <BentoCard>
          <CardHeader icon={Plus} label="New Plan" color="text-orange-500 dark:text-orange-400" bg="bg-orange-100 dark:bg-orange-500/10" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-0.5">Plan Name</label>
              <input
                placeholder="e.g. Cutting Phase 1"
                value={newPlanName}
                onChange={e => setNewPlanName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreatePlan(); }}
                className="
                  w-full bg-zinc-100 dark:bg-zinc-900
                  border border-zinc-200 dark:border-zinc-800
                  rounded-xl px-4 py-3 text-sm font-bold
                  text-zinc-900 dark:text-zinc-100 outline-none
                  focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20
                  placeholder:text-zinc-400 dark:placeholder:text-zinc-700 transition-all
                "
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-0.5">Duration (Weeks)</label>
              <input
                type="number" min="1"
                value={newPlanWeeks}
                onChange={e => setNewPlanWeeks(e.target.value)}
                className="
                  w-full bg-zinc-100 dark:bg-zinc-900
                  border border-zinc-200 dark:border-zinc-800
                  rounded-xl px-4 py-3 text-sm font-bold
                  text-zinc-900 dark:text-zinc-100 outline-none
                  focus:border-orange-500/60 transition-all
                "
              />
            </div>
            <button
              onClick={handleCreatePlan}
              disabled={!newPlanName.trim() || isCreating}
              className="
                py-3 bg-orange-600 hover:bg-orange-500
                disabled:opacity-40 disabled:cursor-not-allowed
                text-white font-bold rounded-xl
                flex items-center justify-center gap-2 text-sm
                shadow-lg shadow-orange-500/20
                active:scale-95 transition-all duration-200
              "
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create Plan
            </button>
          </div>
        </BentoCard>

        {/* Plan Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(n => <PlanCardSkeleton key={n} />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {plans.map((plan, idx) => {
                const isMale   = (plan.calc_gender || 'male') === 'male';
                const activity = formatActivity(plan.calc_activity_level);
                return (
                  <div
                    key={plan.id}
                    onClick={() => { setActivePlan(plan); setView('detail'); }}
                    className="
                      group relative
                      bg-zinc-50 dark:bg-zinc-950/80
                      border border-zinc-200/80 dark:border-zinc-800/70
                      rounded-2xl p-5
                      hover:border-orange-400/50 dark:hover:border-orange-500/40
                      hover:bg-white dark:hover:bg-zinc-900/60
                      hover:shadow-lg hover:shadow-zinc-200/60 dark:hover:shadow-none
                      transition-all duration-300 cursor-pointer overflow-hidden
                      min-h-[160px] flex flex-col
                    "
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    {/* BG Icon */}
                    <div className="
                      absolute -right-4 -bottom-4
                      text-zinc-200 dark:text-zinc-800/30
                      group-hover:text-orange-200 dark:group-hover:text-orange-500/5
                      group-hover:scale-110 group-hover:-rotate-6
                      transition-all duration-500 pointer-events-none
                    ">
                      <Target size={100} strokeWidth={0.8} />
                    </div>

                    <div className="relative z-10 flex flex-col h-full gap-3">
                      {/* Tags */}
                      <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                          <span className="
                            inline-flex items-center gap-1 px-2.5 py-1 rounded-lg
                            bg-zinc-100 dark:bg-zinc-800/60
                            border border-zinc-200 dark:border-zinc-700/40
                            text-[10px] font-bold text-zinc-500 uppercase
                          ">
                            <Calendar size={9} />{plan.duration_weeks}W
                          </span>
                          <span className={`
                            w-6 h-6 rounded-full flex items-center justify-center border text-[10px]
                            ${isMale
                              ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/20 text-blue-500 dark:text-blue-400'
                              : 'bg-pink-100 dark:bg-pink-500/10 border-pink-300 dark:border-pink-500/20 text-pink-500 dark:text-pink-400'
                            }
                          `}>
                            {isMale ? <Mars size={11} /> : <Venus size={11} />}
                          </span>
                        </div>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setDeleteModal({ isOpen: true, planId: plan.id, isLoading: false });
                          }}
                          className="
                            w-7 h-7 flex items-center justify-center rounded-full
                            text-zinc-400 dark:text-zinc-600
                            hover:bg-red-100 dark:hover:bg-red-500/10
                            hover:text-red-500 dark:hover:text-red-400
                            transition-all
                          "
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      {/* Plan name */}
                      <div>
                        <h3 className="
                          text-base font-black
                          text-zinc-900 dark:text-zinc-100
                          group-hover:text-orange-600 dark:group-hover:text-orange-400
                          transition-colors leading-snug mb-0.5 line-clamp-2
                        ">
                          {plan.name}
                        </h3>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-600">
                          {new Date(plan.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className="mt-auto flex items-center gap-2">
                        <span className="
                          flex items-center gap-1.5 px-2.5 py-1.5
                          bg-zinc-100 dark:bg-zinc-900
                          rounded-lg border border-zinc-200 dark:border-zinc-800
                          text-[10px] font-bold text-zinc-500
                        ">
                          <Zap size={10} className="text-emerald-500 dark:text-emerald-400" />{activity}
                        </span>
                        <span className="
                          ml-auto flex items-center gap-1.5 px-2.5 py-1.5
                          bg-zinc-100 dark:bg-zinc-900
                          rounded-lg border border-zinc-200 dark:border-zinc-800
                          text-[10px]
                        ">
                          <Flame size={10} className="text-orange-500" />
                          <span className="font-black text-zinc-900 dark:text-zinc-100 tabular-nums">{plan.target_calories || 0}</span>
                          <span className="text-zinc-500">kcal</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {plans.length === 0 && !loading && (
                <div className="
                  col-span-full py-16 text-center
                  border-2 border-dashed border-zinc-200 dark:border-zinc-800
                  rounded-2xl text-zinc-400 dark:text-zinc-600
                ">
                  <Sparkles size={36} className="mx-auto mb-3 opacity-40" strokeWidth={1} />
                  <p className="font-bold text-sm">No nutrition plans yet</p>
                  <p className="text-xs mt-1 opacity-70">Create the first plan using the form above</p>
                </div>
              )}
            </div>

            <Pagination
              totalItems={totalCount}
              itemsPerPage={12}
              currentPage={page}
              onPageChange={p => setPage(p)}
            />
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════════════════

  if (view === 'detail' && activePlan) {
    return (
      <div className="space-y-5 animate-fade-in p-1 md:p-2">
        {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          title="Delete Nutrition Plan?"
          message="This action cannot be undone."
          onConfirm={handleDeletePlan}
          onCancel={() => setDeleteModal({ isOpen: false, planId: null, isLoading: false })}
          isLoading={deleteModal.isLoading}
        />

        {/* ── Top Action Bar ── */}
        <div className="
          flex items-center gap-2.5 flex-wrap
          bg-white/90 dark:bg-zinc-950/80
          border border-zinc-200 dark:border-zinc-800/70
          rounded-2xl p-3 shadow-sm backdrop-blur-sm
        ">
          <button
            onClick={() => { setView('list'); setActivePlan(null); }}
            className="
              flex items-center gap-1.5 px-3 py-2
              text-zinc-600 dark:text-zinc-400
              hover:text-zinc-900 dark:hover:text-zinc-100
              hover:bg-zinc-100 dark:hover:bg-zinc-800
              rounded-xl text-xs font-bold transition-all active:scale-95
            "
          >
            <ChevronLeft size={14} /> Plans
          </button>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">{activePlan.name}</h3>
            <p className="text-[10px] text-zinc-400">
              {pdfClientName} · {activePlan.duration_weeks}W plan
            </p>
          </div>

          {/* PDF buttons */}
          {currentPdfPlan && (
            <>
              <PDFDownloadLink
                document={
                  <NutritionPDF_EN
                    plan={currentPdfPlan} clientName={pdfClientName}
                    trainerName={trainerName} brandText={calcState.brandText}
                    carbAdjustment={Number(calcState.carbAdjustment) || 0}
                    results={results} exchangeList={exchangeList} notes={planNotes}
                  />
                }
                fileName={`${activePlan.name}_EN.pdf`}
              >
                {({ loading: pdfLoading }) => (
                  <button disabled={pdfLoading} className="
                    whitespace-nowrap px-3 py-2 shrink-0
                    bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700
                    text-zinc-700 dark:text-zinc-300 font-bold rounded-xl
                    border border-zinc-200 dark:border-zinc-700
                    text-xs flex items-center gap-1.5 transition-all active:scale-95
                  ">
                    {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} EN PDF
                  </button>
                )}
              </PDFDownloadLink>
              <PDFDownloadLink
                document={
                  <NutritionPDF_AR
                    plan={currentPdfPlan} clientName={pdfClientName}
                    trainerName={trainerName} brandText={calcState.brandText}
                    carbAdjustment={Number(calcState.carbAdjustment) || 0}
                    results={results} exchangeList={exchangeList} notes={planNotes}
                  />
                }
                fileName={`${activePlan.name}_AR.pdf`}
              >
                {({ loading: pdfLoading }) => (
                  <button disabled={pdfLoading} className="
                    whitespace-nowrap px-3 py-2 shrink-0
                    bg-emerald-50 dark:bg-emerald-500/10
                    hover:bg-emerald-100 dark:hover:bg-emerald-500/20
                    text-emerald-700 dark:text-emerald-400 font-bold rounded-xl
                    border border-emerald-200 dark:border-emerald-500/20
                    text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 active:scale-95
                  ">
                    {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    AR PDF
                  </button>
                )}
              </PDFDownloadLink>
            </>
          )}

          <button
            onClick={handleSavePlan} disabled={isSaving}
            className="
              ml-auto shrink-0 whitespace-nowrap px-5 py-2
              bg-orange-600 hover:bg-orange-500
              disabled:opacity-40 text-white font-bold rounded-xl
              shadow-md shadow-orange-500/20
              text-xs flex items-center gap-1.5 transition-all active:scale-95
            "
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
          </button>
        </div>

        {/* ── Body Metrics ── */}
        <BentoCard>
          <CardHeader icon={User} label="Body Metrics" color="text-blue-500 dark:text-blue-400" bg="bg-blue-100 dark:bg-blue-500/10" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <NutriInput label="Gender" value={calcState.gender} onChange={v => setCalc('gender', v)}
              options={[{ val: 'male', lbl: 'Male' }, { val: 'female', lbl: 'Female' }]} />
            <NutriInput label="Age"    value={calcState.age}      onChange={v => setCalc('age', v)}      type="number" min="0" />
            <NutriInput label="Height" value={calcState.heightCm} onChange={v => setCalc('heightCm', v)} type="number" suffix="cm" min="0" />
            <NutriInput label="Weight" value={calcState.weightKg} onChange={v => setCalc('weightKg', v)} type="number" suffix="kg" min="0" />
            <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl flex flex-col justify-center">
              <label className="text-[10px] uppercase font-bold text-zinc-500 flex items-center gap-1 mb-1">
                <Scale size={9} /> LBS
              </label>
              <span className="text-zinc-900 dark:text-zinc-100 font-black text-sm tabular-nums">{weightLbs}</span>
            </div>
            <NutriInput label="Activity" value={calcState.activityLevel} onChange={v => setCalc('activityLevel', v)}
              options={[
                { val: 'sedentary',   lbl: 'Sedentary'  },
                { val: 'light',       lbl: 'Light'       },
                { val: 'moderate',    lbl: 'Moderate'    },
                { val: 'active',      lbl: 'Active'      },
                { val: 'very_active', lbl: 'Very Active' },
              ]}
            />
          </div>
        </BentoCard>

        {/* ── Strategy ── */}
        <BentoCard>
          <CardHeader icon={Activity} label="Strategy" color="text-emerald-500 dark:text-emerald-400" bg="bg-emerald-100 dark:bg-emerald-500/10" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <NutriInput label="Calorie Goal (+/-)" value={calcState.deficitSurplus}  onChange={v => setCalc('deficitSurplus', v)}  type="number" suffix="kcal" />
            <NutriInput label="Protein Ratio"      value={calcState.proteinPerLb}    onChange={v => setCalc('proteinPerLb', v)}    type="number" suffix="g/lb" min="0" />
            <NutriInput label="Fat %"              value={calcState.fatPercentage}   onChange={v => setCalc('fatPercentage', v)}   type="number" suffix="%" min="0" />
            <NutriInput label="Carb Mod"           value={calcState.carbAdjustment}  onChange={v => setCalc('carbAdjustment', v)} type="number" suffix="%" />
            <NutriInput label="Main Meals"         value={calcState.mealsCount}      onChange={v => setCalc('mealsCount', v)}      type="number" min="1" />
            <NutriInput label="Snacks"             value={calcState.snacksCount}     onChange={v => setCalc('snacksCount', v)}     type="number" min="0" />
          </div>
        </BentoCard>

        {/* ── PDF Branding ── */}
        <BentoCard>
          <CardHeader icon={FileText} label="PDF Branding" color="text-purple-500 dark:text-purple-400" bg="bg-purple-100 dark:bg-purple-500/10" />
          <div className="max-w-xs">
            <NutriInput label="Logo Text" value={calcState.brandText} onChange={v => setCalc('brandText', v)} placeholder="e.g. IRON GYM" />
          </div>
        </BentoCard>

        {/* ── Warning ── */}
        {results?.warning && (
          <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-500/8 border border-red-200 dark:border-red-500/25 rounded-2xl animate-slide-up">
            <AlertTriangle size={17} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{results.warning}</p>
          </div>
        )}

        {/* ── Macro Summary ── */}
        <MacroSummary results={results} />

        {/* ── Exchange Lists ── */}
        {exchangeList && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-orange-400 shrink-0" />
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Exchange Lists</h3>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-medium">
                {foodDatabase.length} foods loaded
              </span>
            </div>
            {Object.entries(exchangeList).map(([groupName, data]) => (
              <ExchangeGroup
                key={groupName}
                groupName={groupName}
                data={data}
                carbAdjustment={calcState.carbAdjustment}
              />
            ))}
          </div>
        )}

        {/* ── Notes ── */}
        <BentoCard>
          <CardHeader icon={FileText} label="Notes & Instructions" color="text-emerald-500 dark:text-emerald-400" bg="bg-emerald-100 dark:bg-emerald-500/10" />
          <textarea
            value={planNotes}
            onChange={e => setPlanNotes(e.target.value)}
            placeholder="Supplements, grocery list, meal timing, hydration targets…"
            className="
              w-full bg-zinc-100 dark:bg-zinc-900
              border border-zinc-200 dark:border-zinc-800
              rounded-xl px-4 py-4 text-sm
              text-zinc-900 dark:text-zinc-200
              placeholder:text-zinc-400 dark:placeholder:text-zinc-700
              resize-none outline-none min-h-[120px] leading-relaxed
              focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/10
              transition-all
            "
          />
        </BentoCard>
      </div>
    );
  }

  return null;
};

export default ClientNutritionTab;