import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
    Users, Activity, DollarSign, TrendingUp, 
    ChevronDown, Check, UserCheck, Hash, Calendar, CreditCard, ChevronRight
} from 'lucide-react';
import { 
    BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../api'; 
import { AuthContext } from '../context/AuthContext';

// --- 1. MODERN DARK DROPDOWN COMPONENT ---
const CustomSelect = ({ value, options, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedLabel = options.find(opt => opt.value == value)?.label || value;

    return (
        <div className="relative z-50" ref={dropdownRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between min-w-[120px] bg-[#18181b] hover:bg-zinc-800 border border-zinc-800 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm"
            >
                <span className="truncate mr-2">{selectedLabel}</span>
                <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 w-full min-w-[140px] right-0 bg-[#18181b] border border-zinc-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto custom-scrollbar">
                    {options.map((option) => (
                        <div 
                            key={option.value}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`px-4 py-3 text-xs font-bold cursor-pointer flex items-center justify-between transition-colors
                                ${option.value == value ? 'bg-orange-500/10 text-orange-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}
                            `}
                        >
                            {option.label}
                            {option.value == value && <Check size={12} />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- 2. CUSTOM CHART TOOLTIP ---
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#18181b] border border-zinc-800 p-3 rounded-xl shadow-2xl">
                <p className="text-zinc-400 text-xs font-bold mb-1">{label}</p>
                <p className="text-white text-lg font-black">
                    ${Number(payload[0].value).toLocaleString()}
                </p>
            </div>
        );
    }
    return null;
};

const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const navigate = useNavigate();
    
    // Date Filters
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        fetchStats();
    }, [selectedMonth, selectedYear]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/dashboard/stats/?month=${selectedMonth}&year=${selectedYear}`);
            setData(res.data);
        } catch (error) {
            console.error("Failed to load dashboard stats", error);
        } finally {
            setLoading(false);
        }
    };

    // Dropdown Options
    const monthOptions = Array.from({length: 12}, (_, i) => ({
        value: i + 1,
        label: new Date(0, i).toLocaleString('default', { month: 'long' })
    }));

    const yearOptions = [
        { value: 2024, label: '2024' },
        { value: 2025, label: '2025' },
        { value: 2026, label: '2026' },
    ];

    if (loading) return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full"></div>
        </div>
    );

    return (
        <div className="p-6 pt-20 lg:p-10 min-h-screen bg-[#09090b] text-white animate-in fade-in duration-300">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* Header & Filters */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
                        <p className="text-zinc-500 mt-1">
                            Welcome back, <span className="text-orange-500 font-bold">{user?.username}</span>
                        </p>
                    </div>

                    {/* Admin Controls */}
                    {data?.role === 'admin' && (
                        <div className="flex items-center gap-3">
                            <CustomSelect 
                                value={selectedMonth} 
                                options={monthOptions} 
                                onChange={setSelectedMonth} 
                            />
                            <CustomSelect 
                                value={selectedYear} 
                                options={yearOptions} 
                                onChange={setSelectedYear} 
                            />
                        </div>
                    )}
                </div>

                {/* --- VIEW 1: ADMIN --- */}
                {data?.role === 'admin' && (
                    <div className="space-y-8">
                        {/* Financial Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-[#121214] border border-zinc-800 p-6 rounded-3xl relative overflow-hidden group hover:border-zinc-700 transition-colors">
                                <div className="absolute right-0 top-0 p-32 bg-orange-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-zinc-900 rounded-2xl text-zinc-400"><TrendingUp size={24}/></div>
                                    <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider bg-zinc-900/50 px-2 py-1 rounded-lg">
                                        {monthOptions[selectedMonth-1].label} Sales
                                    </span>
                                </div>
                                <h3 className="text-zinc-500 text-sm font-medium">Total Sales</h3>
                                <div className="text-4xl font-black mt-1 text-white">
                                    {data.financials.total_sales || 0} <span className="text-lg text-zinc-600 font-bold">Pkgs</span>
                                </div>
                            </div>

                            <div className="bg-[#121214] border border-zinc-800 p-6 rounded-3xl relative overflow-hidden group hover:border-zinc-700 transition-colors">
                                <div className="absolute right-0 top-0 p-32 bg-green-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-zinc-900 rounded-2xl text-green-500"><DollarSign size={24}/></div>
                                    <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-wider bg-zinc-900/50 px-2 py-1 rounded-lg">
                                        {monthOptions[selectedMonth-1].label} Revenue
                                    </span>
                                </div>
                                <h3 className="text-zinc-500 text-sm font-medium">Total Revenue</h3>
                                <div className="text-4xl font-black mt-1 text-white">
                                    ${Number(data.financials.total_revenue || 0).toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Revenue Chart */}
                        <div className="bg-[#121214] border border-zinc-800 p-6 rounded-3xl">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <Activity size={20} className="text-orange-500"/> Revenue Overview ({selectedYear})
                            </h3>
                            <div className="h-[300px] w-full">
                                {data.financials.chart_data.length === 0 ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                                        <Activity size={32} className="opacity-20"/>
                                        <span className="text-sm font-medium">No sales data found.</span>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.financials.chart_data} barSize={40}>
                                            <XAxis 
                                                dataKey="name" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{fill: '#52525b', fontSize: 12, fontWeight: 'bold'}} 
                                                dy={10}
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{fill: '#27272a', opacity: 0.4}} />
                                            <Bar dataKey="revenue" radius={[6, 6, 6, 6]}>
                                                {data.financials.chart_data.map((entry, index) => (
                                                    <Cell 
                                                        key={`cell-${index}`} 
                                                        fill={entry.revenue > 0 ? '#ea580c' : '#27272a'} 
                                                    />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* Trainers Overview */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Users size={20} className="text-blue-500"/> Coach Performance
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {data.trainers_overview.map(trainer => (
                                    <div key={trainer.id} className="bg-[#121214] border border-zinc-800 p-5 rounded-2xl flex flex-col gap-4 hover:border-zinc-700 transition-colors group">
                                        <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
                                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-white font-bold group-hover:bg-zinc-700 transition-colors">
                                                {trainer.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white">{trainer.name}</h4>
                                                <span className="text-xs text-zinc-500">Coach</span>
                                            </div>
                                        </div>
                                        
                                        {/* --- UPDATED: 2 Column Grid for Stats --- */}
                                        <div className="grid grid-cols-2 gap-2">
                                            {/* Left: Active Packages */}
                                            <div className="bg-green-500/5 border border-green-500/10 p-3 rounded-xl flex flex-col justify-center">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="text-[10px] text-green-500 font-bold uppercase">Active</div>
                                                    <UserCheck size={14} className="text-green-500 opacity-50"/>
                                                </div>
                                                <div className="text-xl font-black text-white">{trainer.active_packages}</div>
                                            </div>

                                            {/* Right: Monthly Revenue (NEW) */}
                                            <div className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-xl flex flex-col justify-center">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="text-[10px] text-blue-500 font-bold uppercase">Earnings</div>
                                                    <DollarSign size={14} className="text-blue-500 opacity-50"/>
                                                </div>
                                                <div className="text-xl font-black text-white">
                                                    ${Number(trainer.monthly_revenue || 0).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- VIEW 2: TRAINER (MODERN REDESIGN) --- */}
                {data?.role === 'trainer' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-[#121214] border border-zinc-800 p-6 rounded-3xl flex flex-col justify-center items-center gap-2 group hover:border-green-500/50 transition-colors relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                                <div className="p-4 bg-green-500/10 text-green-500 rounded-2xl group-hover:scale-110 transition-transform"><UserCheck size={28} /></div>
                                <div className="text-4xl font-black text-white mt-2 z-10">{data.summary.active_clients}</div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest z-10">Active Clients</div>
                            </div>
                            
                            <div className="bg-[#121214] border border-zinc-800 p-6 rounded-3xl flex flex-col justify-center items-center gap-2 group hover:border-orange-500/50 transition-colors relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                                <div className="p-4 bg-zinc-800 text-orange-500 rounded-2xl group-hover:bg-orange-500/10 transition-all"><DollarSign size={28} /></div>
                                <div className="text-4xl font-black text-white mt-2 z-10">
                                    ${Number(data.summary.current_month_revenue || 0).toLocaleString()}
                                </div>
                                <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest z-10">Revenue (This Month)</div>
                            </div>
                        </div>

                        {/* --- NEW MODERN CARD GRID (REPLACES TABLE) --- */}
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-xl text-white flex items-center gap-2">
                                    <Users className="text-orange-500"/> My Active Clients
                                </h3>
                                <span className="bg-[#18181b] border border-zinc-800 text-zinc-400 text-xs font-bold px-4 py-2 rounded-xl">
                                    {data.clients.length} Active
                                </span>
                            </div>

                            {data.clients.length === 0 ? (
                                <div className="bg-[#121214] border border-dashed border-zinc-800 rounded-3xl p-16 flex flex-col items-center justify-center text-center gap-4">
                                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center">
                                        <Users size={32} className="text-zinc-600 opacity-50"/>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-white font-bold text-lg">No Active Clients</h4>
                                        <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                                            Clients assigned to you with an active subscription will appear here nicely.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {data.clients.map((client, i) => (
                                        <div 
                                            key={i} 
                                            onClick={() => navigate(`/clients/${client.id}`)}
                                            className="bg-[#18181b] border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-800/80 p-5 rounded-3xl transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between h-full"
                                        >
                                            {/* Top: Avatar & ID */}
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-zinc-700/50 group-hover:border-orange-500 transition-colors shadow-lg">
                                                        {client.photo ? (
                                                            <img src={client.photo} alt={client.name} className="w-full h-full object-cover"/>
                                                        ) : (
                                                            <span className="text-lg font-bold text-zinc-400">{client.name.charAt(0)}</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white text-lg leading-tight group-hover:text-orange-500 transition-colors">
                                                            {client.name}
                                                        </h4>
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <span className="bg-zinc-900 text-zinc-500 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border border-zinc-800">
                                                                <Hash size={10}/> {client.manual_id || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-2 bg-zinc-900 rounded-full text-zinc-600 group-hover:text-orange-500 group-hover:bg-orange-500/10 transition-colors">
                                                    <ChevronRight size={16} />
                                                </div>
                                            </div>

                                            {/* Bottom: Info Grid */}
                                            <div className="grid grid-cols-2 gap-3 bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800/50">
                                                <div>
                                                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                                                        <CreditCard size={10} /> Plan
                                                    </div>
                                                    <div className="text-zinc-200 text-xs font-bold truncate" title={client.plan}>
                                                        {client.plan}
                                                    </div>
                                                </div>
                                                <div className="text-right border-l border-zinc-800 pl-3">
                                                    <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-end gap-1">
                                                        <Calendar size={10} /> Expires
                                                    </div>
                                                    <div className="text-white text-xs font-bold">
                                                        {client.end_date || '—'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Active Indicator Strip */}
                                            <div className="absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-green-500/20 group-hover:bg-green-500 transition-colors"></div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;