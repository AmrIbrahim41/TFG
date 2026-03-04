// ClientInfoTab.jsx — Refactored: Light Mode + Mobile Layout
// ─ All sub-components now use dual light/dark Tailwind classes
// ─ Mobile: single-column stacking with comfortable spacing
// ─ Animations enhanced with smooth enter transitions

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  User, Hash, Calendar, Briefcase, MapPin,
  Activity, Heart, Moon, FileText, Cigarette,
  Check, Globe, Phone, Plus, X, Loader2, MessageCircle,
  AlertCircle,
} from 'lucide-react';
import { z } from 'zod';
import api from '../../api';
import { useCountries, countrySchema } from '../../hooks/useCountries';

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
const Toast = ({ message, type = 'error', onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const isError = type === 'error';
  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border text-sm font-semibold animate-in slide-in-from-bottom-4 duration-300
        ${isError
          ? 'bg-red-50 dark:bg-red-950/90 border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300'
          : 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
        }`}
    >
      <AlertCircle size={15} className="shrink-0" />
      {message}
      <button onClick={onDismiss} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
        <X size={13} />
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────
const Pulse = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800/60 ${className}`} />
);

const FormSkeleton = () => (
  <div className="space-y-5 animate-pulse">
    {[1, 2, 3].map(n => (
      <div key={n} className="bg-white dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/70 rounded-2xl p-5">
        <Pulse className="h-4 w-32 mb-5" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Pulse className="h-12" />
          <Pulse className="h-12" />
          <Pulse className="sm:col-span-2 h-12" />
        </div>
      </div>
    ))}
  </div>
);

// ─────────────────────────────────────────────
// BENTO CARD
// ─────────────────────────────────────────────
const BentoCard = ({ children, className = '', glow = '' }) => (
  <div
    className={`relative bg-white dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/70 rounded-2xl p-4 md:p-5 backdrop-blur-sm overflow-hidden shadow-sm dark:shadow-none transition-colors ${className}`}
  >
    {glow && (
      <div className={`absolute top-0 right-0 w-48 h-48 ${glow} blur-[90px] opacity-10 dark:opacity-25 pointer-events-none`} />
    )}
    {children}
  </div>
);

const SectionHeader = ({ icon: Icon, label, accent }) => (
  <div className="flex items-center gap-2.5 mb-4 md:mb-5">
    <span className={`p-2 rounded-xl ${accent}`}><Icon size={16} /></span>
    <h3 className="text-xs font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">{label}</h3>
  </div>
);

// ─────────────────────────────────────────────
// FIELD INPUT
// ─────────────────────────────────────────────
const FieldInput = ({ label, icon: Icon, className: cls = '', ...props }) => (
  <div className="w-full space-y-1.5">
    {label && (
      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ml-0.5 text-zinc-500 dark:text-zinc-500 transition-colors">
        {Icon && <Icon size={11} />}{label}
      </label>
    )}
    <input
      {...props}
      className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none
        placeholder:text-zinc-400 dark:placeholder:text-zinc-700 caret-orange-500 transition-all
        focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20
        hover:border-zinc-400 dark:hover:border-zinc-700
        disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
    />
  </div>
);

