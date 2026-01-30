import React, { useState, useEffect } from 'react';
import { Phone, MessageCircle } from 'lucide-react';

const COUNTRY_CODES = [
    { code: '+20', country: 'EG', flag: '🇪🇬', name: 'Egypt' },
    { code: '+966', country: 'SA', flag: '🇸🇦', name: 'Saudi Arabia' },
    { code: '+971', country: 'AE', flag: '🇦🇪', name: 'UAE' },
    { code: '+965', country: 'KW', flag: '🇰🇼', name: 'Kuwait' },
    { code: '+1', country: 'US', flag: '🇺🇸', name: 'USA' },
    { code: '+44', country: 'GB', flag: '🇬🇧', name: 'UK' },
    // Add more as needed
];

const WhatsAppInput = ({ value, onChange, label = "Phone Number" }) => {
    // Attempt to detect existing country code, default to Egypt (+20)
    const [selectedCode, setSelectedCode] = useState('+20');
    const [localNumber, setLocalNumber] = useState('');

    useEffect(() => {
        if (!value) return;
        
        // simple logic to split existing value if it starts with a known code
        const found = COUNTRY_CODES.find(c => value.startsWith(c.code));
        if (found) {
            setSelectedCode(found.code);
            setLocalNumber(value.replace(found.code, ''));
        } else {
            setLocalNumber(value);
        }
    }, [value]);

    const handleNumberChange = (e) => {
        const num = e.target.value;
        setLocalNumber(num);
        // We send the combined string back to the parent form
        // If you prefer to save only the local number, remove `selectedCode` here
        onChange({ target: { name: 'phone', value: `${selectedCode}${num}` } });
    };

    const handleCodeChange = (e) => {
        const code = e.target.value;
        setSelectedCode(code);
        onChange({ target: { name: 'phone', value: `${code}${localNumber}` } });
    };

    const openWhatsApp = () => {
        if (!localNumber) return;
        // Strip '+' and spaces for the URL
        const cleanCode = selectedCode.replace('+', '');
        const cleanNum = localNumber.replace(/^0+/, ''); // Remove leading zeros for WA
        const url = `https://wa.me/${cleanCode}${cleanNum}`;
        window.open(url, '_blank');
    };

    return (
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                <Phone size={12} /> {label}
            </label>
            
            <div className="flex gap-2">
                {/* Country Code Selector */}
                <div className="relative w-24">
                    <select
                        value={selectedCode}
                        onChange={handleCodeChange}
                        className="w-full h-full bg-zinc-950 border border-zinc-800 rounded-xl pl-2 pr-6 py-3.5 text-white appearance-none outline-none focus:border-green-500 transition-all cursor-pointer text-sm font-mono"
                    >
                        {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                                {c.flag} {c.code}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Number Input */}
                <div className="relative flex-1">
                    <input
                        type="tel"
                        value={localNumber}
                        onChange={handleNumberChange}
                        placeholder="10xxxxxxxxx"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-12 py-3.5 text-white transition-all outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 placeholder:text-zinc-700 font-mono"
                    />
                    
                    {/* WhatsApp Action Button */}
                    <button
                        type="button"
                        onClick={openWhatsApp}
                        disabled={!localNumber}
                        className="absolute right-2 top-2 bottom-2 aspect-square bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white rounded-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Open in WhatsApp"
                    >
                        <MessageCircle size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppInput;