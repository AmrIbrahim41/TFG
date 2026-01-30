import React, { useState, useEffect } from 'react';
import { 
    Plus, Search, Trash2, Database,  
    Flame, Beef, Wheat, Droplets, X, Save 
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

const FoodDatabase = () => {
    // --- STATE ---
    const [foods, setFoods] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form
    const [formData, setFormData] = useState({
        name: '', category: 'Protein', 
        calories_per_100g: '', protein_per_100g: '', 
        carbs_per_100g: '', fats_per_100g: ''
    });

    const CATEGORIES = ['Protein', 'Carbs', 'Fats', 'Vegetables', 'Fruits'];

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
    const handleSave = async () => {
        if (!formData.name || !formData.calories_per_100g) {
            toast.error("Name and Calories are required");
            return;
        }

        try {
            // Convert strings to numbers to prevent 400 Bad Request errors
            const payload = {
                ...formData,
                calories_per_100g: parseInt(formData.calories_per_100g) || 0,
                protein_per_100g: parseFloat(formData.protein_per_100g) || 0,
                carbs_per_100g: parseFloat(formData.carbs_per_100g) || 0,
                fats_per_100g: parseFloat(formData.fats_per_100g) || 0,
            };

            await api.post('/food-database/', payload);
            toast.success("Saved");
            setIsModalOpen(false);
            fetchFoods();
            // Reset form
            setFormData({ name: '', category: 'Protein', calories_per_100g: '', protein_per_100g: '', carbs_per_100g: '', fats_per_100g: '' });
        } catch (error) { 
            console.error(error);
            toast.error("Error saving item"); 
        }
    };

    const handleDelete = async (id) => {
        if(!confirm("Delete item?")) return;
        try {
            await api.delete(`/food-database/${id}/`);
            setFoods(foods.filter(f => f.id !== id));
            toast.success("Deleted");
        } catch (error) { toast.error("Error deleting"); }
    };

    // --- FILTERING ---
    const filteredFoods = foods.filter(f => 
        (activeCategory === 'All' || f.category === activeCategory) && 
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getCategoryColor = (cat) => {
        if(cat === 'Protein') return 'text-red-500 bg-red-500/10 border-red-500/20';
        if(cat === 'Carbs') return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
        if(cat === 'Fats') return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    };

    return (
        <div className="p-6 lg:p-10 space-y-8 animate-in fade-in duration-300 w-full max-w-7xl mx-auto">
            
            {/* 1. Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                            <Database size={24} />
                        </div>
                        Food Database
                    </h1>
                    <p className="text-zinc-500 mt-2 text-sm ml-1">Manage nutritional values for meal planning.</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-white text-black px-5 py-3 rounded-xl font-bold hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
                >
                    <Plus size={18} /> Add New Item
                </button>
            </div>

            {/* 2. Filters Bar */}
            <div className="flex flex-col md:flex-row gap-4 bg-[#121214] p-2 rounded-2xl border border-zinc-800/50">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18}/>
                    <input 
                        placeholder="Search foods..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-white outline-none focus:border-zinc-700 transition-all text-sm"
                    />
                </div>
                <div className="flex gap-1 overflow-x-auto hide-scrollbar">
                    {['All', ...CATEGORIES].map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${activeCategory === cat ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-transparent text-zinc-500 border-transparent hover:text-zinc-300'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. Data Table (Responsive Wrapper) */}
            <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-[#121214]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-900/50 border-b border-zinc-800 text-xs uppercase text-zinc-500 tracking-wider">
                                <th className="p-4 font-bold">Food Name</th>
                                <th className="p-4 font-bold">Category</th>
                                <th className="p-4 font-bold text-center">Kcal/100g</th>
                                <th className="p-4 font-bold text-center">Prot</th>
                                <th className="p-4 font-bold text-center">Carbs</th>
                                <th className="p-4 font-bold text-center">Fat</th>
                                <th className="p-4 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {filteredFoods.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-12 text-center text-zinc-500">No items found. Add one above.</td>
                                </tr>
                            ) : (
                                filteredFoods.map(food => (
                                    <tr key={food.id} className="hover:bg-zinc-900/30 transition-colors group">
                                        <td className="p-4 font-bold text-white">{food.name}</td>
                                        <td className="p-4">
                                            <span className={`text-[10px] uppercase font-black px-2 py-1 rounded border ${getCategoryColor(food.category)}`}>
                                                {food.category}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center text-zinc-300 font-mono">{food.calories_per_100g}</td>
                                        <td className="p-4 text-center text-red-400 font-mono">{food.protein_per_100g}</td>
                                        <td className="p-4 text-center text-blue-400 font-mono">{food.carbs_per_100g}</td>
                                        <td className="p-4 text-center text-yellow-400 font-mono">{food.fats_per_100g}</td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => handleDelete(food.id)} className="p-2 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                                <Trash2 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#18181b] border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 p-6">
                        <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
                            <h3 className="font-bold text-xl text-white">Add Food Item</h3>
                            <button onClick={() => setIsModalOpen(false)}><X className="text-zinc-500 hover:text-white"/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Name</label>
                                <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-orange-500" placeholder="e.g. Rice"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Category</label>
                                <div className="flex gap-2">
                                    {CATEGORIES.slice(0,3).map(cat => (
                                        <button key={cat} onClick={() => setFormData({...formData, category: cat})} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${formData.category === cat ? 'bg-white text-black border-white' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}>{cat}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Calories (per 100g)</label>
                                    <input type="number" value={formData.calories_per_100g} onChange={e => setFormData({...formData, calories_per_100g: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-orange-500" placeholder="0"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Protein (g)</label>
                                    <input type="number" value={formData.protein_per_100g} onChange={e => setFormData({...formData, protein_per_100g: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-red-500" placeholder="0"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Carbs (g)</label>
                                    <input type="number" value={formData.carbs_per_100g} onChange={e => setFormData({...formData, carbs_per_100g: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-500" placeholder="0"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Fats (g)</label>
                                    <input type="number" value={formData.fats_per_100g} onChange={e => setFormData({...formData, fats_per_100g: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-yellow-500" placeholder="0"/>
                                </div>
                            </div>
                            <button onClick={handleSave} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3.5 rounded-xl mt-4 transition-all flex items-center justify-center gap-2">
                                <Save size={18}/> Save Item
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FoodDatabase;