// ─────────────────────────────────────────────
// COUNTRY SELECTOR
// ─────────────────────────────────────────────
const CountrySelector = ({ value, onChange, countries, onAddClick }) => (
  <div className="w-full space-y-1.5">
    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ml-0.5 text-zinc-500">
      <Globe size={11} />Nationality
    </label>
    <div className="flex gap-2">
      <select
        name="country"
        value={value}
        onChange={onChange}
        className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none
          focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 appearance-none cursor-pointer
          hover:border-zinc-400 dark:hover:border-zinc-700 transition-all"
      >
        <option value="">Select country…</option>
        {countries.map(c => (
          <option key={c.id} value={c.name}>{c.name} ({c.code})</option>
        ))}
      </select>
      <button
        type="button"
        onClick={onAddClick}
        className="px-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 text-orange-500 dark:text-orange-400 rounded-xl
          hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all active:scale-95"
      >
        <Plus size={18} />
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// PHONE INPUT
// ─────────────────────────────────────────────
const PhoneInput = ({ label, name, value, onChange, defaultCountryName, countries }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!countries.length) return;
    const match = countries.find(c => c.name === defaultCountryName);
    setSelected(prev => prev || match || countries[0]);
  }, [countries, defaultCountryName]);

  useEffect(() => {
    const close = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = useMemo(() =>
    search
      ? countries.filter(c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase()))
      : countries,
    [countries, search]
  );

  const handleWhatsApp = useCallback(() => {
    if (!value || !selected) return;
    const code = (selected.dial_code || '').replace('+', '');
    const number = value.replace(/^0+/, '');
    window.open(`https://wa.me/${code}${number}`, '_blank', 'noopener,noreferrer');
  }, [value, selected]);

  const cur = selected || { code: '??', dial_code: '??' };

  return (
    <div className="w-full space-y-1.5" ref={ref}>
      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ml-0.5 text-zinc-500">
        <Phone size={11} />{label}
      </label>
      <div className="flex gap-2">
        {/* Dial code trigger */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsOpen(o => !o)}
            className="w-[4.5rem] h-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center py-3.5 px-1 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all"
          >
            <span className="text-xs font-black text-zinc-800 dark:text-zinc-100 leading-none mb-0.5">{cur.code}</span>
            <span className="text-[10px] font-mono text-zinc-500 leading-none">{cur.dial_code}</span>
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-left overflow-hidden">
              <div className="p-2 border-b border-zinc-200 dark:border-zinc-800">
                <input
                  autoFocus
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-orange-500/50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                />
              </div>
              <div className="max-h-44 overflow-y-auto p-1">
                {filtered.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelected(c); setIsOpen(false); setSearch(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left"
                  >
                    <span className="text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-300 shrink-0">{c.code}</span>
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 flex-1 truncate">{c.name}</span>
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600 shrink-0">{c.dial_code}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <input
          type="tel"
          name={name}
          value={value}
          onChange={onChange}
          placeholder="1000000000"
          inputMode="tel"
          className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-zinc-100 font-mono outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all"
        />

        <button
          type="button"
          onClick={handleWhatsApp}
          disabled={!value}
          className={`px-3.5 rounded-xl border flex items-center justify-center transition-all duration-200
            ${value
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 active:scale-95'
              : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
            }`}
        >
          <MessageCircle size={18} />
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// FLIP CARD — Age / Birth Date
// ─────────────────────────────────────────────
const AgeDateFlip = ({ displayAge, birthDate, onChangeDate }) => {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ml-0.5 text-zinc-500">
        <Calendar size={11} />Age / Birth Date
      </label>
      <div className="relative h-[54px] [perspective:1000px]">
        <div className={`relative w-full h-full transition-all duration-700 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
          {/* Front */}
          <div
            onClick={() => setFlipped(true)}
            className="absolute inset-0 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 flex items-center justify-between cursor-pointer hover:border-orange-500/40 dark:hover:border-orange-500/40 [backface-visibility:hidden] transition-colors"
          >
            <span className={birthDate ? 'text-sm text-zinc-900 dark:text-zinc-100 font-bold' : 'text-sm text-zinc-400 dark:text-zinc-600'}>
              {displayAge ? `${displayAge} Years Old` : 'Set Birth Date'}
            </span>
            <Calendar size={15} className="text-zinc-400 dark:text-zinc-600" />
          </div>
          {/* Back */}
          <div className="absolute inset-0 bg-zinc-50 dark:bg-zinc-900 border border-orange-500/60 rounded-xl px-3 flex items-center gap-2 [transform:rotateY(180deg)] [backface-visibility:hidden]">
            <input
              type="date"
              name="birth_date"
              value={birthDate || ''}
              onChange={onChangeDate}
              max={new Date().toISOString().split('T')[0]}
              className="bg-transparent text-sm text-zinc-900 dark:text-zinc-100 w-full outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setFlipped(false); }}
              className="p-1.5 bg-orange-500 rounded-lg text-white hover:bg-orange-400 shrink-0 transition-colors"
            >
              <Check size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// MARITAL STATUS SELECTOR
// ─────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'Single',   label: 'Single',   icon: User,  activeLight: 'bg-blue-50 border-blue-400 text-blue-600',   activeDark: 'dark:bg-blue-500/15 dark:border-blue-600/50 dark:text-blue-400' },
  { value: 'Married',  label: 'Married',  icon: Heart, activeLight: 'bg-rose-50 border-rose-400 text-rose-600',   activeDark: 'dark:bg-rose-500/15 dark:border-rose-600/50 dark:text-rose-400' },
  { value: 'Divorced', label: 'Divorced', icon: User,  activeLight: 'bg-orange-50 border-orange-400 text-orange-600', activeDark: 'dark:bg-orange-500/15 dark:border-orange-600/50 dark:text-orange-400' },
  { value: 'Widowed',  label: 'Widowed',  icon: User,  activeLight: 'bg-zinc-100 border-zinc-400 text-zinc-700',  activeDark: 'dark:bg-zinc-700/40 dark:border-zinc-600/50 dark:text-zinc-300' },
];

const MaritalSelector = ({ value, onChange }) => (
  <div className="space-y-2">
    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ml-0.5 text-zinc-500">
      <Heart size={11} />Marital Status
    </label>
    <div className="grid grid-cols-2 gap-2">
      {STATUS_OPTIONS.map(opt => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ target: { name: 'status', value: opt.value } })}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-xs font-bold uppercase transition-all duration-200 hover:scale-[1.02] active:scale-95
              ${isSelected
                ? `${opt.activeLight} ${opt.activeDark}`
                : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-400'
              }`}
          >
            <opt.icon size={14} />
            {opt.label}
          </button>
        );
      })}
    </div>
  </div>
);

