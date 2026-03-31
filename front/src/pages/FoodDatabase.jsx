import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Plus, Search, Trash2, Database,
    X, Save, Edit2, Loader2
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Shared Input Component
// ---------------------------------------------------------------------------
const ModernInput = ({ label, value, onChange, type = 'text', placeholder, suffix }) => (
    <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 p-3 rounded-2xl relative focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:border-orange-500 transition-all group">
        <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block tracking-wider group-focus-within:text-orange-500 transition-colors">
            {label}
        </label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            min={type === 'number' ? '0' : undefined}
            className="w-full bg-transparent text-zinc-900 dark:text-white font-bold text-sm outline-none placeholder-zinc-400 dark:placeholder-zinc-700"
        />
        {suffix && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">{suffix}</span>
        )}
    </div>
);

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
const EmptyState = ({ query }) => (
    <div className="p-10 md:p-16 text-center text-zinc-400 dark:text-zinc-600 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl">
        <Database size={40} className="opacity-20 mb-3 mx-auto" />
        <p className="font-medium">{query ? `No results for "${query}"` : 'No food items yet.'}</p>
        {!query && <p className="text-sm mt-1">Click "Add New Item" to get started.</p>}
    </div>
);

// ---------------------------------------------------------------------------
// Skeleton row (desktop table)
// ---------------------------------------------------------------------------
const TableRowSkeleton = () => (
    <tr className="animate-pulse">
        {[...Array(7)].map((_, i) => (
            <td key={i} className="p-5">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
            </td>
        ))}
    </tr>
);

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------
const CATEGORIES = ['Protein', 'Carbs', 'Fats'];

const getCategoryColor = (cat) => {
    if (cat === 'Protein') return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (cat === 'Carbs')   return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    if (cat === 'Fats')    return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
};

