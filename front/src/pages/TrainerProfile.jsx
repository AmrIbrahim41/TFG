import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import {
  User, Calendar, CheckCircle, XCircle,
  Send, Inbox, ArrowUpRight, ArrowDownLeft, Shield, Dumbbell,
  Check, X, Loader2, AlertCircle
} from 'lucide-react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

// ── SKELETON ──────────────────────────────────────────────────────────────
const ClientCardSkeleton = () => (
  <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl animate-pulse">
    <div className="flex gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="space-y-2 flex-1">
        <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
    <div className="bg-zinc-100 dark:bg-zinc-900/50 p-3 rounded-xl space-y-2 mb-4">
      <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
    </div>
    <div className="h-10 w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
  </div>
);

// ── COMPONENT ──────────────────────────────────────────────────────────────
const TrainerProfile = () => {
  const { user } = useContext(AuthContext);

  // Stable currentUserId (never re-computed unless user changes)
  // FIX #16: تطبيع currentUserId إلى Number صراحةً لتمكين استخدام === بأمان.
  // الكود السابق كان يعتمد على == (type coercion) لأن to_trainer من الـ API
  // قد يكون String أو Number. الآن نُحوّل للـ Number مرة واحدة هنا ونستخدم ===
  // في كل المقارنات، وهو أوضح وأقل عرضة للأخطاء المستقبلية.
  const currentUserId = useMemo(
    () => {
      const id = user?.user_id ?? user?.id ?? null;
      return id != null ? Number(id) : null;
    },
    [user]
  );

  const [activeTab, setActiveTab] = useState('clients');
  const [myClients, setMyClients] = useState([]);
  const [transferHistory, setTransferHistory] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  // FIX #9: استبدال respondingId (يتتبع الـ id فقط) بـ respondingAction (يتتبع الـ id + نوع الـ action).
  // الكود السابق كان يُعطّل كلا الزرين (Accept و Reject) بـ spinner واحد عند
  // الضغط على أي منهما، مما يُربك المستخدم — لا يعرف أي زر ضغط.
  // الآن كل زر يعرض spinner خاص به بينما الزر الآخر يبقى ظاهراً بشكل طبيعي.
  const [respondingAction, setRespondingAction] = useState(null); // { id, action } | null
  const [selectedSubForTransfer, setSelectedSubForTransfer] = useState(null);
  const [selectedRequestDetail, setSelectedRequestDetail] = useState(null);

  const [transferForm, setTransferForm] = useState({
    to_trainer: '', sessions_count: '', selected_days: [], time_preference: '', additional_notes: '',
  });

  const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // ── DATA LOADING ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [transfersRes, clientsRes] = await Promise.all([
        api.get('/transfers/'),
        api.get('/client-subscriptions/active/'),
      ]);

      // FIX #1 (frontend): Guard against a paginated response shape.
      // If the backend returns { count, next, results } instead of a flat
      // array (e.g. during a rolling deploy), spreading the object literal
      // throws a TypeError and crashes the entire page.  Extract .results
      // when present; fall back to the raw value only when it is already an
      // array.  Default to [] so .sort() never receives a non-array.
      const transfersRaw = transfersRes.data;
      const transfersArray = Array.isArray(transfersRaw)
        ? transfersRaw
        : Array.isArray(transfersRaw?.results)
          ? transfersRaw.results
          : [];

      const sorted = [...transfersArray].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      setTransferHistory(sorted);
      setMyClients(clientsRes.data);
    } catch (error) {
      console.error('Error loading profile data', error);
      setFetchError('Could not load data. Please try again.');
      toast.error('Could not load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTrainers = useCallback(async () => {
    try {
      // تم التعديل هنا: استخدام المسار الصحيح لجلب قائمة المدربين
      const res = await api.get('/manage-trainers/');
      
      // في حال كان الـ API يرجع data.results (بسبب الـ Pagination) أو مصفوفة مباشرة
      const trainersList = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setTrainers(trainersList.filter((t) => t.id != currentUserId));
    } catch {
      // non-critical
    }
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;
    // FIX #10: استخدام finally بدلاً من .then() لضمان استدعاء fetchTrainers
    // حتى لو فشل fetchData (network error). الكود السابق كان يربط fetchTrainers
    // بنجاح fetchData فقط، مما يجعل قائمة المدربين فارغة عند أي خطأ في الشبكة
    // ويمنع المدرب من اختيار وجهة التحويل حتى لو المشكلة كانت مؤقتة.
    fetchData().finally(() => { if (!cancelled) fetchTrainers(); });
    return () => { cancelled = true; };
  }, [fetchData, fetchTrainers]);

  // ── TRANSFER HELPERS ──────────────────────────────────────────────────
  const handleDayToggle = useCallback((day) => {
    setTransferForm((prev) => ({
      ...prev,
      selected_days: prev.selected_days.includes(day)
        ? prev.selected_days.filter((d) => d !== day)
        : [...prev.selected_days, day],
    }));
  }, []);

  const openTransferModal = useCallback((sub) => {
    setSelectedSubForTransfer(sub);
    setTransferForm({ to_trainer: '', sessions_count: '', selected_days: [], time_preference: '', additional_notes: '' });
    setIsTransferModalOpen(true);
  }, []);

  const handleTransferSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (!transferForm.to_trainer) { toast.error('Please select a trainer.'); return; }
      if (!transferForm.sessions_count || Number(transferForm.sessions_count) < 1) {
        toast.error('Sessions count must be at least 1.'); return;
      }

      const dayString = transferForm.selected_days.length > 0
        ? transferForm.selected_days.join(', ')
        : 'Flexible days';
      const timeString = transferForm.time_preference ? `@ ${transferForm.time_preference}` : '';
      const finalNote = `Days: ${dayString} ${timeString}\nNote: ${transferForm.additional_notes}`;

      setIsSubmittingTransfer(true);
      try {
        await api.post('/transfers/', {
          subscription: selectedSubForTransfer.id,
          to_trainer: transferForm.to_trainer,
          sessions_count: Number(transferForm.sessions_count),
          schedule_notes: finalNote,
        });
        toast.success('Transfer request sent!');
        setIsTransferModalOpen(false);
        fetchData();
      } catch (error) {
        // FIX #15: توسيع error handling ليغطي جميع مفاتيح الأخطاء التي يُعيدها
        // الـ serializer. الكود السابق كان يتحقق فقط من sessions_count وdetail،
        // مما يعني أن أخطاء subscription أو to_trainer كانت تصل للمستخدم كرسالة
        // عامة "Failed to send request." بدلاً من النص الوصفي من الباك اند.
        const data = error.response?.data;
        const msg = data?.sessions_count?.[0]
          || data?.subscription?.[0]
          || data?.to_trainer?.[0]
          || data?.non_field_errors?.[0]
          || data?.detail
          || 'Failed to send request.';
        toast.error(msg);
      } finally {
        setIsSubmittingTransfer(false);
      }
    },
    [transferForm, selectedSubForTransfer, fetchData]
  );

  const handleRespond = useCallback(
    async (id, status, e) => {
      if (e) e.stopPropagation();
      setRespondingAction({ id, action: status });
      try {
        await api.post(`/transfers/${id}/respond/`, { status });
        toast.success(`Request ${status}`);
        fetchData();
        if (selectedRequestDetail?.id === id) setSelectedRequestDetail(null);
      } catch {
        toast.error('Action failed');
      } finally {
        setRespondingAction(null);
      }
    },
    [fetchData, selectedRequestDetail]
  );

  // ── PENDING INCOMING COUNT (badge) ────────────────────────────────────
  const pendingCount = useMemo(
    () =>
      transferHistory.filter((r) => r.to_trainer === currentUserId && r.status === 'pending').length,
    [transferHistory, currentUserId]
  );

  // ── RENDER HELPERS ────────────────────────────────────────────────────
  const renderMyClients = () => {
    if (myClients.length === 0) {
      return (
        <div className="col-span-full py-16 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl">
          <Dumbbell size={48} className="mb-4 opacity-20" />
          <p className="font-bold">No assigned clients found.</p>
        </div>
      );
    }

    return myClients.map((sub) => {
      const isOwner = sub.trainer === currentUserId;
      // FIX #4: Guard plan_total_sessions > 0 strictly before dividing to
      // prevent NaN (0/0) or Infinity (n/0) from leaking into the CSS `width`
      // style.  Both values are valid numbers to JS but browsers silently
      // ignore `width: NaN%` / `width: Infinity%`, leaving the bar either
      // invisible or pinned at 100%.  The `|| 0` fallback also handles the
      // case where plan_total_sessions is undefined or null.
      const totalSessions = Number(sub.plan_total_sessions) || 0;
      const progressPct = totalSessions > 0
        ? Math.min(Math.round((Number(sub.sessions_used) / totalSessions) * 100), 100)
        : 0;
      const isComplete = progressPct >= 100;

      return (
        <div
          key={sub.id}
          className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl relative group overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                  isOwner
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                    : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-500'
                }`}
              >
                {(sub.client_name || 'C').charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-white leading-tight">
                  {sub.client_name}
                </h4>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                    isOwner
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500'
                      : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500'
                  }`}
                >
                  {isOwner ? 'Direct Client' : 'Covering'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-4 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500 font-bold uppercase">Plan</span>
              <span className="text-zinc-700 dark:text-zinc-300 font-bold">{sub.plan_name}</span>
            </div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-500 font-bold uppercase">Sessions</span>
              <span className="text-zinc-700 dark:text-zinc-300 font-bold">
                {sub.sessions_used} / {sub.plan_total_sessions}
              </span>
            </div>
            {/* ── PROGRESS BAR (backend caps at 100%) ────────────────── */}
            <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isComplete
                    ? 'bg-green-500 dark:bg-green-400'
                    : 'bg-orange-500 dark:bg-orange-400'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-end">
              <span
                className={`text-[10px] font-bold ${
                  isComplete ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'
                }`}
              >
                {progressPct}%{isComplete ? ' ✓ Complete' : ''}
              </span>
            </div>
          </div>

          {isOwner ? (
            <button
              onClick={() => openTransferModal(sub)}
              className="w-full py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-orange-500 hover:bg-white dark:hover:bg-zinc-800 transition-all text-sm font-bold flex items-center justify-center gap-2"
            >
              Transfer Sessions
            </button>
          ) : (
            <div className="w-full py-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-500 text-center text-xs font-bold flex items-center justify-center gap-2">
              <Shield size={14} /> You have access
            </div>
          )}
        </div>
      );
    });
  };

  const renderHistory = () => {
    if (transferHistory.length === 0) {
      return (
        <div className="py-20 text-center text-zinc-400 dark:text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl">
          <Inbox size={48} className="mx-auto mb-2 opacity-20" />
          <p>No transfer history yet.</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
        {transferHistory.map((req) => {
          const isIncoming = req.to_trainer === currentUserId;
          // FIX #9: كل زر له حالة spinner منفصلة
          const isAccepting = respondingAction?.id === req.id && respondingAction?.action === 'accepted';
          const isRejecting = respondingAction?.id === req.id && respondingAction?.action === 'rejected';
          const isResponding = isAccepting || isRejecting;

          return (
            <div
              key={req.id}
              onClick={() => setSelectedRequestDetail(req)}
              className={`relative p-4 rounded-2xl border transition-all cursor-pointer hover:-translate-y-0.5 shadow-sm ${
                isIncoming
                  ? 'bg-white dark:bg-[#121214] border-l-4 border-l-blue-500 border-y-zinc-200 dark:border-y-zinc-800 border-r-zinc-200 dark:border-r-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                  : 'bg-zinc-50 dark:bg-zinc-900/40 border-l-4 border-l-zinc-400 dark:border-l-zinc-500 border-y-zinc-200 dark:border-y-zinc-800/50 border-r-zinc-200 dark:border-r-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-900/60'
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isIncoming
                        ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500'
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {isIncoming ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          isIncoming
                            ? 'bg-blue-100 dark:bg-blue-500 text-blue-700 dark:text-black'
                            : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                        }`}
                      >
                        {isIncoming ? 'Received' : 'Sent'}
                      </span>
                      <span className="text-zinc-500 text-xs font-mono">
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white mb-0.5 truncate">
                      {isIncoming
                        ? `From ${req.from_trainer_name}: ${req.client_name}`
                        : `To ${req.to_trainer_name}: ${req.client_name}`}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                      {req.sessions_count} Sessions • {req.schedule_notes}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                      req.status === 'pending'
                        ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500'
                        : req.status === 'accepted'
                        ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-500'
                        : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500'
                    }`}
                  >
                    {req.status}
                  </div>

                  {isIncoming && req.status === 'pending' && (
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={(e) => handleRespond(req.id, 'accepted', e)}
                        disabled={isResponding}
                        className="p-1.5 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-500 hover:bg-green-500 hover:text-white transition-colors disabled:opacity-50"
                        title="Accept"
                      >
                        {/* FIX #9: spinner يظهر فقط على زر Accept لما يكون هو المضغوط */}
                        {isAccepting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                      </button>
                      <button
                        onClick={(e) => handleRespond(req.id, 'rejected', e)}
                        disabled={isResponding}
                        className="p-1.5 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-500 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50"
                        title="Reject"
                      >
                        {/* FIX #9: spinner يظهر فقط على زر Reject لما يكون هو المضغوط */}
                        {isRejecting ? <Loader2 size={14} className="animate-spin" /> : <X size={14} strokeWidth={3} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="text-zinc-900 dark:text-white py-6 lg:py-8 transition-colors duration-300">
      <Toaster
        position="top-right"
        toastOptions={{ style: { background: '#18181b', color: '#fff', border: '1px solid #333' } }}
      />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Trainer Profile</h1>
          <p className="text-zinc-500">Manage your specific clients and coverage requests.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('clients')}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'clients'
                ? 'border-orange-500 text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            My Clients
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-orange-500 text-zinc-900 dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Transfer History
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-black">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Fetch error */}
        {fetchError && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl text-red-600 dark:text-red-400">
            <AlertCircle size={18} />
            <span className="text-sm font-medium">{fetchError}</span>
            <button onClick={fetchData} className="ml-auto text-xs font-bold underline">
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <ClientCardSkeleton key={i} />)}
          </div>
        ) : (
          <>
            {activeTab === 'clients' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4">
                {renderMyClients()}
              </div>
            )}
            {activeTab === 'history' && renderHistory()}
          </>
        )}
      </div>

      {/* ── TRANSFER REQUEST MODAL ─────────────────────────────────────── */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 w-full max-w-lg rounded-3xl p-6 relative animate-in zoom-in-95 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsTransferModalOpen(false)}
              className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            >
              <XCircle size={24} />
            </button>

            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">Transfer Sessions</h2>
            <p className="text-zinc-500 text-sm mb-6">
              Request coverage for{' '}
              <span className="text-zinc-900 dark:text-white font-bold">
                {selectedSubForTransfer?.client_name}
              </span>
              .
            </p>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Select Trainer</label>
                <select
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white outline-none focus:border-orange-500 mt-1"
                  value={transferForm.to_trainer}
                  onChange={(e) => setTransferForm({ ...transferForm, to_trainer: e.target.value })}
                >
                  <option value="">-- Choose Coach --</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>{t.first_name || t.username}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Number of Sessions</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 5"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white outline-none focus:border-orange-500 mt-1"
                  value={transferForm.sessions_count}
                  onChange={(e) => setTransferForm({ ...transferForm, sessions_count: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Select Days</label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDayToggle(day)}
                      className={`w-10 h-10 rounded-lg text-xs font-bold transition-all border ${
                        transferForm.selected_days.includes(day)
                          ? 'bg-orange-600 text-white border-orange-500'
                          : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Preferred Time</label>
                <input
                  type="time"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white outline-none focus:border-orange-500 mt-1"
                  value={transferForm.time_preference}
                  onChange={(e) => setTransferForm({ ...transferForm, time_preference: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Additional Notes</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Focus on cardio..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-900 dark:text-white outline-none focus:border-orange-500 mt-1 resize-none placeholder-zinc-400"
                  value={transferForm.additional_notes}
                  onChange={(e) => setTransferForm({ ...transferForm, additional_notes: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingTransfer}
                className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl mt-2 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isSubmittingTransfer
                  ? <><Loader2 size={18} className="animate-spin" /> Sending...</>
                  : <><Send size={18} /> Send Request</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── REQUEST DETAILS MODAL ──────────────────────────────────────── */}
      {selectedRequestDetail && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-3xl p-8 relative animate-in zoom-in-95 shadow-2xl">
            <button
              onClick={() => setSelectedRequestDetail(null)}
              className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            >
              <XCircle size={24} />
            </button>

            <div className="mb-6">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded">
                Transfer Details
              </span>
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white mt-2 mb-1">
                {selectedRequestDetail.client_name}
              </h2>
              <p className="text-zinc-500 text-sm">{selectedRequestDetail.plan_name}</p>
            </div>

            <div className="space-y-4 bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
              {[
                { label: 'From', val: selectedRequestDetail.from_trainer_name },
                { label: 'To', val: selectedRequestDetail.to_trainer_name },
                { label: 'Count', val: `${selectedRequestDetail.sessions_count} Sessions` },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-3 last:border-0 last:pb-0">
                  <span className="text-zinc-500 font-bold text-xs uppercase">{label}</span>
                  <span className="text-zinc-900 dark:text-white font-bold">{val}</span>
                </div>
              ))}
              <div>
                <span className="text-zinc-500 font-bold text-xs uppercase block mb-1">Schedule & Notes</span>
                <p className="text-zinc-700 dark:text-zinc-300 text-sm whitespace-pre-wrap bg-white dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  {selectedRequestDetail.schedule_notes}
                </p>
              </div>
            </div>

            {selectedRequestDetail.status === 'pending' &&
              selectedRequestDetail.to_trainer === currentUserId && (
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <button
                    onClick={() => handleRespond(selectedRequestDetail.id, 'rejected')}
                    disabled={respondingAction?.id === selectedRequestDetail.id}
                    className="py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {/* FIX #9: spinner مخصص لـ Reject فقط */}
                    {respondingAction?.id === selectedRequestDetail.id && respondingAction?.action === 'rejected'
                      ? <Loader2 size={16} className="animate-spin" /> : null}
                    Reject
                  </button>
                  <button
                    onClick={() => handleRespond(selectedRequestDetail.id, 'accepted')}
                    disabled={respondingAction?.id === selectedRequestDetail.id}
                    className="py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold shadow-lg disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {/* FIX #9: spinner مخصص لـ Accept فقط */}
                    {respondingAction?.id === selectedRequestDetail.id && respondingAction?.action === 'accepted'
                      ? <Loader2 size={16} className="animate-spin" /> : null}
                    Accept
                  </button>
                </div>
              )}

            {selectedRequestDetail.status !== 'pending' && (
              <div className="mt-6 text-center p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-500 text-xs font-bold uppercase">Current Status</span>
                <div
                  className={`text-lg font-black uppercase mt-1 ${
                    selectedRequestDetail.status === 'accepted'
                      ? 'text-green-600 dark:text-green-500'
                      : 'text-red-600 dark:text-red-500'
                  }`}
                >
                  {selectedRequestDetail.status}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainerProfile;