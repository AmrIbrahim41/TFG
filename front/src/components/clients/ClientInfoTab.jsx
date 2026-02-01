import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    User, Hash, Calendar, Briefcase, MapPin, 
    Activity, Heart, Moon, FileText, Cigarette, 
    Check, Globe, Phone, Plus, X, Loader, MessageCircle
} from 'lucide-react';
import api from '../../api';

// --- HELPER COMPONENTS ---

const InputGroup = ({ label, icon: Icon, children }) => (
    <div className="space-y-2 group w-full">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 group-focus-within:text-orange-500 transition-colors">
            {Icon && <Icon size={12} />} {label}
        </label>
        {children}
    </div>
);

const ModernInput = (props) => (
    <input 
        {...props}
        className={`w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3.5 text-white transition-all outline-none focus:bg-zinc-950 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 placeholder:text-zinc-700 ${props.className || ''}`} 
    />
);

// 1. Dynamic Country Selector
const CountrySelector = ({ value, onChange, countries, onAddClick }) => {
    return (
        <InputGroup label="Nationality" icon={Globe}>
            <div className="flex gap-2">
                <div className="relative group flex-1">
                    <select 
                        name="country"
                        value={value}
                        onChange={onChange}
                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3.5 text-white outline-none focus:border-orange-500 appearance-none cursor-pointer hover:bg-zinc-900 transition-colors"
                    >
                        <option value="">Select Country...</option>
                        {countries.map(c => (
                            <option key={c.id} value={c.name}>{c.name} ({c.code})</option>
                        ))}
                    </select>
                </div>
                <button 
                    type="button"
                    onClick={onAddClick}
                    className="bg-orange-500/10 border border-orange-500/20 text-orange-500 hover:bg-orange-500 hover:text-white rounded-xl px-3 transition-all flex items-center justify-center"
                    title="Add New Country"
                >
                    <Plus size={20} />
                </button>
            </div>
        </InputGroup>
    );
};

