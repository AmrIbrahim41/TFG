import React, { useState, useEffect, useContext } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import { Plus, Trash2, Calendar, CheckCircle, Ticket, DollarSign, X } from 'lucide-react';

const Subscriptions = () => {
    const { user } = useContext(AuthContext);
    const [subs, setSubs] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', units: '', duration_days: '', price: '' });

    const fetchSubs = async () => {
        try {
            const response = await api.get('/subscriptions/');
            setSubs(response.data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => { fetchSubs(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/subscriptions/', formData);
            fetchSubs();
            setIsModalOpen(false);
            setFormData({ name: '', units: '', duration_days: '', price: '' });
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
        <div className="min-h-screen bg-zinc-950 text-white p-6 lg:p-10 lg:pl-80 pt-24 lg:pt-10">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Subscription Plans</h1>
                    <p className="text-zinc-500">Manage your gym packages and pricing.</p>
                </div>
                {user?.is_superuser && (
                    <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-all">
                        <Plus size={20} /> New Plan
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subs.map((sub) => (
                    <div key={sub.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl relative group hover:border-orange-500/50 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                                <Ticket size={24} />
                            </div>
                            {user?.is_superuser && (
                                <button onClick={() => handleDelete(sub.id)} className="text-zinc-600 hover:text-red-500">
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                        <h3 className="text-2xl font-bold mb-1">{sub.name}</h3>
                        <p className="text-zinc-500 text-sm mb-6">{sub.price > 0 ? `$${sub.price}` : 'Free/Custom'}</p>
                        
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm text-zinc-300">
                                <CheckCircle size={16} className="text-orange-500" />
                                <span>{sub.units} Training Sessions</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-300">
                                <Calendar size={16} className="text-orange-500" />
                                <span>Valid for {sub.duration_days} Days</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl p-8 relative">
                        <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white"><X /></button>
                        <h2 className="text-xl font-bold mb-6">Create New Package</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Package Name</label>
                                <input required className="w-full bg-black/40 border border-zinc-800 rounded-xl p-3 text-white focus:border-orange-500 outline-none mt-1" 
                                    placeholder="e.g. Gold Month" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Units (Sessions)</label>
                                    <input required type="number" className="w-full bg-black/40 border border-zinc-800 rounded-xl p-3 text-white focus:border-orange-500 outline-none mt-1" 
                                        placeholder="12" value={formData.units} onChange={e => setFormData({...formData, units: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Duration (Days)</label>
                                    <input required type="number" className="w-full bg-black/40 border border-zinc-800 rounded-xl p-3 text-white focus:border-orange-500 outline-none mt-1" 
                                        placeholder="30" value={formData.duration_days} onChange={e => setFormData({...formData, duration_days: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Price (Optional)</label>
                                <div className="relative">
                                    <DollarSign size={16} className="absolute left-3 top-4 text-zinc-500"/>
                                    <input type="number" className="w-full bg-black/40 border border-zinc-800 rounded-xl pl-9 p-3 text-white focus:border-orange-500 outline-none mt-1" 
                                        placeholder="0.00" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                                </div>
                            </div>
                            <button className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl mt-2">Create Package</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Subscriptions;