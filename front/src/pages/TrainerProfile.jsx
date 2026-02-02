import React, { useState, useEffect, useContext } from 'react';
import { 
    User, Calendar, Clock, ArrowRight, CheckCircle, XCircle, 
    Send, Inbox, ArrowUpRight, ArrowDownLeft, Shield, AlertCircle, Dumbbell, 
    Eye, MoreHorizontal, Check, X
} from 'lucide-react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

const TrainerProfile = () => {
    const { user } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState('clients'); // 'clients', 'history'
    
    // Data
    const [myClients, setMyClients] = useState([]);
    const [transferHistory, setTransferHistory] = useState([]); // Unified list
    const [trainers, setTrainers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [selectedSubForTransfer, setSelectedSubForTransfer] = useState(null);
    const [selectedRequestDetail, setSelectedRequestDetail] = useState(null); // For detail view

    // Transfer Form State
    const [transferForm, setTransferForm] = useState({
        to_trainer: '',
        sessions_count: '',
        selected_days: [], // Array of days
        time_preference: '',
        additional_notes: ''
    });

    const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    useEffect(() => {
        fetchData();
        fetchTrainers();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const currentUserId = user.user_id || user.id;

            // 1. Fetch All Transfers
            const transfersRes = await api.get('/transfers/');
            // Sort by newest first
            const sortedTransfers = transfersRes.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setTransferHistory(sortedTransfers);

            // 2. Fetch My Clients
            const myClientsRes = await api.get('/client-subscriptions/profile_clients/');
            setMyClients(myClientsRes.data);

        } catch (error) {
            console.error("Error loading profile data", error);
            toast.error("Could not load data");
        } finally {
            setLoading(false);
        }
    };

    const fetchTrainers = async () => {
        try {
            const currentUserId = user.user_id || user.id;
            const res = await api.get('/coach-schedules/get_trainers/');
            setTrainers(res.data.filter(t => t.id != currentUserId));
        } catch (error) {
            console.error("Error loading trainers", error);
        }
    };

    const handleDayToggle = (day) => {
        setTransferForm(prev => {
            const days = prev.selected_days.includes(day)
                ? prev.selected_days.filter(d => d !== day)
                : [...prev.selected_days, day];
            return { ...prev, selected_days: days };
        });
    };

    const handleTransferSubmit = async (e) => {
        e.preventDefault();
        
        // Construct the formatted schedule note
        const dayString = transferForm.selected_days.length > 0 
            ? transferForm.selected_days.join(', ') 
            : 'Flexible days';
        const timeString = transferForm.time_preference ? `@ ${transferForm.time_preference}` : '';
        const finalNote = `Days: ${dayString} ${timeString}\nNote: ${transferForm.additional_notes}`;

        try {
            await api.post('/transfers/', {
                subscription: selectedSubForTransfer.id,
                to_trainer: transferForm.to_trainer,
                sessions_count: transferForm.sessions_count,
                schedule_notes: finalNote
            });
            toast.success("Transfer request sent!");
            setIsTransferModalOpen(false);
            setTransferForm({ 
                to_trainer: '', sessions_count: '', 
                selected_days: [], time_preference: '', additional_notes: '' 
            });
            fetchData();
        } catch (error) {
            toast.error("Failed to send request.");
        }
    };

    const handleRespond = async (id, status, e) => {
        if(e) e.stopPropagation(); // Prevent opening detail modal
        try {
            await api.post(`/transfers/${id}/respond/`, { status });
            toast.success(`Request ${status}`);
            fetchData();
            if (selectedRequestDetail?.id === id) setSelectedRequestDetail(null); // Close modal if open
        } catch (error) {
            toast.error("Action failed");
        }
    };

    const openTransferModal = (sub) => {
        setSelectedSubForTransfer(sub);
        setIsTransferModalOpen(true);
    };

    // --- RENDER HELPERS ---

    const renderMyClients = () => {
        const currentUserId = user.user_id || user.id;

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4">
                {myClients.map(sub => {
                    const isOwner = sub.trainer == currentUserId;
                    
                    return (
                        <div key={sub.id} className="bg-[#121214] border border-zinc-800 p-5 rounded-2xl relative group overflow-hidden hover:border-zinc-700 transition-all">
                             <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isOwner ? 'bg-zinc-800 text-zinc-400' : 'bg-blue-500/20 text-blue-500'}`}>
                                        {sub.client_name ? sub.client_name.charAt(0) : 'C'}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white leading-tight">{sub.client_name}</h4>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${isOwner ? 'bg-zinc-900 text-zinc-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                            {isOwner ? 'Direct Client' : 'Covering'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 mb-4 bg-zinc-900/50 p-3 rounded-xl">
                                <div className="flex justify-between text-xs">
                                    <span className="text-zinc-500 font-bold uppercase">Plan</span>
                                    <span className="text-zinc-300 font-bold">{sub.plan_name}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-zinc-500 font-bold uppercase">Sessions</span>
                                    <span className="text-zinc-300 font-bold">{sub.sessions_used} / {sub.plan_total_sessions}</span>
                                </div>
                            </div>

                            {isOwner ? (
                                <button 
                                    onClick={() => openTransferModal(sub)}
                                    className="w-full py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-orange-500 hover:bg-zinc-800 transition-all text-sm font-bold flex items-center justify-center gap-2"
                                >
                                    <ArrowRight size={16} /> Transfer Sessions
                                </button>
                            ) : (
                                 <div className="w-full py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 text-center text-xs font-bold flex items-center justify-center gap-2">
                                    <Shield size={14} /> You have access
                                 </div>
                            )}
                        </div>
                    );
                })}
                {myClients.length === 0 && (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                        <Dumbbell size={48} className="mb-4 opacity-20"/>
                        <p className="font-bold">No assigned clients found.</p>
                    </div>
                )}
            </div>
        );
    };

    // --- UNIFIED HISTORY RENDERER ---
    const renderHistory = () => {
        const currentUserId = user.user_id || user.id;

        if (transferHistory.length === 0) {
            return (
                <div className="py-20 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                    <Inbox size={48} className="mx-auto mb-2 opacity-20"/>
                    <p>No transfer history yet.</p>
                </div>
            );
        }

        return (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
                {transferHistory.map(req => {
                    // Determine if Incoming (Received) or Outgoing (Sent)
                    const isIncoming = req.to_trainer == currentUserId;
                    
                    // Styling logic based on Direction and Status
                    const cardBaseClass = "relative p-4 rounded-2xl border transition-all cursor-pointer hover:-translate-y-0.5";
                    const cardColorClass = isIncoming 
                        ? "bg-[#121214] border-l-4 border-l-blue-500 border-y-zinc-800 border-r-zinc-800 hover:bg-zinc-900" // Incoming style
                        : "bg-zinc-900/40 border-l-4 border-l-zinc-500 border-y-zinc-800/50 border-r-zinc-800/50 hover:bg-zinc-900/60"; // Sent style

                    return (
                        <div 
                            key={req.id} 
                            onClick={() => setSelectedRequestDetail(req)}
                            className={`${cardBaseClass} ${cardColorClass}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-start gap-4">
                                    {/* Icon Box */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isIncoming ? 'bg-blue-500/10 text-blue-500' : 'bg-zinc-800 text-zinc-500'}`}>
                                        {isIncoming ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${isIncoming ? 'bg-blue-500 text-black' : 'bg-zinc-700 text-zinc-300'}`}>
                                                {isIncoming ? 'Received' : 'Sent'}
                                            </span>
                                            <span className="text-zinc-500 text-xs font-mono">
                                                {new Date(req.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        
                                        <h4 className="text-sm font-bold text-white mb-0.5">
                                            {isIncoming 
                                                ? `From ${req.from_trainer_name}: Coverage for ${req.client_name}` 
                                                : `To ${req.to_trainer_name}: Coverage for ${req.client_name}`
                                            }
                                        </h4>
                                        
                                        <p className="text-xs text-zinc-400 line-clamp-1">
                                            {req.sessions_count} Sessions • {req.schedule_notes}
                                        </p>
                                    </div>
                                </div>

                                {/* Status Badge / Actions */}
                                <div className="flex flex-col items-end gap-2">
                                    <div className={`px-3 py-1 rounded-lg text-xs font-bold uppercase
                                        ${req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : ''}
                                        ${req.status === 'accepted' ? 'bg-green-500/10 text-green-500' : ''}
                                        ${req.status === 'rejected' ? 'bg-red-500/10 text-red-500' : ''}
                                    `}>
                                        {req.status}
                                    </div>

                                    {/* Quick Actions for Pending Incoming */}
                                    {isIncoming && req.status === 'pending' && (
                                        <div className="flex gap-1 mt-1">
                                            <button 
                                                onClick={(e) => handleRespond(req.id, 'accepted', e)}
                                                className="p-1.5 rounded-lg bg-green-500/20 text-green-500 hover:bg-green-500 hover:text-white transition-colors"
                                                title="Accept"
                                            >
                                                <Check size={14} strokeWidth={3} />
                                            </button>
                                            <button 
                                                onClick={(e) => handleRespond(req.id, 'rejected', e)}
                                                className="p-1.5 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                                                title="Reject"
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-6 lg:p-10 lg:pl-80 pt-24 lg:pt-10 transition-all">
            <Toaster position="top-right" toastOptions={{ style: { background: '#18181b', color: '#fff', border: '1px solid #333' } }} />
            
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-black tracking-tight mb-2">Trainer Profile</h1>
                    <p className="text-zinc-500">Manage your specific clients and coverage requests.</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-8 border-b border-zinc-800 pb-1">
                    <button 
                        onClick={() => setActiveTab('clients')} 
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${activeTab === 'clients' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                    >
                        My Clients
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')} 
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${activeTab === 'history' ? 'border-orange-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Transfer History
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-20 text-orange-500"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div></div>
                ) : (
                    <>
                        {activeTab === 'clients' && renderMyClients()}
                        {activeTab === 'history' && renderHistory()}
                    </>
                )}
            </div>

            {/* --- MODAL 1: CREATE REQUEST (With Day Picker) --- */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-[#121214] border border-zinc-800 w-full max-w-lg rounded-3xl p-6 relative animate-in zoom-in-95">
                        <button onClick={() => setIsTransferModalOpen(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><XCircle size={24}/></button>
                        
                        <h2 className="text-xl font-bold text-white mb-1">Transfer Sessions</h2>
                        <p className="text-zinc-500 text-sm mb-6">Request coverage for <span className="text-white font-bold">{selectedSubForTransfer?.client_name}</span>.</p>

                        <form onSubmit={handleTransferSubmit} className="space-y-4">
                            {/* Coach Select */}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Select Trainer</label>
                                <select 
                                    required
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 mt-1"
                                    value={transferForm.to_trainer}
                                    onChange={e => setTransferForm({...transferForm, to_trainer: e.target.value})}
                                >
                                    <option value="">-- Choose Coach --</option>
                                    {trainers.map(t => (
                                        <option key={t.id} value={t.id}>{t.first_name || t.username}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Count */}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Number of Sessions</label>
                                <input 
                                    type="number" 
                                    required
                                    min="1"
                                    placeholder="e.g. 5"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 mt-1"
                                    value={transferForm.sessions_count}
                                    onChange={e => setTransferForm({...transferForm, sessions_count: e.target.value})}
                                />
                            </div>

                            {/* Day Picker */}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Select Days</label>
                                <div className="flex gap-2 mt-1 mb-3 overflow-x-auto pb-1">
                                    {DAYS_OF_WEEK.map(day => (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => handleDayToggle(day)}
                                            className={`
                                                w-10 h-10 rounded-lg text-xs font-bold transition-all border
                                                ${transferForm.selected_days.includes(day) 
                                                    ? 'bg-orange-600 text-white border-orange-500' 
                                                    : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600'}
                                            `}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Time */}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Preferred Time</label>
                                <input 
                                    type="time" 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 mt-1"
                                    value={transferForm.time_preference}
                                    onChange={e => setTransferForm({...transferForm, time_preference: e.target.value})}
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Additional Notes</label>
                                <textarea 
                                    rows="2"
                                    placeholder="e.g. Focus on cardio..."
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-orange-500 mt-1 resize-none"
                                    value={transferForm.additional_notes}
                                    onChange={e => setTransferForm({...transferForm, additional_notes: e.target.value})}
                                />
                            </div>

                            <button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl mt-2 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                                <Send size={18} /> Send Request
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL 2: REQUEST DETAILS --- */}
            {selectedRequestDetail && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-[#121214] border border-zinc-800 w-full max-w-md rounded-3xl p-8 relative animate-in zoom-in-95">
                        <button onClick={() => setSelectedRequestDetail(null)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><XCircle size={24}/></button>

                        <div className="mb-6">
                            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 bg-zinc-900 px-2 py-1 rounded">Transfer Details</span>
                            <h2 className="text-2xl font-black text-white mt-2 mb-1">{selectedRequestDetail.client_name}</h2>
                            <p className="text-zinc-400 text-sm">{selectedRequestDetail.plan_name}</p>
                        </div>

                        <div className="space-y-4 bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/50">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <span className="text-zinc-500 font-bold text-xs uppercase">From</span>
                                <span className="text-white font-bold">{selectedRequestDetail.from_trainer_name}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <span className="text-zinc-500 font-bold text-xs uppercase">To</span>
                                <span className="text-white font-bold">{selectedRequestDetail.to_trainer_name}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <span className="text-zinc-500 font-bold text-xs uppercase">Count</span>
                                <span className="text-white font-bold">{selectedRequestDetail.sessions_count} Sessions</span>
                            </div>
                            <div>
                                <span className="text-zinc-500 font-bold text-xs uppercase block mb-1">Schedule & Notes</span>
                                <p className="text-zinc-300 text-sm whitespace-pre-wrap bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                                    {selectedRequestDetail.schedule_notes}
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons if Pending & Incoming */}
                        {selectedRequestDetail.status === 'pending' && selectedRequestDetail.to_trainer == (user.user_id || user.id) && (
                            <div className="grid grid-cols-2 gap-4 mt-6">
                                <button 
                                    onClick={() => handleRespond(selectedRequestDetail.id, 'rejected')} 
                                    className="py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 font-bold"
                                >
                                    Reject
                                </button>
                                <button 
                                    onClick={() => handleRespond(selectedRequestDetail.id, 'accepted')} 
                                    className="py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold shadow-lg"
                                >
                                    Accept
                                </button>
                            </div>
                        )}
                        
                        {/* Status Display if not pending */}
                        {selectedRequestDetail.status !== 'pending' && (
                            <div className="mt-6 text-center p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                                <span className="text-zinc-500 text-xs font-bold uppercase">Current Status</span>
                                <div className={`text-lg font-black uppercase mt-1 ${
                                    selectedRequestDetail.status === 'accepted' ? 'text-green-500' : 'text-red-500'
                                }`}>
                                    {selectedRequestDetail.status}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainerProfile;