import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    User, Plus, Search, Loader2, Baby, ArrowRight, Sparkles, 
    Hash, ChevronLeft, ChevronRight 
} from 'lucide-react';
import api, { BASE_URL } from '../../api';

const ChildrenProfiles = () => {
    const navigate = useNavigate();
    const [children, setChildren] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // --- PAGINATION STATE ---
    const [nextPage, setNextPage] = useState(null);
    const [prevPage, setPrevPage] = useState(null);

    // Add Child Form State
    const [newChild, setNewChild] = useState({
        name: '', manual_id: '', phone: '', photo: null
    });

    useEffect(() => {
        fetchChildren();
    }, [searchTerm]); 

    const fetchChildren = async (urlOverride = null) => {
        setLoading(true);
        try {
            let url;
            if (urlOverride) {
                const urlObj = new URL(urlOverride);
                if (!urlObj.searchParams.has('is_child')) {
                    urlObj.searchParams.append('is_child', 'true');
                }
                url = `/clients/${urlObj.search}`;
            } else {
                let queryParams = new URLSearchParams();
                queryParams.append('is_child', 'true');
                if (searchTerm) queryParams.append('search', searchTerm);
                url = `/clients/?${queryParams.toString()}`;
            }
            
            const res = await api.get(url);
            if (res.data.results) {
                setChildren(res.data.results);
                setNextPage(res.data.next);
                setPrevPage(res.data.previous);
            } else {
                setChildren(res.data);
            }
        } catch (error) {
            console.error("Error fetching children", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddChild = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('name', newChild.name);
        formData.append('manual_id', newChild.manual_id);
        formData.append('phone', newChild.phone);
        formData.append('is_child', 'true'); 
        if (newChild.photo) formData.append('photo', newChild.photo);

        try {
            await api.post('/clients/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setIsModalOpen(false);
            setNewChild({ name: '', manual_id: '', phone: '', photo: null });
            fetchChildren();
        } catch (error) {
            alert("Error adding child. ID might be duplicate.");
        }
    };

    const getImageUrl = (path) => path ? (path.startsWith('http') ? path : `${BASE_URL}${path}`) : null;

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Search & Add Button */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="relative group max-w-2xl w-full md:w-auto flex-1">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input 
                        type="text" 
                        placeholder="Search child by name or ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="
                            block w-full pl-12 pr-4 py-4 
                            bg-zinc-200 dark:bg-zinc-900/50 
                            border border-zinc-300 dark:border-zinc-800 
                            rounded-2xl 
                            text-zinc-900 dark:text-zinc-200 
                            placeholder-zinc-500 
                            focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 
                            transition-all
                        "
                    />
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="group bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white dark:hover:text-white font-bold py-4 px-8 rounded-2xl flex items-center gap-3 transition-all shadow-xl shadow-zinc-400/20 dark:shadow-white/5 hover:shadow-blue-500/20 active:scale-95 whitespace-nowrap"
                >
                    <Plus size={20} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" /> 
                    <span>Add New Child</span>
                </button>
            </div>

            {/* Cards Grid */}
            {loading ? (
                <div className="flex justify-center py-32"><Loader2 className="animate-spin text-blue-500 w-10 h-10" /></div>
            ) : children.length === 0 ? (
                <div className="py-20 text-center space-y-4 bg-zinc-100 dark:bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800">
                    <div className="w-20 h-20 bg-zinc-200 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto text-zinc-500 dark:text-zinc-600">
                        <Baby size={32} />
                    </div>
                    <p className="text-zinc-500 font-medium">No children accounts found.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {children.map(child => (
                            <div 
                                key={child.id}
                                onClick={() => navigate(`/children/${child.id}`)}
                                className="
                                    group relative 
                                    bg-zinc-50 dark:bg-[#121214] 
                                    border border-zinc-300 dark:border-zinc-800/80 
                                    rounded-[2rem] p-6 
                                    hover:border-blue-500/30 
                                    cursor-pointer transition-all duration-300 
                                    hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-900/10 
                                    overflow-hidden
                                "
                            >
                                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative z-10 flex items-start gap-5">
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-2xl bg-zinc-200 dark:bg-zinc-900 overflow-hidden border-2 border-zinc-300 dark:border-zinc-800 group-hover:border-blue-500/50 transition-colors shadow-lg">
                                            {child.photo_url ? (
                                                <img src={getImageUrl(child.photo_url)} alt={child.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-zinc-500 dark:text-zinc-600 bg-zinc-200 dark:bg-zinc-800"><User size={28} /></div>
                                            )}
                                        </div>
                                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-[3px] border-zinc-50 dark:border-[#121214] ${child.is_subscribed ? 'bg-green-500' : 'bg-zinc-400 dark:bg-zinc-600'}`} />
                                    </div>
                                    <div className="flex-1 space-y-1 pt-1">
                                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{child.name}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-zinc-200 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 text-xs font-mono px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-800 flex items-center gap-1"><Hash size={10} /> {child.manual_id}</span>
                                            {child.age && <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold px-2 py-1 rounded-lg border border-blue-500/20">{child.age} Years</span>}
                                        </div>
                                    </div>
                                    <div className="h-full flex items-center justify-center">
                                        <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 dark:text-zinc-500 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300"><ArrowRight size={18} /></div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800/50 flex items-center justify-between text-xs font-medium text-zinc-500">
                                    <span>Joined: {new Date(child.created_at).toLocaleDateString()}</span>
                                    <span className={child.is_subscribed ? "text-green-600 dark:text-green-500" : "text-zinc-500 dark:text-zinc-600"}>{child.is_subscribed ? "Active Member" : "No Active Plan"}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Pagination */}
                    <div className="flex justify-center items-center gap-4 mt-12 mb-4">
                        <button onClick={() => fetchChildren(prevPage)} disabled={!prevPage} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronLeft size={18} /> Previous</button>
                        <button onClick={() => fetchChildren(nextPage)} disabled={!nextPage} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">Next <ChevronRight size={18} /></button>
                    </div>
                </>
            )}

            {/* Add Child Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden">
                        <div className="relative z-10 mb-6">
                            <h2 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2"><Sparkles className="text-blue-500" size={24} /> New Child Profile</h2>
                            <p className="text-zinc-500 text-sm mt-1">Create a dedicated account for a junior athlete.</p>
                        </div>
                        <form onSubmit={handleAddChild} className="space-y-5 relative z-10">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Full Name</label>
                                <input required className="w-full bg-zinc-200 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none focus:border-blue-500 transition-all" placeholder="e.g. Aly Ahmed" value={newChild.name} onChange={e => setNewChild({...newChild, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Manual ID</label>
                                    <input required className="w-full bg-zinc-200 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none focus:border-blue-500 transition-all font-mono" placeholder="1024" value={newChild.manual_id} onChange={e => setNewChild({...newChild, manual_id: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Parent Phone</label>
                                    <input required className="w-full bg-zinc-200 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none focus:border-blue-500 transition-all" placeholder="010..." value={newChild.phone} onChange={e => setNewChild({...newChild, phone: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Photo (Optional)</label>
                                <input type="file" className="w-full bg-zinc-200 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 file:bg-zinc-300 dark:file:bg-zinc-800 file:text-zinc-700 dark:file:text-zinc-300 file:border-0 hover:file:bg-zinc-400 dark:hover:file:bg-zinc-700 transition-all" onChange={e => setNewChild({...newChild, photo: e.target.files[0]})} />
                            </div>
                            <div className="flex gap-3 mt-8">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-zinc-200 dark:bg-zinc-900 hover:bg-zinc-300 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white py-3.5 rounded-xl font-bold transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95">Create Account</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChildrenProfiles;