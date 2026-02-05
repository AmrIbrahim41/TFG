import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Utensils, Calendar, User, Activity, 
    Save, ArrowLeft, Target, Trash2, Plus, 
    Flame, Droplets, Wheat, Beef, AlertTriangle, 
    Leaf, FileText, Zap, Mars, Venus, Loader2, 
    ChevronLeft, ChevronRight, Download, Scale,
    Check, ChevronDown 
} from 'lucide-react';
import api from '../../api';
import { PDFDownloadLink } from '@react-pdf/renderer'; 

// --- IMPORT SEPARATE PDF FILES ---
import NutritionPDF_EN from '../../utils/NutritionPDF_EN'; 
import NutritionPDF_AR from '../../utils/NutritionPDF_AR'; 

// --- PAGINATION ---
const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-2 mt-8 pb-8">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-all"
            >
                <ChevronLeft size={18} />
            </button>
            <span className="text-xs font-bold text-zinc-500 px-4">Page {currentPage} of {totalPages}</span>
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-all"
            >
                <ChevronRight size={18} />
            </button>
        </div>
    );
};

// --- LOGIC ENGINE ---
const calculateNutrition = (inputs) => {
    const {
        gender = 'male', age = 25, heightCm = 170, weightKg = 80, 
        activityLevel = 'moderate', deficitSurplus = 0, 
        fatPercentage = 25, proteinPerLb = 1.0, 
        mealsCount = 4
    } = inputs;

    const safeWeight = Math.max(0, parseFloat(weightKg) || 0);
    const safeHeight = Math.max(0, parseFloat(heightCm) || 0);
    const safeAge = Math.max(0, parseInt(age) || 0);
    const safeMeals = Math.max(1, parseInt(mealsCount) || 1); 

    const weightLbs = safeWeight * 2.20462;
    
    let bmr = (10 * safeWeight) + (6.25 * safeHeight) - (5 * safeAge);
    bmr += (gender === 'male' ? 5 : -161);

    const multipliers = { 'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 'active': 1.725, 'very_active': 1.9 };
    const tdee = Math.round(bmr * (multipliers[activityLevel] || 1.2));
    const targetCalories = tdee + parseInt(deficitSurplus || 0);
    
    const proteinGrams = Math.round(weightLbs * parseFloat(proteinPerLb || 1));
    const proteinCals = proteinGrams * 4;
    
    let fatCals = Math.round(targetCalories * (parseFloat(fatPercentage || 25) / 100));
    let fatGrams = Math.round(fatCals / 9);

    const usedCals = proteinCals + fatCals;
    let remainingCals = targetCalories - usedCals;
    let warning = null;

    if (remainingCals < 0) {
        warning = "Check Macros! (Over Limit)";
        remainingCals = 0; 
    }

    const carbGrams = Math.round(remainingCals / 4);
    const fiberGrams = Math.round((targetCalories / 1000) * 14);

    return {
        tdee, targetCalories, warning, 
        macros: {
            protein: { grams: proteinGrams, cals: proteinCals, pct: Math.round((proteinCals/targetCalories)*100) || 0 },
            fats: { grams: fatGrams, cals: fatCals, pct: Math.round((fatCals/targetCalories)*100) || 0 },
            carbs: { grams: carbGrams, cals: remainingCals, pct: Math.round((remainingCals/targetCalories)*100) || 0 },
            fiber: { grams: fiberGrams } 
        },
        perMeal: {
            proteinCals: Math.round(proteinCals / safeMeals),
            carbsCals: Math.round(remainingCals / safeMeals),
            fatsCals: Math.round(fatCals / safeMeals),
            proteinGrams: Math.round(proteinGrams / safeMeals),
            carbsGrams: Math.round(carbGrams / safeMeals),
            fatsGrams: Math.round(fatGrams / safeMeals),
        }
    };
};

// --- MODERN SELECT COMPONENT ---
const CustomSelect = ({ label, value, options, onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.val === value)?.lbl || value;

    return (
        <div ref={containerRef} className={`relative w-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div 
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
                    bg-zinc-200 dark:bg-zinc-900/50 border p-3.5 rounded-2xl cursor-pointer transition-all duration-200 group relative
                    ${isOpen ? 'border-orange-500 ring-1 ring-orange-500/20 bg-zinc-100 dark:bg-zinc-900' : 'border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-900'}
                `}
            >
                <label className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-500 mb-1 block group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors">
                    {label}
                </label>
                <div className="flex justify-between items-center">
                    <span className="text-zinc-900 dark:text-white font-bold text-sm md:text-base truncate pr-2">
                        {selectedLabel}
                    </span>
                    <ChevronDown 
                        size={16} 
                        className={`text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-orange-500' : ''}`} 
                    />
                </div>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-50 dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                        {options.map((opt) => (
                            <div 
                                key={opt.val}
                                onClick={() => { onChange(opt.val); setIsOpen(false); }}
                                className={`
                                    px-4 py-3 flex items-center justify-between cursor-pointer transition-colors border-b border-zinc-300 dark:border-zinc-800/50 last:border-0
                                    ${opt.val === value ? 'bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'text-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white'}
                                `}
                            >
                                <span className="font-bold text-sm">{opt.lbl}</span>
                                {opt.val === value && <Check size={14} className="text-orange-600 dark:text-orange-500" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- UPDATED INPUT COMPONENT ---
const ModernInput = ({ label, value, onChange, type="text", suffix, options, disabled=false, className="", min }) => {
    if (options) {
        return (
            <div className={className}>
                <CustomSelect 
                    label={label} 
                    value={value} 
                    options={options} 
                    onChange={onChange} 
                    disabled={disabled} 
                />
            </div>
        );
    }

    return (
        <div className={`bg-zinc-200 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 p-3.5 rounded-2xl relative focus-within:ring-1 focus-within:ring-orange-500/50 focus-within:border-orange-500 focus-within:bg-zinc-100 dark:focus-within:bg-zinc-900 transition-all ${disabled ? 'opacity-50' : ''} ${className}`}>
            <label className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-500 mb-1 block">{label}</label>
            <input 
                disabled={disabled} 
                type={type} 
                min={min}
                value={value} 
                onChange={(e) => {
                    if (type === 'number' && min !== undefined) {
                        const val = parseFloat(e.target.value);
                        if (val < min && e.target.value !== '') return; 
                    }
                    onChange(e.target.value)
                }} 
                className="w-full bg-transparent text-zinc-900 dark:text-white font-bold text-sm md:text-base outline-none placeholder-zinc-500 dark:placeholder-zinc-700" 
            />
            {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500 dark:text-zinc-600">{suffix}</span>}
        </div>
    );
};

const ClientNutritionTab = ({ subscriptions, clientData }) => {
    const [view, setView] = useState('list'); 
    const [plans, setPlans] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    
    const [activePlan, setActivePlan] = useState(null);
    const [foodDatabase, setFoodDatabase] = useState([]);
    const [newPlanName, setNewPlanName] = useState('');
    const [newPlanWeeks, setNewPlanWeeks] = useState(4);
    
    const [calcState, setCalcState] = useState({
        gender: 'male', age: 25, heightCm: 175, weightKg: 80,
        activityLevel: 'moderate', deficitSurplus: -500,
        fatPercentage: 25, proteinPerLb: 1.0,
        mealsCount: 4, snacksCount: 0,
        carbAdjustment: 0, 
        brandText: 'TFG' 
    });

    const [results, setResults] = useState(null);
    const [planNotes, setPlanNotes] = useState('');

    const clientId = clientData?.id || (subscriptions && subscriptions[0] ? subscriptions[0].client : null);
    const defaultSubId = subscriptions && subscriptions[0] ? subscriptions[0].id : null;

    const pdfClientName = activePlan?.client_name || clientData?.name || "Athlete";
    const trainerName = activePlan?.created_by_name || "Coach";

    useEffect(() => { if (clientId) fetchPlans(page); }, [clientId, page]);
    useEffect(() => { fetchFoodDatabase(); }, []);

    useEffect(() => {
        if (view === 'detail') {
            const res = calculateNutrition(calcState);
            setResults(res);
        }
    }, [calcState, view]);

    useEffect(() => {
        if (activePlan) {
            setCalcState({
                gender: activePlan.calc_gender || 'male',
                age: activePlan.calc_age || 25,
                heightCm: activePlan.calc_height || 170,
                weightKg: activePlan.calc_weight || 80,
                activityLevel: activePlan.calc_activity_level || 'moderate',
                deficitSurplus: activePlan.calc_defer_cal || 0,
                fatPercentage: activePlan.calc_fat_percent || 25,
                proteinPerLb: activePlan.calc_protein_multiplier || 1.0,
                mealsCount: activePlan.calc_meals || 4,
                snacksCount: activePlan.calc_snacks || 0,
                carbAdjustment: activePlan.calc_carb_adjustment || 0,
                brandText: activePlan.pdf_brand_text || 'TFG'
            });
            setPlanNotes(activePlan.notes || '');
        }
    }, [activePlan]);

    const weightLbs = useMemo(() => {
        return ((parseFloat(calcState.weightKg) || 0) * 2.20462).toFixed(1);
    }, [calcState.weightKg]);

    const fetchPlans = async (pageNum = 1) => {
        if (!clientId) return;
        setLoading(true);
        try {
            const res = await api.get(`/nutrition-plans/?client_id=${clientId}&page=${pageNum}`);
            if (res.data.results) {
                setPlans(res.data.results);
                setTotalCount(res.data.count);
            } else {
                setPlans(res.data);
                setTotalCount(res.data.length);
            }
        } catch (err) { console.error(err); } 
        finally { setLoading(false); }
    };

    const fetchFoodDatabase = async () => {
        try {
            const res = await api.get('/food-database/');
            setFoodDatabase(res.data);
        } catch (err) { console.error("Failed to load foods", err); }
    };

    const handleCreatePlan = async () => {
        if (!newPlanName || !defaultSubId) return alert("Enter name and ensure valid subscription");
        try {
            const payload = { subscription: defaultSubId, name: newPlanName, duration_weeks: newPlanWeeks, target_calories: 2000 };
            const res = await api.post('/nutrition-plans/', payload);
            fetchPlans(page);
            setNewPlanName('');
            setActivePlan(res.data);
            setView('detail');
        } catch (err) { alert("Error creating plan."); }
    };

    const handleSavePlan = async () => {
        if (!activePlan || !results) return;
        try {
            const payload = {
                calc_gender: calcState.gender,
                calc_age: parseInt(calcState.age),
                calc_height: parseFloat(calcState.heightCm),
                calc_weight: parseFloat(calcState.weightKg),
                calc_activity_level: calcState.activityLevel,
                calc_defer_cal: parseInt(calcState.deficitSurplus),
                calc_fat_percent: parseFloat(calcState.fatPercentage),
                calc_protein_multiplier: parseFloat(calcState.proteinPerLb),
                calc_meals: parseInt(calcState.mealsCount),
                calc_snacks: parseInt(calcState.snacksCount),
                
                calc_carb_adjustment: parseInt(calcState.carbAdjustment),
                pdf_brand_text: calcState.brandText,

                calc_tdee: parseInt(results.tdee),
                target_calories: parseInt(results.targetCalories),
                target_protein: parseInt(results.macros.protein.grams),
                target_carbs: parseInt(results.macros.carbs.grams),
                target_fats: parseInt(results.macros.fats.grams),
                notes: planNotes
            };
            await api.patch(`/nutrition-plans/${activePlan.id}/`, payload);
            alert("✅ Targets & Notes Saved!");
            fetchPlans(page);
        } catch (err) { alert("Failed to save."); }
    };

    const handleDeletePlan = async (id, e) => {
        e.stopPropagation();
        if(!confirm("Delete this plan?")) return;
        try {
            await api.delete(`/nutrition-plans/${id}/`);
            fetchPlans(page);
            if(activePlan?.id === id) setView('list');
        } catch (err) { alert("Error deleting."); }
    };

    const formatActivity = (str) => {
        if (!str) return 'Moderate';
        return str.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const exchangeList = useMemo(() => {
        if (!results || !foodDatabase.length) return null;
        const targets = results.perMeal; 
        const groups = {
            'Protein Sources': { items: [], targetCals: targets.proteinCals, color: 'text-red-500', bg: 'bg-red-500/10' },
            'Carbohydrates': { items: [], targetCals: targets.carbsCals, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            'Fats': { items: [], targetCals: targets.fatsCals, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
        };

        const carbModifier = 1 + (parseFloat(calcState.carbAdjustment || 0) / 100);

        foodDatabase.forEach(food => {
            const cat = food.category?.toLowerCase() || '';
            let targetGroup = '';
            
            if (cat === 'protein') targetGroup = 'Protein Sources';
            else if (cat === 'carbs') targetGroup = 'Carbohydrates';
            else if (cat === 'fats') targetGroup = 'Fats';
            
            if (targetGroup && food.calories_per_100g > 0) {
                const targetCals = groups[targetGroup].targetCals;
                let requiredWeight = (targetCals / food.calories_per_100g) * 100;
                
                if (targetGroup === 'Carbohydrates') {
                    requiredWeight = requiredWeight * carbModifier;
                }

                const meta = {
                    cals: Math.round((food.calories_per_100g * requiredWeight) / 100),
                    pro: Math.round((food.protein_per_100g * requiredWeight) / 100),
                    carbs: Math.round((food.carbs_per_100g * requiredWeight) / 100),
                    fats: Math.round((food.fats_per_100g * requiredWeight) / 100),
                };
                
                groups[targetGroup].items.push({ 
                    name: food.name, 
                    arabic_name: food.arabic_name, 
                    weight: Math.round(requiredWeight), 
                    unit: 'g', 
                    meta: meta 
                });
            }
        });
        return groups;
    }, [results, foodDatabase, calcState.carbAdjustment]);

    if (view === 'list') {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 p-2 md:p-4">
                
                {/* LIST HEADER */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                            <Utensils className="text-white" size={20} />
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white">Nutrition</h2>
                            <p className="text-zinc-500 font-medium text-xs md:text-sm">Manage diet plans</p>
                        </div>
                    </div>
                </div>

                {/* CREATE NEW PLAN CARD */}
                <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 p-4 md:p-6 rounded-3xl relative overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end relative z-10">
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-500 uppercase ml-1">Plan Name</label>
                            <input 
                                placeholder="e.g. Cutting Phase 1" 
                                className="w-full bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white font-bold outline-none focus:border-orange-500 transition-all text-sm"
                                value={newPlanName} 
                                onChange={e => setNewPlanName(e.target.value)} 
                            />
                        </div>
                        <div className="md:col-span-1 space-y-2">
                            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-500 uppercase ml-1">Weeks</label>
                            <input 
                                type="number" 
                                placeholder="4" 
                                className="w-full bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white font-bold outline-none focus:border-orange-500 transition-all text-sm" 
                                value={newPlanWeeks} 
                                onChange={e => setNewPlanWeeks(e.target.value)} 
                            />
                        </div>
                        <button 
                            onClick={handleCreatePlan} 
                            disabled={!newPlanName} 
                            className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-orange-600 dark:hover:bg-orange-500 hover:text-white dark:hover:text-white disabled:opacity-50 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-sm"
                        >
                            <Plus size={16} /> Create
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="py-20 flex justify-center text-orange-500"><Loader2 className="animate-spin w-10 h-10" /></div>
                ) : (
                    <div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {plans.map(plan => {
                                const isMale = (plan.calc_gender || 'male') === 'male';
                                const activity = formatActivity(plan.calc_activity_level);

                                return (
                                    <div 
                                        key={plan.id} 
                                        onClick={() => { setActivePlan(plan); setView('detail'); }} 
                                        className="group relative bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-3xl p-5 hover:border-orange-500/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between min-h-[180px]"
                                    >
                                        <div className="absolute -right-6 -bottom-6 text-zinc-200 dark:text-zinc-800/50 group-hover:text-orange-500/5 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-500">
                                            <Target size={120} strokeWidth={1} />
                                        </div>

                                        <div className="relative z-10 flex flex-col h-full gap-3">
                                            <div className="flex justify-between items-start">
                                                <div className="flex gap-2">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-200 dark:bg-zinc-800/50 border border-zinc-300 dark:border-zinc-700/50 text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider backdrop-blur-sm">
                                                        <Calendar size={10} /> {plan.duration_weeks}W
                                                    </span>
                                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-[10px] backdrop-blur-sm ${isMale ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-pink-500/10 border-pink-500/20 text-pink-600 dark:text-pink-400'}`}>
                                                        {isMale ? <Mars size={12}/> : <Venus size={12}/>}
                                                    </span>
                                                </div>

                                                <button onClick={(e) => handleDeletePlan(plan.id, e)} className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 dark:text-zinc-600 hover:bg-red-500/10 hover:text-red-500 transition-all z-20">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            
                                            <div>
                                                <h3 className="text-lg font-black text-zinc-900 dark:text-white leading-tight mb-1 group-hover:text-orange-600 dark:group-hover:text-orange-500 transition-colors line-clamp-2">{plan.name}</h3>
                                                <p className="text-[10px] text-zinc-500">Created {new Date(plan.created_at).toLocaleDateString()}</p>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 mt-auto">
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-200 dark:bg-zinc-950 rounded-lg border border-zinc-300 dark:border-zinc-800/50 text-zinc-600 dark:text-zinc-400">
                                                    <Zap size={12} className="text-emerald-600 dark:text-emerald-500 fill-emerald-500/20" />
                                                    <span className="text-[10px] font-bold uppercase">{activity}</span>
                                                </div>

                                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-200 dark:bg-zinc-950 rounded-lg border border-zinc-300 dark:border-zinc-800/50 group-hover:border-orange-500/20 transition-colors ml-auto">
                                                    <Flame size={12} className="text-orange-600 dark:text-orange-500 fill-orange-500/20" />
                                                    <span className="text-zinc-900 dark:text-white font-bold text-xs">{plan.target_calories || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {plans.length === 0 && (
                                <div className="col-span-full py-10 text-center border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl text-zinc-500">
                                    <Utensils size={32} className="mx-auto mb-2 opacity-20" />
                                    <p className="font-bold text-sm">No Nutrition Plans Found</p>
                                </div>
                            )}
                        </div>

                        <Pagination totalItems={totalCount} itemsPerPage={12} currentPage={page} onPageChange={setPage} />
                    </div>
                )}
            </div>
        );
    }

    if (view === 'detail' && results) {
        return (
            <div className="animate-in slide-in-from-bottom-4 duration-500 pb-20 p-1 md:p-2">
                {/* DETAIL HEADER */}
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('list')} className="w-10 h-10 flex items-center justify-center bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white shrink-0"><ArrowLeft size={18} /></button>
                        <div className="min-w-0">
                            <h2 className="text-xl font-black text-zinc-900 dark:text-white truncate">{activePlan.name}</h2>
                            <p className="text-xs text-zinc-500">Editing Mode</p>
                        </div>
                    </div>
                    
                    {/* ACTION BUTTONS (Scrollable on mobile) */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {results && activePlan && (
                            <>
                                <PDFDownloadLink
                                    document={<NutritionPDF_EN plan={activePlan} clientName={pdfClientName} trainerName={trainerName} brandText={calcState.brandText} carbAdjustment={calcState.carbAdjustment} results={results} exchangeList={exchangeList} notes={planNotes} />}
                                    fileName={`${activePlan.name}_EN.pdf`}
                                >
                                    {({ loading: pdfLoading }) => (
                                        <button disabled={pdfLoading} className="whitespace-nowrap px-4 py-2.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-200 font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs flex items-center gap-2 transition-all disabled:opacity-50">
                                            {pdfLoading ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />} EN PDF
                                        </button>
                                    )}
                                </PDFDownloadLink>

                                <PDFDownloadLink
                                    document={<NutritionPDF_AR plan={activePlan} clientName={pdfClientName} trainerName={trainerName} brandText={calcState.brandText} carbAdjustment={calcState.carbAdjustment} results={results} exchangeList={exchangeList} notes={planNotes} />}
                                    fileName={`${activePlan.name}_AR.pdf`}
                                >
                                    {({ loading: pdfLoading }) => (
                                        <button disabled={pdfLoading} className="whitespace-nowrap px-4 py-2.5 bg-emerald-100 dark:bg-emerald-900/50 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs flex items-center gap-2 transition-all disabled:opacity-50">
                                            {pdfLoading ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />} عربي PDF
                                        </button>
                                    )}
                                </PDFDownloadLink>
                            </>
                        )}

                        <button onClick={handleSavePlan} className="whitespace-nowrap px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-900/20 text-xs flex items-center gap-2 ml-auto">
                            <Save size={14} /> Save
                        </button>
                    </div>
                </div>

                <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto">
                    
                    {/* 1. CLIENT METRICS */}
                    <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-3xl p-4 md:p-6">
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2 text-sm md:text-base">
                            <User size={16} className="text-orange-500"/> Body Metrics
                        </h3>
                        {/* GRID: 1 col on mobile, 2 on tablet, 6 on desktop */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
                            <ModernInput label="Gender" value={calcState.gender} onChange={(v) => setCalcState({...calcState, gender: v})} options={[{val:'male', lbl:'Male'}, {val:'female', lbl:'Female'}]} />
                            <ModernInput label="Age" value={calcState.age} onChange={(v) => setCalcState({...calcState, age: v})} type="number" min="0" />
                            <ModernInput label="Height" value={calcState.heightCm} onChange={(v) => setCalcState({...calcState, heightCm: v})} type="number" suffix="cm" min="0" />
                            <ModernInput label="Weight" value={calcState.weightKg} onChange={(v) => setCalcState({...calcState, weightKg: v})} type="number" suffix="kg" min="0" />
                            
                            {/* Read-only LBS Display */}
                            <div className="bg-zinc-200 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 p-3.5 rounded-2xl flex flex-col justify-center">
                                <label className="text-[10px] uppercase font-bold text-zinc-600 dark:text-zinc-500 flex items-center gap-1"><Scale size={10} /> LBS</label>
                                <span className="text-zinc-900 dark:text-white font-bold text-sm md:text-base">{weightLbs}</span>
                            </div>

                            <div className="sm:col-span-2 lg:col-span-1">
                                <ModernInput label="Activity" value={calcState.activityLevel} onChange={(v) => setCalcState({...calcState, activityLevel: v})} options={[
                                    {val:'sedentary', lbl:'Sedentary'}, {val:'light', lbl:'Light'}, {val:'moderate', lbl:'Moderate'}, {val:'active', lbl:'Active'}
                                ]} />
                            </div>
                        </div>
                    </div>

                    {/* 2. STRATEGY INPUTS */}
                    <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-3xl p-4 md:p-6">
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2 text-sm md:text-base">
                            <Activity size={16} className="text-emerald-500"/> Strategy
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
                            <ModernInput label="Calorie Goal (+/-)" value={calcState.deficitSurplus} onChange={(v) => setCalcState({...calcState, deficitSurplus: v})} type="number" suffix="kcal" />
                            <ModernInput label="Protein Ratio" value={calcState.proteinPerLb} onChange={(v) => setCalcState({...calcState, proteinPerLb: v})} type="number" suffix="g/lb" min="0" />
                            <ModernInput label="Fat Percentage" value={calcState.fatPercentage} onChange={(v) => setCalcState({...calcState, fatPercentage: v})} type="number" suffix="%" min="0" />
                            <ModernInput label="Carb Mod" value={calcState.carbAdjustment} onChange={(v) => setCalcState({...calcState, carbAdjustment: v})} type="number" suffix="+/-" />
                            <ModernInput label="Main Meals" value={calcState.mealsCount} onChange={(v) => setCalcState({...calcState, mealsCount: v})} type="number" min="1" />
                            <ModernInput label="Snacks" value={calcState.snacksCount} onChange={(v) => setCalcState({...calcState, snacksCount: v})} type="number" suffix="#" min="0" />
                        </div>
                    </div>

                    {/* BRANDING */}
                    <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-3xl p-4 md:p-6">
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2 text-sm md:text-base">
                            <FileText size={16} className="text-purple-500"/> PDF Branding
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <ModernInput label="Logo Text" value={calcState.brandText} onChange={(v) => setCalcState({...calcState, brandText: v})} placeholder="e.g. IRON GYM" />
                        </div>
                    </div>

                    {results.warning && (
                        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-start gap-3">
                            <AlertTriangle className="text-red-500 shrink-0" size={18} />
                            <p className="text-xs font-bold text-red-600 dark:text-red-400">{results.warning}</p>
                        </div>
                    )}

                    {/* 3. DAILY TARGET DASHBOARD */}
                    <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-3xl p-4 md:p-6 flex flex-col lg:flex-row items-center gap-6 md:gap-8">
                        {/* Total Calories */}
                        <div className="text-center lg:text-left min-w-[150px]">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Daily Target</p>
                            <p className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white leading-none">{results.targetCalories}</p>
                            <span className="text-sm text-zinc-500 font-bold">kcal</span>
                        </div>
                        
                        {/* Macro Cards (Grid 2x2 on Mobile) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full">
                            {[
                                { label: 'Protein', val: results.macros.protein.grams, sub: results.perMeal.proteinGrams, icon: Beef, color: 'text-red-500' },
                                { label: 'Carbs', val: results.macros.carbs.grams, sub: results.perMeal.carbsGrams, icon: Wheat, color: 'text-blue-500' },
                                { label: 'Fats', val: results.macros.fats.grams, sub: results.perMeal.fatsGrams, icon: Droplets, color: 'text-yellow-500' },
                                { label: 'Fiber', val: results.macros.fiber.grams, sub: 'Min', icon: Leaf, color: 'text-emerald-500' },
                            ].map((m, i) => (
                                <div key={i} className="bg-zinc-200 dark:bg-zinc-950 p-3 md:p-4 rounded-2xl border border-zinc-300 dark:border-zinc-800/50 flex flex-col items-center md:items-start text-center md:text-left">
                                    <span className="text-zinc-600 dark:text-zinc-500 flex items-center gap-1.5 text-[10px] uppercase font-bold mb-1">
                                        <m.icon size={12} className={m.color}/> {m.label}
                                    </span>
                                    <span className="text-zinc-900 dark:text-white font-black text-xl md:text-2xl">{m.val}g</span>
                                    <div className="text-zinc-500 dark:text-zinc-600 text-[10px] font-bold mt-1">{m.sub === 'Min' ? 'Minimum' : `${m.sub}g / meal`}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 4. EXCHANGE LIST */}
                    <div className="space-y-4 md:space-y-6">
                        {exchangeList && Object.entries(exchangeList).map(([groupName, data]) => (
                            <div key={groupName} className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-3xl overflow-hidden">
                                <div className={`p-4 border-b border-zinc-300 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-2 ${data.bg}`}>
                                    <h3 className={`font-black uppercase tracking-wider text-xs md:text-sm ${data.color}`}>{groupName}</h3>
                                    <div className="flex flex-wrap justify-center items-center gap-2">
                                        {groupName === 'Carbohydrates' && calcState.carbAdjustment !== 0 && (
                                            <span className="text-[10px] font-bold text-white bg-blue-500 px-2 py-0.5 rounded-md">
                                                {calcState.carbAdjustment > 0 ? '+' : ''}{calcState.carbAdjustment}%
                                            </span>
                                        )}
                                        <div className="text-[10px] md:text-xs font-bold text-zinc-700 dark:text-white bg-white/50 dark:bg-black/20 px-2 py-1 rounded-lg">
                                            {Math.round(data.targetCals)} kcal / meal
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div className="grid grid-cols-1 divide-y divide-zinc-200 dark:divide-zinc-800/50 bg-zinc-100/50 dark:bg-zinc-800/20">
                                        {data.items.length > 0 ? (
                                            data.items.map((item, idx) => (
                                                <div key={idx} className="bg-zinc-50 dark:bg-[#121214] p-3 md:p-4 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex justify-between items-center">
                                                    <div className="min-w-0 pr-2">
                                                        <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm truncate">{item.name}</p>
                                                        <p className="text-[10px] text-zinc-500">{Math.round(item.meta.cals)} kcal</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className={`font-black text-base md:text-lg ${groupName === 'Carbohydrates' && calcState.carbAdjustment !== 0 ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-900 dark:text-white'}`}>
                                                            {item.weight}
                                                        </span>
                                                        <span className="text-zinc-500 text-[10px] font-bold ml-1">{item.unit}</span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-6 text-center text-zinc-500 text-xs">
                                                No items found for this category.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 5. NOTES */}
                    <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-3xl p-4 md:p-6">
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2 text-sm md:text-base">
                            <FileText size={16} className="text-emerald-500"/> Notes & Instructions
                        </h3>
                        <textarea
                            value={planNotes}
                            onChange={(e) => setPlanNotes(e.target.value)}
                            placeholder="Supplements, grocery list, etc..."
                            className="w-full bg-zinc-200 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 text-zinc-700 dark:text-zinc-300 font-medium outline-none focus:border-emerald-500/50 transition-colors resize-none text-sm min-h-[120px]"
                        ></textarea>
                    </div>

                </div>
            </div>
        );
    }
    return null;
};

export default ClientNutritionTab;