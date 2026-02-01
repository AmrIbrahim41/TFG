import React, { useState } from 'react';
import { Plus, Calendar, Scale, Power, UserCheck, Ruler, Droplets, Target, Activity, Waves, Dumbbell, ArrowRight, Save, Loader2 } from 'lucide-react';

// --- PAGINATION COMPONENT ---
const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-2 mt-2">
            {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                    key={idx}
                    onClick={() => onPageChange(idx + 1)}
                    className={`
                        w-8 h-8 rounded-lg font-bold text-xs transition-all border
                        ${currentPage === idx + 1 
                            ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-900/20' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700'}
                    `}
                >
                    {idx + 1}
                </button>
            ))}
        </div>
    );
};

const ClientMembershipTab = ({ 
    subscriptions, hasActiveSub, setIsSubModalOpen, 
    setSelectedSub, selectedSub, toggleSubStatus, handleSaveInBody 
}) => {
    // Local loading state for better UX
    const [isSaving, setIsSaving] = useState(false);
    
    // CLIENT PAGINATION STATE
    const [page, setPage] = useState(1);
    const itemsPerPage = 4; // Show 4 items per page

    // Helper: Water % for Animation
    const getWaterPercentage = () => {
        const weight = parseFloat(selectedSub?.inbody_weight) || 0;
        const tbw = parseFloat(selectedSub?.inbody_tbw) || 0;
        if (weight > 0 && tbw > 0) return Math.min((tbw / weight) * 100, 100).toFixed(1);
        return 0;
    };
    const waterPercent = selectedSub ? getWaterPercentage() : 0;

    // --- COLOR MAPS ---
    const GOAL_CONFIG = {
        'Weight Loss': { color: 'bg-emerald-600', border: 'border-emerald-500', shadow: 'shadow-emerald-900/30', icon: Scale },
        'Bulking':     { color: 'bg-violet-600',  border: 'border-violet-500',  shadow: 'shadow-violet-900/30',  icon: Dumbbell },
        'Cutting':     { color: 'bg-red-600',     border: 'border-red-500',     shadow: 'shadow-red-900/30',     icon: Ruler },
        'Maintain':    { color: 'bg-blue-600',    border: 'border-blue-500',    shadow: 'shadow-blue-900/30',    icon: Activity },
    };

    const ACTIVITY_CONFIG = {
        'Light':    { color: 'bg-teal-600',   border: 'border-teal-500',   shadow: 'shadow-teal-900/30' },
        'Moderate': { color: 'bg-orange-600', border: 'border-orange-500', shadow: 'shadow-orange-900/30' },
        'High':     { color: 'bg-rose-600',   border: 'border-rose-500',   shadow: 'shadow-rose-900/30' },
    };

    // --- FIXED SAVE HANDLER ---
    const onSaveClick = async () => {
        if (!handleSaveInBody || !selectedSub) return;

        setIsSaving(true);
        try {
            // Ensure numeric values are actually numbers before sending
            const cleanData = {
                ...selectedSub,
                inbody_weight: parseFloat(selectedSub.inbody_weight) || 0,
                inbody_height: parseFloat(selectedSub.inbody_height) || 0,
                inbody_muscle: parseFloat(selectedSub.inbody_muscle) || 0,
                inbody_fat: parseFloat(selectedSub.inbody_fat) || 0,
                inbody_tbw: parseFloat(selectedSub.inbody_tbw) || 0,
            };

            // Call the prop with the CLEAN DATA, not the event
            await handleSaveInBody(cleanData);
        } catch (error) {
            console.error("Failed to save InBody data", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Slice for pagination
    const displayedSubs = subscriptions.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* --- Section 1: Subscription List --- */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Subscription History</h3>
                    {!hasActiveSub && (
                        <button onClick={() => setIsSubModalOpen(true)} className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-xl font-bold hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5">
                            <Plus size={16}/> New Sub
                        </button>
                    )}
                </div>

                <div className="min-h-[200px]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {displayedSubs.map((sub) => {
                            const total = sub.plan_total_sessions || 0;
                            const used = sub.sessions_used || 0;
                            const remaining = Math.max(total - used, 0);

                            return (
                                <div 
                                    key={sub.id} 
                                    onClick={() => setSelectedSub(sub)}
                                    className={`p-4 rounded-2xl border cursor-pointer transition-all relative group
                                        ${selectedSub?.id === sub.id 
                                            ? 'bg-gradient-to-br from-orange-500/20 to-zinc-900 border-orange-500/50 shadow-lg shadow-orange-900/20' 
                                            : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'}
                                        ${!sub.is_active && 'opacity-60 grayscale-[0.5]'}
                                    `}
                                >
                                    {/* UPDATED HEADER: Name on left, Badge + Button on right */}
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-base text-white truncate pr-2">{sub.plan_name || 'Custom Plan'}</h4>
                                        
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md border ${sub.is_active ? 'bg-green-500 text-black border-green-500' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                                                {sub.is_active ? 'ACTIVE' : 'Ended'}
                                            </span>
                                            
                                            <button 
                                                onClick={(e) => toggleSubStatus(e, sub)}
                                                className={`p-1 rounded-md border transition-all ${sub.is_active ? 'text-green-500 border-green-900/30 hover:bg-red-500 hover:text-white hover:border-red-500' : 'text-zinc-600 border-zinc-700 hover:text-green-500 hover:bg-green-500/10'}`}
                                                title={sub.is_active ? "Deactivate Subscription" : "Activate Subscription"}
                                            >
                                                <Power size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2 mb-3">
                                        {/* Date Range Row */}
                                        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-black/30 px-2 py-1.5 rounded-lg w-fit">
                                            <Calendar size={12} className="text-zinc-500"/> 
                                            <span>{sub.start_date}</span>
                                            <ArrowRight size={10} className="text-zinc-600" />
                                            <span>{sub.end_date || 'Ongoing'}</span>
                                        </div>

                                        {sub.trainer_name && (
                                            <div className="flex items-center gap-2 text-xs text-zinc-400 bg-black/30 px-2 py-1.5 rounded-lg w-fit">
                                                <UserCheck size={12} className="text-zinc-500"/> 
                                                <span className="truncate max-w-[150px]">{sub.trainer_name}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Remaining Sessions */}
                                    {sub.is_active && total > 0 && (
                                        <div className="bg-black/40 rounded-lg p-2 border border-zinc-800/50 flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Remaining</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-sm font-black ${remaining <= 3 ? 'text-red-500' : 'text-white'}`}>
                                                    {remaining}
                                                </span>
                                                <span className="text-[10px] text-zinc-600 font-medium">/ {total} Sessions</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {subscriptions.length === 0 && (
                            <div className="col-span-full text-zinc-500 text-center py-8 border border-dashed border-zinc-800 rounded-2xl">
                                No subscriptions found.
                            </div>
                        )}
                    </div>
                </div>

                <Pagination 
                    totalItems={subscriptions.length} 
                    itemsPerPage={itemsPerPage} 
                    currentPage={page} 
                    onPageChange={setPage} 
                />
            </div>

            {/* --- Section 2: InBody Analysis Form --- */}
            {selectedSub && (
                <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-3xl p-6 md:p-8 animate-in slide-in-from-bottom-5 fade-in duration-300 shadow-2xl">
                    
                    <div className="flex justify-between items-start mb-8 border-b border-zinc-800/50 pb-6">
                        <div>
                            <h3 className="text-2xl font-black flex items-center gap-3 text-white">
                                <span className="bg-orange-500/10 p-2 rounded-xl text-orange-500"><Scale size={24} /></span>
                                InBody Analysis
                            </h3>
                            <p className="text-zinc-400 text-sm mt-1 ml-1">Plan: <span className="text-white font-bold">{selectedSub.plan_name || 'Custom'}</span></p>
                        </div>
                        
                        {/* --- FIXED BUTTON --- */}
                        <button 
                            onClick={onSaveClick} 
                            disabled={isSaving}
                            className="flex items-center gap-2 bg-white text-black hover:bg-orange-500 hover:text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <><Loader2 size={16} className="animate-spin" /> Saving...</>
                            ) : (
                                <><Save size={16} /> Save Results</>
                            )}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        
                        {/* Core Inputs */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider ml-1 flex items-center gap-1">
                                <Ruler size={12} className="text-orange-500"/> Height (cm)
                            </label>
                            <input 
                                type="number" 
                                value={selectedSub.inbody_height || ''} 
                                onChange={(e) => setSelectedSub({...selectedSub, inbody_height: e.target.value})} 
                                className="w-full bg-black/40 border border-zinc-700/50 focus:border-orange-500 focus:bg-zinc-900 rounded-xl px-4 py-3 text-white font-mono text-lg transition-all outline-none" 
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider ml-1 flex items-center gap-1">
                                <Scale size={12} className="text-orange-500"/> Weight (kg)
                            </label>
                            <input 
                                type="number" 
                                value={selectedSub.inbody_weight || ''} 
                                onChange={(e) => setSelectedSub({...selectedSub, inbody_weight: e.target.value})} 
                                className="w-full bg-black/40 border border-zinc-700/50 focus:border-orange-500 focus:bg-zinc-900 rounded-xl px-4 py-3 text-white font-mono text-lg transition-all outline-none" 
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider ml-1 flex items-center gap-1">
                                <Target size={12} className="text-orange-500"/> Muscle (kg)
                            </label>
                            <input 
                                type="number" 
                                value={selectedSub.inbody_muscle || ''} 
                                onChange={(e) => setSelectedSub({...selectedSub, inbody_muscle: e.target.value})} 
                                className="w-full bg-black/40 border border-zinc-700/50 focus:border-orange-500 focus:bg-zinc-900 rounded-xl px-4 py-3 text-white font-mono text-lg transition-all outline-none" 
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider ml-1 flex items-center gap-1">
                                <Activity size={12} className="text-orange-500"/> Body Fat (%)
                            </label>
                            <input 
                                type="number" 
                                value={selectedSub.inbody_fat || ''} 
                                onChange={(e) => setSelectedSub({...selectedSub, inbody_fat: e.target.value})} 
                                className="w-full bg-black/40 border border-zinc-700/50 focus:border-orange-500 focus:bg-zinc-900 rounded-xl px-4 py-3 text-white font-mono text-lg transition-all outline-none" 
                            />
                        </div>

                        {/* Animated Water Bar */}
                        <div className="lg:col-span-2 space-y-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4">
                            <div className="flex justify-between items-end">
                                <label className="text-xs font-bold text-blue-200 uppercase tracking-wider flex items-center gap-2">
                                    <Droplets size={14} className="text-blue-400"/> Total Body Water
                                </label>
                                <span className="text-xs font-mono text-blue-300">{waterPercent}% of Body</span>
                            </div>
                            <div className="relative h-12 bg-black/40 rounded-xl overflow-hidden border border-blue-500/20">
                                {/* The Liquid Fill */}
                                <div 
                                    className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-1000 ease-out flex items-center justify-end px-3"
                                    style={{ 
                                        width: `${Math.min(waterPercent, 100)}%`,
                                        opacity: 0.7 
                                    }}
                                >
                                    <div 
                                        className="absolute inset-0 w-full h-full opacity-30 animate-pulse"
                                        style={{
                                            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
                                        }}
                                    />
                                </div>
                                <input 
                                    type="number" 
                                    value={selectedSub.inbody_tbw || ''} 
                                    onChange={(e) => setSelectedSub({...selectedSub, inbody_tbw: e.target.value})}
                                    className="absolute inset-0 w-full h-full bg-transparent px-4 text-white font-mono font-bold outline-none z-10 placeholder-blue-500/30"
                                    placeholder="0.0"
                                />
                                <div className="absolute right-4 top-3 pointer-events-none text-xs font-bold text-white/50">Liters</div>
                            </div>
                        </div>

                        {/* Goal Selector */}
                        <div className="lg:col-span-2 space-y-2">
                            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider ml-1">Current Goal</label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {Object.entries(GOAL_CONFIG).map(([goal, style]) => (
                                    <button 
                                        key={goal}
                                        onClick={() => setSelectedSub({...selectedSub, inbody_goal: goal})}
                                        className={`py-2 px-2 rounded-xl text-[10px] md:text-xs font-bold uppercase transition-all border flex flex-col items-center justify-center gap-1 min-h-[60px] h-auto whitespace-normal text-center
                                            ${selectedSub.inbody_goal === goal 
                                                ? `${style.color} text-white ${style.border} ${style.shadow} transform scale-105` 
                                                : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'}
                                        `}
                                    >
                                        <style.icon size={14} />
                                        <span>{goal}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Activity Selector */}
                        <div className="lg:col-span-4 space-y-2">
                            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider ml-1">Activity Level</label>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.entries(ACTIVITY_CONFIG).map(([level, style]) => (
                                    <button 
                                        key={level}
                                        onClick={() => setSelectedSub({...selectedSub, inbody_activity: level})}
                                        className={`py-3 px-2 rounded-xl text-xs font-bold uppercase transition-all border flex items-center justify-center gap-2 min-h-[50px]
                                            ${selectedSub.inbody_activity === level 
                                                ? `${style.color} text-white ${style.border} ${style.shadow}` 
                                                : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'}
                                        `}
                                    >
                                        <Waves size={14} className={selectedSub.inbody_activity === level ? 'animate-pulse' : ''}/>
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="md:col-span-2 lg:col-span-4 space-y-2">
                            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider ml-1">Analysis Notes</label>
                            <textarea 
                                rows="3" 
                                value={selectedSub.inbody_notes || ''} 
                                onChange={(e) => setSelectedSub({...selectedSub, inbody_notes: e.target.value})} 
                                className="w-full bg-black/40 border border-zinc-700/50 focus:border-orange-500 rounded-xl px-4 py-3 text-white outline-none resize-none" 
                                placeholder="Detailed breakdown..." 
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientMembershipTab;