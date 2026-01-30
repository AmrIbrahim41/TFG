import React, { useState, useMemo } from 'react';
import { 
    User, Hash, Calendar, Briefcase, MapPin, 
    Activity, Heart, Moon, FileText, Cigarette, 
    Check
} from 'lucide-react';
import WhatsAppInput from '../inputs/WhatsAppInput'; // Adjust path if needed

const ClientInfoTab = ({ formData, handleChange, clientAge, user }) => {
    
    // State for the 3D Flip Card
    const [isFlipped, setIsFlipped] = useState(false);

    // Calculate Age Live for Display inside the flip card
    const displayAge = useMemo(() => {
        if (formData.birth_date) {
            const today = new Date();
            const birthDate = new Date(formData.birth_date);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            return age;
        }
        return clientAge;
    }, [formData.birth_date, clientAge]);

    // --- Components ---
    const InputGroup = ({ label, icon: Icon, children }) => (
        <div className="space-y-2 group">
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

    const statusOptions = [
        { value: 'Single', label: 'Single', color: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500', icon: User },
        { value: 'Married', label: 'Married', color: 'bg-rose-500', border: 'border-rose-500', text: 'text-rose-500', icon: Heart },
        { value: 'Divorced', label: 'Divorced', color: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500', icon: User },
        { value: 'Widowed', label: 'Widowed', color: 'bg-zinc-500', border: 'border-zinc-500', text: 'text-zinc-500', icon: User },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* 1. Identity Section */}
            <div className="bg-[#121214] border border-zinc-800/60 rounded-3xl p-6 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[80px] rounded-full pointer-events-none" />
                
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <span className="p-2 bg-orange-500/10 rounded-lg text-orange-500"><User size={18} /></span>
                    Identity
                </h3>

                {/* --- LAYOUT FIX: Changed from 3 columns to specialized grid --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
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

                    {/* Phone gets its own dedicated column now */}
                    <WhatsAppInput 
                        value={formData.phone}
                        onChange={handleChange}
                    />

                    {/* ID gets the other column */}
                    <InputGroup label="System ID" icon={Hash}>
                        <ModernInput 
                            name="manual_id" 
                            value={formData.manual_id} 
                            onChange={handleChange} 
                            disabled={!user?.is_superuser}
                            className="font-mono text-zinc-400"
                        />
                    </InputGroup>
                </div>
            </div>

            {/* 2. Personal & Bio Section */}
            <div className="bg-[#121214] border border-zinc-800/60 rounded-3xl p-6 md:p-8 relative overflow-hidden">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <span className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><Briefcase size={18} /></span>
                    Personal Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* --- FLIP CARD FOR AGE / DATE --- */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                            <Calendar size={12} /> Age / Birth Date
                        </label>
                        
                        <div className="relative w-full h-[54px] perspective-1000 group">
                            <div 
                                className={`relative w-full h-full transition-all duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
                            >
                                {/* FRONT: Display Age */}
                                <div 
                                    onClick={() => setIsFlipped(true)}
                                    className="absolute inset-0 w-full h-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 flex items-center justify-between cursor-pointer hover:border-orange-500/50 [backface-visibility:hidden]"
                                >
                                    <span className={formData.birth_date ? "text-white font-bold" : "text-zinc-600"}>
                                        {displayAge ? `${displayAge} Years Old` : "Set Birth Date"}
                                    </span>
                                    <Calendar size={16} className="text-zinc-500" />
                                </div>

                                {/* BACK: Date Input */}
                                <div 
                                    className="absolute inset-0 w-full h-full bg-zinc-950 border border-orange-500 rounded-xl px-2 flex items-center gap-2 [transform:rotateY(180deg)] [backface-visibility:hidden]"
                                >
                                    <input 
                                        type="date" 
                                        name="birth_date" 
                                        value={formData.birth_date || ''} 
                                        onChange={handleChange} 
                                        className="bg-transparent text-white w-full outline-none [color-scheme:dark] text-sm"
                                    />
                                    <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }}
                                        className="p-1.5 bg-orange-500 rounded-lg text-white hover:bg-orange-600"
                                    >
                                        <Check size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <InputGroup label="Nature of Work" icon={Briefcase}>
                        <ModernInput 
                            name="nature_of_work" 
                            value={formData.nature_of_work} 
                            onChange={handleChange} 
                            placeholder="e.g. Accountant..."
                        />
                    </InputGroup>

                    <div className="md:col-span-2">
                        <InputGroup label="Address" icon={MapPin}>
                            <ModernInput 
                                name="address" 
                                value={formData.address} 
                                onChange={handleChange} 
                                placeholder="Home Address"
                            />
                        </InputGroup>
                    </div>
                </div>
            </div>

            {/* 3. Lifestyle */}
            <div className="bg-[#121214] border border-zinc-800/60 rounded-3xl p-6 md:p-8 relative overflow-hidden">
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
                                        className={`relative flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all duration-300 ${
                                            isSelected 
                                                ? `${option.border} ${option.color}/10 text-white shadow-lg` 
                                                : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:bg-zinc-900 hover:border-zinc-700'
                                        }`}
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
                            <ModernInput 
                                type="number"
                                name="sleep_hours" 
                                value={formData.sleep_hours} 
                                onChange={handleChange} 
                            />
                        </InputGroup>

                        <div 
                            onClick={() => handleChange({ target: { name: 'smoking', type: 'checkbox', checked: !formData.smoking } })}
                            className={`cursor-pointer group relative overflow-hidden rounded-2xl p-4 border transition-all duration-300 flex items-center justify-between ${
                                formData.smoking 
                                ? 'bg-red-500/10 border-red-500/50' 
                                : 'bg-green-500/5 border-zinc-800 hover:border-green-500/30'
                            }`}
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
                    <textarea 
                        name="notes" 
                        value={formData.notes} 
                        onChange={handleChange} 
                        rows={4} 
                        className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 rounded-xl p-4 text-white resize-none transition-all outline-none placeholder:text-zinc-700 leading-relaxed" 
                        placeholder="Write any important details about the client here..." 
                    />
                </InputGroup>
            </div>
        </div>
    );
};

export default ClientInfoTab;