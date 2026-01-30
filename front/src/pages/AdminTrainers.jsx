import React, { useState, useEffect } from 'react';
import api from '../api';
import { UserPlus, Shield, CheckCircle, AlertCircle, Trash2, Edit2, X, Save, User, Lock, Type } from 'lucide-react';

const AdminTrainers = () => {
    // State
    const [trainers, setTrainers] = useState([]);
    const [formData, setFormData] = useState({ username: '', first_name: '', email: '', password: '' });
    const [status, setStatus] = useState({ type: '', message: '' });
    const [isLoading, setIsLoading] = useState(false);
    
    // Editing State
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({ username: '', first_name: '', email: '', password: '' });

    // Fetch Trainers
    const fetchTrainers = async () => {
        try {
            const response = await api.get('/manage-trainers/');
            setTrainers(response.data);
        } catch (error) {
            console.error("Error fetching trainers", error);
        }
    };

    useEffect(() => { fetchTrainers(); }, []);

    // Create Trainer
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setStatus({ type: '', message: '' });

        try {
            await api.post('/manage-trainers/', formData);
            setStatus({ type: 'success', message: 'Trainer Account Created Successfully!' });
            setFormData({ username: '', first_name: '', email: '', password: '' });
            fetchTrainers(); 
        } catch (error) {
            setStatus({ type: 'error', message: 'Error: Check inputs or username might be taken.' });
        } finally {
            setIsLoading(false);
        }
    };

    // Delete Trainer
    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to remove this trainer?")) {
            try { await api.delete(`/manage-trainers/${id}/`); fetchTrainers(); } catch (error) { alert("Failed to delete trainer."); }
        }
    };

    // Update Trainer
    const startEdit = (trainer) => {
        setEditingId(trainer.id);
        setEditData({ username: trainer.username, first_name: trainer.first_name || '', email: trainer.email, password: '' });
    };

    const saveEdit = async (id) => {
        try {
            const payload = { username: editData.username, first_name: editData.first_name, email: editData.email };
            if (editData.password.length > 0) payload.password = editData.password;

            await api.patch(`/manage-trainers/${id}/`, payload);
            setEditingId(null);
            fetchTrainers();
        } catch (error) { alert("Error updating trainer."); }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white w-full p-6 lg:p-10 lg:pl-80 pt-24 lg:pt-10">
            <div className="max-w-6xl mx-auto space-y-12">
                
                <div>
                    <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
                    <p className="text-zinc-500">Manage staff access and system settings.</p>
                </div>
                
                {/* --- Create Trainer Form --- */}
                <div className="bg-zinc-900/50 backdrop-blur-md border border-white/5 rounded-3xl p-8 shadow-xl">
                    <div className="flex items-center gap-5 mb-8 border-b border-white/5 pb-8">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Register New Trainer</h2>
                            <p className="text-zinc-500 text-sm">Create credentials for new gym staff.</p>
                        </div>
                    </div>

                    {status.message && (
                        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 border ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                            {status.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
                            <span className="text-sm font-medium">{status.message}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-end">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 ml-1">Full Name</label>
                            <input className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-orange-500 outline-none" 
                                onChange={(e) => setFormData({...formData, first_name: e.target.value})} value={formData.first_name} placeholder="e.g. John Doe" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 ml-1">Username</label>
                            <input className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-orange-500 outline-none" 
                                onChange={(e) => setFormData({...formData, username: e.target.value})} value={formData.username} placeholder="TrainerUser" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 ml-1">Email</label>
                            <input className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-orange-500 outline-none" 
                                type="email" onChange={(e) => setFormData({...formData, email: e.target.value})} value={formData.email} placeholder="email@gym.com" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 ml-1">Password</label>
                            <input className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-orange-500 outline-none" 
                                type="password" onChange={(e) => setFormData({...formData, password: e.target.value})} value={formData.password} placeholder="••••••••" required />
                        </div>
                        <button type="submit" disabled={isLoading} className="md:col-span-2 lg:col-span-4 bg-white text-black font-bold py-4 rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 mt-2">
                            {isLoading ? 'Creating...' : <><UserPlus size={20} /> Create Account</>}
                        </button>
                    </form>
                </div>

                {/* --- Trainers List --- */}
                <div>
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-3"><User size={24} className="text-orange-500" /> Current Staff Team</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {trainers.map((trainer) => (
                            <div key={trainer.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center justify-between group hover:border-zinc-700 transition-all">
                                {editingId === trainer.id ? (
                                    <div className="flex-1 space-y-3 mr-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <input value={editData.first_name} onChange={(e) => setEditData({...editData, first_name: e.target.value})} className="bg-black border border-orange-500/50 rounded-lg px-3 py-2 text-sm text-white outline-none w-full" placeholder="Name" />
                                            <input value={editData.username} onChange={(e) => setEditData({...editData, username: e.target.value})} className="bg-black border border-orange-500/50 rounded-lg px-3 py-2 text-sm text-white outline-none w-full" placeholder="User" />
                                        </div>
                                        <input value={editData.email} onChange={(e) => setEditData({...editData, email: e.target.value})} className="bg-black border border-orange-500/50 rounded-lg px-3 py-2 text-sm text-white outline-none w-full" placeholder="Email" />
                                        <input type="text" value={editData.password} onChange={(e) => setEditData({...editData, password: e.target.value})} className="bg-zinc-950 border border-zinc-800 focus:border-orange-500 rounded-lg px-3 py-2 text-sm text-white outline-none w-full" placeholder="New Password" />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold border border-zinc-700">
                                            {trainer.first_name ? trainer.first_name[0].toUpperCase() : trainer.username[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">{trainer.first_name || trainer.username}</h3>
                                            <p className="text-zinc-500 text-xs">@{trainer.username} • {trainer.email || 'No email'}</p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 self-start mt-2">
                                    {editingId === trainer.id ? (
                                        <>
                                            <button onClick={() => saveEdit(trainer.id)} className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20"><Save size={16}/></button>
                                            <button onClick={() => setEditingId(null)} className="p-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700"><X size={16}/></button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => startEdit(trainer)} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                            <button onClick={() => handleDelete(trainer.id)} className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminTrainers;