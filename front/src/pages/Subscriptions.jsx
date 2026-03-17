import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import {
  Plus, Trash2, Calendar, CheckCircle, Ticket,
  DollarSign, X, Baby, Users, Loader2, AlertCircle
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// ── SKELETON ───────────────────────────────────────────────────────────────
const CardSkeleton = () => (
  <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] animate-pulse">
    <div className="flex justify-between items-start mb-6">
      <div className="w-14 h-14 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
    <div className="h-7 w-40 rounded-xl bg-zinc-200 dark:bg-zinc-800 mb-2" />
    <div className="h-9 w-24 rounded-xl bg-zinc-200 dark:bg-zinc-800 mb-6" />
    <div className="space-y-3 pt-6 border-t border-zinc-100 dark:border-zinc-800/50">
      <div className="h-5 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-5 w-3/4 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
    </div>
  </div>
);

// ── FIELD VALIDATION ───────────────────────────────────────────────────────
const EMPTY_FORM = { name: '', units: '', duration_days: '', price: '', is_child_plan: false };

const validateForm = (data) => {
  const errors = {};
  if (!data.name.trim()) errors.name = 'Package name is required.';
  if (!data.units || Number(data.units) < 1) errors.units = 'Must be at least 1 session.';
  if (!data.duration_days || Number(data.duration_days) < 1)
    errors.duration_days = 'Must be at least 1 day.';
  if (data.price !== '' && Number(data.price) < 0)
    errors.price = 'Price cannot be negative.';
  return errors;
};

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
const Subscriptions = () => {
  const { user } = useContext(AuthContext);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('adult');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  // ── DATA FETCHING ────────────────────────────────────────────────────────
  const fetchSubs = useCallback(async () => {
    try {
      const response = await api.get('/subscriptions/');
      // Defensive: handle both flat array and paginated { count, results } object
      const data = response.data;
      setSubs(Array.isArray(data) ? data : (data?.results ?? []));
      setFetchError(null);
    } catch (error) {
      console.error(error);
      setFetchError('Failed to load subscription plans. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs]);

  // ── DERIVED DATA ──────────────────────────────────────────────────────────
  const filteredSubs = subs.filter((sub) =>
    activeTab === 'child' ? sub.is_child_plan === true : sub.is_child_plan === false
  );

  // ── HANDLERS ─────────────────────────────────────────────────────────────
  const openModal = useCallback(() => {
    setFormData({ ...EMPTY_FORM, is_child_plan: activeTab === 'child' });
    setFormErrors({});
    setIsModalOpen(true);
  }, [activeTab]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      const errors = validateForm(formData);
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }

      setIsSubmitting(true);
      try {
        await api.post('/subscriptions/', {
          ...formData,
          units: Number(formData.units),
          duration_days: Number(formData.duration_days),
          price: formData.price !== '' ? Number(formData.price) : 0,
        });
        await fetchSubs();
        setIsModalOpen(false);
        toast.success('Package created successfully!');
      } catch (error) {
        const msg = error.response?.data?.detail || 'Error creating subscription.';
        toast.error(msg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, fetchSubs]
  );

  const handleDelete = useCallback(
    async (id) => {
      if (!window.confirm('Delete this package? This action cannot be undone.')) return;
      try {
        await api.delete(`/subscriptions/${id}/`);
        setSubs((prev) => prev.filter((s) => s.id !== id));
        toast.success('Package deleted.');
      } catch {
        toast.error('Failed to delete package.');
      }
    },
    []
  );

  const updateForm = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white p-6 md:p-10 transition-colors duration-300">
      <Toaster position="top-center" toastOptions={{ style: { background: '#18181b', color: '#fff', border: '1px solid #333' } }} />

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Subscription Plans</h1>
          <p className="text-zinc-500 font-medium">Manage pricing and session packages.</p>
        </div>
        {user?.is_superuser && (
          <button
            onClick={openModal}
            className="flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-2xl font-bold hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-all shadow-lg active:scale-95"
          >
            <Plus size={20} strokeWidth={3} />
            Create {activeTab === 'child' ? 'Child' : 'Adult'} Plan
          </button>
        )}
      </div>

      {/* ── TABS ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8 bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-2xl w-fit border border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('adult')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'adult'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
        >
          <Users size={18} /> Adult Plans
        </button>
        <button
          onClick={() => setActiveTab('child')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'child'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
        >
          <Baby size={18} /> Children Plans
        </button>
      </div>

      {/* ── FETCH ERROR ─────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl text-red-600 dark:text-red-400">
          <AlertCircle size={18} />
          <span className="text-sm font-medium">{fetchError}</span>
        </div>
      )}

      {/* ── GRID ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
        ) : filteredSubs.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-3xl text-zinc-400 dark:text-zinc-600">
            <Ticket size={48} className="mb-4 opacity-30" />
            <p className="font-bold">
              No {activeTab === 'child' ? 'children' : 'adult'} plans yet.
            </p>
            {user?.is_superuser && (
              <button
                onClick={openModal}
                className="mt-4 text-sm font-bold text-orange-600 hover:underline"
              >
                Create one now
              </button>
            )}
          </div>
        ) : (
          filteredSubs.map((sub) => (
            <div
              key={sub.id}
              className={`bg-white dark:bg-[#121214] border p-6 rounded-[2rem] relative group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-2xl shadow-sm
                ${sub.is_child_plan
                  ? 'border-zinc-200 dark:border-zinc-800 hover:border-blue-500/50'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-orange-500/50'
                }`}
            >
              <div className="flex justify-between items-start mb-6">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors
                    ${sub.is_child_plan
                      ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500'
                      : 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500'
                    }`}
                >
                  {sub.is_child_plan ? <Baby size={28} /> : <Ticket size={28} />}
                </div>
                {user?.is_superuser && (
                  <button
                    onClick={() => handleDelete(sub.id)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 dark:text-zinc-600 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    title="Delete plan"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <h3 className="text-2xl font-black mb-1 text-zinc-900 dark:text-white">
                {sub.name}
              </h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold text-zinc-700 dark:text-zinc-200">
                  {Number(sub.price) > 0 ? sub.price : 'Custom'}
                </span>
                {Number(sub.price) > 0 && (
                  <span className="text-sm font-bold text-zinc-400 dark:text-zinc-500">EGP</span>
                )}
              </div>

              <div className="space-y-3 pt-6 border-t border-zinc-100 dark:border-zinc-800/50">
                <div className="flex items-center gap-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  <div
                    className={`p-1.5 rounded-lg ${sub.is_child_plan
                        ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500'
                        : 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500'
                      }`}
                  >
                    <CheckCircle size={14} strokeWidth={3} />
                  </div>
                  <span className="text-zinc-800 dark:text-zinc-200 font-bold">{sub.units}</span>
                  &nbsp;Training Sessions
                </div>
                <div className="flex items-center gap-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  <div
                    className={`p-1.5 rounded-lg ${sub.is_child_plan
                        ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500'
                        : 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500'
                      }`}
                  >
                    <Calendar size={14} strokeWidth={3} />
                  </div>
                  Valid for{' '}
                  <span className="text-zinc-800 dark:text-zinc-200 font-bold">
                    {sub.duration_days}
                  </span>{' '}
                  Days
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── MODAL ────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-3xl p-8 relative animate-in zoom-in-95 shadow-2xl">
            <button
              onClick={closeModal}
              disabled={isSubmitting}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all"
            >
              <X size={18} />
            </button>

            <h2 className="text-2xl font-black mb-1 text-zinc-900 dark:text-white">
              New {formData.is_child_plan ? 'Child' : 'Adult'} Plan
            </h2>
            <p className="text-zinc-500 text-sm mb-6">Fill out the details below.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">
                  Package Name
                </label>
                <input
                  required
                  className={`w-full bg-zinc-50 dark:bg-zinc-950 border rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white focus:border-orange-500 outline-none mt-1.5 transition-colors placeholder-zinc-400 ${formErrors.name
                      ? 'border-red-400 dark:border-red-500'
                      : 'border-zinc-200 dark:border-zinc-800'
                    }`}
                  placeholder="e.g. Gold Month"
                  value={formData.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                />
                {formErrors.name && (
                  <p className="text-xs text-red-500 mt-1 ml-1">{formErrors.name}</p>
                )}
              </div>

              {/* Units + Days */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">
                    Sessions
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    className={`w-full bg-zinc-50 dark:bg-zinc-950 border rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white focus:border-orange-500 outline-none mt-1.5 ${formErrors.units
                        ? 'border-red-400 dark:border-red-500'
                        : 'border-zinc-200 dark:border-zinc-800'
                      }`}
                    placeholder="12"
                    value={formData.units}
                    onChange={(e) => updateForm('units', e.target.value)}
                  />
                  {formErrors.units && (
                    <p className="text-xs text-red-500 mt-1 ml-1">{formErrors.units}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Days</label>
                  <input
                    required
                    type="number"
                    min="1"
                    className={`w-full bg-zinc-50 dark:bg-zinc-950 border rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white focus:border-orange-500 outline-none mt-1.5 ${formErrors.duration_days
                        ? 'border-red-400 dark:border-red-500'
                        : 'border-zinc-200 dark:border-zinc-800'
                      }`}
                    placeholder="30"
                    value={formData.duration_days}
                    onChange={(e) => updateForm('duration_days', e.target.value)}
                  />
                  {formErrors.duration_days && (
                    <p className="text-xs text-red-500 mt-1 ml-1">{formErrors.duration_days}</p>
                  )}
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">
                  Price (EGP)
                </label>
                <div className="relative">
                  <DollarSign
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
                  />
                  <input
                    type="number"
                    min="0"
                    className={`w-full bg-zinc-50 dark:bg-zinc-950 border rounded-xl pl-10 pr-4 py-3.5 text-zinc-900 dark:text-white focus:border-orange-500 outline-none mt-1.5 ${formErrors.price
                        ? 'border-red-400 dark:border-red-500'
                        : 'border-zinc-200 dark:border-zinc-800'
                      }`}
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => updateForm('price', e.target.value)}
                  />
                </div>
                {formErrors.price && (
                  <p className="text-xs text-red-500 mt-1 ml-1">{formErrors.price}</p>
                )}
              </div>

              {/* Child toggle */}
              <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="block text-sm font-bold text-zinc-900 dark:text-white">
                    Child Package?
                  </span>
                  <span className="text-xs text-zinc-500">Visible only to children accounts.</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateForm('is_child_plan', !formData.is_child_plan)}
                  className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors duration-300 ${formData.is_child_plan ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
                    }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${formData.is_child_plan ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full font-bold py-4 rounded-xl mt-4 transition-all shadow-lg active:scale-[0.98] text-white flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${formData.is_child_plan
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                    : 'bg-orange-600 hover:bg-orange-500 shadow-orange-500/20'
                  }`}
              >
                {isSubmitting && <Loader2 size={18} className="animate-spin" />}
                {isSubmitting ? 'Creating...' : 'Create Package'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscriptions;