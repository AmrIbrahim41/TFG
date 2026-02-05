import React, { useState, useEffect, useContext } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { Plus, Trash2, Calendar, CheckCircle, Ticket, DollarSign, X, Baby, Users } from 'lucide-react';

const Subscriptions = () => {
    const { user } = useContext(AuthContext);
    const [subs, setSubs] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // UI State
    const [activeTab, setActiveTab] = useState('adult'); // 'adult' or 'child'

    // Form State (Added is_child_plan)
    const [formData, setFormData] = useState({ 
        name: '', units: '', duration_days: '', price: '', is_child_plan: false 
    });

    const fetchSubs = async () => {
        try {
            const response = await api.get('/subscriptions/');
            setSubs(response.data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => { fetchSubs(); }, []);

    // Filter displayed subs based on active tab
    const filteredSubs = subs.filter(sub => 
        activeTab === 'child' ? sub.is_child_plan === true : sub.is_child_plan === false
    );

    const openModal = () => {
        // Auto-check the box if we are on the child tab
        setFormData({ 
            name: '', units: '', duration_days: '', price: '', 
            is_child_plan: activeTab === 'child' 
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/subscriptions/', formData);
            fetchSubs();
            setIsModalOpen(false);
        } catch (error) {
            alert("Error creating subscription.");
        }
    };

    const handleDelete = async (id) => {
        if (confirm("Delete this package?")) {
            await api.delete(`/subscriptions/${id}/`);
            fetchSubs();
        }
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white p-6 lg:p-10 lg:pl-80 pt-24 lg:pt-10 transition-colors duration-300">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight mb-2">Subscription Plans</h1>
                    <p className="text-zinc-500 font-medium">Manage pricing and session packages.</p>
                </div>
                {user?.is_superuser && (
                    <button onClick={openModal} className="flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-bold hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-all shadow-lg shadow-black/10 dark:shadow-white/10 active:scale-95">
                        <Plus size={20} strokeWidth={3} /> Create {activeTab === 'child' ? 'Child' : 'Adult'} Plan
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 mb-8 bg-zinc-200 dark:bg-zinc-900/50 p-1.5 rounded-2xl w-fit border border-zinc-300 dark:border-zinc-800 transition-colors">
                <button 
                    onClick={() => setActiveTab('adult')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'adult' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm dark:shadow-lg' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                >
                    <Users size={18} /> Adult Plans
                </button>
                <button 
                    onClick={() => setActiveTab('child')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'child' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                >
                    <Baby size={18} /> Children Plans
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSubs.map((sub) => (
                    <div key={sub.id} className={`bg-white dark:bg-[#121214] border p-6 rounded-[2rem] relative group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-2xl shadow-sm
                        ${sub.is_child_plan ? 'border-zinc-200 dark:border-zinc-800 hover:border-blue-500/50 hover:shadow-blue-500/10 dark:hover:shadow-blue-900/10' : 'border-zinc-200 dark:border-zinc-800 hover:border-orange-500/50 hover:shadow-orange-500/10 dark:hover:shadow-orange-900/10'}
                    `}>
                        <div className="flex justify-between items-start mb-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors
                                ${sub.is_child_plan ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500' : 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500'}
                            `}>
                                {sub.is_child_plan ? <Baby size={28} /> : <Ticket size={28} />}
                            </div>
                            {user?.is_superuser && (
                                <button onClick={() => handleDelete(sub.id)} className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 dark:text-zinc-600 hover:bg-red-500/10 hover:text-red-500 transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                        
                        <h3 className="text-2xl font-black mb-1 text-zinc-900 dark:text-white">{sub.name}</h3>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-3xl font-bold text-zinc-700 dark:text-zinc-200">{sub.price > 0 ? sub.price : 'Custom'}</span>
                            {sub.price > 0 && <span className="text-sm font-bold text-zinc-400 dark:text-zinc-500">EGP</span>}
                        </div>
                        
                        <div className="space-y-3 pt-6 border-t border-zinc-100 dark:border-zinc-800/50">
                            <div className="flex items-center gap-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                <div className={`p-1.5 rounded-lg ${sub.is_child_plan ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500' : 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500'}`}>
                                    <CheckCircle size={14} strokeWidth={3} />
                                </div>
                                <span className="text-zinc-800 dark:text-zinc-200 font-bold">{sub.units}</span> Training Sessions
                            </div>
                            <div className="flex items-center gap-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                <div className={`p-1.5 rounded-lg ${sub.is_child_plan ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500' : 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500'}`}>
                                    <Calendar size={14} strokeWidth={3} />
                                </div>
                                Valid for <span className="text-zinc-800 dark:text-zinc-200 font-bold">{sub.duration_days}</span> Days
                            </div>
                        </div>
                    </div>
                ))}

                {/* Empty State */}
                {filteredSubs.length === 0 && (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl">
                        {activeTab === 'child' ? <Baby size={48} className="mb-4 opacity-50"/> : <Ticket size={48} className="mb-4 opacity-50"/>}
                        <p className="font-medium">No {activeTab} packages available.</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-3xl p-8 relative animate-in zoom-in-95 shadow-2xl">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"><X size={18}/></button>
                        
                        <h2 className="text-2xl font-black mb-1 text-zinc-900 dark:text-white">New {formData.is_child_plan ? 'Child' : 'Adult'} Plan</h2>
                        <p className="text-zinc-500 text-sm mb-6">Create a new pricing tier for your clients.</p>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Package Name</label>
                                <input required className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white focus:border-orange-500 outline-none mt-1.5 transition-colors placeholder-zinc-400" 
                                    placeholder="e.g. Gold Month" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Units (Sessions)</label>
                                    <input required type="number" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white focus:border-orange-500 outline-none mt-1.5 transition-colors placeholder-zinc-400" 
                                        placeholder="12" value={formData.units} onChange={e => setFormData({...formData, units: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Duration (Days)</label>
                                    <input required type="number" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white focus:border-orange-500 outline-none mt-1.5 transition-colors placeholder-zinc-400" 
                                        placeholder="30" value={formData.duration_days} onChange={e => setFormData({...formData, duration_days: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Price (EGP)</label>
                                <div className="relative">
                                    <DollarSign size={16} className="absolute left-4 top-4 text-zinc-400 dark:text-zinc-500"/>
                                    <input type="number" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-3.5 text-zinc-900 dark:text-white focus:border-orange-500 outline-none mt-1.5 transition-colors placeholder-zinc-400" 
                                        placeholder="0.00" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                                </div>
                            </div>

                            {/* Type Toggle Checkbox */}
                            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                                <div>
                                    <span className="block text-sm font-bold text-zinc-900 dark:text-white">Child Package?</span>
                                    <span className="text-xs text-zinc-500">Visible only to children accounts.</span>
                                </div>
                                <div 
                                    onClick={() => setFormData(prev => ({...prev, is_child_plan: !prev.is_child_plan}))}
                                    className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors duration-300 ${formData.is_child_plan ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${formData.is_child_plan ? 'translate-x-5' : 'translate-x-0'}`} />
                                </div>
                            </div>

                            <button className={`w-full font-bold py-4 rounded-xl mt-4 transition-all shadow-lg active:scale-[0.98] text-white
                                ${formData.is_child_plan ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 dark:shadow-blue-900/20' : 'bg-orange-600 hover:bg-orange-500 shadow-orange-500/20 dark:shadow-orange-900/20'}
                            `}>
                                Create Package
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Subscriptions;