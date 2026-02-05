import React, { useState, useRef } from 'react';
import { 
    Dumbbell, ChevronRight, ChevronLeft, CheckCircle, RefreshCw, 
    Save, ArrowLeft, Trash2, LayoutGrid, Calendar, 
    Minus, Plus, Trophy, User, CircleDashed 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

// --- PAGINATION COMPONENT (Local) ---
const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-2 mt-6">
            <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-all"
            >
                <ChevronLeft size={16} />
            </button>
            
            <div className="flex gap-1">
                {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => onPageChange(idx + 1)}
                        className={`
                            w-8 h-8 rounded-lg font-bold text-xs transition-all border
                            ${currentPage === idx + 1 
                                ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-900/20' 
                                : 'bg-zinc-200 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-700'}
                        `}
                    >
                        {idx + 1}
                    </button>
                ))}
            </div>

            <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:hover:text-zinc-500 transition-all"
            >
                <ChevronRight size={16} />
            </button>
        </div>
    );
};

const ClientTrainingTab = ({ subscriptions }) => {
    const navigate = useNavigate();
    
    // Pagination State for Subscriptions
    const [page, setPage] = useState(1);
    const itemsPerPage = 4;

    // Data States
    const [selectedSub, setSelectedSub] = useState(null);
    const [trainingPlan, setTrainingPlan] = useState(null);
    const [logs, setLogs] = useState([]); 
    const [loadingPlan, setLoadingPlan] = useState(false);

    // Setup Form States
    const [setupStep, setSetupStep] = useState(0);
    const [cycleLength, setCycleLength] = useState(3);
    const [dayNames, setDayNames] = useState({});

    // --- 1. FETCH LOGIC ---
    const fetchPlan = async (subId) => {
        setLoadingPlan(true);
        setTrainingPlan(null);
        setLogs([]);
        setSetupStep(0);
        try {
            // Get Plan
            const res = await api.get(`/training-plans/?subscription_id=${subId}`);
            if (res.data.length > 0) {
                setTrainingPlan(res.data[0]);
            } else {
                setSetupStep(1); // Go to Wizard
                setCycleLength(3);
                setDayNames({});
            }

            // Get Completed Logs
            const logRes = await api.get(`/training-sessions/?subscription=${subId}&is_completed=true`);
            setLogs(logRes.data);

        } catch (error) {
            console.error(error);
        } finally {
            setLoadingPlan(false);
        }
    };

    const handleSelectSub = (sub) => {
        if (!sub.plan_total_sessions || sub.plan_total_sessions === 0) {
            sub.plan_total_sessions = 30;
        }
        setSelectedSub(sub);
        fetchPlan(sub.id);
    };

    // --- 2. PLAN WIZARD LOGIC ---
    const handleIncrement = () => { if (cycleLength < 14) setCycleLength(prev => prev + 1); };
    const handleDecrement = () => { if (cycleLength > 1) setCycleLength(prev => prev - 1); };

    const handleNextStep = () => {
        const newNames = { ...dayNames };
        for (let i = 1; i <= cycleLength; i++) {
            if (!newNames[i]) newNames[i] = `Day ${i}`;
        }
        setDayNames(newNames);
        setSetupStep(2);
    };

    const handleSavePlan = async () => {
        const namesArray = [];
        for (let i = 1; i <= cycleLength; i++) {
            namesArray.push(dayNames[i]);
        }
        try {
            await api.post('/training-plans/', {
                subscription: selectedSub.id,
                cycle_length: cycleLength,
                day_names: namesArray
            });
            fetchPlan(selectedSub.id);
        } catch (error) {
            alert("Error creating plan");
        }
    };

    const handleDeletePlan = async () => {
        if (!confirm("⚠️ Resetting the plan will hide the schedule. History is preserved, but the grid will be rebuilt. Continue?")) return;
        try {
            await api.delete(`/training-plans/${trainingPlan.id}/`);
            setTrainingPlan(null);
            setSetupStep(1);
            setDayNames({});
            setCycleLength(3);
        } catch (error) {
            alert("Error deleting plan");
        }
    };

    // --- 3. HELPER: PROGRESS BAR ---
    const renderProgressBar = () => {
        if (!selectedSub) return null;
        const total = selectedSub.plan_total_sessions;
        const completed = logs.length;
        const percentage = Math.min((completed / total) * 100, 100);

        return (
            <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-2xl p-4 md:p-6 mb-6 relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-end mb-3">
                    <div>
                        <h4 className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Progress</h4>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-zinc-900 dark:text-white">{completed}</span>
                            <span className="text-zinc-500 font-medium">/ {total} Sessions</span>
                        </div>
                    </div>
                    <Trophy size={24} className={percentage === 100 ? "text-yellow-500" : "text-zinc-400 dark:text-zinc-700"} />
                </div>
                
                <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-1000 ease-out rounded-full"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>
        );
    };

    // --- 4. RENDER GRID (UPDATED DESIGN) ---
    const renderSessionGrid = () => {
        if (!selectedSub || !trainingPlan) return null;

        const totalSessions = selectedSub.plan_total_sessions;
        const splits = trainingPlan.splits.sort((a, b) => a.order - b.order);
        const cycleLen = trainingPlan.cycle_length;

        const cycles = [];
        let currentSession = 1;

        while (currentSession <= totalSessions) {
            const cycleSessions = [];
            for (let i = 0; i < cycleLen; i++) {
                if (currentSession > totalSessions) break;
                const template = splits[i];
                cycleSessions.push({
                    number: currentSession,
                    name: template.name,
                    templateId: template.id
                });
                currentSession++;
            }
            cycles.push(cycleSessions);
        }

        return (
            <div className="space-y-8 pb-20 animate-in slide-in-from-bottom-4 duration-500">
                {cycles.map((cycle, cIndex) => (
                    <div key={cIndex} className="space-y-4">
                        {/* Cycle Header */}
                        <div className="flex items-center gap-3 px-1">
                            <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-800" />
                            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest bg-zinc-100 dark:bg-[#09090b] px-3 py-1 rounded-full border border-zinc-300 dark:border-zinc-800">
                                Cycle {cIndex + 1}
                            </span>
                            <div className="h-px flex-1 bg-zinc-300 dark:bg-zinc-800" />
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {cycle.map((session, sIndex) => {
                                const isCompleted = logs.some(l => l.session_number === session.number && l.is_completed);
                                const completedLog = logs.find(l => l.session_number === session.number);
                                const dateStr = completedLog?.date_completed 
                                    ? new Date(completedLog.date_completed).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
                                    : '--/--';
                                const trainerName = completedLog?.trainer_name || 'TFG Trainer';

                                return (
                                    <div 
                                        key={sIndex}
                                        onClick={() => navigate(`/training-plan/${trainingPlan.id}/day/${session.templateId}?sub=${selectedSub.id}&session=${session.number}`)}
                                        className={`
                                            group relative rounded-2xl cursor-pointer border transition-all duration-300 overflow-hidden
                                            flex flex-col justify-between min-h-[140px]
                                            ${isCompleted 
                                                ? 'bg-zinc-50 dark:bg-[#121214] border-emerald-500/30 hover:bg-emerald-500/5 hover:border-emerald-500/50' 
                                                : 'bg-zinc-50 dark:bg-[#121214] border-zinc-300 dark:border-zinc-800 border-dashed hover:border-solid hover:border-orange-500/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-900/10'
                                            }
                                        `}
                                    >
                                        <div className={`absolute top-0 left-0 w-full h-1 ${isCompleted ? 'bg-emerald-500' : 'bg-transparent group-hover:bg-orange-500 transition-colors'}`} />

                                        <div className="flex justify-between items-start p-4 pb-2">
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-md border ${isCompleted ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 border-zinc-300 dark:border-zinc-700'}`}>
                                                SESSION {session.number}
                                            </span>
                                            {isCompleted ? (
                                                <div className="bg-emerald-500 rounded-full p-1 shadow-lg shadow-emerald-500/20">
                                                    <CheckCircle size={12} className="text-white dark:text-black fill-current" />
                                                </div>
                                            ) : (
                                                <CircleDashed size={14} className="text-zinc-400 dark:text-zinc-600 group-hover:text-orange-500 transition-colors" />
                                            )}
                                        </div>

                                        <div className="px-4 mb-auto">
                                            <h5 className={`font-bold text-sm leading-tight line-clamp-2 ${isCompleted ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors'}`}>
                                                {session.name}
                                            </h5>
                                        </div>

                                        {isCompleted ? (
                                            <div className="mt-3 px-4 py-3 bg-zinc-100 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                                                    <Calendar size={12} className="text-emerald-500" />
                                                    <span className="text-[11px] font-mono font-medium">{dateStr}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                                                    <User size={12} className="text-blue-500" />
                                                    <span className="text-[11px] font-medium truncate max-w-[120px]">{trainerName}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-3 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800/50 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-[10px] font-bold text-orange-600 dark:text-orange-500 uppercase tracking-wider">Start Workout</span>
                                                <ChevronRight size={14} className="text-orange-600 dark:text-orange-500" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    // Calculate displayed subscriptions for pagination
    const displayedSubs = subscriptions.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    return (
        <div className="min-h-[500px]">
            {!selectedSub ? (
                /* 1. SUBSCRIPTION SELECTION (PAGINATED GRID) */
                <div className="space-y-5 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-2">
                        <LayoutGrid className="text-orange-500" size={20} />
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Active Memberships</h3>
                    </div>
                    
                    {/* Grid Layout replacing the Carousel */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {displayedSubs.map((sub) => (
                            <div 
                                key={sub.id} 
                                onClick={() => handleSelectSub(sub)} 
                                className={`
                                    relative overflow-hidden p-6 rounded-3xl border cursor-pointer transition-all duration-300 group
                                    ${sub.is_active 
                                        ? 'bg-zinc-50 dark:bg-[#121214] border-zinc-300 dark:border-zinc-800 hover:border-orange-500 hover:shadow-xl hover:shadow-orange-900/10' 
                                        : 'bg-zinc-200 dark:bg-zinc-900/20 border-zinc-300 dark:border-zinc-800/50 opacity-60 grayscale'
                                    }
                                `}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-colors" />
                                
                                <div className="relative z-10 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${sub.is_active ? 'bg-zinc-200 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-orange-600 dark:text-orange-500' : 'bg-zinc-200 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-500 dark:text-zinc-600'}`}>
                                            <Dumbbell size={24} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-lg text-zinc-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors truncate pr-2">{sub.plan_name}</h4>
                                            <p className="text-xs text-zinc-500 font-medium">
                                                {sub.plan_total_sessions} Sessions • Starts {new Date(sub.start_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-900 flex items-center justify-center shrink-0 group-hover:bg-orange-600 dark:group-hover:bg-orange-500 group-hover:text-white transition-all">
                                        <ChevronRight size={16} />
                                    </div>
                                </div>
                            </div>
                        ))}

                        {subscriptions.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-16 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl text-zinc-500">
                                <Dumbbell size={48} className="mb-4 opacity-20" />
                                <p className="font-bold">No Subscriptions Found</p>
                                <p className="text-sm">Assign a plan in the Membership tab first.</p>
                            </div>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    <Pagination 
                        totalItems={subscriptions.length} 
                        itemsPerPage={itemsPerPage} 
                        currentPage={page} 
                        onPageChange={setPage} 
                    />
                </div>
            ) : (
                /* 2. PLAN VIEW OR WIZARD */
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <button 
                            onClick={() => { setSelectedSub(null); setTrainingPlan(null); }} 
                            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors text-sm font-bold"
                        >
                            <ArrowLeft size={16} /> Back to Plans
                        </button>
                        
                        {trainingPlan && (
                            <button 
                                onClick={handleDeletePlan} 
                                className="p-2 bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:text-red-600 dark:hover:text-red-500 hover:border-red-500/50 rounded-lg transition-all"
                                title="Reset Plan"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>

                    {loadingPlan ? (
                        <div className="flex flex-col items-center justify-center py-20 text-orange-500 gap-3">
                            <RefreshCw className="animate-spin" size={32} />
                            <span className="text-sm font-bold tracking-widest uppercase">Loading Schedule...</span>
                        </div>
                    ) : !trainingPlan ? (
                        /* --- WIZARD DESIGN --- */
                        <div className="max-w-md mx-auto py-8 animate-in zoom-in-95 duration-300">
                            {setupStep === 1 && (
                                <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-purple-500" />
                                    
                                    <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-900 rounded-2xl border border-zinc-300 dark:border-zinc-800 flex items-center justify-center mx-auto mb-6 text-zinc-900 dark:text-white shadow-inner">
                                        <RefreshCw size={32} />
                                    </div>
                                    
                                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">Split Structure</h3>
                                    <p className="text-zinc-500 text-sm mb-8">How many different workouts rotate in this cycle?</p>
                                    
                                    {/* Counter UI */}
                                    <div className="flex items-center justify-center gap-6 mb-8">
                                        <button onClick={handleDecrement} className="w-12 h-12 rounded-xl bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-white text-zinc-900 dark:text-white flex items-center justify-center transition-all active:scale-90">
                                            <Minus size={20} />
                                        </button>
                                        <div className="w-20 text-center">
                                            <span className="text-4xl font-black text-zinc-900 dark:text-white">{cycleLength}</span>
                                            <p className="text-[10px] uppercase font-bold text-zinc-500 mt-1">Days</p>
                                        </div>
                                        <button onClick={handleIncrement} className="w-12 h-12 rounded-xl bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-white text-zinc-900 dark:text-white flex items-center justify-center transition-all active:scale-90">
                                            <Plus size={20} />
                                        </button>
                                    </div>

                                    <button onClick={handleNextStep} className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-orange-600 dark:hover:bg-orange-500 hover:text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-95">
                                        Continue
                                    </button>
                                </div>
                            )}

                            {setupStep === 2 && (
                                <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-3xl p-8 shadow-2xl animate-in slide-in-from-right-8 duration-300">
                                    <div className="flex items-center gap-3 mb-6">
                                        <button onClick={() => setSetupStep(1)} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-900 rounded-lg text-zinc-500"><ArrowLeft size={18}/></button>
                                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Name Your Days</h3>
                                    </div>

                                    <div className="space-y-3 mb-8 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {Array.from({ length: cycleLength }).map((_, i) => (
                                            <div key={i} className="flex items-center gap-3 group">
                                                <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 flex items-center justify-center text-zinc-500 font-bold text-xs group-focus-within:border-orange-500 group-focus-within:text-orange-500 transition-colors">
                                                    {i + 1}
                                                </div>
                                                <input 
                                                    type="text" 
                                                    autoFocus={i === 0} 
                                                    placeholder={`e.g. Push, Pull, Legs`} 
                                                    value={dayNames[i + 1] || ''} 
                                                    className="flex-1 bg-zinc-200 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white outline-none focus:border-orange-500 transition-colors text-sm" 
                                                    onChange={(e) => setDayNames({ ...dayNames, [i + 1]: e.target.value })} 
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <button onClick={handleSavePlan} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-orange-900/20 active:scale-95 flex items-center justify-center gap-2">
                                        <Save size={18} /> Generate Schedule
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* DASHBOARD VIEW */
                        <div>
                            {renderProgressBar()}
                            {renderSessionGrid()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
export default ClientTrainingTab;