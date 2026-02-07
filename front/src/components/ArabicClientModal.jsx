import React, { useState } from 'react';
import { X, User, FileText } from 'lucide-react';

const ArabicClientModal = ({ isOpen, onClose, onSubmit, currentClientName }) => {
    const [arabicName, setArabicName] = useState(currentClientName || '');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (arabicName.trim()) {
            onSubmit(arabicName);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md mx-4 bg-white dark:bg-[#121214] rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl dark:shadow-black/80 animate-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="relative p-6 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-900/20">
                            <User size={24} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Client Name</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Enter client name in Arabic</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="absolute top-6 right-6 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                            Arabic Name | الاسم بالعربي
                        </label>
                        <input
                            type="text"
                            value={arabicName}
                            onChange={(e) => setArabicName(e.target.value)}
                            placeholder="أدخل اسم العميل"
                            dir="rtl"
                            className="w-full bg-zinc-50 dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 rounded-2xl px-4 py-4 text-lg font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none transition-all"
                            autoFocus
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleSubmit();
                                }
                            }}
                        />
                        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-600 flex items-center gap-1">
                            <FileText size={12} />
                            This name will appear in the PDF document
                        </p>
                    </div>

                    {/* Preview */}
                    {arabicName && (
                        <div className="bg-zinc-100 dark:bg-zinc-900/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
                            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-wider mb-2">Preview</p>
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white text-right" dir="rtl">
                                {arabicName}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-sm transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!arabicName.trim()}
                        className="flex-[1.5] py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:from-zinc-300 disabled:to-zinc-300 dark:disabled:from-zinc-800 dark:disabled:to-zinc-800 text-white disabled:text-zinc-500 font-bold text-sm shadow-lg shadow-orange-900/20 disabled:shadow-none transition-all active:scale-95 disabled:cursor-not-allowed"
                    >
                        Confirm & Download
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ArabicClientModal;