// ─────────────────────────────────────────────
// SMOKING TOGGLE
// ─────────────────────────────────────────────
const SmokingToggle = ({ value, onChange }) => (
  <div
    onClick={() => onChange({ target: { name: 'smoking', type: 'checkbox', checked: !value } })}
    className={`cursor-pointer rounded-2xl p-4 border transition-all duration-300 flex items-center justify-between hover:scale-[1.01] active:scale-[0.99]
      ${value
        ? 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-700/50'
        : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
  >
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors
        ${value ? 'bg-red-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}
      >
        <Cigarette size={18} />
      </div>
      <div>
        <p className={`font-bold text-sm ${value ? 'text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
          Smoking Habits
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-600">{value ? 'Current Smoker' : 'Non-Smoker'}</p>
      </div>
    </div>
    {/* Toggle pill */}
    <div className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${value ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${value ? 'left-6' : 'left-1'}`} />
    </div>
  </div>
);

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
const ClientInfoTab = ({ formData, handleChange, clientAge, user }) => {
  const { countries, isLoading: countriesLoading, addCountry } = useCountries();

  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [newCountry, setNewCountry]       = useState({ name: '', code: '', dial_code: '' });
  const [countryErrors, setCountryErrors] = useState({});
  const [toast, setToast]                 = useState(null);

  const showToast    = useCallback((msg, type = 'error') => setToast({ message: msg, type }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setNewCountry({ name: '', code: '', dial_code: '' });
    setCountryErrors({});
  }, []);

  const handleCountryField = useCallback((field, val) => {
    setNewCountry(prev => ({ ...prev, [field]: val }));
    setCountryErrors(prev => ({ ...prev, [field]: undefined }));
  }, []);

  const handleSaveCountry = useCallback(async (e) => {
    e.preventDefault();
    const parsed = countrySchema.safeParse(newCountry);
    if (!parsed.success) {
      const errs = {};
      parsed.error.errors.forEach(err => { errs[err.path[0]] = err.message; });
      setCountryErrors(errs);
      return;
    }
    setIsSubmitting(true);
    try {
      await addCountry(parsed.data);
      closeModal();
      showToast('Country added successfully!', 'success');
    } catch {
      showToast('Error adding country — code or name may already exist.');
    } finally {
      setIsSubmitting(false);
    }
  }, [newCountry, addCountry, closeModal, showToast]);

  const displayAge = useMemo(() => {
    if (!formData.birth_date) return clientAge;
    const today = new Date();
    const birth = new Date(formData.birth_date);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : clientAge;
  }, [formData.birth_date, clientAge]);

  if (countriesLoading) return <FormSkeleton />;

  // Common modal input class
  const modalInput = (hasError) =>
    `w-full mt-1.5 bg-zinc-50 dark:bg-zinc-900 border rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition-all ${hasError ? 'border-red-400 dark:border-red-600/60' : 'border-zinc-300 dark:border-zinc-800 focus:border-orange-500/60'}`;

  return (
    <div className="space-y-4 md:space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-500 relative">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      {/* ── IDENTITY ────────────────────────────────────── */}
      <BentoCard glow="bg-orange-500">
        <SectionHeader icon={User} label="Identity" accent="text-orange-500 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
          <div className="sm:col-span-2">
            <FieldInput
              label="Full Name"
              icon={User}
              name="name"
              value={formData.name || ''}
              onChange={handleChange}
              disabled={!user?.is_superuser}
              placeholder="Client full name"
            />
          </div>
          <CountrySelector
            value={formData.country || ''}
            onChange={handleChange}
            countries={countries}
            onAddClick={() => setIsModalOpen(true)}
          />
          <FieldInput
            label="System ID"
            icon={Hash}
            name="manual_id"
            value={formData.manual_id || ''}
            onChange={handleChange}
            disabled={!user?.is_superuser}
            cls="font-mono text-zinc-500 tracking-widest"
          />
          <div className="sm:col-span-2">
            <PhoneInput
              label="WhatsApp Number"
              name="phone"
              value={formData.phone || ''}
              onChange={handleChange}
              defaultCountryName={formData.country}
              countries={countries}
            />
          </div>
        </div>
      </BentoCard>

      {/* ── PERSONAL DETAILS ─────────────────────────────── */}
      <BentoCard glow="bg-blue-500">
        <SectionHeader icon={Briefcase} label="Personal Details" accent="text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
          <AgeDateFlip
            displayAge={displayAge}
            birthDate={formData.birth_date}
            onChangeDate={handleChange}
          />
          <FieldInput
            label="Nature of Work"
            icon={Briefcase}
            name="nature_of_work"
            value={formData.nature_of_work || ''}
            onChange={handleChange}
            placeholder="e.g. Accountant…"
          />
          <div className="sm:col-span-2">
            <FieldInput
              label="Address"
              icon={MapPin}
              name="address"
              value={formData.address || ''}
              onChange={handleChange}
              placeholder="Home address"
            />
          </div>
        </div>
      </BentoCard>

      {/* ── LIFESTYLE ───────────────────────────────────── */}
      <BentoCard glow="bg-rose-500">
        <SectionHeader icon={Activity} label="Lifestyle" accent="text-rose-500 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          <MaritalSelector value={formData.status || ''} onChange={handleChange} />

          <div className="space-y-4">
            {/* Sleep hours */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ml-0.5 text-zinc-500">
                <Moon size={11} />Daily Sleep (Hours)
              </label>
              <input
                type="number"
                name="sleep_hours"
                value={formData.sleep_hours || ''}
                onChange={handleChange}
                min="0"
                max="24"
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all"
              />
            </div>
            <SmokingToggle value={!!formData.smoking} onChange={handleChange} />
          </div>
        </div>
      </BentoCard>

      {/* ── NOTES ───────────────────────────────────────── */}
      <BentoCard>
        <SectionHeader icon={FileText} label="Notes & Medical History" accent="text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/60" />
        <textarea
          name="notes"
          value={formData.notes || ''}
          onChange={handleChange}
          rows={4}
          placeholder="Write any important details about the client here…"
          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-zinc-200 resize-none outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-700 focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/10 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all leading-relaxed"
        />
      </BentoCard>

      {/* ── ADD COUNTRY MODAL ─────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl ring-1 ring-orange-500/10 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Globe size={18} className="text-orange-500" />Add Country
              </h3>
              <button onClick={closeModal} className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCountry} noValidate className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-0.5">Country Name</label>
                <input
                  placeholder="e.g. Bahrain"
                  value={newCountry.name}
                  onChange={e => handleCountryField('name', e.target.value)}
                  className={modalInput(countryErrors.name)}
                />
                {countryErrors.name && <p className="text-[11px] text-red-500 mt-1">{countryErrors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-0.5">ISO Code</label>
                  <input
                    placeholder="BH"
                    maxLength={2}
                    value={newCountry.code}
                    onChange={e => handleCountryField('code', e.target.value.toUpperCase())}
                    className={`${modalInput(countryErrors.code)} uppercase font-mono`}
                  />
                  {countryErrors.code && <p className="text-[11px] text-red-500 mt-1">{countryErrors.code}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-0.5">Dial Code</label>
                  <input
                    placeholder="+973"
                    value={newCountry.dial_code}
                    onChange={e => handleCountryField('dial_code', e.target.value)}
                    className={`${modalInput(countryErrors.dial_code)} font-mono`}
                  />
                  {countryErrors.dial_code && <p className="text-[11px] text-red-500 mt-1">{countryErrors.dial_code}</p>}
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {isSubmitting ? <><Loader2 size={15} className="animate-spin" />Saving…</> : 'Save Country'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientInfoTab;
