// ManualNutritionPlan.jsx — v2 — Full Review + Search + Animation Polish
// Bug fixes:
//   BUG-1  calculateNutrition: Infinity guard when targetCalories = 0
//   BUG-2  Missing 'very_active' (1.9×) activity level option
//   BUG-3  fetchHistory: handle paginated { count, results } response
//   BUG-4  Exchange list: per-group search filter (ported from ClientNutritionTab)
//   BUG-5  Exchange list: show arabic_name + full macro breakdown per item
//   BUG-6  Staggered entry animations + hover micro-interactions

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Utensils, User, Activity, FileText, Zap, Download,
  Scale, Calculator, ClipboardType, Loader2, Wheat, Droplets, Leaf,
  Save, Trash2, History, Smartphone, FolderOpen, X,
  Search, Calendar, Beef, Sparkles,
} from 'lucide-react';
import api from '../api';
import { PDFDownloadLink } from '@react-pdf/renderer';
import toast from 'react-hot-toast';
import NutritionPDF_EN from '../utils/NutritionPDF_EN';
import NutritionPDF_AR from '../utils/NutritionPDF_AR';

// ── NUTRITION CALCULATOR ──────────────────────────────────────────────────
// FIX-BUG-1: Added safe() guard to prevent Infinity/NaN percentages when
//            targetCalories is 0 (e.g. extreme deficit settings).
const calculateNutrition = (inputs) => {
  const {
    gender = 'male', age = 25, heightCm = 170, weightKg = 80,
    activityLevel = 'moderate', deficitSurplus = 0,
    fatPercentage = 25, proteinPerLb = 1.0,
    mealsCount = 4
  } = inputs;

  const safeWeight = Math.max(0, parseFloat(weightKg) || 0);
  const safeHeight = Math.max(0, parseFloat(heightCm) || 0);
  const safeAge    = Math.max(0, parseInt(age) || 0);
  const safeMeals  = Math.max(1, parseInt(mealsCount) || 1);
  const weightLbs  = safeWeight * 2.20462;

  let bmr = 10 * safeWeight + 6.25 * safeHeight - 5 * safeAge;
  bmr += gender === 'male' ? 5 : -161;

  const multipliers = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725,
    very_active: 1.9, // FIX-BUG-2: was missing from the dropdown but present in calc
  };
  const tdee           = Math.round(bmr * (multipliers[activityLevel] || 1.2));
  const targetCalories = Math.max(0, tdee + parseInt(deficitSurplus || 0));

  const proteinGrams = Math.round(weightLbs * parseFloat(proteinPerLb || 1));
  const proteinCals  = proteinGrams * 4;
  const fatCals      = Math.round(targetCalories * (parseFloat(fatPercentage || 25) / 100));
  const fatGrams     = Math.round(fatCals / 9);

  const usedCals = proteinCals + fatCals;
  let remainingCals = targetCalories - usedCals;
  let warning = null;
  if (remainingCals < 0) {
    warning = 'Macros exceed Target Calories! Increase Calories or lower Fats/Protein.';
    remainingCals = 0;
  }

  const carbGrams  = Math.round(remainingCals / 4);
  const fiberGrams = Math.round((targetCalories / 1000) * 14);

  // Guard: prevents Infinity/NaN when targetCalories === 0
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
};

// ── MODERN INPUT ──────────────────────────────────────────────────────────
const ModernInput = ({
  label, value, onChange, type = 'text', suffix, options,
  disabled = false, className = '', min, placeholder
}) => (
  <div className={`
    bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800
    p-3 rounded-2xl relative
    focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:border-orange-500
    transition-all duration-200
    ${disabled ? 'opacity-50' : ''}
    ${className}
  `}>
    <label className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-500 mb-1 block">
      {label}
    </label>
    {options ? (
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-zinc-900 dark:text-white font-bold text-sm outline-none appearance-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.val} value={o.val} className="dark:bg-zinc-900 bg-zinc-100">
            {o.lbl}
          </option>
        ))}
      </select>
    ) : (
      <input
        disabled={disabled}
        type={type}
        min={min}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          if (type === 'number' && min !== undefined && e.target.value !== '') {
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val < parseFloat(min)) return;
          }
          onChange(e.target.value);
        }}
        className="w-full bg-transparent text-zinc-900 dark:text-white font-bold text-lg outline-none
          placeholder-zinc-400 dark:placeholder-zinc-600 pr-8"
      />
    )}
    {suffix && (
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500 dark:text-zinc-600 pointer-events-none">
        {suffix}
      </span>
    )}
  </div>
);

// ── EXCHANGE GROUP with search (ported from ClientNutritionTab) ───────────
const CATEGORY_CONFIG = {
  'Protein Sources': { color: 'text-red-500 dark:text-red-400',   bg: 'bg-red-500/10 dark:bg-red-500/8',     icon: Beef     },
  'Carbohydrates':   { color: 'text-blue-500 dark:text-blue-400',  bg: 'bg-blue-500/10 dark:bg-blue-500/8',   icon: Wheat    },
  'Fats':            { color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10 dark:bg-amber-500/8', icon: Droplets },
};

const ExchangeGroupSection = ({ groupName, data, carbAdjustment }) => {
  const [query, setQuery] = useState('');

  // FIX-BUG-4: Per-group search filter
  const filtered = useMemo(() =>
    query.trim()
      ? data.items.filter(item =>
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          (item.arabic_name || '').includes(query)
        )
      : data.items,
    [data.items, query]
  );

  const isCarbs      = groupName === 'Carbohydrates';
  const safeCarbAdj  = Number(carbAdjustment) || 0;
  const config       = CATEGORY_CONFIG[groupName] || CATEGORY_CONFIG['Protein Sources'];
  const CatIcon      = config.icon;

  return (
    <div className="
      bg-white dark:bg-[#121214]
      border border-zinc-300 dark:border-zinc-800
      rounded-3xl overflow-hidden shadow-sm
      transition-all duration-300
      hover:shadow-md hover:border-zinc-400/60 dark:hover:border-zinc-700/60
    ">
      {/* ── Colored Header ── */}
      <div className={`
        p-4 border-b border-zinc-200 dark:border-zinc-800
        flex flex-col sm:flex-row justify-between sm:items-center gap-3
        ${config.bg}
      `}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="p-1.5 rounded-lg bg-white/60 dark:bg-black/20 border border-white/30 dark:border-zinc-700/30">
            <CatIcon size={13} className={config.color} />
          </span>
          <h3 className={`font-black uppercase tracking-wider text-sm ${config.color}`}>
            {groupName}
          </h3>
          {isCarbs && safeCarbAdj !== 0 && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              safeCarbAdj > 0
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
            }`}>
              {safeCarbAdj > 0 ? '+' : ''}{safeCarbAdj}% Mod
            </span>
          )}
          <div className="text-xs font-bold text-zinc-700 dark:text-white bg-white/50 dark:bg-black/20 px-3 py-1 rounded-lg border border-white/20 font-mono tabular-nums">
            {Math.round(data.targetCals)} kcal / meal
          </div>
        </div>

        {/* Search (FIX-BUG-4) */}
        <div className="relative w-full sm:w-auto">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 pointer-events-none" />
          <input
            placeholder="Filter items…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="
              w-full sm:w-40
              bg-white/70 dark:bg-zinc-900/80
              border border-white/60 dark:border-zinc-700
              rounded-xl pl-7 pr-7 py-1.5
              text-[11px] font-medium text-zinc-700 dark:text-zinc-300
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

      {/* ── 3-column item grid (FIX-BUG-5: show arabic + macros) ── */}
      {filtered.length === 0 ? (
        <div className="p-10 text-center text-zinc-500 text-sm bg-white dark:bg-[#121214]">
          {query ? 'No items match your search.' : 'No items found for this category in database.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y divide-zinc-200 dark:divide-zinc-800 md:divide-y-0 md:gap-px bg-zinc-200 dark:bg-zinc-800/50">
          {filtered.map((item, idx) => (
            <div
              key={`${item.name}-${idx}`}
              className="
                bg-white dark:bg-[#121214]
                p-4
                hover:bg-zinc-50 dark:hover:bg-zinc-900/70
                transition-colors duration-150
                flex justify-between items-start gap-3
                group
              "
              style={{ animationDelay: `${Math.min(idx * 20, 400)}ms` }}
            >
              {/* Left: name + arabic + macros */}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-zinc-700 dark:text-zinc-300 text-sm truncate
                  group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                  {item.name}
                </p>
                {item.arabic_name && (
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5 truncate" dir="rtl">
                    {item.arabic_name}
                  </p>
                )}
                {/* FIX-BUG-5: macro breakdown */}
                <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1 tabular-nums">
                  ~{item.meta.cals} kcal · P{item.meta.pro}g · C{item.meta.carbs}g · F{item.meta.fats}g
                </p>
              </div>

              {/* Right: weight */}
              <div className="text-right shrink-0">
                <div>
                  <span className={`font-black text-lg ${
                    isCarbs && safeCarbAdj !== 0
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-zinc-900 dark:text-white'
                  }`}>
                    {item.weight}
                  </span>
                  <span className="text-zinc-500 text-xs font-bold ml-1">{item.unit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const INITIAL_CALC_STATE = {
  manualClientName: '', manualPhone: '', manualTrainerName: '', planName: 'Custom Strategy',
  gender: 'male', age: 25, heightCm: 175, weightKg: 80,
  activityLevel: 'moderate', deficitSurplus: -500,
  fatPercentage: 25, proteinPerLb: 1.0,
  mealsCount: 4, snacksCount: 0, carbAdjustment: 0, brandText: 'TFG',
};

// ── COMPONENT ─────────────────────────────────────────────────────────────
const ManualNutritionPlan = () => {
  const [foodDatabase, setFoodDatabase] = useState([]);
  const [savedPlans, setSavedPlans]     = useState([]);
  const [showHistory, setShowHistory]   = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSaving, setIsSaving]         = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');

  const [calcState, setCalcState] = useState(INITIAL_CALC_STATE);
  const [results, setResults]     = useState(() => calculateNutrition(INITIAL_CALC_STATE));
  const [planNotes, setPlanNotes] = useState('');
  const [currentId, setCurrentId] = useState(null);

  // ── FOOD DATABASE — handle pagination, all pages ───────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let all = [];
        let url = '/food-database/?page_size=100&page=1';
        while (url && !cancelled) {
          const res  = await api.get(url);
          const data = res.data;
          if (data && Array.isArray(data.results)) {
            all = [...all, ...data.results];
            if (data.next) {
              const next = new URL(data.next);
              url = next.pathname + next.search;
            } else {
              url = null;
            }
          } else if (Array.isArray(data)) {
            all = data;
            url = null;
          } else {
            url = null;
          }
        }
        if (!cancelled) setFoodDatabase(all);
      } catch {
        /* non-critical */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── RECALCULATE ───────────────────────────────────────────────────────
  useEffect(() => {
    setResults(calculateNutrition(calcState));
  }, [calcState]);

  // ── EXCHANGE LIST ─────────────────────────────────────────────────────
  const exchangeList = useMemo(() => {
    if (!results || !foodDatabase.length) return null;

    const targets = results.perMeal;
    const groups = {
      'Protein Sources': { items: [], targetCals: targets.proteinCals },
      'Carbohydrates':   { items: [], targetCals: targets.carbsCals   },
      'Fats':            { items: [], targetCals: targets.fatsCals    },
    };

    const carbModifier = 1 + (parseFloat(calcState.carbAdjustment || 0) / 100);

    foodDatabase.forEach((food) => {
      const cat = (food.category || '').toLowerCase();
      let targetGroup = cat === 'protein' ? 'Protein Sources'
                      : cat === 'carbs'   ? 'Carbohydrates'
                      : cat === 'fats'    ? 'Fats'
                      : '';
      if (!targetGroup || !food.calories_per_100g) return;

      const targetCals = groups[targetGroup].targetCals;
      let requiredWeight = (targetCals / food.calories_per_100g) * 100;
      if (targetGroup === 'Carbohydrates') requiredWeight *= carbModifier;
      const w = Math.round(requiredWeight);

      groups[targetGroup].items.push({
        name:        food.name,
        arabic_name: food.arabic_name,
        weight: w,
        unit: 'g',
        meta: {
          cals:  Math.round((food.calories_per_100g * w) / 100),
          pro:   Math.round((food.protein_per_100g  * w) / 100),
          carbs: Math.round((food.carbs_per_100g    * w) / 100),
          fats:  Math.round((food.fats_per_100g     * w) / 100),
        },
      });
    });

    return groups;
  }, [results, foodDatabase, calcState.carbAdjustment]);

  // ── WEIGHT IN LBS ─────────────────────────────────────────────────────
  const weightLbs = useMemo(
    () => ((parseFloat(calcState.weightKg) || 0) * 2.20462).toFixed(1),
    [calcState.weightKg]
  );

  // ── FILTERED PLANS ────────────────────────────────────────────────────
  const filteredPlans = useMemo(
    () => savedPlans.filter(
      (p) =>
        p.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.plan_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [savedPlans, searchQuery]
  );

  // ── HANDLERS ──────────────────────────────────────────────────────────

  // FIX-BUG-3: Handle both paginated {count, results} and plain array responses
  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res  = await api.get('/manual-nutrition/');
      const data = res.data;
      const list = Array.isArray(data) ? data
                 : Array.isArray(data?.results) ? data.results
                 : [];
      setSavedPlans(list);
      setShowHistory(true);
    } catch {
      toast.error('Failed to load history');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!calcState.manualClientName.trim()) {
      toast.error('Client Name is required to save.');
      return;
    }

    const payload = {
      client_name: calcState.manualClientName,
      phone:       calcState.manualPhone,
      plan_name:   calcState.planName,
      data:        { calcState, planNotes },
    };

    setIsSaving(true);
    try {
      if (currentId) {
        await api.patch(`/manual-nutrition/${currentId}/`, payload);
        toast.success('Plan Updated!');
      } else {
        const res = await api.post('/manual-nutrition/', payload);
        setCurrentId(res.data.id);
        toast.success('Plan Saved!');
      }
    } catch {
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [calcState, planNotes, currentId]);

  const handleLoad = useCallback((plan) => {
    setCurrentId(plan.id);
    if (plan.data?.calcState) {
      // Merge to ensure new fields not in old saves get defaults
      setCalcState({ ...INITIAL_CALC_STATE, ...plan.data.calcState });
    }
    setPlanNotes(plan.data?.planNotes || '');
    setShowHistory(false);
    toast.success(`Loaded: ${plan.plan_name}`);
  }, []);

  const handleDelete = useCallback(async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this plan?')) return;
    try {
      await api.delete(`/manual-nutrition/${id}/`);
      setSavedPlans((prev) => prev.filter((p) => p.id !== id));
      if (currentId === id) setCurrentId(null);
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }, [currentId]);

  const handleNew = useCallback(() => {
    setCurrentId(null);
    setCalcState({ ...INITIAL_CALC_STATE, manualClientName: '', manualPhone: '', planName: 'New Plan' });
    setPlanNotes('');
    toast.success('New Plan Started');
  }, []);

  const updateCalc = useCallback((key, value) => {
    setCalcState((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── PDF OBJECT ────────────────────────────────────────────────────────
  const dummyPlanObject = useMemo(() => ({
    name:                calcState.planName,
    duration_weeks:      4,
    calc_activity_level: calcState.activityLevel,
    calc_meals:          calcState.mealsCount,
    calc_snacks:         calcState.snacksCount,
    calc_weight:         calcState.weightKg,
  }), [calcState]);

  // ── RENDER ────────────────────────────────────────────────────────────
  return (
    <div className="animate-in slide-in-from-bottom-4 duration-500 pb-20 p-6 pt-20 lg:pt-6 max-w-7xl mx-auto relative bg-zinc-50 dark:bg-[#09090b] min-h-screen transition-colors">

      {/* ── HISTORY OVERLAY ───────────────────────────────────────────── */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-end animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowHistory(false); }}
        >
          <div className="
            w-full max-w-md h-full bg-zinc-50 dark:bg-[#0a0a0c]
            border-l border-zinc-200 dark:border-zinc-800
            shadow-2xl flex flex-col
            animate-slide-in-from-right
          ">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-purple-100 dark:bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <History size={17} className="text-purple-500" />
                </div>
                <div>
                  <h3 className="font-black text-zinc-900 dark:text-zinc-100 text-sm">Saved Plans</h3>
                  <p className="text-[10px] text-zinc-500">{savedPlans.length} plan{savedPlans.length !== 1 ? 's' : ''} total</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500
                  hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  placeholder="Search by client or plan name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="
                    w-full bg-white dark:bg-zinc-900
                    border border-zinc-200 dark:border-zinc-700
                    rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium
                    text-zinc-800 dark:text-zinc-200
                    outline-none focus:border-purple-400 dark:focus:border-purple-500/50
                    placeholder:text-zinc-400 dark:placeholder:text-zinc-600
                    transition-colors
                  "
                />
              </div>
            </div>

            {/* Plans list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredPlans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-600">
                  <FolderOpen size={44} className="mb-3 stroke-1" />
                  <p className="font-medium text-sm">No plans found</p>
                  {searchQuery && <p className="text-xs mt-1 opacity-70">Try a different search term</p>}
                </div>
              ) : (
                filteredPlans.map((plan, idx) => (
                  <div
                    key={plan.id}
                    onClick={() => handleLoad(plan)}
                    className="
                      group relative
                      bg-white dark:bg-[#18181b]
                      border border-zinc-200 dark:border-zinc-800
                      hover:border-purple-500/50 dark:hover:border-purple-500/30
                      hover:bg-zinc-50 dark:hover:bg-[#1f1f22]
                      rounded-2xl p-4 cursor-pointer transition-all duration-300
                      overflow-hidden shadow-sm hover:shadow-md
                    "
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="flex items-start gap-3">
                        <div className="
                          w-11 h-11 rounded-2xl
                          bg-zinc-100 dark:bg-zinc-800
                          border border-zinc-200 dark:border-zinc-700
                          flex items-center justify-center
                          text-zinc-400 dark:text-zinc-500 font-black text-base shadow-inner
                          group-hover:text-purple-500 group-hover:border-purple-500/30
                          transition-colors shrink-0
                        ">
                          {plan.client_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-base leading-tight truncate">
                            {plan.client_name}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] uppercase font-bold tracking-wider">
                              {plan.plan_name || 'Custom Plan'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(plan.id, e)}
                        className="
                          p-2 text-zinc-400 hover:text-red-500
                          hover:bg-red-500/10 rounded-xl transition-all
                          opacity-0 group-hover:opacity-100
                          translate-x-2 group-hover:translate-x-0
                        "
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/50 flex items-center gap-5 text-xs text-zinc-500 relative z-10 font-medium">
                      {plan.phone && (
                        <div className="flex items-center gap-1.5">
                          <Smartphone size={12} className="text-zinc-400 dark:text-zinc-600 shrink-0" />
                          <span className="truncate">{plan.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 ml-auto shrink-0">
                        <Calendar size={12} className="text-zinc-400 dark:text-zinc-600" />
                        <span>{new Date(plan.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Calculator className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-zinc-900 dark:text-white">Manual Nutrition</h2>
            <p className="text-zinc-500 font-medium text-sm">Create, Save & Print Strategies</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleNew}
            title="New Plan"
            className="p-3 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700
              text-zinc-700 dark:text-white rounded-xl border border-zinc-300 dark:border-zinc-700
              transition-all shadow-sm active:scale-95"
          >
            <FileText size={18} />
          </button>
          <button
            onClick={fetchHistory}
            disabled={isLoadingHistory}
            title="Saved Plans"
            className="p-3 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700
              text-zinc-700 dark:text-white rounded-xl border border-zinc-300 dark:border-zinc-700
              transition-all shadow-sm disabled:opacity-70 active:scale-95"
          >
            {isLoadingHistory ? <Loader2 size={18} className="animate-spin" /> : <FolderOpen size={18} />}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl
              shadow-lg shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {currentId ? 'Update' : 'Save'}
          </button>

          {/* PDF — EN */}
          <PDFDownloadLink
            document={
              <NutritionPDF_EN
                plan={dummyPlanObject}
                clientName={calcState.manualClientName}
                trainerName={calcState.manualTrainerName}
                brandText={calcState.brandText}
                carbAdjustment={calcState.carbAdjustment}
                results={results}
                exchangeList={exchangeList}
                notes={planNotes}
              />
            }
            fileName={`${calcState.manualClientName || 'Plan'}_EN.pdf`}
          >
            {({ loading: pdfLoading }) => (
              <button disabled={pdfLoading}
                className="px-4 py-3 bg-zinc-200 dark:bg-white text-black font-bold rounded-xl
                  flex items-center gap-2 shadow-sm disabled:opacity-70 transition-all active:scale-95">
                {pdfLoading ? <Loader2 size={18} className="animate-spin" /> : <Download size={16} />}
                EN
              </button>
            )}
          </PDFDownloadLink>

          {/* PDF — AR */}
          <PDFDownloadLink
            document={
              <NutritionPDF_AR
                plan={dummyPlanObject}
                clientName={calcState.manualClientName}
                trainerName={calcState.manualTrainerName}
                brandText={calcState.brandText}
                carbAdjustment={calcState.carbAdjustment}
                results={results}
                exchangeList={exchangeList}
                notes={planNotes}
              />
            }
            fileName={`${calcState.manualClientName || 'Plan'}_AR.pdf`}
          >
            {({ loading: pdfLoading }) => (
              <button disabled={pdfLoading}
                className="px-4 py-3 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400
                  font-bold rounded-xl border border-emerald-200 dark:border-emerald-800
                  flex items-center gap-2 shadow-sm disabled:opacity-70 transition-all active:scale-95">
                {pdfLoading ? <Loader2 size={18} className="animate-spin" /> : <Download size={16} />}
                AR
              </button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      <div className="space-y-6">

        {/* ── PLAN DETAILS ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-3xl p-6 relative overflow-hidden shadow-sm transition-shadow hover:shadow-md">
          {currentId && (
            <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
              EDITING MODE
            </div>
          )}
          <h3 className="font-bold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
            <ClipboardType size={18} className="text-purple-500" /> Plan Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <ModernInput label="Client Name"   value={calcState.manualClientName}  onChange={(v) => updateCalc('manualClientName', v)}  placeholder="e.g. John Doe"    />
            <ModernInput label="Phone Number"  value={calcState.manualPhone}       onChange={(v) => updateCalc('manualPhone', v)}        placeholder="01xxxxxxxxx"      />
            <ModernInput label="Trainer Name"  value={calcState.manualTrainerName} onChange={(v) => updateCalc('manualTrainerName', v)}  placeholder="e.g. Coach Mike"  />
            <ModernInput label="Plan Title"    value={calcState.planName}          onChange={(v) => updateCalc('planName', v)}           placeholder="e.g. Cutting Phase" />
          </div>
        </div>

        {/* ── BODY METRICS ──────────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-3xl p-6 shadow-sm transition-shadow hover:shadow-md">
          <h3 className="font-bold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
            <User size={18} className="text-orange-500" /> Body Metrics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <ModernInput label="Gender" value={calcState.gender} onChange={(v) => updateCalc('gender', v)}
              options={[{ val: 'male', lbl: 'Male' }, { val: 'female', lbl: 'Female' }]} />
            <ModernInput label="Age"    value={calcState.age}      onChange={(v) => updateCalc('age', v)}      type="number" min="0" />
            <ModernInput label="Height" value={calcState.heightCm} onChange={(v) => updateCalc('heightCm', v)} type="number" suffix="cm" min="0" />
            <ModernInput label="Weight" value={calcState.weightKg} onChange={(v) => updateCalc('weightKg', v)} type="number" suffix="kg" min="0" />
            <div className="bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-3 rounded-2xl flex flex-col justify-center">
              <label className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-500 flex items-center gap-1">
                <Scale size={10} /> In Lbs
              </label>
              <span className="text-zinc-900 dark:text-white font-bold text-lg tabular-nums">{weightLbs}</span>
            </div>
            {/* FIX-BUG-2: Added very_active (1.9×) which was missing */}
            <ModernInput label="Activity" value={calcState.activityLevel} onChange={(v) => updateCalc('activityLevel', v)}
              options={[
                { val: 'sedentary',   lbl: 'Sedentary'  },
                { val: 'light',       lbl: 'Light'       },
                { val: 'moderate',    lbl: 'Moderate'    },
                { val: 'active',      lbl: 'Active'      },
                { val: 'very_active', lbl: 'Very Active' },
              ]}
            />
          </div>
        </div>

        {/* ── STRATEGY ──────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-3xl p-6 shadow-sm transition-shadow hover:shadow-md">
          <h3 className="font-bold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
            <Activity size={18} className="text-emerald-500" /> Strategy
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <ModernInput label="Deficit/Surplus" value={calcState.deficitSurplus}  onChange={(v) => updateCalc('deficitSurplus', v)}  type="number" suffix="kcal" />
            <ModernInput label="Pro Ratio"        value={calcState.proteinPerLb}    onChange={(v) => updateCalc('proteinPerLb', v)}    type="number" suffix="g/lb" min="0" />
            <ModernInput label="Fat Ratio"        value={calcState.fatPercentage}   onChange={(v) => updateCalc('fatPercentage', v)}   type="number" suffix="%" min="0" />
            <ModernInput label="Carb Manip %"     value={calcState.carbAdjustment}  onChange={(v) => updateCalc('carbAdjustment', v)} type="number" suffix="+/-" className="border-blue-500/30" />
            <ModernInput label="Main Meals"       value={calcState.mealsCount}      onChange={(v) => updateCalc('mealsCount', v)}      type="number" min="1" />
            <ModernInput label="Snacks"           value={calcState.snacksCount}     onChange={(v) => updateCalc('snacksCount', v)}     type="number" suffix="#" min="0" />
          </div>
        </div>

        {/* ── DAILY TARGETS ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="text-center md:text-left min-w-[150px]">
              <p className="text-xs font-bold text-zinc-500 uppercase">Daily Target</p>
              <p className="text-5xl font-black text-zinc-900 dark:text-white tabular-nums">
                {results.targetCalories}{' '}
                <span className="text-lg text-zinc-500 font-bold">kcal</span>
              </p>
              {results.warning && (
                <p className="text-xs text-red-500 mt-2 font-medium">{results.warning}</p>
              )}
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
              {[
                { label: 'Protein', value: `${results.macros.protein.grams}g`, pct: results.macros.protein.pct, color: 'text-red-500',     Icon: Beef     },
                { label: 'Carbs',   value: `${results.macros.carbs.grams}g`,   pct: results.macros.carbs.pct,   color: 'text-blue-500',    Icon: Wheat    },
                { label: 'Fats',    value: `${results.macros.fats.grams}g`,    pct: results.macros.fats.pct,    color: 'text-yellow-500',  Icon: Droplets },
                { label: 'Fiber',   value: `${results.macros.fiber.grams}g`,   pct: null,                       color: 'text-emerald-500', Icon: Leaf     },
              ].map(({ label, value, pct, color, Icon }) => (
                <div key={label} className="bg-white dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-300 dark:border-zinc-800/50 hover:border-zinc-400 dark:hover:border-zinc-700 transition-colors">
                  <span className={`text-zinc-600 dark:text-zinc-400 flex items-center gap-2 text-[10px] uppercase font-bold mb-1`}>
                    <Icon size={12} className={color} /> {label}
                  </span>
                  <span className="text-zinc-900 dark:text-white font-black text-xl tabular-nums">{value}</span>
                  {pct !== null && (
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">{pct}% of target</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-3xl p-6 shadow-sm transition-shadow hover:shadow-md">
            <h3 className="font-bold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
              <FileText size={18} className="text-purple-500" /> PDF Brand
            </h3>
            <ModernInput label="Brand / Logo Text" value={calcState.brandText} onChange={(v) => updateCalc('brandText', v)} placeholder="e.g. IRON GYM" />
          </div>
        </div>

        {/* ── EXCHANGE TABLE (with search — FIX-BUG-4,5) ────────────── */}
        {exchangeList ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-purple-400 shrink-0" />
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Exchange Lists</h3>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              <span className="text-[10px] text-zinc-400 font-medium">{foodDatabase.length} foods</span>
            </div>
            {Object.entries(exchangeList).map(([groupName, data]) => (
              <ExchangeGroupSection
                key={groupName}
                groupName={groupName}
                data={data}
                carbAdjustment={calcState.carbAdjustment}
              />
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-zinc-400 dark:text-zinc-600 text-sm border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
            <Utensils size={32} className="mx-auto mb-3 opacity-30 stroke-1" />
            <p className="font-medium">Loading food database…</p>
          </div>
        )}

        {/* ── COACH NOTES ───────────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-3xl p-6 shadow-sm transition-shadow hover:shadow-md">
          <h3 className="font-bold text-zinc-800 dark:text-white mb-4 flex items-center gap-2">
            <FileText size={18} className="text-emerald-500" /> Coach Notes & Recommendations
          </h3>
          <textarea
            value={planNotes}
            onChange={(e) => setPlanNotes(e.target.value)}
            placeholder="Write your grocery list, supplement recommendations, or snack ideas here..."
            className="
              w-full bg-zinc-100 dark:bg-zinc-900/50
              border border-zinc-300 dark:border-zinc-800
              rounded-2xl p-4
              text-zinc-800 dark:text-zinc-300 font-medium
              outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/10
              transition-colors resize-none text-sm leading-relaxed min-h-[150px]
              placeholder-zinc-400 dark:placeholder-zinc-600
            "
          />
        </div>
      </div>
    </div>
  );
};

export default ManualNutritionPlan;