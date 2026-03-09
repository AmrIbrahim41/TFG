import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import {
    UserPlus, Shield, CheckCircle, AlertCircle,
    Trash2, Edit2, X, Save, User, Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Skeleton card for loading state
// ---------------------------------------------------------------------------
const TrainerCardSkeleton = () => (
    <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-5 rounded-2xl animate-pulse">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="w-2/3 h-4 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                <div className="w-3/4 h-3 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const AdminTrainers = () => {
    const [trainers, setTrainers]               = useState([]);
    const [loadingTrainers, setLoadingTrainers] = useState(true);
    const [formData, setFormData]               = useState({ username: '', first_name: '', email: '', password: '' });
    const [formErrors, setFormErrors]           = useState({});
    const [status, setStatus]                   = useState({ type: '', message: '' });
    const [isLoading, setIsLoading]             = useState(false);
    const statusTimerRef                        = useRef(null);

    // Edit State
    const [editingId, setEditingId]     = useState(null);
    const [editData, setEditData]       = useState({ username: '', first_name: '', email: '', password: '' });
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // ---------------------------------------------------------------------------
    // Auto-clear status banner after 5 seconds
    // ---------------------------------------------------------------------------
    const showStatus = useCallback((type, message) => {
        setStatus({ type, message });
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
        statusTimerRef.current = setTimeout(
            () => setStatus({ type: '', message: '' }),
            5000,
        );
    }, []);

    useEffect(() => () => {
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    }, []);

    // ---------------------------------------------------------------------------
    // fetchTrainers
    //
    // FIX #2 (Medium — broken async cleanup):
    // The original code returned `() => { cancelled = true }` as the *resolved
    // value* of the async function, then attempted to call it via
    // `.then(fn => fn && fn())` inside the useEffect cleanup.  By the time
    // `.then()` resolves the component is already unmounted, so the flag is
    // set far too late to prevent the setState calls inside `finally`.
    //
    // Fix: Accept an AbortSignal parameter and pass it to api.get().  Each
    // useEffect creates its own AbortController and returns `controller.abort`
    // as the synchronous cleanup React requires.  On abort, Axios throws a
    // CanceledError which we catch and swallow silently.
    // ---------------------------------------------------------------------------
    const fetchTrainers = useCallback(async (signal = null) => {
        setLoadingTrainers(true);
        try {
            const response = await api.get('/manage-trainers/', { signal });
            setTrainers(response.data);
        } catch (error) {
            if (error.name === 'CanceledError' || error.name === 'AbortError') return;
            console.error('Error fetching trainers', error);
        } finally {
            // Guard: don't update state if the request was intentionally aborted
            // (i.e. the component unmounted while the request was in flight).
            if (!signal?.aborted) {
                setLoadingTrainers(false);
            }
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetchTrainers(controller.signal);
        return () => controller.abort();
    }, [fetchTrainers]);

    // ---------------------------------------------------------------------------
    // Form Validation
    // ---------------------------------------------------------------------------
    const validateCreateForm = useCallback(() => {
        const errors = {};
        if (!formData.first_name.trim()) errors.first_name = 'Full name is required.';
        if (!formData.username.trim())   errors.username   = 'Username is required.';
        else if (formData.username.trim().length < 3) errors.username = 'Username must be at least 3 characters.';
        if (!formData.email.trim())      errors.email      = 'Email is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Please enter a valid email address.';
        if (!formData.password)          errors.password   = 'Password is required.';
        else if (formData.password.length < 8) errors.password = 'Password must be at least 8 characters.';
        return errors;
    }, [formData]);

    // ---------------------------------------------------------------------------
    // Create Trainer
    // ---------------------------------------------------------------------------
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        const errors = validateCreateForm();
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        setIsLoading(true);
        setStatus({ type: '', message: '' });

        try {
            await api.post('/manage-trainers/', {
                username:   formData.username.trim(),
                first_name: formData.first_name.trim(),
                email:      formData.email.trim(),
                password:   formData.password,
            });
            showStatus('success', 'Trainer account created successfully!');
            setFormData({ username: '', first_name: '', email: '', password: '' });
            // Refresh without a signal — user-triggered action, no unmount concern.
            fetchTrainers();
        } catch (error) {
            const detail = error.response?.data?.username?.[0]
                || error.response?.data?.email?.[0]
                || error.response?.data?.password?.[0]
                || 'Error creating trainer. Username or email may already be taken.';
            showStatus('error', detail);
        } finally {
            setIsLoading(false);
        }
    }, [formData, validateCreateForm, fetchTrainers, showStatus]);

    // ---------------------------------------------------------------------------
    // Delete Trainer
    // ---------------------------------------------------------------------------
    const handleDelete = useCallback(async (id, name) => {
        if (!window.confirm(`Are you sure you want to remove ${name}?`)) return;
        try {
            await api.delete(`/manage-trainers/${id}/`);
            setTrainers(prev => prev.filter(t => t.id !== id));
            showStatus('success', `${name} has been removed.`);
        } catch {
            showStatus('error', 'Failed to delete trainer. They may have active assignments.');
        }
    }, [showStatus]);

    // ---------------------------------------------------------------------------
    // Edit Trainer
    // ---------------------------------------------------------------------------
    const startEdit = useCallback((trainer) => {
        setEditingId(trainer.id);
        setEditData({
            username:   trainer.username,
            first_name: trainer.first_name || '',
            email:      trainer.email || '',
            password:   '',
        });
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingId(null);
        setEditData({ username: '', first_name: '', email: '', password: '' });
    }, []);

    const saveEdit = useCallback(async (id) => {
        if (!editData.username.trim()) {
            showStatus('error', 'Username cannot be empty.');
            return;
        }
        if (editData.password && editData.password.length < 8) {
            showStatus('error', 'New password must be at least 8 characters.');
            return;
        }

        setIsSavingEdit(true);
        try {
            const payload = {
                username:   editData.username.trim(),
                first_name: editData.first_name.trim(),
                email:      editData.email.trim(),
            };
            if (editData.password.length > 0) payload.password = editData.password;

            const res = await api.patch(`/manage-trainers/${id}/`, payload);
            setTrainers(prev => prev.map(t => t.id === id ? { ...t, ...res.data } : t));
            setEditingId(null);
            showStatus('success', 'Trainer updated successfully.');
        } catch (error) {
            const detail = error.response?.data?.username?.[0]
                || error.response?.data?.email?.[0]
                || error.response?.data?.password?.[0]
                || 'Error updating trainer.';
            showStatus('error', detail);
        } finally {
            setIsSavingEdit(false);
        }
    }, [editData, showStatus]);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    return (
        <div className="text-zinc-900 dark:text-white w-full py-6 lg:py-8 transition-colors duration-300">
        <div className="max-w-[1600px] mx-auto space-y-12">

                {/* Page Header */}
                <div>
                    <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
                    <p className="text-zinc-500">Manage staff access and system settings.</p>
                </div>

                {/* Global Status Banner */}
                {status.message && (
                    <div className={`p-4 rounded-2xl flex items-center gap-3 border ${status.type === 'success'
                        ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'}`}
                    >
                        {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <span className="text-sm font-medium flex-1">{status.message}</span>
                        <button onClick={() => setStatus({ type: '', message: '' })} className="shrink-0 opacity-60 hover:opacity-100">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Create Trainer Form */}
                <div className="bg-zinc-50 dark:bg-zinc-900/50 backdrop-blur-md border border-zinc-300 dark:border-white/5 rounded-3xl p-8 shadow-xl transition-colors duration-300">
                    <div className="flex items-center gap-5 mb-8 border-b border-zinc-200 dark:border-white/5 pb-8">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-500 border border-orange-500/20 shrink-0">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Register New Trainer</h2>
                            <p className="text-zinc-500 text-sm">Create credentials for new gym staff.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
                        {/* Full Name */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1 ml-1">Full Name</label>
                            <input
                                className={`w-full bg-zinc-100 dark:bg-black/40 border rounded-xl p-4 text-zinc-900 dark:text-white focus:border-orange-500 outline-none transition-colors ${formErrors.first_name ? 'border-red-500' : 'border-zinc-300 dark:border-white/10'}`}
                                onChange={(e) => { setFormData({ ...formData, first_name: e.target.value }); setFormErrors(prev => ({ ...prev, first_name: '' })); }}
                                value={formData.first_name}
                                placeholder="e.g. John Doe"
                            />
                            {formErrors.first_name && <p className="text-red-500 text-xs ml-1">{formErrors.first_name}</p>}
                        </div>

                        {/* Username */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1 ml-1">Username</label>
                            <input
                                className={`w-full bg-zinc-100 dark:bg-black/40 border rounded-xl p-4 text-zinc-900 dark:text-white focus:border-orange-500 outline-none transition-colors ${formErrors.username ? 'border-red-500' : 'border-zinc-300 dark:border-white/10'}`}
                                onChange={(e) => { setFormData({ ...formData, username: e.target.value }); setFormErrors(prev => ({ ...prev, username: '' })); }}
                                value={formData.username}
                                placeholder="TrainerUser"
                            />
                            {formErrors.username && <p className="text-red-500 text-xs ml-1">{formErrors.username}</p>}
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1 ml-1">Email</label>
                            <input
                                className={`w-full bg-zinc-100 dark:bg-black/40 border rounded-xl p-4 text-zinc-900 dark:text-white focus:border-orange-500 outline-none transition-colors ${formErrors.email ? 'border-red-500' : 'border-zinc-300 dark:border-white/10'}`}
                                type="email"
                                onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setFormErrors(prev => ({ ...prev, email: '' })); }}
                                value={formData.email}
                                placeholder="email@gym.com"
                            />
                            {formErrors.email && <p className="text-red-500 text-xs ml-1">{formErrors.email}</p>}
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1 ml-1">Password</label>
                            <input
                                className={`w-full bg-zinc-100 dark:bg-black/40 border rounded-xl p-4 text-zinc-900 dark:text-white focus:border-orange-500 outline-none transition-colors ${formErrors.password ? 'border-red-500' : 'border-zinc-300 dark:border-white/10'}`}
                                type="password"
                                onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setFormErrors(prev => ({ ...prev, password: '' })); }}
                                value={formData.password}
                                placeholder="Min. 8 characters"
                            />
                            {formErrors.password && <p className="text-red-500 text-xs ml-1">{formErrors.password}</p>}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="md:col-span-2 lg:col-span-4 bg-zinc-900 dark:bg-white text-white dark:text-black font-bold py-4 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:pointer-events-none"
                        >
                            {isLoading
                                ? <><Loader2 size={20} className="animate-spin" /> Creating Account...</>
                                : <><UserPlus size={20} /> Create Account</>
                            }
                        </button>
                    </form>
                </div>

                {/* Trainers List */}
                <div>
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                        <User size={24} className="text-orange-500" /> Current Staff Team
                        <span className="text-sm font-medium text-zinc-500 bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                            {trainers.length}
                        </span>
                    </h2>

                    {loadingTrainers ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {[...Array(3)].map((_, i) => <TrainerCardSkeleton key={i} />)}
                        </div>
                    ) : trainers.length === 0 ? (
                        <div className="border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl p-16 flex flex-col items-center gap-3 text-zinc-400">
                            <User size={40} className="opacity-30" />
                            <p className="font-medium">No trainers registered yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {trainers.map((trainer) => (
                                <div
                                    key={trainer.id}
                                    className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-5 rounded-2xl flex items-start justify-between group hover:border-orange-400 dark:hover:border-zinc-700 transition-all shadow-sm gap-4"
                                >
                                    {editingId === trainer.id ? (
                                        /* Edit Mode */
                                        <div className="flex-1 space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <input
                                                    value={editData.first_name}
                                                    onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                                                    className="bg-zinc-100 dark:bg-black border border-orange-500/50 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none w-full"
                                                    placeholder="Full Name"
                                                />
                                                <input
                                                    value={editData.username}
                                                    onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                                                    className="bg-zinc-100 dark:bg-black border border-orange-500/50 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none w-full"
                                                    placeholder="Username"
                                                />
                                            </div>
                                            <input
                                                value={editData.email}
                                                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                                className="bg-zinc-100 dark:bg-black border border-orange-500/50 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none w-full"
                                                placeholder="Email"
                                                type="email"
                                            />
                                            <input
                                                type="password"
                                                value={editData.password}
                                                onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                                                className="bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-orange-500 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none w-full"
                                                placeholder="New Password (leave blank to keep)"
                                            />
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    onClick={() => saveEdit(trainer.id)}
                                                    disabled={isSavingEdit}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-500/10 text-green-600 dark:text-green-500 rounded-lg hover:bg-green-500/20 transition-colors text-sm font-bold disabled:opacity-60"
                                                >
                                                    {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                    {isSavingEdit ? 'Saving...' : 'Save'}
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    disabled={isSavingEdit}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-sm font-bold"
                                                >
                                                    <X size={14} /> Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* View Mode */
                                        <>
                                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                                <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-bold border border-zinc-300 dark:border-zinc-700 shrink-0 text-sm">
                                                    {(trainer.first_name || trainer.username)[0].toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-bold text-zinc-900 dark:text-white truncate">
                                                        {trainer.first_name || trainer.username}
                                                    </h3>
                                                    <p className="text-zinc-500 text-xs truncate">
                                                        @{trainer.username} • {trainer.email || 'No email'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => startEdit(trainer)}
                                                    className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(trainer.id, trainer.first_name || trainer.username)}
                                                    className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminTrainers;