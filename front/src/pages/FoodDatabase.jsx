import React, { useState, useEffect } from 'react';
import {
    Plus, Search, Trash2, Database,
    Flame, Beef, Wheat, Droplets, X, Save, Edit2, ChevronRight
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

// --- SHARED COMPONENT: MODERN INPUT ---
const ModernInput = ({ label, value, onChange, type = "text", placeholder, suffix }) => (
    <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl relative focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:border-orange-500 transition-all group">
        <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block tracking-wider group-focus-within:text-orange-500 transition-colors">{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-white font-bold text-sm outline-none placeholder-zinc-700"
        />
        {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-600">{suffix}</span>}
    </div>
);

const FoodDatabase = () => {
    // --- STATE ---
    const [foods, setFoods] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '', arabic_name: '', category: 'Protein',
        calories_per_100g: '', protein_per_100g: '',
        carbs_per_100g: '', fats_per_100g: ''
    });

    const CATEGORIES = ['Protein', 'Carbs', 'Fats'];

    // --- FETCH ---
    useEffect(() => { fetchFoods(); }, []);

    const fetchFoods = async () => {
        setLoading(true);
        try {
            const res = await api.get('/food-database/');
            setFoods(res.data);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    // --- HANDLERS ---
    const openCreateModal = () => {
        setEditingId(null);
        setFormData({ name: '', category: 'Protein', calories_per_100g: '', protein_per_100g: '', carbs_per_100g: '', fats_per_100g: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (food) => {
        setEditingId(food.id);
        setFormData({
            name: food.name,
            arabic_name: food.arabic_name || '',
            category: food.category,
            calories_per_100g: food.calories_per_100g,
            protein_per_100g: food.protein_per_100g,
            carbs_per_100g: food.carbs_per_100g,
            fats_per_100g: food.fats_per_100g
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.calories_per_100g) {
            toast.error("Name and Calories are required");
            return;
        }

        try {
            const payload = {
                ...formData,
                calories_per_100g: parseInt(formData.calories_per_100g) || 0,
                protein_per_100g: parseFloat(formData.protein_per_100g) || 0,
                carbs_per_100g: parseFloat(formData.carbs_per_100g) || 0,
                fats_per_100g: parseFloat(formData.fats_per_100g) || 0,
            };

            if (editingId) {
                const res = await api.patch(`/food-database/${editingId}/`, payload);
                setFoods(foods.map(f => f.id === editingId ? res.data : f));
                toast.success("Updated Successfully");
            } else {
                const res = await api.post('/food-database/', payload);
                setFoods([res.data, ...foods]);
                toast.success("Created Successfully");
            }

            setIsModalOpen(false);
            setFormData({ name: '', category: 'Protein', calories_per_100g: '', protein_per_100g: '', carbs_per_100g: '', fats_per_100g: '' });
            setEditingId(null);
        } catch (error) {
            console.error(error);
            toast.error("Error saving item");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete item?")) return;
        try {
            await api.delete(`/food-database/${id}/`);
            setFoods(foods.filter(f => f.id !== id));
            toast.success("Deleted");
        } catch (error) { toast.error("Error deleting"); }
    };

    // --- UI HELPERS ---
    const filteredFoods = foods.filter(f =>
        (activeCategory === 'All' || f.category === activeCategory) &&
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getCategoryColor = (cat) => {
        if (cat === 'Protein') return 'text-red-500 bg-red-500/10 border-red-500/20';
        if (cat === 'Carbs') return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        if (cat === 'Fats') return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
    };

    return (
        // FIXED: Added 'pt-20' on mobile to clear the fixed header. Reset to 'lg:pt-10' on desktop.
        <div className="p-4 pt-20 md:p-6 lg:p-10 space-y-6 md:space-y-8 animate-in fade-in duration-300 w-full max-w-7xl mx-auto min-h-screen pb-24 md:pb-10">

            {/* 1. Integrated Header (Stacked on Mobile) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500 border border-orange-500/20 shrink-0">
                        <Database size={24} md:size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-white">Food Database</h1>
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

            {/* 2. Controls & Search */}
            {/* FIXED: 'top-20' on mobile so it sticks below the header. 'lg:top-2' on desktop. */}
            <div className="bg-[#121214] border border-zinc-800 p-3 md:p-4 rounded-3xl flex flex-col md:flex-row gap-4 items-center sticky top-20 lg:top-2 z-10 shadow-xl shadow-black/50">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                        placeholder="Search ingredients..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-12 pr-4 py-3 text-white font-medium outline-none focus:border-orange-500 transition-colors text-sm"
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 hide-scrollbar snap-x">
                    {['All', ...CATEGORIES].map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`snap-start px-4 md:px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all border whitespace-nowrap shrink-0 ${activeCategory === cat ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-white hover:bg-zinc-800'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. Data Display - Responsive Switch */}

            {/* A) DESKTOP VIEW: Table */}
            <div className="hidden md:block border border-zinc-800 rounded-3xl overflow-hidden bg-[#121214]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-900/50 border-b border-zinc-800 text-[10px] uppercase text-zinc-500 font-bold tracking-wider">
                                <th className="p-5">Food Name</th>
                                <th className="p-5">Category</th>
                                <th className="p-5 text-center">Calories <span className="text-zinc-600">/100g</span></th>
                                <th className="p-5 text-center text-red-400">Protein</th>
                                <th className="p-5 text-center text-blue-400">Carbs</th>
                                <th className="p-5 text-center text-yellow-400">Fats</th>
                                <th className="p-5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {filteredFoods.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-16 text-center text-zinc-500">
                                        <Database size={32} className="opacity-20 mb-2 mx-auto" />
                                        <p>No items found.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredFoods.map(food => (
                                    <tr key={food.id} className="hover:bg-zinc-900/40 transition-colors group">
                                        <td className="p-5 font-bold text-white text-sm">{food.name}</td>
                                        <td className="p-5">
                                            <span className={`text-[10px] uppercase font-black px-3 py-1.5 rounded-lg border ${getCategoryColor(food.category)}`}>
                                                {food.category}
                                            </span>
                                        </td>
                                        <td className="p-5 text-center text-white font-black">{food.calories_per_100g}</td>
                                        <td className="p-5 text-center text-zinc-400 font-medium">{food.protein_per_100g}g</td>
                                        <td className="p-5 text-center text-zinc-400 font-medium">{food.carbs_per_100g}g</td>
                                        <td className="p-5 text-center text-zinc-400 font-medium">{food.fats_per_100g}g</td>
                                        <td className="p-5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openEditModal(food)} className="p-2 bg-zinc-900 rounded-lg text-zinc-500 hover:text-blue-500 hover:bg-blue-500/10 transition-all"><Edit2 size={16} /></button>
                                                <button onClick={() => handleDelete(food.id)} className="p-2 bg-zinc-900 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* B) MOBILE VIEW: Cards */}
            <div className="md:hidden grid grid-cols-1 gap-3">
                {filteredFoods.length === 0 ? (
                    <div className="p-10 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-3xl">
                        <Database size={32} className="opacity-20 mb-2 mx-auto" />
                        <p>No items found.</p>
                    </div>
                ) : (
                    filteredFoods.map(food => (
                        <div key={food.id} className="bg-[#121214] border border-zinc-800 p-4 rounded-2xl space-y-3 shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-white text-lg leading-tight">{food.name}</h3>
                                    <span className={`inline-block mt-1 text-[10px] uppercase font-black px-2 py-0.5 rounded border ${getCategoryColor(food.category)}`}>
                                        {food.category}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => openEditModal(food)} className="p-2 bg-zinc-900 rounded-lg text-zinc-400 hover:text-blue-400"><Edit2 size={18} /></button>
                                    <button onClick={() => handleDelete(food.id)} className="p-2 bg-zinc-900 rounded-lg text-zinc-400 hover:text-red-400"><Trash2 size={18} /></button>
                                </div>
                            </div>

                            {/* Mobile Macro Grid */}
                            <div className="grid grid-cols-4 gap-2 bg-black/20 rounded-xl p-2 border border-zinc-800/50">
                                <div className="text-center">
                                    <div className="text-[9px] text-zinc-500 font-bold uppercase">Cal</div>
                                    <div className="text-white font-black text-sm">{food.calories_per_100g}</div>
                                </div>
                                <div className="text-center relative">
                                    <div className="text-[9px] text-red-500/70 font-bold uppercase">Pro</div>
                                    <div className="text-zinc-300 font-bold text-sm">{food.protein_per_100g}</div>
                                    {/* Vertical Divider */}
                                    <div className="absolute left-0 top-2 bottom-2 w-px bg-zinc-800"></div>
                                </div>
                                <div className="text-center relative">
                                    <div className="text-[9px] text-blue-500/70 font-bold uppercase">Carb</div>
                                    <div className="text-zinc-300 font-bold text-sm">{food.carbs_per_100g}</div>
                                    <div className="absolute left-0 top-2 bottom-2 w-px bg-zinc-800"></div>
                                </div>
                                <div className="text-center relative">
                                    <div className="text-[9px] text-yellow-500/70 font-bold uppercase">Fat</div>
                                    <div className="text-zinc-300 font-bold text-sm">{food.fats_per_100g}</div>
                                    <div className="absolute left-0 top-2 bottom-2 w-px bg-zinc-800"></div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 4. Styled Modal (Responsive Width) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#18181b] border border-zinc-800 rounded-3xl w-[95%] md:w-full max-w-lg shadow-2xl shadow-black/50 overflow-hidden animate-in zoom-in-95 duration-300">

                        {/* Modal Header */}
                        <div className="p-5 md:p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                            <h3 className="font-bold text-lg md:text-xl text-white flex items-center gap-2">
                                {editingId ? <Edit2 size={20} className="text-blue-500" /> : <Plus size={20} className="text-orange-500" />}
                                {editingId ? 'Edit Food Item' : 'New Food Item'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 md:p-6 space-y-4 md:space-y-5">
                            <ModernInput
                                label="Food Name"
                                placeholder="e.g. Chicken Breast"
                                value={formData.name}
                                onChange={val => setFormData({ ...formData, name: val })}
                            />
                            <div className="text-right">
                                <ModernInput
                                    label="اسم الطعام (Arabic)"
                                    placeholder="مثال: صدور دجاج"
                                    value={formData.arabic_name}
                                    onChange={val => setFormData({ ...formData, arabic_name: val })}
                                    className="text-right direction-rtl"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block tracking-wider">Category</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setFormData({ ...formData, category: cat })}
                                            className={`py-3 rounded-xl text-xs font-bold border transition-all ${formData.category === cat ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-zinc-800'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <ModernInput label="Calories (kcal)" suffix="/100g" type="number" placeholder="0" value={formData.calories_per_100g} onChange={val => setFormData({ ...formData, calories_per_100g: val })} />
                                </div>
                                <ModernInput label="Protein (g)" type="number" placeholder="0" value={formData.protein_per_100g} onChange={val => setFormData({ ...formData, protein_per_100g: val })} />
                                <ModernInput label="Carbs (g)" type="number" placeholder="0" value={formData.carbs_per_100g} onChange={val => setFormData({ ...formData, carbs_per_100g: val })} />
                                <ModernInput label="Fats (g)" type="number" placeholder="0" value={formData.fats_per_100g} onChange={val => setFormData({ ...formData, fats_per_100g: val })} />
                            </div>

                            <button
                                onClick={handleSave}
                                className={`w-full font-bold py-4 rounded-xl mt-2 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-white
                                    ${editingId ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' : 'bg-orange-600 hover:bg-orange-500 shadow-orange-900/20'}
                                `}
                            >
                                <Save size={18} /> {editingId ? 'Update Item' : 'Save to Database'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FoodDatabase;