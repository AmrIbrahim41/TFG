import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Plus, Search, Baby, ArrowRight,
  Sparkles, Hash, ChevronLeft, ChevronRight, X, AlertCircle,
} from 'lucide-react';
import api from '../../api';

// ─── Skeleton Card ──────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800/80 rounded-[2rem] p-5 md:p-6 animate-pulse">
    <div className="flex items-start gap-4">
      <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-zinc-200 dark:bg-zinc-800 shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-5 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        <div className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
      </div>
    </div>
    <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800/50 flex justify-between">
      <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
      <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
    </div>
  </div>
);

// ─── Toast ───────────────────────────────────────────────────────────────────
const Toast = ({ message, type = 'error', onClose }) => (
  <div className={`fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 z-[200] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-bottom-4 duration-300
    ${type === 'error'
      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
      : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
    }`}
  >
    <AlertCircle size={18} className="shrink-0" />
    <span className="font-semibold text-sm flex-1">{message}</span>
    <button onClick={onClose} className="ml-2 hover:opacity-70 transition-opacity shrink-0">
      <X size={16} />
    </button>
  </div>
);

// ─── Component ───────────────────────────────────────────────────────────────
const ChildrenProfiles = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [nextPage, setNextPage] = useState(null);
  const [prevPage, setPrevPage] = useState(null);
  const [newChild, setNewChild] = useState({ name: '', manual_id: '', phone: '', photo: null });
  const searchDebounce = useRef(null);

  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────
  const fetchChildren = useCallback(async (urlOverride = null) => {
    setLoading(true);
    try {
      let url;
      if (urlOverride) {
        const urlObj = new URL(urlOverride);
        if (!urlObj.searchParams.has('is_child')) urlObj.searchParams.append('is_child', 'true');
        url = `/clients/${urlObj.search}`;
      } else {
        const params = new URLSearchParams({ is_child: 'true' });
        if (searchTerm) params.append('search', searchTerm);
        url = `/clients/?${params.toString()}`;
      }
      const res = await api.get(url);
      const data = res.data.results !== undefined ? res.data.results : res.data;
      setChildren(data);
      setNextPage(res.data.next ?? null);
      setPrevPage(res.data.previous ?? null);
    } catch (err) {
      console.error('Error fetching children', err);
      showToast('Failed to load profiles. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, showToast]);

  useEffect(() => {
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchChildren(), 350);
    return () => clearTimeout(searchDebounce.current);
  }, [searchTerm]); // eslint-disable-line

  // ── Form ───────────────────────────────────────────────────────────────
  const validateForm = () => {
    const errors = {};
    if (!newChild.name.trim()) errors.name = 'Name is required.';
    if (!newChild.manual_id.trim()) errors.manual_id = 'ID is required.';
    if (!newChild.phone.trim()) errors.phone = 'Phone is required.';
    else if (!/^[0-9+\s-]{7,15}$/.test(newChild.phone.trim())) errors.phone = 'Enter a valid phone number.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddChild = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('name', newChild.name.trim());
    formData.append('manual_id', newChild.manual_id.trim());
    formData.append('phone', newChild.phone.trim());
    formData.append('is_child', 'true');
    if (newChild.photo) formData.append('photo', newChild.photo);
    try {
      await api.post('/clients/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setIsModalOpen(false);
      setNewChild({ name: '', manual_id: '', phone: '', photo: null });
      setFormErrors({});
      showToast('Child profile created!', 'success');
      fetchChildren();
    } catch (err) {
      const detail = err.response?.data?.manual_id?.[0] || err.response?.data?.detail;
      showToast(detail || 'Error adding child. ID might already exist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setNewChild({ name: '', manual_id: '', phone: '', photo: null });
    setFormErrors({});
  };

  const handleFieldChange = (field, value) => {
    setNewChild(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: undefined }));
  };

  // Common input class for modal
  const inputCls = (hasErr) =>
    `w-full bg-zinc-100 dark:bg-zinc-950 border rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none focus:border-blue-500 transition-all text-sm ${hasErr ? 'border-red-400 dark:border-red-500' : 'border-zinc-300 dark:border-zinc-800'}`;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 md:space-y-8 animate-in slide-in-from-bottom-4 duration-500">

      {/* Search & Add ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        {/* Search bar */}
        <div className="relative group flex-1 min-w-0">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="block w-full pl-12 pr-10 py-3.5 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-2xl text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Add button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="group bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white dark:hover:text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 shrink-0"
        >
          <Plus size={18} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
          <span>Add Child</span>
        </button>
      </div>

      {/* Cards Grid ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : children.length === 0 ? (
        <div className="py-16 md:py-24 text-center space-y-4 bg-zinc-100 dark:bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800">
          <div className="w-16 md:w-20 h-16 md:h-20 bg-zinc-200 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto text-zinc-400 dark:text-zinc-600">
            <Baby size={28} />
          </div>
          <p className="text-zinc-500 font-semibold text-sm md:text-base">
            {searchTerm ? `No results for "${searchTerm}"` : 'No children accounts found.'}
          </p>
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-sm text-blue-600 hover:underline font-medium">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {children.map(child => (
              <div
                key={child.id}
                onClick={() => navigate(`/children/${child.id}`)}
                className="group relative bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800/80 rounded-[2rem] p-5 md:p-6 hover:border-blue-400/40 dark:hover:border-blue-500/30 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-blue-900/10 overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative z-10 flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-900 overflow-hidden border-2 border-zinc-200 dark:border-zinc-800 group-hover:border-blue-400 dark:group-hover:border-blue-500/50 transition-colors shadow-sm">
                      {child.photo_url ? (
                        <img
                          src={child.photo_url}
                          alt={child.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-400 dark:text-zinc-600">
                          <User size={24} />
                        </div>
                      )}
                    </div>
                    {/* Subscription status dot */}
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full border-[3px] border-white dark:border-[#121214] ${child.is_subscribed ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1 pt-1">
                    <h3 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {child.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 text-xs font-mono px-2 py-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center gap-1">
                        <Hash size={10} /> {child.manual_id}
                      </span>
                      {child.age && (
                        <span className="bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-500/20">
                          {child.age} yrs
                        </span>
                      )}
                      {child.active_trainer_name && (
                        <span className="bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold px-2 py-0.5 rounded-lg border border-orange-200 dark:border-orange-500/20">
                          Coach: {child.active_trainer_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400 dark:text-zinc-500 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shrink-0">
                    <ArrowRight size={16} />
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between text-xs font-medium text-zinc-500">
                  <span>Joined: {new Date(child.created_at).toLocaleDateString()}</span>
                  <span className={child.is_subscribed ? 'text-green-600 dark:text-green-500' : 'text-zinc-400 dark:text-zinc-600'}>
                    {child.is_subscribed ? '● Active' : '○ No Plan'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {(prevPage || nextPage) && (
            <div className="flex justify-center items-center gap-3 mt-8 mb-4">
              <button
                onClick={() => fetchChildren(prevPage)}
                disabled={!prevPage}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <button
                onClick={() => fetchChildren(nextPage)}
                disabled={!nextPage}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all text-sm"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Add Child Modal ─────────────────────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={e => { if (e.target === e.currentTarget) handleCloseModal(); }}
        >
          <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 md:p-8 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 relative overflow-hidden">

            {/* Close */}
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            {/* Drag handle (mobile) */}
            <div className="w-10 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mx-auto mb-5 sm:hidden" />

            <div className="mb-5">
              <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                <Sparkles className="text-blue-500" size={22} /> New Child Profile
              </h2>
              <p className="text-zinc-500 text-sm mt-1">Create a dedicated account for a junior athlete.</p>
            </div>

            <form onSubmit={handleAddChild} className="space-y-4" noValidate>
              {/* Name */}
              <div>
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-500 uppercase ml-1 mb-1.5 block">Full Name</label>
                <input
                  className={inputCls(formErrors.name)}
                  placeholder="e.g. Aly Ahmed"
                  value={newChild.name}
                  onChange={e => handleFieldChange('name', e.target.value)}
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1 ml-1">{formErrors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Manual ID */}
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Manual ID</label>
                  <input
                    className={`${inputCls(formErrors.manual_id)} font-mono`}
                    placeholder="1024"
                    value={newChild.manual_id}
                    onChange={e => handleFieldChange('manual_id', e.target.value)}
                  />
                  {formErrors.manual_id && <p className="text-red-500 text-xs mt-1 ml-1">{formErrors.manual_id}</p>}
                </div>
                {/* Phone */}
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Parent Phone</label>
                  <input
                    className={inputCls(formErrors.phone)}
                    placeholder="010..."
                    value={newChild.phone}
                    onChange={e => handleFieldChange('phone', e.target.value)}
                  />
                  {formErrors.phone && <p className="text-red-500 text-xs mt-1 ml-1">{formErrors.phone}</p>}
                </div>
              </div>

              {/* Photo */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1 mb-1.5 block">Photo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 file:bg-zinc-200 dark:file:bg-zinc-800 file:text-zinc-700 dark:file:text-zinc-300 file:border-0 file:rounded-lg file:px-3 file:py-1.5 hover:file:bg-zinc-300 dark:hover:file:bg-zinc-700 transition-all cursor-pointer"
                  onChange={e => handleFieldChange('photo', e.target.files[0])}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white py-3.5 rounded-xl font-bold transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  {isSubmitting ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ChildrenProfiles;