const EMPTY_FORM = {
    name: '', arabic_name: '', category: 'Protein',
    calories_per_100g: '', protein_per_100g: '',
    carbs_per_100g: '', fats_per_100g: ''
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const FoodDatabase = () => {
    const [foods, setFoods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);

    // Pagination & Debounce States
    const [nextPage, setNextPage] = useState(null);
    const [prevPage, setPrevPage] = useState(null);
    const searchDebounceRef = useRef(null);
    const isFirstRender = useRef(true);

    // ---------------------------------------------------------------------------
    // Fetch — with Pagination & Server-side filtering
    // ---------------------------------------------------------------------------
    // ---------------------------------------------------------------------------
    // BUG #5 FIX: fetchFoods now accepts an AbortSignal so callers can cancel
    // in-flight requests cleanly.  The old pattern declared `cancelled = false`
    // inside the async body and returned `() => { cancelled = true }` as the
    // Promise's resolved value.  React's useEffect ignores Promise resolved
    // values entirely — it only reads the *synchronous* return of its callback —
    // so the flag was never flipped and state updates kept firing on unmounted
    // components, producing "Can't perform a React state update on an unmounted
    // component" warnings and potential stale-state bugs.
    //
    // BUG #6 FIX: DRF's PageNumberPagination returns absolute URLs for next /
    // previous (e.g. "https://api.example.com/api/food-database/?page=2").
    // Passing those directly to api.get() caused Axios to prepend the configured
    // baseURL a second time, building a double-prefixed path → 404.
    // Fix: parse the absolute URL with new URL(), extract only the query-string
    // portion (.search), and prefix it with the known relative path.
    // ---------------------------------------------------------------------------
    const fetchFoods = useCallback(async (urlOverride = null, query = '', category = 'All', signal = null) => {
        setLoading(true);
        try {
            let url;
            if (urlOverride) {
                // BUG #6 FIX: extract only the query-string from the absolute
                // pagination URL so Axios does not double-prepend the baseURL.
                const urlObj = new URL(urlOverride);
                url = `/food-database/${urlObj.search}`;
            } else {
                const params = new URLSearchParams();
                if (query) params.append('search', query);
                if (category !== 'All') params.append('category', category);
                url = `/food-database/?${params.toString()}`;
            }

            // BUG #5 FIX: pass the AbortSignal to Axios so the request is
            // cancelled when the component unmounts or a newer fetch supersedes it.
            const res = await api.get(url, { signal });

            if (res.data.results) {
                setFoods(res.data.results);
                setNextPage(res.data.next);
                setPrevPage(res.data.previous);
            } else {
                // Fallback in case pagination is disabled globally
                setFoods(res.data);
                setNextPage(null);
                setPrevPage(null);
            }
        } catch (error) {
            // BUG #5 FIX: intentional cancellations must be swallowed silently.
            // They fire on unmount or when a newer request aborts this one and
            // are not real errors — showing a toast here would be noise.
            if (
                error.name === 'AbortError'    ||  // native fetch / browser
                error.name === 'CanceledError' ||  // axios < 1.x
                error.code  === 'ERR_CANCELED'     // axios >= 1.x
            ) {
                return;
            }
            console.error(error);
            toast.error('Failed to load food database.');
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, []);

    // 1. Initial Load
    // BUG #5 FIX: controller.abort() is returned as the *synchronous* cleanup
    // function so React calls it on unmount, cancelling the in-flight request.
    useEffect(() => {
        const controller = new AbortController();
        fetchFoods(null, '', 'All', controller.signal);
        return () => controller.abort();
    }, [fetchFoods]);

    // 2. Search & Category Filter (Debounced)
    // BUG #5 FIX: the controller is created inside the debounce callback so we
    // can still abort it in the cleanup even after the timeout has fired.
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

        // Declared in the outer effect scope so the cleanup closure can reach
        // it whether the debounce fired or not.
        let controller = null;

        searchDebounceRef.current = setTimeout(() => {
            controller = new AbortController();
            fetchFoods(null, searchTerm, activeCategory, controller.signal);
        }, 500);

        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
            // If the debounce already fired and a request is in-flight, abort it.
            if (controller) controller.abort();
        };
    }, [searchTerm, activeCategory, fetchFoods]);

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------
    const openCreateModal = useCallback(() => {
        setEditingId(null);
        setFormData(EMPTY_FORM);
        setIsModalOpen(true);
    }, []);

    const openEditModal = useCallback((food) => {
        setEditingId(food.id);
        setFormData({
            name: food.name,
            arabic_name: food.arabic_name || '',
            category: food.category,
            calories_per_100g: food.calories_per_100g,
            protein_per_100g: food.protein_per_100g,
            carbs_per_100g: food.carbs_per_100g,
            fats_per_100g: food.fats_per_100g,
        });
        setIsModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData(EMPTY_FORM);
    }, []);

    const handleSave = useCallback(async () => {
        // Frontend validation
        if (!formData.name.trim()) {
            toast.error('Food name is required.');
            return;
        }
        if (!formData.calories_per_100g) {
            toast.error('Calories per 100g is required.');
            return;
        }
        const calories = parseInt(formData.calories_per_100g, 10);
        if (isNaN(calories) || calories < 0) {
            toast.error('Calories must be a non-negative number.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...formData,
                name: formData.name.trim(),
                arabic_name: formData.arabic_name.trim(),
                calories_per_100g: parseInt(formData.calories_per_100g, 10) || 0,
                protein_per_100g: parseFloat(formData.protein_per_100g) || 0,
                carbs_per_100g: parseFloat(formData.carbs_per_100g) || 0,
                fats_per_100g: parseFloat(formData.fats_per_100g) || 0,
            };

            if (editingId) {
                const res = await api.patch(`/food-database/${editingId}/`, payload);
                setFoods(prev => prev.map(f => f.id === editingId ? res.data : f));
                toast.success('Item updated successfully!');
            } else {
                const res = await api.post('/food-database/', payload);
                setFoods(prev => [res.data, ...prev]);
                toast.success('Item added to database!');
            }
            closeModal();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.name?.[0] || 'Error saving item. Please try again.');
        } finally {
            setIsSaving(false);
        }
    }, [formData, editingId, closeModal]);

    const handleDelete = useCallback(async (id, name) => {
        if (!window.confirm(`Delete "${name}" from the database?`)) return;
        try {
            await api.delete(`/food-database/${id}/`);
            setFoods(prev => prev.filter(f => f.id !== id));
            toast.success('Item deleted.');
        } catch (error) {
            toast.error('Error deleting item.');
        }
    }, []);

    const updateForm = useCallback((key, val) => {
        setFormData(prev => ({ ...prev, [key]: val }));
    }, []);

    // BUG #5 FIX (cont.): Pagination button handlers also get their own
    // AbortController so navigating quickly between pages cancels stale requests.
    const handlePrev = useCallback(() => {
        if (!prevPage) return;
        const controller = new AbortController();
        fetchFoods(prevPage, '', 'All', controller.signal);
    }, [prevPage, fetchFoods]);

    const handleNext = useCallback(() => {
        if (!nextPage) return;
        const controller = new AbortController();
        fetchFoods(nextPage, '', 'All', controller.signal);
    }, [nextPage, fetchFoods]);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    return (
        <div className="p-4 pt-20 md:p-6 lg:p-10 space-y-6 md:space-y-8 animate-in fade-in duration-300 w-full max-w-7xl mx-auto min-h-screen pb-24 md:pb-10">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500 border border-orange-500/20 shrink-0">
                        <Database size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white">Food Database</h1>
                        <p className="text-zinc-500 text-xs md:text-sm font-medium">Manage nutritional exchange list.</p>
                    </div>
                </div>
                <button
                    onClick={openCreateModal}
                    className="w-full md:w-auto group bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-orange-900/20 active:scale-95 flex items-center justify-center gap-2"
                >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    Add New Item
                </button>
            </div>

            {/* Controls & Search — sticky */}
            <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 p-3 md:p-4 rounded-3xl flex flex-col md:flex-row gap-4 items-center sticky top-20 lg:top-2 z-10 shadow-xl shadow-zinc-200/50 dark:shadow-black/50">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                        placeholder="Search ingredients..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-zinc-900 dark:text-white font-medium outline-none focus:border-orange-500 transition-colors text-sm"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 hide-scrollbar snap-x">
                    {['All', ...CATEGORIES].map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`snap-start px-4 md:px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border whitespace-nowrap shrink-0 ${activeCategory === cat
                                ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white'
                                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-300 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Count badge */}
            {!loading && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500 font-medium">
                        {foods.length} {foods.length === 1 ? 'item' : 'items'}
                        {activeCategory !== 'All' && ` in ${activeCategory}`}
                    </p>
                </div>
            )}

            {/* Desktop Table */}
            <div className="hidden md:block border border-zinc-300 dark:border-zinc-800 rounded-3xl overflow-hidden bg-zinc-50 dark:bg-[#121214]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-100/50 dark:bg-zinc-900/50 border-b border-zinc-300 dark:border-zinc-800 text-[10px] uppercase text-zinc-500 font-bold tracking-wider">
                                <th className="p-5">Food Name</th>
                                <th className="p-5">Category</th>
                                <th className="p-5 text-center">Calories <span className="text-zinc-400">/100g</span></th>
                                <th className="p-5 text-center text-red-500">Protein</th>
                                <th className="p-5 text-center text-blue-500">Carbs</th>
                                <th className="p-5 text-center text-yellow-500">Fats</th>
                                <th className="p-5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50">
                            {loading ? (
                                [...Array(6)].map((_, i) => <TableRowSkeleton key={i} />)
                            ) : foods.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-16 text-center text-zinc-500">
                                        <Database size={32} className="opacity-20 mb-2 mx-auto" />
                                        <p>{searchTerm ? `No results for "${searchTerm}"` : 'No items found.'}</p>
                                    </td>
                                </tr>
                            ) : (
                                foods.map(food => (
                                    <tr key={food.id} className="hover:bg-zinc-100 dark:hover:bg-zinc-900/40 transition-colors group">
                                        <td className="p-5">
                                            <div className="font-bold text-zinc-900 dark:text-white text-sm">{food.name}</div>
                                            {food.arabic_name && (
                                                <div className="text-zinc-400 text-xs mt-0.5 text-right font-medium">{food.arabic_name}</div>
                                            )}
                                        </td>
                                        <td className="p-5">
                                            <span className={`text-[10px] uppercase font-black px-3 py-1.5 rounded-lg border ${getCategoryColor(food.category)}`}>
                                                {food.category}
                                            </span>
                                        </td>
                                        <td className="p-5 text-center text-zinc-900 dark:text-white font-black">{food.calories_per_100g}</td>
                                        <td className="p-5 text-center text-zinc-500 dark:text-zinc-400 font-medium">{food.protein_per_100g}g</td>
                                        <td className="p-5 text-center text-zinc-500 dark:text-zinc-400 font-medium">{food.carbs_per_100g}g</td>
                                        <td className="p-5 text-center text-zinc-500 dark:text-zinc-400 font-medium">{food.fats_per_100g}g</td>
                                        <td className="p-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEditModal(food)}
                                                    className="p-2 bg-zinc-200 dark:bg-zinc-900 rounded-lg text-zinc-500 hover:text-blue-500 hover:bg-blue-500/10 transition-all"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(food.id, food.name)}
                                                    className="p-2 bg-zinc-200 dark:bg-zinc-900 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden grid grid-cols-1 gap-3">
                {loading ? (
                    [...Array(4)].map((_, i) => (
                        <div key={i} className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 p-4 rounded-2xl animate-pulse space-y-3">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <div className="w-40 h-5 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                                    <div className="w-20 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-9 h-9 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                                    <div className="w-9 h-9 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                                </div>
                            </div>
                            <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
                        </div>
                    ))
                ) : foods.length === 0 ? (
                    <EmptyState query={searchTerm} />
                ) : (
                    foods.map(food => (
                        <div key={food.id} className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 p-4 rounded-2xl space-y-3 shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-zinc-900 dark:text-white text-base leading-tight">{food.name}</h3>
                                    {food.arabic_name && (
                                        <p className="text-zinc-400 text-xs mt-0.5 text-right">{food.arabic_name}</p>
                                    )}
                                    <span className={`inline-block mt-1 text-[10px] uppercase font-black px-2 py-0.5 rounded border ${getCategoryColor(food.category)}`}>
                                        {food.category}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => openEditModal(food)}
                                        className="p-2 bg-zinc-200 dark:bg-zinc-900 rounded-lg text-zinc-400 hover:text-blue-400 transition-colors"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(food.id, food.name)}
                                        className="p-2 bg-zinc-200 dark:bg-zinc-900 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2 bg-zinc-100 dark:bg-black/20 rounded-xl p-2 border border-zinc-300 dark:border-zinc-800/50">
                                <div className="text-center">
                                    <div className="text-[9px] text-zinc-500 font-bold uppercase">Cal</div>
                                    <div className="text-zinc-900 dark:text-white font-black text-sm">{food.calories_per_100g}</div>
                                </div>
                                <div className="text-center relative">
                                    <div className="absolute left-0 top-2 bottom-2 w-px bg-zinc-300 dark:bg-zinc-800" />
                                    <div className="text-[9px] text-red-500/70 font-bold uppercase">Pro</div>
                                    <div className="text-zinc-500 dark:text-zinc-300 font-bold text-sm">{food.protein_per_100g}</div>
                                </div>
                                <div className="text-center relative">
                                    <div className="absolute left-0 top-2 bottom-2 w-px bg-zinc-300 dark:bg-zinc-800" />
                                    <div className="text-[9px] text-blue-500/70 font-bold uppercase">Carb</div>
                                    <div className="text-zinc-500 dark:text-zinc-300 font-bold text-sm">{food.carbs_per_100g}</div>
                                </div>
                                <div className="text-center relative">
                                    <div className="absolute left-0 top-2 bottom-2 w-px bg-zinc-300 dark:bg-zinc-800" />
                                    <div className="text-[9px] text-yellow-500/70 font-bold uppercase">Fat</div>
                                    <div className="text-zinc-500 dark:text-zinc-300 font-bold text-sm">{food.fats_per_100g}</div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            {!loading && foods.length > 0 && (
                <div className="flex justify-center items-center gap-4 mt-8 mb-4">
                    <button
                        onClick={handlePrev}
                        disabled={!prevPage}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        Previous
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={!nextPage}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-zinc-50 dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-800 rounded-3xl w-[95%] md:w-full max-w-lg shadow-2xl shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-300">

                        {/* Modal Header */}
                        <div className="p-5 md:p-6 border-b border-zinc-300 dark:border-zinc-800 flex justify-between items-center bg-zinc-100/50 dark:bg-zinc-900/50">
                            <h3 className="font-bold text-lg md:text-xl text-zinc-900 dark:text-white flex items-center gap-2">
                                {editingId
                                    ? <Edit2 size={20} className="text-blue-500" />
                                    : <Plus size={20} className="text-orange-500" />
                                }
                                {editingId ? 'Edit Food Item' : 'New Food Item'}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 md:p-6 space-y-4 md:space-y-5">
                            <ModernInput
                                label="Food Name (English)"
                                placeholder="e.g. Chicken Breast"
                                value={formData.name}
                                onChange={val => updateForm('name', val)}
                            />
                            <div className="text-right">
                                <ModernInput
                                    label="اسم الطعام (Arabic)"
                                    placeholder="مثال: صدور دجاج"
                                    value={formData.arabic_name}
                                    onChange={val => updateForm('arabic_name', val)}
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block tracking-wider">Category</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => updateForm('category', cat)}
                                            className={`py-3 rounded-xl text-xs font-bold border transition-all ${formData.category === cat
                                                ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white'
                                                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-300 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <ModernInput
                                        label="Calories (kcal)"
                                        suffix="/100g"
                                        type="number"
                                        placeholder="0"
                                        value={formData.calories_per_100g}
                                        onChange={val => updateForm('calories_per_100g', val)}
                                    />
                                </div>
                                <ModernInput label="Protein (g)" type="number" placeholder="0" value={formData.protein_per_100g} onChange={val => updateForm('protein_per_100g', val)} />
                                <ModernInput label="Carbs (g)" type="number" placeholder="0" value={formData.carbs_per_100g} onChange={val => updateForm('carbs_per_100g', val)} />
                                <ModernInput label="Fats (g)" type="number" placeholder="0" value={formData.fats_per_100g} onChange={val => updateForm('fats_per_100g', val)} />
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`w-full font-bold py-4 rounded-xl mt-2 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-white disabled:opacity-60 disabled:pointer-events-none
                                    ${editingId ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' : 'bg-orange-600 hover:bg-orange-500 shadow-orange-900/20'}
                                `}
                            >
                                {isSaving
                                    ? <><Loader2 size={18} className="animate-spin" /> Saving...</>
                                    : <><Save size={18} /> {editingId ? 'Update Item' : 'Save to Database'}</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FoodDatabase;