import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Phone, MessageCircle } from 'lucide-react';

const COUNTRY_CODES = [
    { code: '+20',  country: 'EG', flag: '🇪🇬', name: 'Egypt' },
    { code: '+966', country: 'SA', flag: '🇸🇦', name: 'Saudi Arabia' },
    { code: '+971', country: 'AE', flag: '🇦🇪', name: 'UAE' },
    { code: '+965', country: 'KW', flag: '🇰🇼', name: 'Kuwait' },
    { code: '+973', country: 'BH', flag: '🇧🇭', name: 'Bahrain' },
    { code: '+974', country: 'QA', flag: '🇶🇦', name: 'Qatar' },
    { code: '+1',   country: 'US', flag: '🇺🇸', name: 'USA' },
    { code: '+44',  country: 'GB', flag: '🇬🇧', name: 'UK' },
];

// Sort by code length desc so longer codes (e.g. +966) match before shorter (+9)
const SORTED_CODES = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

const WhatsAppInput = ({ value, onChange, label = 'Phone Number' }) => {
    const [selectedCode, setSelectedCode] = useState('+20');
    const [localNumber, setLocalNumber] = useState('');
    // Track if we already parsed the initial value to avoid infinite loop
    const parsedRef = useRef(false);

    // Parse existing value once on mount / when value is provided externally
    useEffect(() => {
        if (!value || parsedRef.current) return;
        parsedRef.current = true;

        const found = SORTED_CODES.find((c) => value.startsWith(c.code));
        if (found) {
            setSelectedCode(found.code);
            setLocalNumber(value.slice(found.code.length));
        } else {
            setLocalNumber(value);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const emitChange = useCallback(
        (code, num) => {
            onChange({ target: { name: 'phone', value: `${code}${num}` } });
        },
        [onChange]
    );

    const handleNumberChange = useCallback(
        (e) => {
            const num = e.target.value;
            setLocalNumber(num);
            emitChange(selectedCode, num);
        },
        [selectedCode, emitChange]
    );

    const handleCodeChange = useCallback(
        (e) => {
            const code = e.target.value;
            setSelectedCode(code);
            emitChange(code, localNumber);
        },
        [localNumber, emitChange]
    );

    const openWhatsApp = useCallback(() => {
        if (!localNumber) return;
        const cleanCode = selectedCode.replace('+', '');
        const cleanNum = localNumber.replace(/^0+/, '');
        window.open(`https://wa.me/${cleanCode}${cleanNum}`, '_blank', 'noopener,noreferrer');
    }, [selectedCode, localNumber]);

    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <Phone size={12} /> {label}
            </label>

            <div className="flex gap-2">
                {/* Country Code Selector */}
                <div className="relative w-24 shrink-0">
                    <select
                        value={selectedCode}
                        onChange={handleCodeChange}
                        aria-label="Country code"
                        className="w-full h-full bg-zinc-950 border border-zinc-800 rounded-xl pl-2 pr-6 py-3.5 text-white appearance-none outline-none focus:border-green-500 transition-all cursor-pointer text-sm font-mono"
                    >
                        {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                                {c.flag} {c.code}
                            </option>
                        ))}
                    </select>
                    {/* Custom dropdown arrow */}
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-[10px]">▾</span>
                </div>

                {/* Number Input */}
                <div className="relative flex-1 min-w-0">
                    <input
                        type="tel"
                        value={localNumber}
                        onChange={handleNumberChange}
                        placeholder="10xxxxxxxxx"
                        inputMode="tel"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-12 py-3.5 text-white transition-all outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 placeholder:text-zinc-700 font-mono"
                    />

                    {/* WhatsApp Button */}
                    <button
                        type="button"
                        onClick={openWhatsApp}
                        disabled={!localNumber}
                        title="Open in WhatsApp"
                        aria-label="Open in WhatsApp"
                        className="absolute right-2 top-2 bottom-2 aspect-square bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white rounded-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <MessageCircle size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppInput;