// 2. Phone Input with Country Code & WhatsApp
const PhoneInputWithCountry = ({ label, value, name, onChange, defaultCountryName, countries }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState(null);
    const wrapperRef = useRef(null);

    // Sync selected country
    useEffect(() => {
        if (countries.length > 0) {
            const match = countries.find(c => c.name === defaultCountryName);
            setSelectedCountry(match || countries[0]);
        }
    }, [countries, defaultCountryName]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const currentCountry = selectedCountry || { code: '??', dial_code: '??' };

    // WhatsApp Action
    const handleWhatsApp = () => {
        if (!value) return;
        const cleanCode = currentCountry.dial_code ? currentCountry.dial_code.replace('+', '') : '';
        const cleanNumber = value.replace(/^0+/, ''); // Remove leading zero
        window.open(`https://wa.me/${cleanCode}${cleanNumber}`, '_blank');
    };

    return (
        <div className="space-y-2 w-full" ref={wrapperRef}>
             <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <Phone size={12} /> {label}
            </label>
            <div className="flex gap-2 relative">
                {/* Dial Code Button */}
                <button 
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex-shrink-0 w-[4.5rem] bg-zinc-950/50 border border-zinc-800 rounded-xl flex flex-col items-center justify-center hover:bg-zinc-900 transition-colors"
                >
                    <span className="text-sm font-black text-white leading-none mb-0.5">{currentCountry.code}</span>
                    <span className="text-[10px] font-mono text-zinc-400 leading-none">{currentCountry.dial_code}</span>
                </button>

                {/* DROPDOWN MENU - Z-INDEX FIXED */}
                {isOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl z-[100] max-h-48 overflow-y-auto p-1">
                        {countries.map(c => (
                            <div 
                                key={c.id}
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setSelectedCountry(c); 
                                    setIsOpen(false); 
                                }}
                                className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors"
                            >
                                <span className="text-xs font-black bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">{c.code}</span>
                                <span className="text-sm text-zinc-300 flex-1 text-left">{c.name}</span>
                                <span className="text-xs text-zinc-500 font-mono">{c.dial_code}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Number Input */}
                <input 
                    type="tel"
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder="10xxxxxxx"
                    className="flex-1 min-w-0 bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3.5 text-white outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition-all font-mono"
                />

                {/* WhatsApp Button */}
                <button
                    type="button"
                    onClick={handleWhatsApp}
                    disabled={!value}
                    className={`px-3.5 rounded-xl border flex items-center justify-center transition-all duration-300
                        ${value 
                            ? 'bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white cursor-pointer' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
                        }
                    `}
                    title="Open in WhatsApp"
                >
                    <MessageCircle size={20} />
                </button>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

const ClientInfoTab = ({ formData, handleChange, clientAge, user }) => {
    
    // State
    const [isFlipped, setIsFlipped] = useState(false);
    const [countries, setCountries] = useState([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newCountry, setNewCountry] = useState({ name: '', code: '', dial_code: '' });

    // Fetch Countries
    const fetchCountries = async () => {
        try {
            const res = await api.get('/countries/');
            setCountries(res.data);
        } catch (error) {
            console.error("Failed to load countries", error);
        }
    };

    useEffect(() => {
        fetchCountries();
    }, []);

    // Save New Country
    const handleSaveCountry = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/countries/', newCountry);
            await fetchCountries();
            setIsAddModalOpen(false);
            setNewCountry({ name: '', code: '', dial_code: '' });
        } catch (error) {
            alert("Error adding country. Ensure code/name is unique.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const displayAge = useMemo(() => {
        if (formData.birth_date) {
            const today = new Date();
            const birthDate = new Date(formData.birth_date);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
            return age;
        }
        return clientAge;
    }, [formData.birth_date, clientAge]);

    const statusOptions = [
        { value: 'Single', label: 'Single', color: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500', icon: User },
        { value: 'Married', label: 'Married', color: 'bg-rose-500', border: 'border-rose-500', text: 'text-rose-500', icon: Heart },
        { value: 'Divorced', label: 'Divorced', color: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500', icon: User },
        { value: 'Widowed', label: 'Widowed', color: 'bg-zinc-500', border: 'border-zinc-500', text: 'text-zinc-500', icon: User },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            
            {/* 1. Identity Section - FIX: Removed overflow-hidden from main container */}
            <div className="bg-[#121214] border border-zinc-800/60 rounded-3xl p-6 md:p-8 relative">
                
                {/* Isolated Background Layer to handle overflow/blur safely */}
                <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[80px] rounded-full" />
                </div>
                
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 relative z-10">
                    <span className="p-2 bg-orange-500/10 rounded-lg text-orange-500"><User size={18} /></span>
                    Identity
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    
                    {/* Full Width Name */}
                    <div className="md:col-span-2">
                        <InputGroup label="Full Name" icon={User}>
                            <ModernInput 
                                name="name" 
                                value={formData.name} 
                                onChange={handleChange} 
                                disabled={!user?.is_superuser}
                                placeholder="Client Name"
                            />
                        </InputGroup>
                    </div>

                    {/* Country - New */}
                    <CountrySelector 
                        value={formData.country} 
                        onChange={handleChange} 
                        countries={countries}
                        onAddClick={() => setIsAddModalOpen(true)}
                    />

                    {/* ID */}
                    <InputGroup label="System ID" icon={Hash}>
                        <ModernInput 
                            name="manual_id" 
                            value={formData.manual_id} 
                            onChange={handleChange} 
                            disabled={!user?.is_superuser}
                            className="font-mono text-zinc-400"
                        />
                    </InputGroup>

                    {/* Phone - Updated with Country & WhatsApp - Full Width Row */}
                    <div className="md:col-span-2">
                        <PhoneInputWithCountry 
                            label="WhatsApp Number"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            defaultCountryName={formData.country}
                            countries={countries}
                        />
                    </div>
                </div>
            </div>

            {/* 2. Personal & Bio Section */}
            <div className="bg-[#121214] border border-zinc-800/60 rounded-3xl p-6 md:p-8 relative">
                 {/* Isolated Background Layer */}
                 <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                    {/* Optional: Add gentle glow here if needed */}
                </div>

                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 relative z-10">
                    <span className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><Briefcase size={18} /></span>
                    Personal Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    
                    {/* --- FLIP CARD FOR AGE / DATE --- */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                            <Calendar size={12} /> Age / Birth Date
                        </label>
                        
                        <div className="relative w-full h-[54px] perspective-1000 group">
                            <div className={`relative w-full h-full transition-all duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
                                {/* FRONT: Display Age */}
                                <div onClick={() => setIsFlipped(true)} className="absolute inset-0 w-full h-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 flex items-center justify-between cursor-pointer hover:border-orange-500/50 [backface-visibility:hidden]">
                                    <span className={formData.birth_date ? "text-white font-bold" : "text-zinc-600"}>
                                        {displayAge ? `${displayAge} Years Old` : "Set Birth Date"}
                                    </span>
                                    <Calendar size={16} className="text-zinc-500" />
                                </div>
                                {/* BACK: Date Input */}
                                <div className="absolute inset-0 w-full h-full bg-zinc-950 border border-orange-500 rounded-xl px-2 flex items-center gap-2 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                                    <input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleChange} className="bg-transparent text-white w-full outline-none [color-scheme:dark] text-sm" />
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }} className="p-1.5 bg-orange-500 rounded-lg text-white hover:bg-orange-600">
                                        <Check size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <InputGroup label="Nature of Work" icon={Briefcase}>
                        <ModernInput name="nature_of_work" value={formData.nature_of_work} onChange={handleChange} placeholder="e.g. Accountant..." />
                    </InputGroup>

                    <div className="md:col-span-2">
                        <InputGroup label="Address" icon={MapPin}>
                            <ModernInput name="address" value={formData.address} onChange={handleChange} placeholder="Home Address" />
                        </InputGroup>
                    </div>
                </div>
            </div>

            {/* 3. Lifestyle */}
            <div className="bg-[#121214] border border-zinc-800/60 rounded-3xl p-6 md:p-8 relative">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <span className="p-2 bg-rose-500/10 rounded-lg text-rose-500"><Activity size={18} /></span>
                    Lifestyle
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Marital Status</label>
                        <div className="grid grid-cols-2 gap-2">
                            {statusOptions.map((option) => {
                                const isSelected = formData.status === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => handleChange({ target: { name: 'status', value: option.value } })}
                                        className={`relative flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all duration-300 ${isSelected ? `${option.border} ${option.color}/10 text-white shadow-lg` : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:bg-zinc-900 hover:border-zinc-700'}`}
                                    >
                                        <option.icon size={16} className={isSelected ? option.text : 'opacity-50'} />
                                        <span className="text-xs font-bold uppercase">{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <InputGroup label="Daily Sleep (Hours)" icon={Moon}>
                            <ModernInput type="number" name="sleep_hours" value={formData.sleep_hours} onChange={handleChange} />
                        </InputGroup>

                        <div 
                            onClick={() => handleChange({ target: { name: 'smoking', type: 'checkbox', checked: !formData.smoking } })}
                            className={`cursor-pointer group relative overflow-hidden rounded-2xl p-4 border transition-all duration-300 flex items-center justify-between ${formData.smoking ? 'bg-red-500/10 border-red-500/50' : 'bg-green-500/5 border-zinc-800 hover:border-green-500/30'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${formData.smoking ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700'}`}>
                                    <Cigarette size={20} />
                                </div>
                                <div>
                                    <p className={`font-bold text-sm ${formData.smoking ? 'text-red-400' : 'text-zinc-300'}`}>Smoking Habits</p>
                                    <p className="text-xs text-zinc-500">{formData.smoking ? 'Current Smoker' : 'Non-Smoker'}</p>
                                </div>
                            </div>
                            <div className={`w-12 h-6 rounded-full relative transition-colors ${formData.smoking ? 'bg-red-500' : 'bg-zinc-700'}`}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${formData.smoking ? 'left-7' : 'left-1'}`} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

             {/* Notes */}
             <div className="bg-[#121214] border border-zinc-800/60 rounded-3xl p-6 md:p-8 relative">
                <InputGroup label="General Notes & Medical History" icon={FileText}>
                    <textarea name="notes" value={formData.notes} onChange={handleChange} rows={4} className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 rounded-xl p-4 text-white resize-none transition-all outline-none placeholder:text-zinc-700 leading-relaxed" placeholder="Write any important details about the client here..." />
                </InputGroup>
            </div>

            {/* --- ADD COUNTRY MODAL --- */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-[#18181b] border border-zinc-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                <Globe className="text-blue-500" size={20}/> Add Country
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSaveCountry} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Country Name</label>
                                <input required placeholder="e.g. Bahrain" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 mt-1"
                                    value={newCountry.name} onChange={e => setNewCountry({...newCountry, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">ISO Code</label>
                                    <input required placeholder="BH" maxLength={2} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 mt-1 uppercase"
                                        value={newCountry.code} onChange={e => setNewCountry({...newCountry, code: e.target.value.toUpperCase()})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Dial Code</label>
                                    <input required placeholder="+973" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 mt-1"
                                        value={newCountry.dial_code} onChange={e => setNewCountry({...newCountry, dial_code: e.target.value})} />
                                </div>
                            </div>
                            <button disabled={isSubmitting} type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg mt-2 flex justify-center">
                                {isSubmitting ? <Loader className="animate-spin" /> : 'Save Country'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientInfoTab;