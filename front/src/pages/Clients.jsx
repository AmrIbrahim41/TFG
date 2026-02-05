import React, { useState, useEffect } from 'react';
import { Plus, X, User, Phone, Hash, Loader2, Camera, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import api, { BASE_URL } from '../api';
import { useNavigate } from 'react-router-dom';

const Clients = () => {
    const navigate = useNavigate();
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Search & Pagination State
    const [searchQuery, setSearchQuery] = useState('');
    const [nextPage, setNextPage] = useState(null);
    const [prevPage, setPrevPage] = useState(null);

    // Form State
    const [formData, setFormData] = useState({ name: '', manual_id: '', phone: '', photo: null });
    const [previewUrl, setPreviewUrl] = useState(null);

    // --- UPDATED FETCH FUNCTION (Strictly Excludes Children) ---
    const fetchClients = async (urlOverride = null, query = '') => {
        setLoading(true);
        try {
            let url;

            if (urlOverride) {
                // If using a pagination link (Next/Prev), we parse it to ensure is_child=false is preserved
                // This prevents the API from reverting to showing all clients on page 2
                const urlObj = new URL(urlOverride);
                
                // Ensure 'is_child' param is always present and set to false
                if (!urlObj.searchParams.has('is_child')) {
                    urlObj.searchParams.append('is_child', 'false');
                }
                
                // Use the relative path + search params
                url = `/clients/${urlObj.search}`;
            } else {
                // Default / Search behavior
                // We manually construct the query string to include is_child=false
                const queryParams = new URLSearchParams();
                queryParams.append('is_child', 'false'); // <--- CRITICAL FILTER
                
                if (query) {
                    queryParams.append('search', query);
                }
                
                url = `/clients/?${queryParams.toString()}`;
            }

            const response = await api.get(url);

            if (response.data.results) {
                setClients(response.data.results);
                setNextPage(response.data.next);
                setPrevPage(response.data.previous);
            } else {
                setClients(response.data);
            }

        } catch (error) {
            console.error("Failed to fetch clients:", error);
        } finally {
            setLoading(false);
        }
    };

    // 1. Initial Load
    useEffect(() => {
        fetchClients();
    }, []);

    // 2. Search Debounce: Wait 500ms after typing stops before calling API
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            // When searching, reset to page 1 (urlOverride = null)
            fetchClients(null, searchQuery);
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);


    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({ ...prev, photo: file }));
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const data = new FormData();
        data.append('name', formData.name);
        data.append('manual_id', formData.manual_id);
        data.append('phone', formData.phone);
        // We do NOT append 'is_child' here, defaulting to False (Adult) in the backend model
        if (formData.photo) data.append('photo', formData.photo);

        try {
            await api.post('/clients/', data, { headers: { 'Content-Type': 'multipart/form-data' } });
            fetchClients(null, searchQuery); // Refresh list
            setIsModalOpen(false);
            setFormData({ name: '', manual_id: '', phone: '', photo: null });
            setPreviewUrl(null);
        } catch (error) {
            alert("Error creating client. Check ID uniqueness.");
        }
    };

    const getImageUrl = (path) => path ? (path.startsWith('http') ? path : `${BASE_URL}${path}`) : null;

    return (
        <div className="min-h-screen bg-zinc-100 dark:bg-[#09090b] text-zinc-900 dark:text-white p-4 md:p-8 lg:pl-80 pt-24 lg:pt-8 transition-colors duration-300">

            {/* --- Header --- */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">
                        Athletes
                    </h1>
                    <p className="text-zinc-500 font-medium">Manage your team and their progress.</p>
                </div>

                {/* --- SEARCH INPUT --- */}
                <div className="flex-1 md:mx-6 w-full md:w-auto">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-zinc-400 group-focus-within:text-orange-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            // Search input: bg-zinc-50 (not white), border-zinc-300
                            className="block w-full pl-10 pr-3 py-4 border border-zinc-300 dark:border-zinc-800 rounded-2xl leading-5 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 sm:text-sm transition-all shadow-xl dark:shadow-none"
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

            {/* --- Grid --- */}
            {loading ? (
                <div className="flex justify-center py-32">
                    <Loader2 className="animate-spin text-orange-500 w-10 h-10" />
                </div>
            ) : clients.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
                    <User size={48} className="mb-4 opacity-20" />
                    <p>No athletes found.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                        {clients.map((client) => (
                            <div
                                key={client.id}
                                onClick={() => navigate(`/clients/${client.id}`)}
                                // Client Card: bg-zinc-50, border-zinc-300
                                className="group relative bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-300 dark:border-zinc-800/60 hover:border-orange-500/50 hover:bg-zinc-200 dark:hover:bg-zinc-900/80 rounded-3xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-2xl hover:shadow-orange-500/10 dark:hover:shadow-orange-900/10 cursor-pointer shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    {/* Avatar */}
                                    <div className="relative">
                                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700/50 overflow-hidden shadow-inner relative z-10">
                                            {client.photo_url ? (
                                                <img src={getImageUrl(client.photo_url)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={client.name} />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-600 bg-zinc-200 dark:bg-zinc-800">
                                                    <User size={32} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white truncate group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors flex items-center gap-2">
                                            {client.name}
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${client.is_subscribed ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-500 border-green-200 dark:border-green-500/20' : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500 border-red-200 dark:border-red-500/20'}`}>
                                                {client.is_subscribed ? 'Active' : 'Inactive'}
                                            </span>
                                        </h3>

                                        <div className="mt-2 space-y-1.5">
                                            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs md:text-sm">
                                                <div className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 group-hover:border-orange-500/30 group-hover:text-orange-500 transition-colors">
                                                    <Hash size={12} strokeWidth={2.5} />
                                                </div>
                                                <span className="font-mono tracking-wider">{client.manual_id}</span>
                                            </div>

                                            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs md:text-sm">
                                                <div className="w-6 h-6 rounded-lg bg-zinc-200 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 group-hover:border-orange-500/30 group-hover:text-orange-500 transition-colors">
                                                    <Phone size={12} strokeWidth={2.5} />
                                                </div>
                                                <span className="truncate">{client.phone}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* --- Pagination Controls --- */}
                    <div className="flex justify-center items-center gap-4 mt-12 mb-4">
                        <button
                            onClick={() => fetchClients(prevPage)}
                            disabled={!prevPage}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-zinc-50 dark:disabled:hover:bg-zinc-900 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <ChevronLeft size={18} />
                            Previous
                        </button>

                        <button
                            onClick={() => fetchClients(nextPage)}
                            disabled={!nextPage}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-zinc-50 dark:disabled:hover:bg-zinc-900 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            Next
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </>
            )}

            {/* --- Modal --- */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[150] flex items-end md:items-center justify-center p-0 md:p-4">
                    <div className="absolute inset-0 bg-black/60 dark:bg-zinc-950/60 backdrop-blur-xl transition-opacity" onClick={() => setIsModalOpen(false)} />
                    {/* Modal: bg-zinc-50, border-zinc-300 */}
                    <div className="relative w-full max-w-lg bg-zinc-50 dark:bg-[#121214] md:border border-zinc-300 dark:border-zinc-800 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200 transition-colors">
                        <div className="px-8 py-6 border-b border-zinc-200 dark:border-zinc-800/50 flex items-center justify-between bg-zinc-200/50 dark:bg-zinc-900/30">
                            <h2 className="text-xl font-black text-zinc-900 dark:text-white">New Athlete Profile</h2>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                            <div className="flex justify-center">
                                <div className="relative group cursor-pointer">
                                    <div className={`w-28 h-28 md:w-32 md:h-32 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden transition-all duration-300 ${previewUrl ? 'border-orange-500 bg-black' : 'border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900/50 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}>
                                        {previewUrl ? <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" /> : (
                                            <div className="flex flex-col items-center gap-2 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors"><Camera size={24} /><span className="text-[10px] font-bold uppercase tracking-wider">Add Photo</span></div>
                                        )}
                                    </div>
                                    <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1.5"><label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Full Name</label><input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl px-4 py-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700 transition-all outline-none" placeholder="e.g. Amr Hisham" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5"><label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">ID Number</label><input required value={formData.manual_id} onChange={e => setFormData({ ...formData, manual_id: e.target.value })} className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl px-4 py-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700 font-mono transition-all outline-none" placeholder="e.g. 1024" /></div>
                                    <div className="space-y-1.5"><label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Phone</label><input required type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl px-4 py-4 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700 transition-all outline-none" placeholder="010..." /></div>
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-orange-500/20 dark:shadow-orange-900/20 transition-all active:scale-[0.98] mt-4">Create Profile</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Clients;