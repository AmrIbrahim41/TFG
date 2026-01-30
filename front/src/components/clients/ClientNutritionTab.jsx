import React, { useState, useEffect, useRef } from 'react';
import { 
    Utensils, Plus, Trash2, ArrowLeft, Search, X, Check,
    Calculator, Settings, Scale, Flame, ArrowDown, 
    Dumbbell, Coffee, Minus, ChevronRight, Calendar, User, 
    Download, Save, Loader2
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

// IMPORT THE PDF COMPONENT
import { NutritionPDFTemplate, downloadNutritionPDF } from '../../utils/NutritionPDF';

// === MAIN COMPONENT ===
const ClientNutritionTab = ({ subscriptions }) => {
    const activeSub = subscriptions?.find(s => s.is_active) || subscriptions?.[0];
    const [viewMode, setViewMode] = useState('list');
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        if (activeSub) fetchPlans();
    }, [activeSub]);

    const fetchPlans = async () => {
        try {
            const res = await api.get(`/nutrition-plans/?subscription_id=${activeSub.id}`);
            setPlans(res.data);
        } catch (error) { console.error("Error fetching plans", error); }
    };

    const handleCreatePlan = async (name, weeks) => {
        try {
            await api.post('/nutrition-plans/', {
                subscription: activeSub.id,
                name: name,
                duration_weeks: weeks,
                calc_weight: 80, calc_tdee: 2500, calc_meals: 4
            });
            toast.success("Plan Created");
            setShowCreateModal(false);
            fetchPlans();
        } catch (error) { toast.error("Failed to create plan"); }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if(!confirm("Delete this plan permanently?")) return;
        try {
            await api.delete(`/nutrition-plans/${id}/`);
            setPlans(plans.filter(p => p.id !== id));
            toast.success("Deleted");
        } catch (err) { toast.error("Error"); }
    };

    if (viewMode === 'list') {
        return (
            <div className="space-y-8 animate-in fade-in duration-500 w-full max-w-[1800px] mx-auto p-4 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-500 border border-orange-500/20">
                            <Utensils size={32}/>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white">Nutrition Dashboard</h2>
                            <p className="text-zinc-500 text-lg">Manage diet cycles for {activeSub?.client_name || 'Client'}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="bg-white text-black hover:bg-orange-500 hover:text-white px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wide transition-all shadow-lg flex items-center gap-2"
                    >
                        <Plus size={20} /> New Cycle
                    </button>
                </div>

                {/* --- SINGLE COLUMN GRID FOR FULL WIDTH CARDS --- */}
                <div className="grid grid-cols-1 gap-6">
                    {plans.map(plan => (
                        <div key={plan.id} onClick={() => { setSelectedPlan(plan); setViewMode('detail'); }}>
                            <HorizontalPlanCard plan={plan} onDelete={(e) => handleDelete(e, plan.id)} />
                        </div>
                    ))}
                    {plans.length === 0 && (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-3xl text-zinc-600">
                            <Utensils className="mx-auto mb-4 opacity-20" size={64}/>
                            <div className="font-bold text-xl">No active nutrition plans</div>
                        </div>
                    )}
                </div>

                {showCreateModal && <CreatePlanModal onClose={() => setShowCreateModal(false)} onSubmit={handleCreatePlan} />}
            </div>
        );
    }

    return (
        <PlanDetailView 
            plan={selectedPlan} 
            clientName={activeSub?.client_name}
            onBack={() => { setViewMode('list'); fetchPlans(); }} 
        />
    );
};

// === UPDATED HORIZONTAL CARD ===
const HorizontalPlanCard = ({ plan, onDelete }) => {
    return (
        <div className="group relative bg-[#121214] rounded-[2rem] border border-zinc-800/60 hover:border-orange-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-900/20 cursor-pointer overflow-hidden flex flex-col md:flex-row">
            
            {/* LEFT SIDE: Info */}
            <div className="p-8 flex flex-col justify-between flex-1 relative z-10 border-b md:border-b-0 md:border-r border-zinc-800/50">
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-green-500/20">Active</span>
                        <span className="text-zinc-500 text-xs font-bold flex items-center gap-2 px-2 border-l border-zinc-800">
                             <Calendar size={14}/> {new Date(plan.created_at).toLocaleDateString()}
                        </span>
                    </div>
                    <h3 className="text-4xl font-black text-white leading-tight group-hover:text-orange-500 transition-colors mb-3">{plan.name}</h3>
                    <div className="flex items-center gap-3 text-zinc-400 text-sm font-bold bg-zinc-900/50 w-fit px-4 py-2 rounded-xl border border-zinc-800/50">
                        <User size={16}/> <span>Created by: <span className="text-white">{plan.created_by_name || 'Coach'}</span></span>
                    </div>
                </div>
                <div className="mt-8 flex items-center gap-4">
                     <div className="bg-zinc-900/80 px-6 py-4 rounded-2xl border border-zinc-800 flex items-center gap-4">
                        <div className="text-right">
                             <div className="text-[10px] uppercase text-zinc-500 font-bold">Duration</div>
                             <div className="text-2xl font-black text-white leading-none">{plan.duration_weeks}<span className="text-sm ml-1 text-zinc-600">wks</span></div>
                        </div>
                        <div className="h-8 w-[1px] bg-zinc-800"></div>
                        <div>
                             <div className="text-[10px] uppercase text-zinc-500 font-bold">Type</div>
                             <div className="text-sm font-bold text-white leading-none mt-1">Standard</div>
                        </div>
                     </div>
                     <button onClick={onDelete} className="w-14 h-[4.5rem] flex items-center justify-center rounded-2xl bg-zinc-900 text-zinc-600 hover:bg-red-500 hover:text-white transition-all border border-zinc-800 group/del">
                        <Trash2 size={24} className="group-hover/del:scale-110 transition-transform" />
                    </button>
                </div>
            </div>

            {/* RIGHT SIDE: Stats */}
            <div className="p-8 w-full md:w-[450px] md:min-w-[400px] bg-[#0c0c0e] flex flex-col justify-center border-l border-zinc-800/50">
                <div className="flex justify-between items-center mb-8">
                    <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">Daily Target</span>
                    <span className="text-3xl font-black text-white">{plan.target_calories} <span className="text-orange-500 text-base">kcal</span></span>
                </div>
                <div className="space-y-6">
                    <MacroRow label="Protein" val={plan.target_protein} color="bg-red-500" />
                    <MacroRow label="Carbs" val={plan.target_carbs} color="bg-blue-500" />
                    <MacroRow label="Fats" val={plan.target_fats} color="bg-yellow-500" />
                </div>
                <div className="mt-8 pt-6 border-t border-zinc-800/50 flex justify-end">
                    <span className="text-sm font-bold text-zinc-500 group-hover:text-white flex items-center gap-2 transition-colors">
                        Open Planner <div className="bg-zinc-800 rounded-full p-1"><ChevronRight size={14} /></div>
                    </span>
                </div>
            </div>
        </div>
    );
};

const MacroRow = ({ label, val, color }) => (
    <div>
        <div className="flex justify-between text-[11px] font-bold text-zinc-500 uppercase mb-2"><span>{label}</span><span className="text-white">{val}g</span></div>
        <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800"><div className={`h-full ${color}`} style={{ width: '60%' }}></div></div>
    </div>
);


