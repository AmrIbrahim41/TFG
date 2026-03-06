import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, User, Phone, Hash, Loader2, Camera, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api';
// IMPORTANT: BASE_URL is NOT imported here.
// The backend returns full absolute URIs for all photo fields.
// Using photo_url directly without any prepending is correct.
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Skeleton card for the loading state
// ---------------------------------------------------------------------------
const ClientCardSkeleton = () => (
    <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-4 animate-pulse">
        <div className="flex items-center gap-4">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
            <div className="flex-1 space-y-3">
                <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-3/4" />
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-1/2" />
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-2/3" />
            </div>
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const Clients = () => {
    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [nextPage, setNextPage] = useState(null);
    const [prevPage, setPrevPage] = useState(null);
    const [formData, setFormData] = useState({ name: '', manual_id: '', phone: '', photo: null });
    const [previewUrl, setPreviewUrl] = useState(null);
    const [fetchError, setFetchError] = useState(null);
    const searchDebounceRef = useRef(null);

    // FIX #9: Used to prevent the debounce effect from firing on initial mount.
    // Without this guard, both the initial-load effect and the debounce effect
    // fired immediately on mount, sending two identical API requests.
    const isFirstRender = useRef(true);

    // ---------------------------------------------------------------------------
    // Fetch clients — supports pagination URL overrides and search queries
    // ---------------------------------------------------------------------------
    const fetchClients = useCallback(async (urlOverride = null, query = '') => {
        setLoading(true);
        setFetchError(null);
        let cancelled = false;
        try {
            let url;
            if (urlOverride) {
                const urlObj = new URL(urlOverride);
                if (!urlObj.searchParams.has('is_child')) {
                    urlObj.searchParams.append('is_child', 'false');
                }
                url = `/clients/${urlObj.search}`;
            } else {
                const queryParams = new URLSearchParams();
                queryParams.append('is_child', 'false');
                if (query) queryParams.append('search', query);
                url = `/clients/?${queryParams.toString()}`;
            }
            const response = await api.get(url);
            if (cancelled) return;
            if (response.data.results) {
                setClients(response.data.results);
                setNextPage(response.data.next);
                setPrevPage(response.data.previous);
            } else {
                setClients(response.data);
            }
        } catch (error) {
            if (!cancelled) {
                console.error('Failed to fetch clients:', error);
                setFetchError('Failed to load athletes. Please try again.');
            }
        } finally {
            if (!cancelled) setLoading(false);
        }
        // FIX #10: Return the cleanup function so React can call it on unmount.
        // Previously fetchClients returned this function but the initial-load
        // useEffect below didn't propagate the return value to React, meaning
        // a fast navigation away (before the response arrived) would still
        // attempt setState on an unmounted component and trigger a React warning.
        return () => { cancelled = true; };
    }, []);

    // Initial load
    // FIX #10: Return the cleanup so React cancels any in-flight request on unmount.
    useEffect(() => {
        return fetchClients();
    }, [fetchClients]);

    // Debounced search — clears previous timeout on every keystroke
    // FIX #9: Skip on first render. The initial-load effect above already
    // fetches on mount. Without this guard, both effects fired simultaneously,
    // causing two identical GET /clients/?is_child=false requests every time
    // the component mounted.
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            fetchClients(null, searchQuery);
        }, 500);
        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
    }, [searchQuery, fetchClients]);

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------
    const handleFileChange = useCallback((e) => {
        const file = e.target.files[0];
        if (!file) return;
        // Revoke previous object URL to prevent memory leaks
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setFormData(prev => ({ ...prev, photo: file }));
        setPreviewUrl(URL.createObjectURL(file));
    }, [previewUrl]);

    // Clean up object URL when modal closes
    const handleCloseModal = useCallback(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setIsModalOpen(false);
        setFormData({ name: '', manual_id: '', phone: '', photo: null });
        setPreviewUrl(null);
    }, [previewUrl]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();

        // Frontend validation
        if (!formData.name.trim()) {
            toast.error('Full name is required.');
            return;
        }
        if (!formData.manual_id.trim()) {
            toast.error('ID number is required.');
            return;
        }
        if (!formData.phone.trim()) {
            toast.error('Phone number is required.');
            return;
        }

        setIsSaving(true);
        try {
            const data = new FormData();
            data.append('name', formData.name.trim());
            data.append('manual_id', formData.manual_id.trim());
            data.append('phone', formData.phone.trim());
            if (formData.photo) data.append('photo', formData.photo);

            await api.post('/clients/', data, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success('Athlete profile created!');
            fetchClients(null, searchQuery);
            handleCloseModal();
        } catch (error) {
            const detail = error.response?.data?.manual_id?.[0]
                || error.response?.data?.phone?.[0]
                || 'Error creating client. Check that the ID is unique.';
            toast.error(detail);
        } finally {
            setIsSaving(false);
        }
    }, [formData, fetchClients, handleCloseModal, searchQuery]);

    const handlePrev = useCallback(() => { if (prevPage) fetchClients(prevPage); }, [prevPage, fetchClients]);
    const handleNext = useCallback(() => { if (nextPage) fetchClients(nextPage); }, [nextPage, fetchClients]);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    return (
        <div className="p-6 md:p-10 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">Athletes</h1>
                    <p className="text-zinc-500 font-medium">Manage your team and their progress.</p>
                </div>

                <div className="flex-1 md:mx-6 w-full md:w-auto">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-zinc-400 group-focus-within:text-orange-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-3 py-4 border border-zinc-300 dark:border-zinc-800 rounded-2xl leading-5 bg-white dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 sm:text-sm transition-all shadow-sm"
                            placeholder="Search by name, ID, or phone..."
                        />
                    </div>
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="group flex items-center justify-center gap-3 bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-4 rounded-2xl font-bold hover:bg-orange-600 dark:hover:bg-orange-500 hover:text-white dark:hover:text-white transition-all duration-300 shadow-xl shadow-zinc-900/10 dark:shadow-white/5 hover:shadow-orange-500/20 active:scale-95 whitespace-nowrap"
                >
                    <div className="bg-white/10 dark:bg-black/10 group-hover:bg-white/20 p-1 rounded-lg transition-colors">
                        <Plus size={18} strokeWidth={3} />
                    </div>
                    <span>Add New Athlete</span>
                </button>
            </div>

            {/* Error Banner */}
            {fetchError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-between gap-4">
                    <span className="text-sm font-medium">{fetchError}</span>
                    <button
                        onClick={() => fetchClients(null, searchQuery)}
                        className="text-xs font-bold underline underline-offset-2 shrink-0"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Grid */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                    {[...Array(8)].map((_, i) => <ClientCardSkeleton key={i} />)}
                </div>
            ) : clients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                    <User size={48} className="mb-4 opacity-20" />
                    <p className="font-medium">No athletes found.</p>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="mt-4 text-sm text-orange-500 hover:text-orange-600 font-bold"
                        >
                            Clear search
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                        {clients.map((client) => (
                            <div
                                key={client.id}
                                onClick={() => navigate(`/clients/${client.id}`)}
                                className="group relative bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/80 rounded-3xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-2xl hover:shadow-orange-500/10 dark:hover:shadow-orange-900/10 cursor-pointer shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative shrink-0">
                                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 overflow-hidden shadow-inner relative z-10">
                                            {/* Backend returns absolute URI — use directly */}
                                            {client.photo_url ? (
                                                <img
                                                    src={client.photo_url}
                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                    alt={client.name}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-600">
                                                    <User size={32} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors flex items-center gap-2 flex-wrap">
                                            <span className="truncate">{client.name}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${client.is_subscribed ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-500 border-green-200 dark:border-green-500/20' : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500 border-red-200 dark:border-red-500/20'}`}>
                                                {client.is_subscribed ? 'Active' : 'Inactive'}
                                            </span>
                                        </h3>
                                        <div className="mt-2 space-y-1.5">
                                            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs md:text-sm">
                                                <Hash size={12} strokeWidth={2.5} />
                                                <span className="font-mono tracking-wider">{client.manual_id}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs md:text-sm">
                                                <Phone size={12} strokeWidth={2.5} />
                                                <span className="truncate">{client.phone}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-center items-center gap-4 mt-12 mb-4">
                        <button
                            onClick={handlePrev}
                            disabled={!prevPage}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <ChevronLeft size={18} /> Previous
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={!nextPage}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            Next <ChevronRight size={18} />
                        </button>
                    </div>
                </>
            )}

            {/* Create Athlete Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center p-0 md:p-4">
                    <div
                        className="absolute inset-0 bg-black/60 dark:bg-zinc-950/60 backdrop-blur-xl transition-opacity"
                        onClick={handleCloseModal}
                    />
                    <div className="relative w-full max-w-lg bg-zinc-50 dark:bg-[#121214] md:border border-zinc-300 dark:border-zinc-800 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200 transition-colors">
                        <div className="px-8 py-6 border-b border-zinc-200 dark:border-zinc-800/50 flex items-center justify-between bg-zinc-200/50 dark:bg-zinc-900/30">
                            <h2 className="text-xl font-black text-zinc-900 dark:text-white">New Athlete Profile</h2>
                            <button
                                onClick={handleCloseModal}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                            {/* Photo Upload */}
                            <div className="flex justify-center">
                                <div className="relative group cursor-pointer">
                                    <div className={`w-28 h-28 md:w-32 md:h-32 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden transition-all duration-300 ${previewUrl ? 'border-orange-500 bg-black' : 'border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900/50 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}>
                                        {previewUrl
                                            ? <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                                            : (
                                                <div className="flex flex-col items-center gap-2 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                                                    <Camera size={24} />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider">Add Photo</span>
                                                </div>
                                            )
                                        }
                                    </div>
                                    <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </div>
                            </div>

                            {/* Fields */}
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Full Name</label>
                                    <input
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl px-4 py-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700 transition-all outline-none"
                                        placeholder="e.g. Amr Hisham"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">ID Number</label>
                                        <input
                                            required
                                            value={formData.manual_id}
                                            onChange={e => setFormData({ ...formData, manual_id: e.target.value })}
                                            className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl px-4 py-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700 font-mono transition-all outline-none"
                                            placeholder="e.g. 1024"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Phone</label>
                                        <input
                                            required
                                            type="tel"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl px-4 py-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700 transition-all outline-none"
                                            placeholder="010..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-orange-500/20 dark:shadow-orange-900/20 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
                            >
                                {isSaving ? <><Loader2 size={20} className="animate-spin" /> Creating...</> : 'Create Profile'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Clients;