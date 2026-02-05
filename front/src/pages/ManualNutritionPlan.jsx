import React, { useState, useEffect, useMemo } from 'react';
import { 
    Utensils, User, Activity, FileText, Zap, Download,
    Scale, Calculator, ClipboardType, Loader2, Wheat, Droplets, Leaf,
    Save, Trash2, History, Smartphone, FolderOpen, X,
    Search, Calendar // <-- Added new icons
} from 'lucide-react';
import api from '../api'; 
import { PDFDownloadLink } from '@react-pdf/renderer'; 
import toast from 'react-hot-toast'; 

// --- IMPORT SEPARATE PDF FILES ---
import NutritionPDF_EN from '../utils/NutritionPDF_EN'; 
import NutritionPDF_AR from '../utils/NutritionPDF_AR'; 

// --- HELPER: NUTRITION CALCULATOR ---
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
        warning = "Macros exceed Target Calories! Increase Calories or lower Fats/Protein.";
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

// --- HELPER: MODERN INPUT COMPONENT ---
const ModernInput = ({ label, value, onChange, type="text", suffix, options, disabled=false, className="", min, placeholder }) => (
    <div className={`bg-zinc-900 border border-zinc-800 p-3 rounded-2xl relative focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:border-orange-500 transition-all ${disabled ? 'opacity-50' : ''} ${className}`}>
        <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">{label}</label>
        {options ? (
            <select disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-white font-bold text-sm outline-none appearance-none cursor-pointer">
                {options.map(o => <option key={o.val} value={o.val}>{o.lbl}</option>)}
            </select>
        ) : (
            <input 
                disabled={disabled} 
                type={type} 
                min={min}
                value={value} 
                placeholder={placeholder}
                onChange={(e) => {
                    if (type === 'number' && min !== undefined) {
                        const val = parseFloat(e.target.value);
                        if (val < min && e.target.value !== '') return; 
                    }
                    onChange(e.target.value)
                }} 
                className="w-full bg-transparent text-white font-bold text-lg outline-none" 
            />
        )}
        {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-600">{suffix}</span>}
    </div>
);

const ManualNutritionPlan = () => {
    const [foodDatabase, setFoodDatabase] = useState([]);
    const [savedPlans, setSavedPlans] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [searchQuery, setSearchQuery] = useState(''); // --- NEW: Search State ---

    // STATE: All manual inputs
    const [calcState, setCalcState] = useState({
        manualClientName: '',
        manualPhone: '', 
        manualTrainerName: '',
        planName: 'Custom Strategy',
        
        gender: 'male', age: 25, heightCm: 175, weightKg: 80,
        activityLevel: 'moderate', deficitSurplus: -500,
        fatPercentage: 25, proteinPerLb: 1.0,
        mealsCount: 4, snacksCount: 0,
        carbAdjustment: 0, 
        brandText: 'TFG' 
    });

    const [results, setResults] = useState(null);
    const [planNotes, setPlanNotes] = useState('');
    const [currentId, setCurrentId] = useState(null); 

    useEffect(() => { 
        const fetchFoodDatabase = async () => {
            try {
                const res = await api.get('/food-database/');
                setFoodDatabase(res.data);
            } catch (err) { console.error("Failed to load foods", err); }
        };
        fetchFoodDatabase(); 
    }, []);

    useEffect(() => {
        const res = calculateNutrition(calcState);
        setResults(res);
    }, [calcState]);

    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const res = await api.get('/manual-nutrition/');
            setSavedPlans(res.data);
            setShowHistory(true);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load history");
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleSave = async () => {
        if (!calcState.manualClientName) return toast.error("Client Name required");
        
        const payload = {
            client_name: calcState.manualClientName,
            phone: calcState.manualPhone,
            plan_name: calcState.planName,
            data: {
                calcState: calcState,
                planNotes: planNotes
            }
        };

        try {
            if (currentId) {
                // Update
                await api.put(`/manual-nutrition/${currentId}/`, payload);
                toast.success("Plan Updated!");
            } else {
                // Create
                const res = await api.post('/manual-nutrition/', payload);
                setCurrentId(res.data.id);
                toast.success("Plan Saved!");
            }
            fetchHistory(); 
        } catch (error) {
            toast.error("Failed to save");
            console.error(error);
        }
    };

    const handleLoad = (plan) => {
        setCurrentId(plan.id);
        setCalcState(plan.data.calcState);
        setPlanNotes(plan.data.planNotes || '');
        setShowHistory(false);
        toast.success(`Loaded ${plan.plan_name}`);
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!confirm("Are you sure?")) return;
        try {
            await api.delete(`/manual-nutrition/${id}/`);
            setSavedPlans(prev => prev.filter(p => p.id !== id));
            if (currentId === id) setCurrentId(null);
            toast.success("Deleted");
        } catch (error) {
            toast.error("Failed to delete");
        }
    };

    const handleNew = () => {
        setCurrentId(null);
        setCalcState(prev => ({ ...prev, manualClientName: '', manualPhone: '', planName: 'New Plan' }));
        setPlanNotes('');
        toast.success("New Plan Started");
    };

    const weightLbs = useMemo(() => {
        return ((parseFloat(calcState.weightKg) || 0) * 2.20462).toFixed(1);
    }, [calcState.weightKg]);

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
                if (targetGroup === 'Carbohydrates') requiredWeight = requiredWeight * carbModifier;

                const meta = {
                    cals: Math.round((food.calories_per_100g * requiredWeight) / 100),
                    pro: Math.round((food.protein_per_100g * requiredWeight) / 100),
                    carbs: Math.round((food.carbs_per_100g * requiredWeight) / 100),
                    fats: Math.round((food.fats_per_100g * requiredWeight) / 100),
                };
                groups[targetGroup].items.push({ 
                    name: food.name, arabic_name: food.arabic_name,
                    weight: Math.round(requiredWeight), unit: 'g', meta: meta 
                });
            }
        });
        return groups;
    }, [results, foodDatabase, calcState.carbAdjustment]);

    const dummyPlanObject = {
        name: calcState.planName,
        duration_weeks: 4,
        calc_activity_level: calcState.activityLevel,
        calc_meals: calcState.mealsCount,
        calc_snacks: calcState.snacksCount,
        calc_weight: calcState.weightKg
    };

    if (!results) return <div className="p-10 text-white">Loading Calculator...</div>;

    return (
        <div className="animate-in slide-in-from-bottom-4 duration-500 pb-20 p-6 pt-20 lg:pt-6 max-w-7xl mx-auto relative">
            
            {/* --- UPDATED HISTORY OVERLAY --- */}
            {showHistory && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowHistory(false)}>
                    <div className="bg-[#121214] border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        
                        {/* Header & Search */}
                        <div className="p-5 border-b border-zinc-800 bg-[#18181b]/50 space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-white flex items-center gap-2 text-lg">
                                    <History size={20} className="text-purple-500"/> Saved Strategies
                                </h3>
                                <button onClick={() => setShowHistory(false)} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition-colors"><X size={18}/></button>
                            </div>
                            
                            {/* NEW: Search Input */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search by Client Name or Plan Title..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-black/50 border border-zinc-700 focus:border-purple-500/50 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* List with Modern Cards */}
                        <div className="overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[#0c0c0e]">
                            {savedPlans.filter(p => 
                                p.client_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                (p.plan_name && p.plan_name.toLowerCase().includes(searchQuery.toLowerCase()))
                            ).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-zinc-500 opacity-60">
                                    <FolderOpen size={48} className="mb-4 stroke-1"/>
                                    <p>No plans found matching your search.</p>
                                </div>
                            ) : (
                                savedPlans.filter(p => 
                                    p.client_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                    (p.plan_name && p.plan_name.toLowerCase().includes(searchQuery.toLowerCase()))
                                ).map(plan => (
                                    <div 
                                        key={plan.id} 
                                        onClick={() => handleLoad(plan)} 
                                        className="group relative bg-[#18181b] border border-zinc-800 hover:border-purple-500/50 hover:bg-[#1f1f22] rounded-2xl p-4 cursor-pointer transition-all duration-300 overflow-hidden"
                                    >
                                        {/* Decorative Gradient on Hover */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"/>

                                        <div className="flex justify-between items-start relative z-10">
                                            <div className="flex items-start gap-4">
                                                {/* Client Avatar (Initials) */}
                                                <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 font-black text-lg shadow-inner group-hover:text-purple-400 group-hover:border-purple-500/30 transition-colors">
                                                    {plan.client_name.charAt(0).toUpperCase()}
                                                </div>

                                                <div className="space-y-1">
                                                    <h4 className="font-bold text-zinc-100 text-lg leading-tight group-hover:text-white transition-colors">
                                                        {plan.client_name}
                                                    </h4>
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] uppercase font-bold tracking-wider">
                                                            {plan.plan_name || 'Custom Plan'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={(e) => handleDelete(plan.id, e)} 
                                                className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
                                                title="Delete Plan"
                                            >
                                                <Trash2 size={18}/>
                                            </button>
                                        </div>

                                        {/* Footer Info */}
                                        <div className="mt-4 pt-3 border-t border-zinc-800/50 flex items-center gap-6 text-xs text-zinc-500 relative z-10 font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <Smartphone size={14} className="text-zinc-600"/>
                                                <span>{plan.phone || 'No Phone'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={14} className="text-zinc-600"/>
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

            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <Calculator className="text-white" size={24} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white">Manual Nutrition</h2>
                        <p className="text-zinc-500 font-medium text-sm">Create, Save & Print Strategies</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button onClick={handleNew} className="p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl border border-zinc-700 transition-all"><FileText size={18}/></button>
                    <button onClick={fetchHistory} className="p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl border border-zinc-700 transition-all"><FolderOpen size={18}/></button>
                    <button onClick={handleSave} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2">
                        <Save size={18} /> {currentId ? 'Update' : 'Save'}
                    </button>
                    
                    {/* PDF BUTTONS */}
                    <PDFDownloadLink document={<NutritionPDF_EN plan={dummyPlanObject} clientName={calcState.manualClientName} trainerName={calcState.manualTrainerName} brandText={calcState.brandText} carbAdjustment={calcState.carbAdjustment} results={results} exchangeList={exchangeList} notes={planNotes} />} fileName={`${calcState.manualClientName}_EN.pdf`}>
                        {({ loading }) => (<button disabled={loading} className="px-4 py-3 bg-white text-black font-bold rounded-xl flex items-center gap-2">{loading ? <Loader2 size={18} className="animate-spin"/> : "EN"}</button>)}
                    </PDFDownloadLink>
                    <PDFDownloadLink document={<NutritionPDF_AR plan={dummyPlanObject} clientName={calcState.manualClientName} trainerName={calcState.manualTrainerName} brandText={calcState.brandText} carbAdjustment={calcState.carbAdjustment} results={results} exchangeList={exchangeList} notes={planNotes} />} fileName={`${calcState.manualClientName}_AR.pdf`}>
                        {({ loading }) => (<button disabled={loading} className="px-4 py-3 bg-emerald-900/50 text-emerald-400 font-bold rounded-xl border border-emerald-800 flex items-center gap-2">{loading ? <Loader2 size={18} className="animate-spin"/> : "AR"}</button>)}
                    </PDFDownloadLink>
                </div>
            </div>

            <div className="space-y-6">
                
                {/* 0. MANUAL IDENTITY & PHONE */}
                <div className="bg-[#121214] border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
                    {currentId && <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">EDITING MODE</div>}
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <ClipboardType size={18} className="text-purple-500"/> Plan Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <ModernInput label="Client Name" value={calcState.manualClientName} onChange={(v) => setCalcState({...calcState, manualClientName: v})} placeholder="e.g. John Doe"/>
                        <ModernInput label="Phone Number" value={calcState.manualPhone} onChange={(v) => setCalcState({...calcState, manualPhone: v})} placeholder="01xxxxxxxxx" suffix={<Smartphone size={14}/>}/>
                        <ModernInput label="Trainer Name" value={calcState.manualTrainerName} onChange={(v) => setCalcState({...calcState, manualTrainerName: v})} placeholder="e.g. Coach Mike"/>
                        <ModernInput label="Plan Title" value={calcState.planName} onChange={(v) => setCalcState({...calcState, planName: v})} placeholder="e.g. Cutting Phase"/>
                    </div>
                </div>

                 {/* 1. CLIENT DATA */}
                <div className="bg-[#121214] border border-zinc-800 rounded-3xl p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <User size={18} className="text-orange-500"/> Body Metrics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <ModernInput label="Gender" value={calcState.gender} onChange={(v) => setCalcState({...calcState, gender: v})} options={[{val:'male', lbl:'Male'}, {val:'female', lbl:'Female'}]} />
                        <ModernInput label="Age" value={calcState.age} onChange={(v) => setCalcState({...calcState, age: v})} type="number" min="0" />
                        <ModernInput label="Height" value={calcState.heightCm} onChange={(v) => setCalcState({...calcState, heightCm: v})} type="number" suffix="cm" min="0" />
                        <div className="col-span-1"><ModernInput label="Weight" value={calcState.weightKg} onChange={(v) => setCalcState({...calcState, weightKg: v})} type="number" suffix="kg" min="0" /></div>
                        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl flex flex-col justify-center"><label className="text-[10px] uppercase font-bold text-zinc-500 flex items-center gap-1"><Scale size={10} /> In Lbs</label><span className="text-white font-bold text-lg">{weightLbs}</span></div>
                        <ModernInput label="Activity" value={calcState.activityLevel} onChange={(v) => setCalcState({...calcState, activityLevel: v})} options={[{val:'sedentary', lbl:'Sedentary'}, {val:'light', lbl:'Light'}, {val:'moderate', lbl:'Moderate'}, {val:'active', lbl:'Active'}]} />
                    </div>
                </div>

                {/* 2. STRATEGY */}
                <div className="bg-[#121214] border border-zinc-800 rounded-3xl p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Activity size={18} className="text-emerald-500"/> Strategy</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <ModernInput label="Deficit/Surplus" value={calcState.deficitSurplus} onChange={(v) => setCalcState({...calcState, deficitSurplus: v})} type="number" suffix="kcal" />
                        <ModernInput label="Pro Ratio" value={calcState.proteinPerLb} onChange={(v) => setCalcState({...calcState, proteinPerLb: v})} type="number" suffix="g/lb" min="0" />
                        <ModernInput label="Fat Ratio" value={calcState.fatPercentage} onChange={(v) => setCalcState({...calcState, fatPercentage: v})} type="number" suffix="%" min="0" />
                        <ModernInput label="Carb Manip %" value={calcState.carbAdjustment} onChange={(v) => setCalcState({...calcState, carbAdjustment: v})} type="number" suffix="+/-" className="border-blue-500/30" />
                        <ModernInput label="Main Meals" value={calcState.mealsCount} onChange={(v) => setCalcState({...calcState, mealsCount: v})} type="number" min="1" />
                        <ModernInput label="Snacks" value={calcState.snacksCount} onChange={(v) => setCalcState({...calcState, snacksCount: v})} type="number" suffix="#" min="0" />
                    </div>
                </div>

                {/* 3. DAILY TARGET & PDF BRAND */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="text-center md:text-left min-w-[150px]">
                            <p className="text-xs font-bold text-zinc-500 uppercase">Daily Target</p>
                            <p className="text-5xl font-black text-white">{results.targetCalories} <span className="text-lg text-zinc-500 font-bold">kcal</span></p>
                        </div>
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                            <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/50"><span className="text-zinc-400 flex items-center gap-2 text-[10px] uppercase font-bold mb-1"><Zap size={12} className="text-red-500"/> Protein</span><span className="text-white font-black text-xl">{results.macros.protein.grams}g</span></div>
                            <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/50"><span className="text-zinc-400 flex items-center gap-2 text-[10px] uppercase font-bold mb-1"><Wheat size={12} className="text-blue-500"/> Carbs</span><span className="text-white font-black text-xl">{results.macros.carbs.grams}g</span></div>
                            <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/50"><span className="text-zinc-400 flex items-center gap-2 text-[10px] uppercase font-bold mb-1"><Droplets size={12} className="text-yellow-500"/> Fats</span><span className="text-white font-black text-xl">{results.macros.fats.grams}g</span></div>
                            <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/50"><span className="text-zinc-400 flex items-center gap-2 text-[10px] uppercase font-bold mb-1"><Leaf size={12} className="text-emerald-500"/> Fiber</span><span className="text-white font-black text-xl">{results.macros.fiber.grams}g</span></div>
                        </div>
                    </div>
                     <div className="bg-[#121214] border border-zinc-800 rounded-3xl p-6">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><FileText size={18} className="text-purple-500"/> PDF Brand</h3>
                        <ModernInput label="Brand / Logo Text" value={calcState.brandText} onChange={(v) => setCalcState({...calcState, brandText: v})} placeholder="e.g. IRON GYM"/>
                    </div>
                </div>

                {/* 4. ITEMS TABLE */}
                <div className="space-y-6">
                    {exchangeList && Object.entries(exchangeList).map(([groupName, data]) => (
                        <div key={groupName} className="bg-[#121214] border border-zinc-800 rounded-3xl overflow-hidden">
                            <div className={`p-4 border-b border-zinc-800 flex justify-between items-center ${data.bg}`}>
                                <h3 className={`font-black uppercase tracking-wider text-sm ${data.color}`}>{groupName}</h3>
                                <div className="flex items-center gap-2">
                                    {groupName === 'Carbohydrates' && calcState.carbAdjustment !== 0 && (<span className="text-[10px] font-bold text-white bg-blue-500 px-2 py-1 rounded-md">{calcState.carbAdjustment > 0 ? '+' : ''}{calcState.carbAdjustment}% Modified</span>)}
                                    <div className="text-xs font-bold text-white bg-black/20 px-3 py-1 rounded-lg">Target: {Math.round(data.targetCals)} kcal / meal</div>
                                </div>
                            </div>
                            <div className="p-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:gap-px bg-zinc-800/50">
                                    {data.items.length > 0 ? (data.items.map((item, idx) => (
                                        <div key={idx} className="bg-[#121214] p-4 hover:bg-zinc-900 transition-colors flex justify-between items-center">
                                            <span className="font-bold text-zinc-300">{item.name}</span>
                                            <div className="text-right"><div><span className={`font-black text-lg ${groupName === 'Carbohydrates' && calcState.carbAdjustment !== 0 ? 'text-blue-400' : 'text-white'}`}>{item.weight}</span><span className="text-zinc-500 text-xs font-bold ml-1">{item.unit}</span></div><div className="text-[10px] text-zinc-500 font-medium">~ {item.meta.cals} kcal</div></div>
                                        </div>
                                    ))) : (<div className="col-span-full p-8 text-center text-zinc-500 text-sm bg-[#121214]">No items found for this category in database.</div>)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 5. NOTES */}
                <div className="bg-[#121214] border border-zinc-800 rounded-3xl p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2"><FileText size={18} className="text-emerald-500"/> Coach Notes & Recommendations</h3>
                    <textarea value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} placeholder="Write your grocery list, supplement recommendations, or snack ideas here..." className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-zinc-300 font-medium outline-none focus:border-emerald-500/50 transition-colors resize-none text-sm leading-relaxed min-h-[150px]"></textarea>
                </div>
            </div>
        </div>
    );
};

export default ManualNutritionPlan;