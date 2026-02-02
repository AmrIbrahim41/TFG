import React, { useState, useEffect, useMemo } from 'react';
import { 
    Utensils, User, Activity, 
    FileText, Zap, Download,
    Scale, Calculator, ClipboardType, Loader2, Wheat, Droplets, Leaf
} from 'lucide-react';
import api from '../api'; 
import { PDFDownloadLink } from '@react-pdf/renderer'; 

// --- IMPORT SEPARATE PDF FILES ---
import NutritionPDF_EN from '../utils/NutritionPDF_EN'; 
import NutritionPDF_AR from '../utils/NutritionPDF_AR'; 

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
    
    // STATE: All manual inputs
    const [calcState, setCalcState] = useState({
        // Manual Identity Fields
        manualClientName: '',
        manualTrainerName: '',
        planName: 'Custom Strategy',
        
        // Calculator Fields
        gender: 'male', age: 25, heightCm: 175, weightKg: 80,
        activityLevel: 'moderate', deficitSurplus: -500,
        fatPercentage: 25, proteinPerLb: 1.0,
        mealsCount: 4, snacksCount: 0,
        carbAdjustment: 0, 
        brandText: 'TFG' 
    });

    const [results, setResults] = useState(null);
    const [planNotes, setPlanNotes] = useState('');

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
        <div className="animate-in slide-in-from-bottom-4 duration-500 pb-20 p-6 pt-20 lg:pt-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <Calculator className="text-white" size={24} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white">Quick Plan Generator</h2>
                        <p className="text-zinc-500 font-medium text-sm">Create PDF strategies without a client record</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* ENGLISH PDF BUTTON */}
                    <PDFDownloadLink
                        document={
                            <NutritionPDF_EN 
                                plan={dummyPlanObject}
                                clientName={calcState.manualClientName || "Guest Client"} 
                                trainerName={calcState.manualTrainerName || "Coach"} 
                                brandText={calcState.brandText} 
                                carbAdjustment={calcState.carbAdjustment} 
                                results={results}
                                exchangeList={exchangeList}
                                notes={planNotes}
                            />
                        }
                        fileName={`${(calcState.manualClientName || 'Plan').replace(/\s+/g, '_')}_EN.pdf`}
                    >
                        {({ blob, url, loading: pdfLoading, error }) => (
                            <button 
                                disabled={pdfLoading}
                                className="px-6 py-3 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
                            >
                                {pdfLoading ? <Loader2 size={18} className="animate-spin"/> : <Download size={18} />} 
                                EN PDF
                            </button>
                        )}
                    </PDFDownloadLink>

                    {/* ARABIC PDF BUTTON */}
                    <PDFDownloadLink
                        document={
                            <NutritionPDF_AR 
                                plan={dummyPlanObject}
                                clientName={calcState.manualClientName || "Guest Client"} 
                                trainerName={calcState.manualTrainerName || "Coach"} 
                                brandText={calcState.brandText} 
                                carbAdjustment={calcState.carbAdjustment} 
                                results={results}
                                exchangeList={exchangeList}
                                notes={planNotes}
                            />
                        }
                        fileName={`${(calcState.manualClientName || 'Plan').replace(/\s+/g, '_')}_AR.pdf`}
                    >
                        {({ blob, url, loading: pdfLoading, error }) => (
                            <button 
                                disabled={pdfLoading}
                                className="px-6 py-3 bg-emerald-900/50 hover:bg-emerald-800 text-emerald-400 font-bold rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2"
                            >
                                {pdfLoading ? <Loader2 size={18} className="animate-spin"/> : <Download size={18} />} 
                                عربي PDF
                            </button>
                        )}
                    </PDFDownloadLink>
                </div>
            </div>

            <div className="space-y-6">
                
                {/* 0. MANUAL IDENTITY */}
                <div className="bg-[#121214] border border-zinc-800 rounded-3xl p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <ClipboardType size={18} className="text-purple-500"/> Plan Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ModernInput 
                            label="Client Name" 
                            value={calcState.manualClientName} 
                            onChange={(v) => setCalcState({...calcState, manualClientName: v})} 
                            placeholder="e.g. John Doe"
                        />
                         <ModernInput 
                            label="Trainer Name" 
                            value={calcState.manualTrainerName} 
                            onChange={(v) => setCalcState({...calcState, manualTrainerName: v})} 
                            placeholder="e.g. Coach Mike"
                        />
                        <ModernInput 
                            label="Plan Title" 
                            value={calcState.planName} 
                            onChange={(v) => setCalcState({...calcState, planName: v})} 
                            placeholder="e.g. Cutting Phase"
                        />
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
                        
                        <div className="col-span-1">
                            <ModernInput label="Weight" value={calcState.weightKg} onChange={(v) => setCalcState({...calcState, weightKg: v})} type="number" suffix="kg" min="0" />
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl flex flex-col justify-center">
                            <label className="text-[10px] uppercase font-bold text-zinc-500 flex items-center gap-1"><Scale size={10} /> In Lbs</label>
                            <span className="text-white font-bold text-lg">{weightLbs}</span>
                        </div>

                        <ModernInput label="Activity" value={calcState.activityLevel} onChange={(v) => setCalcState({...calcState, activityLevel: v})} options={[
                            {val:'sedentary', lbl:'Sedentary'}, {val:'light', lbl:'Light'}, {val:'moderate', lbl:'Moderate'}, {val:'active', lbl:'Active'}
                        ]} />
                    </div>
                </div>

                {/* 2. STRATEGY */}
                <div className="bg-[#121214] border border-zinc-800 rounded-3xl p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <Activity size={18} className="text-emerald-500"/> Strategy
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <ModernInput label="Deficit/Surplus" value={calcState.deficitSurplus} onChange={(v) => setCalcState({...calcState, deficitSurplus: v})} type="number" suffix="kcal" />
                        <ModernInput label="Pro Ratio" value={calcState.proteinPerLb} onChange={(v) => setCalcState({...calcState, proteinPerLb: v})} type="number" suffix="g/lb" min="0" />
                        <ModernInput label="Fat Ratio" value={calcState.fatPercentage} onChange={(v) => setCalcState({...calcState, fatPercentage: v})} type="number" suffix="%" min="0" />
                        <ModernInput label="Carb Manip %" value={calcState.carbAdjustment} onChange={(v) => setCalcState({...calcState, carbAdjustment: v})} type="number" suffix="+/-" className="border-blue-500/30" />
                        <ModernInput label="Main Meals" value={calcState.mealsCount} onChange={(v) => setCalcState({...calcState, mealsCount: v})} type="number" min="1" />
                        <ModernInput label="Snacks" value={calcState.snacksCount} onChange={(v) => setCalcState({...calcState, snacksCount: v})} type="number" suffix="#" min="0" />
                    </div>
                </div>

                {/* PDF BRAND CUSTOMIZATION */}
                <div className="bg-[#121214] border border-zinc-800 rounded-3xl p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <FileText size={18} className="text-purple-500"/> PDF Customization
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ModernInput 
                            label="Brand / Logo Text" 
                            value={calcState.brandText} 
                            onChange={(v) => setCalcState({...calcState, brandText: v})} 
                            placeholder="e.g. IRON GYM"
                        />
                    </div>
                </div>

                {/* 3. DAILY TARGET */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-left min-w-[200px]">
                        <p className="text-xs font-bold text-zinc-500 uppercase">Daily Target</p>
                        <p className="text-5xl font-black text-white">{results.targetCalories} <span className="text-lg text-zinc-500 font-bold">kcal</span></p>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 w-full">
                        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
                            <span className="text-zinc-400 flex items-center gap-2 text-xs uppercase font-bold mb-1"><Zap size={14} className="text-red-500"/> Protein</span>
                            <span className="text-white font-black text-2xl">{results.macros.protein.grams}g</span>
                        </div>
                        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
                            <span className="text-zinc-400 flex items-center gap-2 text-xs uppercase font-bold mb-1"><Wheat size={14} className="text-blue-500"/> Carbs</span>
                            <span className="text-white font-black text-2xl">{results.macros.carbs.grams}g</span>
                        </div>
                        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
                            <span className="text-zinc-400 flex items-center gap-2 text-xs uppercase font-bold mb-1"><Droplets size={14} className="text-yellow-500"/> Fats</span>
                            <span className="text-white font-black text-2xl">{results.macros.fats.grams}g</span>
                        </div>
                            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800/50">
                            <span className="text-zinc-400 flex items-center gap-2 text-xs uppercase font-bold mb-1"><Leaf size={14} className="text-emerald-500"/> Fiber</span>
                            <span className="text-white font-black text-2xl">{results.macros.fiber.grams}g</span>
                        </div>
                    </div>
                </div>

                {/* 4. ITEMS TABLE */}
                <div className="space-y-6">
                    {exchangeList && Object.entries(exchangeList).map(([groupName, data]) => (
                        <div key={groupName} className="bg-[#121214] border border-zinc-800 rounded-3xl overflow-hidden">
                            <div className={`p-4 border-b border-zinc-800 flex justify-between items-center ${data.bg}`}>
                                <h3 className={`font-black uppercase tracking-wider text-sm ${data.color}`}>{groupName}</h3>
                                <div className="flex items-center gap-2">
                                    {groupName === 'Carbohydrates' && calcState.carbAdjustment !== 0 && (
                                        <span className="text-[10px] font-bold text-white bg-blue-500 px-2 py-1 rounded-md">
                                            {calcState.carbAdjustment > 0 ? '+' : ''}{calcState.carbAdjustment}% Modified
                                        </span>
                                    )}
                                    <div className="text-xs font-bold text-white bg-black/20 px-3 py-1 rounded-lg">
                                        Target: {Math.round(data.targetCals)} kcal / meal
                                    </div>
                                </div>
                            </div>
                            <div className="p-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:gap-px bg-zinc-800/50">
                                    {data.items.length > 0 ? (
                                        data.items.map((item, idx) => (
                                            <div key={idx} className="bg-[#121214] p-4 hover:bg-zinc-900 transition-colors flex justify-between items-center">
                                                <span className="font-bold text-zinc-300">{item.name}</span>
                                                <div className="text-right">
                                                    <div>
                                                        <span className={`font-black text-lg ${groupName === 'Carbohydrates' && calcState.carbAdjustment !== 0 ? 'text-blue-400' : 'text-white'}`}>
                                                            {item.weight}
                                                        </span>
                                                        <span className="text-zinc-500 text-xs font-bold ml-1">{item.unit}</span>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500 font-medium">~ {item.meta.cals} kcal</div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-full p-8 text-center text-zinc-500 text-sm bg-[#121214]">
                                            No items found for this category in database.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 5. NOTES */}
                <div className="bg-[#121214] border border-zinc-800 rounded-3xl p-6">
                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                        <FileText size={18} className="text-emerald-500"/> Coach Notes & Recommendations
                    </h3>
                    <textarea
                        value={planNotes}
                        onChange={(e) => setPlanNotes(e.target.value)}
                        placeholder="Write your grocery list, supplement recommendations, or snack ideas here..."
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-zinc-300 font-medium outline-none focus:border-emerald-500/50 transition-colors resize-none text-sm leading-relaxed min-h-[150px]"
                    ></textarea>
                </div>

            </div>
        </div>
    );
};

export default ManualNutritionPlan;