// === PLAN DETAIL VIEW (With Save Fix) ===
const PlanDetailView = ({ plan, clientName, onBack }) => {
    // --- STATE ---
    const [calcParams, setCalcParams] = useState({
        weight: plan.calc_weight || 80,             
        fatPercent: plan.calc_fat_percent || 25,         
        proteinMultiplier: plan.calc_protein_multiplier || 2.2, 
        proteinAdvance: plan.calc_protein_advance || 0.8,    
        tdee: plan.calc_tdee || 2500,             
        deferCal: plan.calc_defer_cal || 500,          
        meals: plan.calc_meals || 4,               
        snacks: plan.calc_snacks || 2
    });

    const [showCalculator, setShowCalculator] = useState(true); 
    const [foodDB, setFoodDB] = useState([]);
    
    // --- LOAD SAVED MEALS INTO STATE ---
    // This function runs once on mount to populate the dashboard from the database
    const [dailyLog, setDailyLog] = useState(() => {
        if (!plan.meal_plans || plan.meal_plans.length === 0) return [];
        
        const loadedLog = [];
        // Map backend meal_type (breakfast, lunch...) to UI slots (Meal 1, Meal 2...)
        const typeToSlot = {
            'breakfast': { type: 'meal', index: 1 },
            'lunch': { type: 'meal', index: 2 },
            'dinner': { type: 'meal', index: 3 },
            'snack1': { type: 'snack', index: 1 },
            'snack2': { type: 'snack', index: 2 },
            'snack3': { type: 'snack', index: 3 }
        };

        plan.meal_plans.forEach(mp => {
            let slotInfo = typeToSlot[mp.meal_type];
            // Fallback for Meal 4, 5 etc if strictly named 'meal4' in backend or similar
            if (!slotInfo) {
                 // Simple heuristic: if we have more than 3 meals, map them sequentially if possible
                 // For now, we assume standard 3 meals + snacks structure or custom logic
                 // If you saved them as 'meal_4', you might need to adjust the backend enum or mapping here
                 // Defaulting to "Meal 4" logic if undefined but exists
                 if(mp.meal_name && mp.meal_name.startsWith("Meal")) {
                     const num = parseInt(mp.meal_name.split(' ')[1]) || 4;
                     slotInfo = { type: 'meal', index: num };
                 } else if (mp.meal_name && mp.meal_name.startsWith("Snack")) {
                     const num = parseInt(mp.meal_name.split(' ')[1]) || 1;
                     slotInfo = { type: 'snack', index: num };
                 }
            }

            if (slotInfo && mp.foods) {
                mp.foods.forEach(food => {
                    loadedLog.push({
                        id: Date.now() + Math.random(),
                        slotType: slotInfo.type,
                        slotIndex: slotInfo.index,
                        name: food.name,
                        amount: food.quantity,
                        calories: food.calories,
                        protein: food.protein,
                        carbs: food.carbs,
                        fat: food.fats
                    });
                });
            }
        });
        return loadedLog;
    });

    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [currentSlot, setCurrentSlot] = useState(null); 

    const pdfRef = useRef();

    useEffect(() => {
        api.get('/food-database/').then(res => setFoodDB(res.data));
    }, []);

    // --- CALCULATIONS ---
    const targetCalories = Math.max(0, calcParams.tdee - calcParams.deferCal);
    const targetProteinG = Math.round(calcParams.weight * calcParams.proteinMultiplier * calcParams.proteinAdvance);
    const targetFatCal = Math.round(targetCalories * (calcParams.fatPercent / 100));
    const targetFatG = Math.round(targetFatCal / 9);
    const targetCarbsCal = Math.max(0, targetCalories - (targetProteinG * 4) - targetFatCal);
    const targetCarbsG = Math.round(targetCarbsCal / 4);

    const perMeal = {
        protein: (targetProteinG / (calcParams.meals || 1)).toFixed(0),
        fat: (targetFatG / (calcParams.meals || 1)).toFixed(0),
        carbs: (targetCarbsG / (calcParams.meals || 1)).toFixed(0),
        cals: Math.round(targetCalories / (calcParams.meals || 1))
    };

    const totals = dailyLog.reduce((acc, item) => ({
        cals: acc.cals + item.calories,
        protein: acc.protein + item.protein,
        carbs: acc.carbs + item.carbs,
        fat: acc.fat + item.fat
    }), { cals: 0, protein: 0, carbs: 0, fat: 0 });

    const balance = targetCalories - totals.cals;

    // --- SAVE HANDLER (CORRECTED) ---
    const handleSaveCalculator = async () => {
        setIsSaving(true);
        setSaveSuccess(false);

        // 1. Prepare Meal Plans Payload
        const mealPlansPayload = [];
        
        const getSlotItems = (type, idx) => dailyLog.filter(i => i.slotType === type && i.slotIndex === idx);

        // Map Meal 1-3 to types, others fallback
        const mealTypeMap = { 1: 'breakfast', 2: 'lunch', 3: 'dinner' }; 
        
        for (let i = 1; i <= calcParams.meals; i++) {
            const items = getSlotItems('meal', i);
            if (items.length > 0) {
                mealPlansPayload.push({
                    day: 'Monday',
                    meal_type: mealTypeMap[i] || 'dinner', // Fallback
                    meal_name: `Meal ${i}`,
                    foods: items.map(item => ({
                        name: item.name,
                        quantity: item.amount,
                        unit: 'g',
                        calories: item.calories,
                        protein: item.protein,
                        carbs: item.carbs,
                        fats: item.fat,
                        category: 'Protein'
                    }))
                });
            }
        }

        const snackTypeMap = { 1: 'snack1', 2: 'snack2', 3: 'snack3' };
        for (let i = 1; i <= calcParams.snacks; i++) {
            const items = getSlotItems('snack', i);
            if (items.length > 0) {
                mealPlansPayload.push({
                    day: 'Monday',
                    meal_type: snackTypeMap[i] || 'snack1',
                    meal_name: `Snack ${i}`,
                    foods: items.map(item => ({
                        name: item.name,
                        quantity: item.amount,
                        unit: 'g',
                        calories: item.calories,
                        protein: item.protein,
                        carbs: item.carbs,
                        fats: item.fat,
                        category: 'Snacks'
                    }))
                });
            }
        }

        const payload = {
            target_calories: targetCalories,
            target_protein: targetProteinG,
            target_carbs: targetCarbsG,
            target_fats: targetFatG,
            calc_weight: calcParams.weight,
            calc_tdee: calcParams.tdee,
            calc_defer_cal: calcParams.deferCal,
            calc_fat_percent: calcParams.fatPercent,
            calc_protein_multiplier: calcParams.proteinMultiplier,
            calc_protein_advance: calcParams.proteinAdvance,
            calc_meals: calcParams.meals,
            calc_snacks: calcParams.snacks,
            meal_plans: mealPlansPayload // Send the meals!
        };

        try {
            await api.patch(`/nutrition-plans/${plan.id}/`, payload);
            setTimeout(() => {
                setIsSaving(false);
                setSaveSuccess(true);
                toast.success("Plan Saved Successfully!");
                setTimeout(() => setSaveSuccess(false), 3000);
            }, 800);
        } catch (e) {
            console.error(e);
            setIsSaving(false);
            toast.error("Failed to save settings");
        }
    };

    const handleAddFoodFromModal = (foodItem) => {
        setDailyLog([...dailyLog, foodItem]);
        setShowModal(false);
        toast.success("Food Added");
    };

    const renderMealCard = (type, index, title, icon) => {
        const items = dailyLog.filter(x => x.slotType === type && x.slotIndex === index);
        return (
            <MealCard 
                key={`${type}-${index}`} type={type} index={index} title={title} 
                items={items} icon={icon}
                onAdd={() => { setCurrentSlot({type, index}); setShowModal(true); }}
                onRemove={(id) => setDailyLog(dailyLog.filter(i => i.id !== id))}
            />
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in pb-32 w-full max-w-[1800px] mx-auto p-4 md:p-8">
            
            {/* Top Navigation */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:bg-white hover:text-black transition-all"><ArrowLeft size={20} /></button>
                    <div>
                        <h2 className="text-2xl font-black text-white">{plan.name}</h2>
                        <div className="flex gap-2 mt-1"><span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-xs font-bold border border-zinc-700">{plan.duration_weeks} Weeks</span></div>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => downloadNutritionPDF(pdfRef.current, `${plan.name}_${plan.client_name || clientName}.pdf`)}
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-3 rounded-xl font-bold transition-all text-xs uppercase tracking-wide border border-zinc-700"
                    >
                        <Download size={16} /> PDF
                    </button>
                    
                    <button onClick={handleSaveCalculator} disabled={isSaving} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all text-xs uppercase tracking-wide shadow-lg ${saveSuccess ? 'bg-green-500 text-black scale-105' : 'bg-orange-600 hover:bg-orange-500 text-white'}`}>
                        {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16} />} {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Plan'}
                    </button>

                    <button onClick={() => setShowCalculator(!showCalculator)} className="flex items-center gap-2 bg-zinc-900 hover:text-orange-500 text-zinc-500 px-5 py-3 rounded-xl font-bold transition-all text-xs uppercase tracking-wide border border-zinc-800">
                        <Settings size={16} /> {showCalculator ? 'Hide' : 'Machine'}
                    </button>
                </div>
            </div>

            {/* === THE CALCULATOR === */}
            {showCalculator && (
                <div className="bg-[#09090b] border border-zinc-800 rounded-[2.5rem] p-6 md:p-10 shadow-2xl animate-in slide-in-from-top-4">
                     <div className="flex items-center gap-4 mb-8">
                        <div className="bg-gradient-to-br from-orange-500 to-red-500 p-3 rounded-2xl text-white shadow-lg shadow-orange-500/20"><Calculator size={24}/></div>
                        <div><h3 className="text-xl font-black text-white uppercase tracking-wider leading-none">The Machine</h3></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800 flex flex-col gap-5">
                            <div className="flex items-center gap-2 text-zinc-500 mb-2"><Scale size={16} className="text-zinc-400" /> <span className="text-xs font-black uppercase tracking-widest">Bio-Data</span></div>
                            <div className="space-y-6">
                                <StepperControl label="Weight" sub="kg" value={calcParams.weight} onChange={(v) => setCalcParams({...calcParams, weight: v})} step={1} />
                                <StepperControl label="TDEE" sub="kcal" value={calcParams.tdee} onChange={(v) => setCalcParams({...calcParams, tdee: v})} step={50} />
                            </div>
                        </div>
                        <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800 flex flex-col gap-5">
                            <div className="flex items-center gap-2 text-zinc-500 mb-2"><ArrowDown size={16} className="text-red-400" /> <span className="text-xs font-black uppercase tracking-widest">Strategy</span></div>
                            <div className="space-y-6">
                                <StepperControl label="Deficit" sub="kcal" color="text-red-400" value={calcParams.deferCal} onChange={(v) => setCalcParams({...calcParams, deferCal: v})} step={50} />
                                <StepperControl label="Fat Split" sub="%" color="text-yellow-400" value={calcParams.fatPercent} onChange={(v) => setCalcParams({...calcParams, fatPercent: v})} step={1} />
                            </div>
                        </div>
                        <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800 flex flex-col gap-5">
                            <div className="flex items-center gap-2 text-zinc-500 mb-2"><Dumbbell size={16} className="text-blue-400" /> <span className="text-xs font-black uppercase tracking-widest">Protein</span></div>
                            <div className="space-y-6">
                                <StepperControl label="Multiplier" sub="x" color="text-blue-400" value={calcParams.proteinMultiplier} onChange={(v) => setCalcParams({...calcParams, proteinMultiplier: parseFloat(v.toFixed(1))})} step={0.1}/>
                                <StepperControl label="Lean Factor" sub="x" color="text-blue-400" value={calcParams.proteinAdvance} onChange={(v) => setCalcParams({...calcParams, proteinAdvance: parseFloat(v.toFixed(1))})} step={0.1}/>
                            </div>
                        </div>
                        <div className="bg-zinc-900/40 p-6 rounded-3xl border border-zinc-800 flex flex-col gap-5">
                            <div className="flex items-center gap-2 text-zinc-500 mb-2"><Utensils size={16} className="text-emerald-400" /> <span className="text-xs font-black uppercase tracking-widest">Schedule</span></div>
                            <div className="space-y-6">
                                <StepperControl label="Meals" sub="daily" value={calcParams.meals} onChange={(v) => setCalcParams({...calcParams, meals: v})} step={1} />
                                <StepperControl label="Snacks" sub="daily" value={calcParams.snacks} onChange={(v) => setCalcParams({...calcParams, snacks: v})} step={1} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* === DASHBOARD === */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-[2rem] p-8 flex flex-col justify-center relative overflow-hidden">
                    <div className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">Total Budget</div>
                    <div className="text-6xl lg:text-7xl font-black text-white tracking-tighter leading-none">{targetCalories}</div>
                    <div className={`text-sm font-mono font-bold mt-4 flex items-center gap-2 ${balance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                         {balance > 0 ? '+' : ''}{balance} <span className="opacity-60 text-xs text-zinc-500 uppercase">Remaining</span>
                    </div>
                </div>
                <BigMacroBar label="Protein" current={totals.protein} target={targetProteinG} color="bg-red-500" textColor="text-red-400" />
                <BigMacroBar label="Carbs" current={totals.carbs} target={targetCarbsG} color="bg-blue-500" textColor="text-blue-400" />
                <BigMacroBar label="Fats" current={totals.fat} target={targetFatG} color="bg-yellow-500" textColor="text-yellow-400" />
            </div>

            {/* === MEALS GRID === */}
            <div className="space-y-6 pt-4">
                <h3 className="text-2xl font-black text-white border-b border-zinc-800 pb-4">Daily Meals</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Array.from({ length: calcParams.meals }).map((_, i) => renderMealCard('meal', i + 1, `Meal ${i + 1}`, Utensils))}
                    {Array.from({ length: calcParams.snacks }).map((_, i) => renderMealCard('snack', i + 1, `Snack ${i + 1}`, Coffee))}
                </div>
            </div>

            {/* === HIDDEN PDF TEMPLATE (IMPORTED) === */}
            <NutritionPDFTemplate 
                ref={pdfRef}
                plan={{ ...plan, items: dailyLog }} // PASSING ITEMS TO PDF
                clientName={plan.client_name || clientName} 
                calcParams={calcParams}
            />

            {showModal && (
                <FoodSearchModal 
                    onClose={() => setShowModal(false)} 
                    foodDB={foodDB} 
                    currentSlot={currentSlot}
                    onAdd={handleAddFoodFromModal}
                />
            )}
        </div>
    );
};

// === HELPER COMPONENTS ===
const FoodSearchModal = ({ onClose, foodDB, currentSlot, onAdd }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFood, setSelectedFood] = useState(null);
    const [gramAmount, setGramAmount] = useState(100);

    const filteredFoods = foodDB.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleConfirm = () => {
        if (!selectedFood) return;
        const ratio = gramAmount / 100;
        const newItem = {
            id: Date.now(),
            slotType: currentSlot.type,
            slotIndex: currentSlot.index,
            name: selectedFood.name,
            amount: gramAmount,
            calories: Math.round(selectedFood.calories_per_100g * ratio),
            protein: Math.round(selectedFood.protein_per_100g * ratio),
            carbs: Math.round(selectedFood.carbs_per_100g * ratio),
            fat: Math.round(selectedFood.fats_per_100g * ratio),
        };
        onAdd(newItem);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in">
            <div className="bg-[#18181b] w-full max-w-5xl rounded-[2.5rem] border border-zinc-800 shadow-2xl overflow-hidden flex flex-col md:flex-row h-[700px]">
                <div className="w-full md:w-6/12 border-r border-zinc-800 flex flex-col bg-[#0c0c0e]">
                    <div className="p-6 border-b border-zinc-800">
                        <h3 className="text-xl font-black text-white mb-4">Select Food</h3>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
                            <input autoFocus placeholder="Search database..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-4 py-4 text-white font-bold outline-none focus:border-orange-500 transition-all"/>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                        {filteredFoods.map(food => (
                            <div key={food.id} onClick={() => setSelectedFood(food)}
                                className={`p-4 rounded-2xl cursor-pointer transition-all border group relative overflow-hidden ${selectedFood?.id === food.id ? 'bg-zinc-800 border-orange-500' : 'bg-[#121214] border-transparent hover:bg-zinc-800'}`}>
                                <div className="flex justify-between items-start relative z-10">
                                    <div>
                                        <div className={`font-bold text-lg ${selectedFood?.id === food.id ? 'text-white' : 'text-zinc-300'}`}>{food.name}</div>
                                        <div className="text-xs font-mono text-zinc-500 mt-1">{food.calories_per_100g} kcal / 100g</div>
                                    </div>
                                    {selectedFood?.id === food.id && <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-black"><Check size={14} strokeWidth={3}/></div>}
                                </div>
                                <div className="flex gap-2 mt-3 relative z-10">
                                    <div className="flex-1 bg-black/40 rounded-lg p-1.5 text-center border border-zinc-800">
                                        <div className="text-[9px] text-red-400 font-bold uppercase">Pro</div>
                                        <div className="text-xs font-mono font-bold text-zinc-300">{food.protein_per_100g}</div>
                                    </div>
                                    <div className="flex-1 bg-black/40 rounded-lg p-1.5 text-center border border-zinc-800">
                                        <div className="text-[9px] text-blue-400 font-bold uppercase">Carb</div>
                                        <div className="text-xs font-mono font-bold text-zinc-300">{food.carbs_per_100g}</div>
                                    </div>
                                    <div className="flex-1 bg-black/40 rounded-lg p-1.5 text-center border border-zinc-800">
                                        <div className="text-[9px] text-yellow-400 font-bold uppercase">Fat</div>
                                        <div className="text-xs font-mono font-bold text-zinc-300">{food.fats_per_100g}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="w-full md:w-6/12 bg-[#121214] p-8 flex flex-col relative">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-white"><X size={24}/></button>
                    {!selectedFood ? (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-700 gap-4">
                            <Utensils size={64} className="opacity-10"/>
                            <p className="text-lg font-bold opacity-50">Select an item to calculate</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full justify-center animate-in slide-in-from-right-4 duration-300">
                            <h3 className="text-4xl font-black text-white mb-2">{selectedFood.name}</h3>
                            <div className="text-zinc-500 mb-10 font-bold">Base: {selectedFood.calories_per_100g} kcal / 100g</div>
                            <label className="text-xs font-black text-zinc-500 uppercase mb-3 ml-2">Amount (grams)</label>
                            <input type="number" value={gramAmount} onChange={e => setGramAmount(parseInt(e.target.value) || 0)}
                                className="w-full bg-black border-2 border-zinc-800 rounded-3xl p-6 text-6xl font-black text-white text-center outline-none focus:border-orange-500 font-mono mb-10 shadow-inner"/>
                            <div className="grid grid-cols-4 gap-3 mb-8">
                                <StatBox label="Cal" val={Math.round(selectedFood.calories_per_100g * (gramAmount/100))} />
                                <StatBox label="Pro" val={Math.round(selectedFood.protein_per_100g * (gramAmount/100))} col="text-red-400"/>
                                <StatBox label="Carb" val={Math.round(selectedFood.carbs_per_100g * (gramAmount/100))} col="text-blue-400"/>
                                <StatBox label="Fat" val={Math.round(selectedFood.fats_per_100g * (gramAmount/100))} col="text-yellow-400"/>
                            </div>
                            <button onClick={handleConfirm} className="w-full bg-orange-600 hover:bg-orange-500 text-white py-5 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-orange-900/20">
                                <Check size={24} strokeWidth={3} /> ADD TO MEAL
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StatBox = ({ label, val, col = "text-white" }) => (
    <div className="bg-zinc-900 rounded-2xl p-4 text-center border border-zinc-800">
        <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1">{label}</div>
        <div className={`text-xl font-black ${col}`}>{val}</div>
    </div>
);

const StepperControl = ({ label, sub, value, onChange, color = "text-white", step = 1 }) => (
    <div className="flex items-center justify-between group">
        <label className="text-sm font-bold text-zinc-400">{label}</label>
        <div className="flex items-center gap-3 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800 group-hover:border-zinc-700 transition-colors">
            <button onClick={() => onChange(Math.max(0, parseFloat((value - step).toFixed(1))))} className="w-8 h-8 rounded-lg bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-white flex items-center justify-center"><Minus size={14} /></button>
            <div className="flex items-baseline justify-center min-w-[70px] gap-1"><span className={`text-xl font-mono font-black ${color}`}>{value}</span><span className="text-[10px] text-zinc-600 font-bold uppercase">{sub}</span></div>
            <button onClick={() => onChange(parseFloat((value + step).toFixed(1)))} className="w-8 h-8 rounded-lg bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-white flex items-center justify-center"><Plus size={14} /></button>
        </div>
    </div>
);

const BigMacroBar = ({ label, current, target, color, textColor }) => (
    <div className="bg-zinc-900/30 rounded-[2rem] p-8 border border-zinc-800 flex flex-col justify-center h-full relative overflow-hidden">
        <div className="flex justify-between items-end mb-6 relative z-10">
            <span className="text-xs font-black text-zinc-500 uppercase tracking-wider">{label}</span>
            <span className={`text-4xl font-mono font-black ${textColor}`}>{current}<span className="text-zinc-600 text-sm ml-1">/{target}g</span></span>
        </div>
        <div className="h-4 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 relative z-10">
            <div className={`h-full ${color}`} style={{ width: `${Math.min((current / target) * 100, 100)}%` }}></div>
        </div>
    </div>
);

const MealCard = ({ type, index, title, items, onAdd, onRemove, icon: Icon }) => {
    const totalCals = items.reduce((sum, i) => sum + i.calories, 0);
    return (
        <div className="flex flex-col h-full bg-[#121214] border border-zinc-800 rounded-[1.5rem] hover:bg-zinc-900/80 transition-all group overflow-hidden shadow-lg hover:shadow-2xl">
            <div className="p-6 flex justify-between items-start border-b border-zinc-800/50 bg-black/20">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-zinc-400 shadow-inner"><Icon size={24} /></div>
                    <div><h4 className="text-xl font-bold text-white">{title}</h4><div className="flex items-center gap-2 mt-1">{totalCals > 0 ? <span className="text-xs font-mono font-bold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{totalCals} cal</span> : <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Empty</span>}</div></div>
                </div>
                <button onClick={onAdd} className="bg-zinc-800 text-zinc-400 hover:bg-white hover:text-black p-3 rounded-xl transition-all opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 shadow-lg"><Plus size={20} /></button>
            </div>
            <div className="flex-1 p-4 space-y-3 min-h-[160px] bg-zinc-900/20">
                {items.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-zinc-700 border-2 border-dashed border-zinc-800/50 rounded-2xl gap-2 hover:border-zinc-700 cursor-pointer" onClick={onAdd}><Plus size={24} className="opacity-20"/><span className="text-xs font-bold uppercase tracking-widest opacity-40">Add Food</span></div> : items.map(item => (
                    <div key={item.id} className="bg-black/40 rounded-xl p-3 border border-zinc-800/50 flex justify-between items-center group/item hover:border-zinc-600 transition-all">
                        <div><div className="font-bold text-zinc-200 text-base">{item.name}</div><div className="text-xs font-mono text-zinc-500 mt-1 flex gap-3"><span>{item.amount}g</span><span className="text-zinc-700">|</span><span className="text-red-400">{item.protein}P</span><span className="text-blue-400">{item.carbs}C</span><span className="text-yellow-400">{item.fat}F</span></div></div>
                        <button onClick={() => onRemove(item.id)} className="text-zinc-600 hover:text-red-500 px-2 transition-colors"><Trash2 size={18}/></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CreatePlanModal = ({ onClose, onSubmit }) => {
    const [name, setName] = useState('');
    const [weeks, setWeeks] = useState(4);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#18181b] border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-white">New Nutrition Cycle</h3><button onClick={onClose}><X className="text-zinc-500 hover:text-white"/></button></div>
                <div className="space-y-4">
                    <div><label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Phase Name</label><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Winter Bulk" className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white font-bold outline-none focus:border-orange-500"/></div>
                    <div><label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Duration (Weeks)</label><input type="number" value={weeks} onChange={e => setWeeks(e.target.value)} className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white font-bold outline-none focus:border-orange-500"/></div>
                    <button onClick={() => { if(name) onSubmit(name, weeks); }} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-xl mt-4">CREATE PLAN</button>
                </div>
            </div>
        </div>
    );
};

export default ClientNutritionTab;