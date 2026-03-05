// ChildInfoTab.jsx — Premium Refactor
// Bento-grid layout · Zod validation · Custom hooks · Skeleton screens

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  User, Hash, Calendar, MapPin,
  Activity, Phone, FileText, Globe, Trophy,
  Stethoscope, Plus, X, Loader2,
  Dumbbell, Baby, Check, MessageCircle, AlertCircle, Shield
} from 'lucide-react';
import { z } from 'zod';
import api from '../../api';
import { useCountries, countrySchema } from '../../hooks/useCountries';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const SPORTS = [
  { id: 'Football', label: 'Football', icon: Trophy,   accent: { ring: 'ring-emerald-500/60', bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' } },
  { id: 'Swimming', label: 'Swimming', icon: Activity,  accent: { ring: 'ring-cyan-500/60',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    dot: 'bg-cyan-400' } },
  { id: 'Tennis',   label: 'Tennis',   icon: Activity,  accent: { ring: 'ring-amber-500/60',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400' } },
  { id: 'Combat',   label: 'Combat',   icon: Dumbbell,  accent: { ring: 'ring-rose-500/60',    bg: 'bg-rose-500/10',    text: 'text-rose-400',    dot: 'bg-rose-400' } },
  { id: 'Other',    label: 'Other',    icon: Hash,      accent: { ring: 'ring-zinc-500/60',    bg: 'bg-zinc-700/40',    text: 'text-zinc-400',    dot: 'bg-zinc-400' } },
];

// ─────────────────────────────────────────────
// ZOD SCHEMA — Country form
// ─────────────────────────────────────────────



// ─────────────────────────────────────────────
// CUSTOM HOOK — useCountries
// ─────────────────────────────────────────────



// ─────────────────────────────────────────────
// SKELETON COMPONENTS
// ─────────────────────────────────────────────

const Pulse = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800/60 ${className}`} />
);

const SkeletonCard = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/60 rounded-2xl p-5 backdrop-blur-sm ${className}`}>
    {children}
  </div>
);

const CountrySkeleton = () => (
  <div className="xl:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-5 animate-pulse">
    <SkeletonCard>
      <Pulse className="h-4 w-32 mb-5" />
      <div className="space-y-4">
        <Pulse className="h-12" />
        <Pulse className="h-12" />
        <Pulse className="h-12" />
      </div>
    </SkeletonCard>
    <SkeletonCard>
      <Pulse className="h-4 w-32 mb-5" />
      <div className="space-y-4">
        <Pulse className="h-12" />
        <Pulse className="h-12" />
        <Pulse className="h-12" />
      </div>
    </SkeletonCard>
  </div>
);

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
    <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border text-sm font-semibold
      animate-in slide-in-from-bottom-4 duration-300
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
// PRIMITIVE INPUTS
// ─────────────────────────────────────────────

const FieldInput = ({ label, icon: Icon, error, className: cls = '', ...props }) => (
  <div className="w-full space-y-1.5">
    {label && (
      <label className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ml-0.5
        ${error ? 'text-red-500 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-500'}`}
      >
        {Icon && <Icon size={11} />}{label}
      </label>
    )}
    <input
      {...props}
      className={`w-full bg-zinc-50 dark:bg-zinc-900 border rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition-all
        placeholder:text-zinc-400 dark:placeholder:text-zinc-700 caret-blue-500 dark:caret-blue-400
        hover:border-zinc-400 dark:hover:border-zinc-700
        disabled:opacity-40 disabled:cursor-not-allowed
        ${error
          ? 'border-red-400 dark:border-red-600/50 focus:border-red-500 bg-red-50/50 dark:bg-red-950/20'
          : 'border-zinc-300 dark:border-zinc-800 focus:border-blue-500/70 dark:focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/20'
        } ${cls}`}
    />
    {error && <p className="text-[11px] text-red-500 dark:text-red-400 ml-0.5">{error}</p>}
  </div>
);

// ─────────────────────────────────────────────
// COUNTRY SELECTOR
// ─────────────────────────────────────────────

const CountrySelector = ({ value, onChange, countries, onAddClick }) => (
  <div className="w-full space-y-1.5">
    <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ml-0.5 text-zinc-500 dark:text-zinc-500">
      <Globe size={11} />Nationality
    </label>
    <div className="flex flex-col sm:flex-row gap-2">
      <select
        name="country"
        value={value}
        onChange={onChange}
        className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none
          focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/20 appearance-none cursor-pointer
          hover:border-zinc-400 dark:hover:border-zinc-700 transition-all"
      >
        <option value="">Select nationality…</option>
        {countries.map(c => (
          <option key={c.id} value={c.name}>{c.name} ({c.code})</option>
        ))}
      </select>
      <button
        type="button"
        onClick={onAddClick}
        title="Add country"
        className="w-full sm:w-auto px-3 py-3 sm:py-0 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-500 dark:text-blue-400 rounded-xl
          hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-all active:scale-95 flex items-center justify-center"
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
  const [isOpen, setIsOpen]             = useState(false);
  const [selected, setSelected]         = useState(null);
  const [search, setSearch]             = useState('');
  const wrapperRef                      = useRef(null);

  useEffect(() => {
    if (!countries.length) return;
    const match = countries.find(c => c.name === defaultCountryName);
    setSelected(prev => prev || match || countries[0]);
  }, [countries, defaultCountryName]);

  useEffect(() => {
    const close = e => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
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
          c.code.toLowerCase().includes(search.toLowerCase())
        )
      : countries,
    [countries, search]
  );

  const handleWhatsApp = useCallback(() => {
    if (!value || !selected) return;
    const code   = (selected.dial_code || '').replace('+', '');
    const number = value.replace(/^0+/, '');
    window.open(`https://wa.me/${code}${number}`, '_blank', 'noopener,noreferrer');
  }, [value, selected]);

  const cur = selected || { code: '??', dial_code: '??' };

  return (
    <div className="w-full space-y-1.5" ref={wrapperRef}>
      <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ml-0.5 text-zinc-500 dark:text-zinc-500">
        <Phone size={11} />{label}
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Code picker */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsOpen(o => !o)}
            className="w-full sm:w-[4.5rem] bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl
              flex items-center justify-center sm:flex-col py-3.5 px-3 sm:px-1 gap-2 sm:gap-0
              hover:border-zinc-400 dark:hover:border-zinc-700 transition-all"
          >
            <span className="text-xs font-black text-zinc-800 dark:text-zinc-100 leading-none sm:mb-0.5">{cur.code}</span>
            <span className="text-[10px] font-mono text-zinc-500 leading-none">{cur.dial_code}</span>
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-2 w-60 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50
              animate-in fade-in zoom-in-95 duration-150 origin-top-left overflow-hidden">
              <div className="p-2 border-b border-zinc-200 dark:border-zinc-800">
                <input
                  autoFocus
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200
                    outline-none focus:border-blue-500/50 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
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

        {/* Number */}
        <input
          type="tel"
          name={name}
          value={value}
          onChange={onChange}
          placeholder="1000000000"
          inputMode="tel"
          className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5
            text-zinc-900 dark:text-zinc-100 text-sm font-mono outline-none
            focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/20
            hover:border-zinc-400 dark:hover:border-zinc-700 transition-all"
        />

        {/* WhatsApp */}
        <button
          type="button"
          onClick={handleWhatsApp}
          disabled={!value}
          title="Open in WhatsApp"
          className={`w-full sm:w-auto px-3.5 py-3.5 rounded-xl border flex items-center justify-center transition-all duration-200
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
// TOGGLE PAIR
// ─────────────────────────────────────────────

const TogglePair = ({ label, name, value, onTrue, onFalse, trueLabel = 'Yes', falseLabel = 'No', trueColor = 'bg-emerald-600', icon: Icon }) => (
  <div className="space-y-2">
    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
      {Icon && <Icon size={11} />}{label}
    </span>
    <div className="flex bg-zinc-100 dark:bg-zinc-900/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 gap-1">
      <button
        type="button"
        onClick={onFalse}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-bold uppercase transition-all duration-200
          ${!value ? 'bg-zinc-400 dark:bg-zinc-700 text-white shadow' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
      >
        <X size={12} />{falseLabel}
      </button>
      <button
        type="button"
        onClick={onTrue}
        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-bold uppercase transition-all duration-200
          ${value ? `${trueColor} text-white shadow-lg` : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
      >
        <Check size={12} />{trueLabel}
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────

const SectionHeader = ({ icon: Icon, label, accent = 'text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10', action }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-2.5">
      <span className={`p-2 rounded-xl ${accent}`}>
        <Icon size={16} />
      </span>
      <h3 className="text-xs font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">{label}</h3>
    </div>
    {action}
  </div>
);

const BentoCard = ({ children, className = '', glowColor = '' }) => (
  <div className={`relative bg-white dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800/70 rounded-2xl p-5 backdrop-blur-sm overflow-hidden shadow-sm dark:shadow-none transition-colors ${className}`}>
    {glowColor && (
      <div className={`absolute top-0 right-0 w-40 h-40 ${glowColor} blur-[80px] opacity-10 dark:opacity-30 pointer-events-none rounded-full`} />
    )}
    {children}
  </div>
);

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

const ChildInfoTab = ({ formData, handleChange, clientAge, user }) => {
  const { countries, isLoading: countriesLoading, addCountry } = useCountries();

  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [newCountry, setNewCountry]         = useState({ name: '', code: '', dial_code: '' });
  const [countryErrors, setCountryErrors]   = useState({});
  const [toast, setToast]                   = useState(null);

  const showToast   = useCallback((message, type = 'error') => setToast({ message, type }), []);
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
      showToast('Country added successfully', 'success');
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
    return age >= 0 ? age : null;
  }, [formData.birth_date, clientAge]);

  const isOtherActive = useMemo(() => {
    const stdIds = SPORTS.filter(s => s.id !== 'Other').map(s => s.id);
    return formData.nature_of_work !== '' && !stdIds.includes(formData.nature_of_work);
  }, [formData.nature_of_work]);

  const activeSportId = useMemo(() => {
    if (isOtherActive) return 'Other';
    return formData.nature_of_work || '';
  }, [formData.nature_of_work, isOtherActive]);

  if (countriesLoading) return <CountrySkeleton />;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-3 duration-500 relative">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      {/* ── COLUMN 1 ── */}
      <div className="space-y-5">

        {/* Core Identity */}
        <BentoCard glowColor="bg-blue-500">
          <SectionHeader icon={Baby} label="Core Identity" accent="text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10" />
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-8">
              <FieldInput
                label="Full Name"
                icon={User}
                name="name"
                value={formData.name || ''}
                onChange={handleChange}
                placeholder="Child's full name"
              />
            </div>
            <div className="col-span-4">
              <FieldInput
                label="ID"
                icon={Hash}
                name="manual_id"
                value={formData.manual_id || ''}
                onChange={handleChange}
                disabled={!user?.is_superuser}
                className="font-mono text-center tracking-widest text-zinc-500 text-xs"
              />
            </div>
            <div className="col-span-12">
              <CountrySelector
                value={formData.country || ''}
                onChange={handleChange}
                countries={countries}
                onAddClick={() => setIsModalOpen(true)}
              />
            </div>
          </div>
        </BentoCard>

        {/* Contact Channels */}
        <BentoCard glowColor="bg-emerald-500">
          <SectionHeader icon={Phone} label="Contact Channels" accent="text-emerald-500 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10" />
          <div className="space-y-5">
            <PhoneInput
              label="Parent's WhatsApp (Primary)"
              name="parent_phone"
              value={formData.parent_phone || ''}
              onChange={handleChange}
              defaultCountryName={formData.country}
              countries={countries}
            />
            <PhoneInput
              label="Child's Phone (Optional)"
              name="phone"
              value={formData.phone || ''}
              onChange={handleChange}
              defaultCountryName={formData.country}
              countries={countries}
            />
            <FieldInput
              label="Home Address"
              icon={MapPin}
              name="address"
              value={formData.address || ''}
              onChange={handleChange}
              placeholder="Street, City"
            />
          </div>
        </BentoCard>
      </div>

      {/* ── COLUMN 2 ── */}
      <div className="space-y-5">

        {/* Physical & Sport */}
        <BentoCard glowColor="bg-purple-500">
          <SectionHeader
            icon={Activity}
            label="Physical & Sport"
            accent="text-purple-500 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/10"
            action={
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <Calendar size={11} className="text-zinc-500" />
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Age</span>
                <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 font-mono">{displayAge ?? '--'}</span>
              </div>
            }
          />
          <div className="space-y-5">
            {/* Date of birth */}
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ml-0.5 text-zinc-500 mb-1.5">
                <Calendar size={11} />Date of Birth
              </label>
              <input
                type="date"
                name="birth_date"
                value={formData.birth_date || ''}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-zinc-900 dark:text-zinc-100
                  outline-none focus:border-purple-500/70 focus:ring-1 focus:ring-purple-500/20
                  hover:border-zinc-400 dark:hover:border-zinc-700
                  [color-scheme:light] dark:[color-scheme:dark] transition-all"
              />
            </div>

            {/* Discipline selector */}
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ml-0.5 text-zinc-500 mb-3">
                <Trophy size={11} />Discipline
              </label>
              <div className="grid grid-cols-5 gap-2">
                {SPORTS.map(sport => {
                  const isSelected = activeSportId === sport.id;
                  return (
                    <button
                      key={sport.id}
                      type="button"
                      onClick={() => handleChange({ target: { name: 'nature_of_work', value: sport.id } })}
                      className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200
                        hover:scale-105 active:scale-95
                        ${isSelected
                          ? `${sport.accent.bg} border-zinc-300 dark:border-zinc-700 ${sport.accent.text} ring-1 ${sport.accent.ring}`
                          : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-400'
                        }`}
                    >
                      <sport.icon size={18} />
                      <span className="text-[9px] font-black uppercase tracking-tight">{sport.label}</span>
                    </button>
                  );
                })}
              </div>

              {isOtherActive && (
                <div className="mt-3 animate-in slide-in-from-top-2 fade-in duration-200">
                  <input
                    autoFocus
                    type="text"
                    name="nature_of_work"
                    value={formData.nature_of_work === 'Other' ? '' : formData.nature_of_work}
                    onChange={handleChange}
                    placeholder="Specific sport name…"
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100
                      outline-none focus:border-zinc-400 dark:focus:border-zinc-600 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 transition-all"
                  />
                </div>
              )}
            </div>
          </div>
        </BentoCard>

        {/* History & Medical */}
        <BentoCard glowColor="bg-orange-500">
          <SectionHeader icon={Stethoscope} label="History & Medical" accent="text-orange-500 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/10" />
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <TogglePair
                label="Trained Before?"
                value={formData.trained_gym_before}
                onTrue={() => handleChange({ target: { name: 'trained_gym_before', value: true } })}
                onFalse={() => handleChange({ target: { name: 'trained_gym_before', value: false } })}
                trueColor="bg-emerald-600"
              />
              <TogglePair
                label="Has Coach?"
                value={formData.trained_coach_before}
                onTrue={() => handleChange({ target: { name: 'trained_coach_before', value: true } })}
                onFalse={() => handleChange({ target: { name: 'trained_coach_before', value: false } })}
                trueColor="bg-blue-600"
              />
            </div>

            {/* Injuries textarea */}
            <div className="relative">
              <label className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ml-0.5 mb-1.5
                ${formData.injuries ? 'text-red-500 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-500'}`}
              >
                <Stethoscope size={11} />Medical Conditions / Injuries
              </label>
              <textarea
                name="injuries"
                value={formData.injuries || ''}
                onChange={handleChange}
                rows={3}
                placeholder="None"
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100
                  outline-none resize-none transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-700
                  ${formData.injuries
                    ? 'border-red-300 dark:border-red-700/50 bg-red-50/50 dark:bg-red-950/20 focus:border-red-400 dark:focus:border-red-600'
                    : 'border-zinc-300 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-700'
                  }`}
              />
              {formData.injuries && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-md
                  bg-red-500/10 border border-red-400/20 dark:border-red-500/20 text-[9px] font-black text-red-500 dark:text-red-400 uppercase">
                  <Shield size={9} />Alert Active
                </div>
              )}
            </div>

            <FieldInput
              label="Internal Notes"
              icon={FileText}
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              placeholder="Extra info…"
            />
          </div>
        </BentoCard>
      </div>

      {/* ── ADD COUNTRY MODAL ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4
            animate-in fade-in duration-200"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl
            ring-1 ring-blue-500/10 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Globe size={18} className="text-blue-500 dark:text-blue-400" /> Add Country
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
                  className={`w-full mt-1.5 bg-zinc-50 dark:bg-zinc-900 border rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none transition-all
                    ${countryErrors.name ? 'border-red-400 dark:border-red-600/60' : 'border-zinc-300 dark:border-zinc-800 focus:border-blue-500/60'}`}
                />
                {countryErrors.name && <p className="text-[11px] text-red-500 dark:text-red-400 mt-1">{countryErrors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-0.5">ISO Code</label>
                  <input
                    placeholder="BH"
                    maxLength={2}
                    value={newCountry.code}
                    onChange={e => handleCountryField('code', e.target.value.toUpperCase())}
                    className={`w-full mt-1.5 bg-zinc-50 dark:bg-zinc-900 border rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 uppercase font-mono outline-none transition-all
                      ${countryErrors.code ? 'border-red-400 dark:border-red-600/60' : 'border-zinc-300 dark:border-zinc-800 focus:border-blue-500/60'}`}
                  />
                  {countryErrors.code && <p className="text-[11px] text-red-500 dark:text-red-400 mt-1">{countryErrors.code}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-0.5">Dial Code</label>
                  <input
                    placeholder="+973"
                    value={newCountry.dial_code}
                    onChange={e => handleCountryField('dial_code', e.target.value)}
                    className={`w-full mt-1.5 bg-zinc-50 dark:bg-zinc-900 border rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 font-mono outline-none transition-all
                      ${countryErrors.dial_code ? 'border-red-400 dark:border-red-600/60' : 'border-zinc-300 dark:border-zinc-800 focus:border-blue-500/60'}`}
                  />
                  {countryErrors.dial_code && <p className="text-[11px] text-red-500 dark:text-red-400 mt-1">{countryErrors.dial_code}</p>}
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed
                  text-white text-sm font-bold rounded-xl shadow-lg flex items-center justify-center gap-2
                  transition-all active:scale-95"
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

export default ChildInfoTab;