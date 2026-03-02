import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    User, Hash, Calendar, MapPin,
    Activity, Phone, FileText, Globe, Trophy,
    Stethoscope, Plus, X, Loader,
    Dumbbell, Baby, Check, MessageCircle, AlertCircle
} from 'lucide-react';
import api from '../../api';

// --- CONSTANTS ---
const SPORTS_OPTIONS = [
    { id: 'Football', label: 'Football', icon: Trophy,    color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10 dark:bg-emerald-400/10', border: 'border-emerald-500/20 dark:border-emerald-400/20' },
    { id: 'Swimming', label: 'Swimming', icon: Activity,  color: 'text-cyan-500 dark:text-cyan-400',       bg: 'bg-cyan-500/10 dark:bg-cyan-400/10',           border: 'border-cyan-500/20 dark:border-cyan-400/20' },
    { id: 'Tennis',   label: 'Tennis',   icon: Activity,  color: 'text-amber-500 dark:text-amber-400',     bg: 'bg-amber-500/10 dark:bg-amber-400/10',         border: 'border-amber-500/20 dark:border-amber-400/20' },
    { id: 'Combat',   label: 'Combat',   icon: Dumbbell,  color: 'text-rose-500 dark:text-rose-400',       bg: 'bg-rose-500/10 dark:bg-rose-400/10',           border: 'border-rose-500/20 dark:border-rose-400/20' },
    { id: 'Other',    label: 'Other',    icon: Hash,      color: 'text-zinc-500 dark:text-zinc-400',       bg: 'bg-zinc-200 dark:bg-zinc-800',                 border: 'border-zinc-300 dark:border-zinc-700' },
];

// --- TOAST COMPONENT ---
const Toast = ({ message, type = 'error', onDismiss }) => {
    useEffect(() => {
        const t = setTimeout(onDismiss, 4000);
        return () => clearTimeout(t);
    }, [onDismiss]);

    return (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold animate-in slide-in-from-bottom-4 duration-300
            ${type === 'error'
                ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
                : 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300'
            }`}
        >
            <AlertCircle size={16} className="shrink-0" />
            {message}
            <button onClick={onDismiss} className="ml-2 text-current opacity-60 hover:opacity-100 transition-opacity"><X size={14} /></button>
        </div>
    );
};

// --- HELPER COMPONENTS ---
const ModernInput = ({ label, icon: Icon, error, ...props }) => (
    <div className="space-y-1.5 w-full">
        {label && (
            <label className={`text-xs font-bold uppercase tracking-wider ml-1 flex items-center gap-1.5 transition-colors ${error ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-500'}`}>
                {Icon && <Icon size={12} />} {label}
            </label>
        )}
        <div className="relative group">
            <input
                {...props}
                className={`w-full bg-zinc-200 dark:bg-[#18181b] border rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-500 dark:placeholder:text-zinc-700
                    ${error
                        ? 'border-red-500/70 dark:border-red-500/50 focus:border-red-500 bg-red-50 dark:bg-red-900/10'
                        : 'border-zinc-300 dark:border-zinc-800 focus:border-blue-500 focus:bg-zinc-100 dark:focus:bg-zinc-900'
                    }
                    ${props.className || ''}
                `}
            />
            <div className="absolute inset-0 rounded-xl bg-blue-500/5 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity" />
        </div>
        {error && <p className="text-xs text-red-500 ml-1">{error}</p>}
    </div>
);

const CountrySelector = ({ value, onChange, countries, onAddClick }) => (
    <div className="space-y-1.5 w-full">
        <label className="text-xs font-bold text-zinc-600 dark:text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
            <Globe size={12} /> Nationality
        </label>
        <div className="flex gap-2">
            <div className="relative group flex-1">
                <select
                    name="country"
                    value={value}
                    onChange={onChange}
                    className="w-full bg-zinc-200 dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none focus:border-blue-500 appearance-none cursor-pointer hover:bg-zinc-300 dark:hover:bg-zinc-900 transition-colors"
                >
                    <option value="">Select Nationality...</option>
                    {countries.map(c => (
                        <option key={c.id} value={c.name}>{c.name} ({c.code})</option>
                    ))}
                </select>
            </div>
            <button
                type="button"
                onClick={onAddClick}
                title="Add New Country"
                className="bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-500 hover:bg-blue-600 dark:hover:bg-blue-600 hover:text-white rounded-xl px-3 transition-all flex items-center justify-center"
            >
                <Plus size={20} />
            </button>
        </div>
    </div>
);

// Phone input with integrated country-code picker and WhatsApp button
const PhoneInputWithCountry = ({ label, value, name, onChange, defaultCountryName, countries }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState(null);
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (countries.length > 0 && !selectedCountry) {
            const match = countries.find(c => c.name === defaultCountryName);
            setSelectedCountry(match || countries[0]);
        }
    }, [countries, defaultCountryName, selectedCountry]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentCountry = selectedCountry || { code: '??', dial_code: '??' };

    const handleWhatsApp = useCallback(() => {
        if (!value) return;
        const cleanCode = currentCountry.dial_code ? currentCountry.dial_code.replace('+', '') : '';
        const cleanNumber = value.replace(/^0+/, '');
        window.open(`https://wa.me/${cleanCode}${cleanNumber}`, '_blank', 'noopener,noreferrer');
    }, [value, currentCountry]);

    const handleCountrySelect = useCallback((country) => {
        setSelectedCountry(country);
        setIsOpen(false);
    }, []);

    return (
        <div className="space-y-1.5 w-full" ref={wrapperRef}>
            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-1.5">
                <Phone size={12} /> {label}
            </label>
            <div className="flex gap-2">
                {/* Country Code Trigger */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex-shrink-0 w-[4.5rem] h-full bg-zinc-200 dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center py-3.5 px-1 hover:bg-zinc-300 dark:hover:bg-zinc-900 transition-colors"
                    >
                        <span className="text-sm font-black text-zinc-900 dark:text-white leading-none mb-0.5">{currentCountry.code}</span>
                        <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 leading-none">{currentCountry.dial_code}</span>
                    </button>

                    {isOpen && (
                        <div className="absolute top-full left-0 mt-2 w-56 bg-zinc-50 dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-800 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto p-1 animate-in fade-in zoom-in-95 duration-150">
                            {countries.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => handleCountrySelect(c)}
                                    className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors"
                                >
                                    <span className="text-xs font-black bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-700 dark:text-zinc-300">{c.code}</span>
                                    <span className="text-sm text-zinc-900 dark:text-zinc-300 flex-1 text-left truncate">{c.name}</span>
                                    <span className="text-xs text-zinc-500 font-mono shrink-0">{c.dial_code}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Number Input */}
                <input
                    type="tel"
                    name={name}
                    value={value}
                    onChange={onChange}
                    placeholder="10xxxxxxx"
                    inputMode="tel"
                    className="flex-1 min-w-0 bg-zinc-200 dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none focus:border-blue-500 transition-all font-mono text-lg"
                />

                {/* WhatsApp Button */}
                <button
                    type="button"
                    onClick={handleWhatsApp}
                    disabled={!value}
                    title="Open in WhatsApp"
                    aria-label="Open in WhatsApp"
                    className={`px-3.5 rounded-xl border flex items-center justify-center transition-all duration-300
                        ${value
                            ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-500 hover:bg-green-500 hover:text-white cursor-pointer'
                            : 'bg-zinc-200 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                        }
                    `}
                >
                    <MessageCircle size={20} />
                </button>
            </div>
        </div>
    );
};

const ToggleTile = ({ label, active, onClick, icon: Icon, activeColorClass }) => (
    <button
        type="button"
        onClick={onClick}
        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all duration-300
        ${active
            ? `${activeColorClass} border-transparent text-white shadow-lg`
            : 'bg-zinc-200 dark:bg-[#18181b] border-zinc-300 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300'
        }`}
    >
        {Icon && <Icon size={16} />}
        <span className="text-xs font-bold uppercase">{label}</span>
    </button>
);

// --- MAIN COMPONENT ---
const ChildInfoTab = ({ formData, handleChange, clientAge, user }) => {

    const [countries, setCountries] = useState([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newCountry, setNewCountry] = useState({ name: '', code: '', dial_code: '' });
    const [countryErrors, setCountryErrors] = useState({});
    const [toast, setToast] = useState(null);

    const showToast = useCallback((message, type = 'error') => {
        setToast({ message, type });
    }, []);

    const dismissToast = useCallback(() => setToast(null), []);

    const fetchCountries = useCallback(async () => {
        let cancelled = false;
        try {
            const res = await api.get('/countries/');
            if (!cancelled) setCountries(res.data);
        } catch (error) {
            console.error('Failed to load countries', error);
        }
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await api.get('/countries/');
                if (!cancelled) setCountries(res.data);
            } catch (e) {
                console.error('Failed to load countries', e);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    const validateCountryForm = useCallback(() => {
        const errors = {};
        if (!newCountry.name.trim()) errors.name = 'Country name is required';
        if (!newCountry.code.trim()) errors.code = 'ISO code is required';
        else if (newCountry.code.length !== 2) errors.code = 'Must be 2 characters';
        if (!newCountry.dial_code.trim()) errors.dial_code = 'Dial code is required';
        else if (!newCountry.dial_code.startsWith('+')) errors.dial_code = 'Must start with +';
        return errors;
    }, [newCountry]);

    const handleSaveCountry = useCallback(async (e) => {
        e.preventDefault();
        const errors = validateCountryForm();
        if (Object.keys(errors).length > 0) {
            setCountryErrors(errors);
            return;
        }
        setIsSubmitting(true);
        try {
            await api.post('/countries/', newCountry);
            await fetchCountries();
            setIsAddModalOpen(false);
            setNewCountry({ name: '', code: '', dial_code: '' });
            setCountryErrors({});
            showToast('Country added successfully', 'success');
        } catch (error) {
            showToast('Error adding country. Code or name may already exist.');
        } finally {
            setIsSubmitting(false);
        }
    }, [newCountry, validateCountryForm, fetchCountries, showToast]);

    const handleCountryFieldChange = useCallback((field, value) => {
        setNewCountry(prev => ({ ...prev, [field]: value }));
        setCountryErrors(prev => ({ ...prev, [field]: undefined }));
    }, []);

    const displayAge = useMemo(() => {
        if (formData.birth_date) {
            const today = new Date();
            const birth = new Date(formData.birth_date);
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
            return age >= 0 ? age : null;
        }
        return clientAge;
    }, [formData.birth_date, clientAge]);

    const isStandardSport = useCallback(
        (val) => SPORTS_OPTIONS.some(s => s.id === val && s.id !== 'Other'),
        []
    );

    const isOtherActive = useMemo(
        () => formData.nature_of_work === 'Other' || (formData.nature_of_work !== '' && !isStandardSport(formData.nature_of_work)),
        [formData.nature_of_work, isStandardSport]
    );

    const handleCloseAddModal = useCallback(() => {
        setIsAddModalOpen(false);
        setNewCountry({ name: '', code: '', dial_code: '' });
        setCountryErrors({});
    }, []);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">

            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

            {/* --- COLUMN 1 --- */}
            <div className="space-y-6">

                <div className="bg-zinc-50 dark:bg-[#0c0c0e] border border-zinc-300 dark:border-zinc-800/60 rounded-[1.5rem] p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6 opacity-80">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-500"><Baby size={18} /></div>
                        <h3 className="text-sm font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">Core Identity</h3>
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-8">
                            <ModernInput
                                label="Full Name"
                                icon={User}
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Child's full name"
                            />
                        </div>
                        <div className="col-span-4">
                            <ModernInput
                                label="ID"
                                icon={Hash}
                                name="manual_id"
                                value={formData.manual_id}
                                onChange={handleChange}
                                disabled={!user?.is_superuser}
                                className="font-mono text-center tracking-widest text-zinc-500 dark:text-zinc-400"
                            />
                        </div>

                        <div className="col-span-12">
                            <CountrySelector
                                value={formData.country}
                                onChange={handleChange}
                                countries={countries}
                                onAddClick={() => setIsAddModalOpen(true)}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-50 dark:bg-[#0c0c0e] border border-zinc-300 dark:border-zinc-800/60 rounded-[1.5rem] p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6 opacity-80">
                        <div className="p-2 bg-green-500/10 rounded-lg text-green-600 dark:text-green-500"><Phone size={18} /></div>
                        <h3 className="text-sm font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">Contact Channels</h3>
                    </div>

                    <div className="space-y-5">
                        <PhoneInputWithCountry
                            label="Parent's WhatsApp (Primary)"
                            name="parent_phone"
                            value={formData.parent_phone}
                            onChange={handleChange}
                            defaultCountryName={formData.country}
                            countries={countries}
                        />

                        <PhoneInputWithCountry
                            label="Child's Phone (Optional)"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            defaultCountryName={formData.country}
                            countries={countries}
                        />

                        <ModernInput
                            label="Home Address"
                            icon={MapPin}
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="Street, City"
                        />
                    </div>
                </div>
            </div>

            {/* --- COLUMN 2 --- */}
            <div className="space-y-6">

                <div className="bg-zinc-50 dark:bg-[#0c0c0e] border border-zinc-300 dark:border-zinc-800/60 rounded-[1.5rem] p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6 opacity-80">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600 dark:text-purple-500"><Activity size={18} /></div>
                            <h3 className="text-sm font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">Physical & Sport</h3>
                        </div>
                        <div className="bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 px-3 py-1 rounded-lg">
                            <span className="text-xs text-zinc-600 dark:text-zinc-500 font-bold uppercase mr-2">Age</span>
                            <span className="text-sm font-mono text-zinc-900 dark:text-white">{displayAge ?? '--'}</span>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="relative">
                            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-1.5 mb-1.5">
                                <Calendar size={12} /> Date of Birth
                            </label>
                            <input
                                type="date"
                                name="birth_date"
                                value={formData.birth_date || ''}
                                onChange={handleChange}
                                max={new Date().toISOString().split('T')[0]}
                                className="w-full bg-zinc-200 dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none focus:border-purple-500 focus:bg-zinc-100 dark:focus:bg-zinc-900 [color-scheme:light] dark:[color-scheme:dark] transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-1.5 mb-3">
                                <Trophy size={12} /> Discipline
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {SPORTS_OPTIONS.map((sport) => {
                                    const isSelected = sport.id === 'Other'
                                        ? isOtherActive
                                        : formData.nature_of_work === sport.id;

                                    return (
                                        <button
                                            key={sport.id}
                                            type="button"
                                            onClick={() => handleChange({ target: { name: 'nature_of_work', value: sport.id } })}
                                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-300 hover:scale-105 active:scale-95
                                                ${isSelected
                                                    ? `${sport.bg} ${sport.border} ${sport.color} ring-1 ring-inset ring-white/10`
                                                    : 'bg-zinc-200 dark:bg-[#18181b] border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-600 hover:bg-zinc-300 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-400'
                                                }
                                            `}
                                        >
                                            <sport.icon size={20} />
                                            <span className="text-[10px] font-black uppercase tracking-tight">{sport.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {isOtherActive && (
                                <div className="mt-3 animate-in slide-in-from-top-2 fade-in duration-200">
                                    <input
                                        type="text"
                                        name="nature_of_work"
                                        value={formData.nature_of_work === 'Other' ? '' : formData.nature_of_work}
                                        onChange={handleChange}
                                        placeholder="Specific Sport Name..."
                                        autoFocus
                                        className="w-full bg-zinc-200 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-sm outline-none focus:border-zinc-500 dark:focus:border-zinc-600"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-50 dark:bg-[#0c0c0e] border border-zinc-300 dark:border-zinc-800/60 rounded-[1.5rem] p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6 opacity-80">
                        <div className="p-2 bg-orange-500/10 rounded-lg text-orange-600 dark:text-orange-500"><Stethoscope size={18} /></div>
                        <h3 className="text-sm font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">History & Medical</h3>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Trained Before?</span>
                                <div className="flex bg-zinc-200 dark:bg-[#18181b] p-1 rounded-xl border border-zinc-300 dark:border-zinc-800">
                                    <ToggleTile label="No"  active={!formData.trained_gym_before} onClick={() => handleChange({ target: { name: 'trained_gym_before', value: false } })} activeColorClass="bg-zinc-600 dark:bg-zinc-700" icon={X} />
                                    <ToggleTile label="Yes" active={formData.trained_gym_before}  onClick={() => handleChange({ target: { name: 'trained_gym_before', value: true  } })} activeColorClass="bg-emerald-600" icon={Check} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Has Coach?</span>
                                <div className="flex bg-zinc-200 dark:bg-[#18181b] p-1 rounded-xl border border-zinc-300 dark:border-zinc-800">
                                    <ToggleTile label="No"  active={!formData.trained_coach_before} onClick={() => handleChange({ target: { name: 'trained_coach_before', value: false } })} activeColorClass="bg-zinc-600 dark:bg-zinc-700" icon={X} />
                                    <ToggleTile label="Yes" active={formData.trained_coach_before}  onClick={() => handleChange({ target: { name: 'trained_coach_before', value: true  } })} activeColorClass="bg-blue-600" icon={Check} />
                                </div>
                            </div>
                        </div>

                        <div className="relative group">
                            <label className={`text-xs font-bold uppercase tracking-wider ml-1 flex items-center gap-1.5 mb-1.5 transition-colors ${formData.injuries ? 'text-red-500' : 'text-zinc-600 dark:text-zinc-500'}`}>
                                <Stethoscope size={12} /> Medical Conditions / Injuries
                            </label>
                            <textarea
                                name="injuries"
                                value={formData.injuries || ''}
                                onChange={handleChange}
                                rows={3}
                                className={`w-full bg-zinc-200 dark:bg-[#18181b] border rounded-xl px-4 py-3 text-zinc-900 dark:text-white outline-none transition-all resize-none
                                    ${formData.injuries
                                        ? 'border-red-500/50 dark:border-red-900/50 bg-red-100 dark:bg-red-900/10 focus:border-red-500 text-red-700 dark:text-red-100 placeholder:text-red-400/50'
                                        : 'border-zinc-300 dark:border-zinc-800 focus:border-zinc-500 dark:focus:border-zinc-600 placeholder:text-zinc-500 dark:placeholder:text-zinc-700'
                                    }
                                `}
                                placeholder="None"
                            />
                            {formData.injuries && (
                                <div className="absolute bottom-3 right-3 text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                    ALERT ACTIVE
                                </div>
                            )}
                        </div>

                        <ModernInput
                            label="Internal Notes"
                            icon={FileText}
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            placeholder="Extra info..."
                        />
                    </div>
                </div>
            </div>

            {/* --- ADD COUNTRY MODAL --- */}
            {isAddModalOpen && (
                <div
                    className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) handleCloseAddModal(); }}
                >
                    <div className="bg-zinc-50 dark:bg-[#18181b] border border-zinc-300 dark:border-zinc-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2">
                                <Globe className="text-blue-500" size={20} /> Add Country
                            </h3>
                            <button onClick={handleCloseAddModal} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCountry} noValidate className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-600 dark:text-zinc-500 uppercase ml-1">Country Name</label>
                                <input
                                    required
                                    placeholder="e.g. Bahrain"
                                    className={`w-full bg-zinc-200 dark:bg-zinc-950 border rounded-xl px-4 py-3 text-zinc-900 dark:text-white outline-none mt-1 transition-all
                                        ${countryErrors.name ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800 focus:border-blue-500'}
                                    `}
                                    value={newCountry.name}
                                    onChange={e => handleCountryFieldChange('name', e.target.value)}
                                />
                                {countryErrors.name && <p className="text-xs text-red-500 mt-1">{countryErrors.name}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-zinc-600 dark:text-zinc-500 uppercase ml-1">ISO Code</label>
                                    <input
                                        required
                                        placeholder="BH"
                                        maxLength={2}
                                        className={`w-full bg-zinc-200 dark:bg-zinc-950 border rounded-xl px-4 py-3 text-zinc-900 dark:text-white outline-none mt-1 uppercase transition-all
                                            ${countryErrors.code ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800 focus:border-blue-500'}
                                        `}
                                        value={newCountry.code}
                                        onChange={e => handleCountryFieldChange('code', e.target.value.toUpperCase())}
                                    />
                                    {countryErrors.code && <p className="text-xs text-red-500 mt-1">{countryErrors.code}</p>}
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-600 dark:text-zinc-500 uppercase ml-1">Dial Code</label>
                                    <input
                                        required
                                        placeholder="+973"
                                        className={`w-full bg-zinc-200 dark:bg-zinc-950 border rounded-xl px-4 py-3 text-zinc-900 dark:text-white outline-none mt-1 transition-all
                                            ${countryErrors.dial_code ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-800 focus:border-blue-500'}
                                        `}
                                        value={newCountry.dial_code}
                                        onChange={e => handleCountryFieldChange('dial_code', e.target.value)}
                                    />
                                    {countryErrors.dial_code && <p className="text-xs text-red-500 mt-1">{countryErrors.dial_code}</p>}
                                </div>
                            </div>
                            <button
                                disabled={isSubmitting}
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-lg mt-2 flex items-center justify-center gap-2 transition-all"
                            >
                                {isSubmitting ? <><Loader size={16} className="animate-spin" /> Saving...</> : 'Save Country'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChildInfoTab;
