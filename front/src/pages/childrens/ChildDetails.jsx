import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import {
    ArrowLeft, Save, User, Trash2, Baby,
    Hash, ShieldCheck, Dumbbell, X, AlertCircle, CheckCircle2
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';
import ChildInfoTab from '../../components/children/ChildInfoTab';
import ChildMembershipTab from '../../components/children/ChildMembershipTab';
import ChildHistoryTab from '../../components/children/ChildHistoryTab';

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type = 'success', onClose }) => (
    <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-bottom-4 duration-300 ${
        type === 'error'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
    }`}>
        {type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
        <span className="font-semibold text-sm">{message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-70"><X size={16} /></button>
    </div>
);

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
const LoadingSkeleton = () => (
    <div className="py-6 lg:py-8 transition-colors">
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
            <div className="xl:col-span-4">
                <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800/60 rounded-3xl p-6 animate-pulse space-y-6">
                    <div className="w-32 h-32 rounded-full bg-zinc-200 dark:bg-zinc-800 mx-auto" />
                    <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg mx-auto" />
                    <div className="space-y-3">
                        <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                        <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                    </div>
                </div>
            </div>
            <div className="xl:col-span-8">
                <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800/60 rounded-3xl p-6 animate-pulse space-y-6">
                    <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    </div>
);

// ─── Component ────────────────────────────────────────────────────────────────
const ChildDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [loading, setLoading] = useState(true);
    const [photoUrl, setPhotoUrl] = useState(null);
    const [dbAge, setDbAge] = useState('');
    const [activeTab, setActiveTab] = useState('info');
    const [toast, setToast] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // ── Data State ────────────────────────────────────────────────────────
    const [formData, setFormData] = useState({
        name: '', manual_id: '', phone: '', parent_phone: '',
        country: 'Egypt', nature_of_work: '', birth_date: '',
        address: '', status: '', smoking: false, sleep_hours: '',
        notes: '', trained_gym_before: false, trained_coach_before: false,
        injuries: '', created_at: ''
    });

    // ── Subscription State ────────────────────────────────────────────────
    const [subscriptions, setSubscriptions] = useState([]);
    const [availablePlans, setAvailablePlans] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [selectedSub, setSelectedSub] = useState(null);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [newSubData, setNewSubData] = useState({
        plan: '', trainer: '', start_date: new Date().toISOString().split('T')[0]
    });

    // ── Calculated Age ────────────────────────────────────────────────────
    const calculatedAge = useMemo(() => {
        if (!formData.birth_date) return dbAge || '--';
        const today = new Date();
        const birth = new Date(formData.birth_date);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    }, [formData.birth_date, dbAge]);

    const hasActiveSub = useMemo(
        () => Array.isArray(subscriptions) && subscriptions.some(s => s.is_active),
        [subscriptions]
    );

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // ── Fetch All Data ────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            try {
                const requests = [
                    api.get(`/clients/${id}/`),
                    api.get(`/client-subscriptions/?client_id=${id}`),
                    api.get('/subscriptions/?target=child'),
                ];
                if (user?.is_superuser) {
                    requests.push(api.get('/manage-trainers/'));
                }

                const results = await Promise.all(requests);
                if (cancelled) return;

                const [clientRes, subRes, plansRes, trainersRes] = results;

                const data = clientRes.data;
                setFormData({
                    name: data.name || '',
                    manual_id: data.manual_id || '',
                    phone: data.phone || '',
                    parent_phone: data.parent_phone || '',
                    country: data.country || 'Egypt',
                    nature_of_work: data.nature_of_work || '',
                    birth_date: data.birth_date || '',
                    address: data.address || '',
                    status: data.status || '',
                    trained_gym_before: data.trained_gym_before || false,
                    trained_coach_before: data.trained_coach_before || false,
                    injuries: data.injuries || '',
                    smoking: data.smoking || false,
                    sleep_hours: data.sleep_hours || '',
                    notes: data.notes || '',
                    created_at: data.created_at,
                });
                setDbAge(data.age);
                // Backend now returns absolute URIs — use directly
                if (data.photo_url) setPhotoUrl(data.photo_url);

                setSubscriptions(subRes.data.results ?? subRes.data);
                setAvailablePlans(plansRes.data.results ?? plansRes.data);

                if (trainersRes) {
                    setTrainers(trainersRes.data.results ?? trainersRes.data);
                }
            } catch (err) {
                if (!cancelled) showToast('Failed to load child profile.', 'error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchData();
        return () => { cancelled = true; };
    }, [id, user, showToast]);

    // ── Handlers ──────────────────────────────────────────────────────────
    const handleChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }, []);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        try {
            const payload = { ...formData };
            if (payload.sleep_hours === '') payload.sleep_hours = null;
            if (payload.birth_date === '') payload.birth_date = null;
            await api.patch(`/clients/${id}/`, payload);
            showToast('Child profile updated successfully!', 'success');
        } catch (err) {
            const detail = err.response?.data?.detail || 'Error updating profile.';
            showToast(detail, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await api.delete(`/clients/${id}/`);
            navigate('/children');
        } catch {
            showToast('Error deleting account.', 'error');
            setIsDeleting(false);
        }
        setShowDeleteConfirm(false);
    };

    // ── Subscription Logic ────────────────────────────────────────────────
    const refreshSubscriptions = useCallback(async () => {
        const res = await api.get(`/client-subscriptions/?client_id=${id}`);
        setSubscriptions(res.data.results ?? res.data);
    }, [id]);

    const handleCreateSub = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                client: id,
                plan: newSubData.plan,
                start_date: newSubData.start_date,
                is_active: true,
            };
            if (user?.is_superuser) {
                if (newSubData.trainer) payload.trainer = newSubData.trainer;
            } else {
                payload.trainer = user.id;
            }
            await api.post('/client-subscriptions/', payload);
            await refreshSubscriptions();
            setIsSubModalOpen(false);
            setNewSubData({ plan: '', trainer: '', start_date: new Date().toISOString().split('T')[0] });
            showToast('Subscription assigned!', 'success');
        } catch (err) {
            // BUG #3 FIX: الكود السابق كان يتحقق فقط من err.response?.data?.detail،
            // لكن الـ backend بيرجع الخطأ في err.response?.data?.is_active?.[0]
            // لما يكون في اشتراك نشط آخر للعميل.
            // بدون هذا الـ fix، كانت رسالة "This client already has an active subscription."
            // تختفي وتظهر بدلها "Error creating subscription." عامة بدون تفاصيل.
            const errData = err.response?.data || {};
            const msg =
                errData?.is_active?.[0] ||
                errData?.non_field_errors?.[0] ||
                errData?.client?.[0] ||
                errData?.plan?.[0] ||
                errData?.detail ||
                'Error creating subscription.';
            showToast(msg, 'error');
        }
    };

    const toggleSubStatus = async (e, sub) => {
        e.stopPropagation();
        try {
            await api.patch(`/client-subscriptions/${sub.id}/`, { is_active: !sub.is_active });
            await refreshSubscriptions();
            showToast(`Subscription marked as ${sub.is_active ? 'inactive' : 'active'}.`, 'success');
        } catch {
            showToast('Error updating subscription.', 'error');
        }
    };

    const handleSaveInBody = async (data) => {
        if (!selectedSub) return;
        try {
            await api.patch(`/client-subscriptions/${selectedSub.id}/`, {
                inbody_height: data.inbody_height,
                inbody_weight: data.inbody_weight,
                inbody_muscle: data.inbody_muscle,
                inbody_fat: data.inbody_fat,
                inbody_tbw: data.inbody_tbw,
                inbody_goal: data.inbody_goal,
                inbody_activity: data.inbody_activity,
                inbody_notes: data.inbody_notes,
            });
            showToast('Child stats saved!', 'success');
            setSelectedSub(data);
        } catch {
            showToast('Error saving stats.', 'error');
        }
    };

    // ── Loading ───────────────────────────────────────────────────────────
    if (loading) return <LoadingSkeleton />;

    const tabs = [
        { id: 'info', label: 'Personal Info', icon: User },
        { id: 'membership', label: 'Membership', icon: ShieldCheck },
        { id: 'history', label: 'Training Log', icon: Dumbbell },
    ];

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <div className="text-zinc-900 dark:text-white py-6 lg:py-8 transition-all animate-in fade-in duration-500">

            {/* Mobile back button */}
            <div className="lg:hidden flex items-center justify-between mb-6">
                <button
                    onClick={() => navigate('/children')}
                    className="p-2 bg-zinc-200 dark:bg-zinc-900 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="text-sm font-bold text-zinc-500 dark:text-zinc-400">Child Profile</div>
                <div className="w-9" />
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">

                {/* ── Left Column: Profile Card ───────────────────────────────────── */}
                <div className="xl:col-span-4 xl:sticky xl:top-6 space-y-4">
                    <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-100/50 dark:from-blue-900/20 to-transparent pointer-events-none" />

                        {/* Avatar */}
                        <div className="relative flex justify-center mb-4 mt-2">
                            <div className="w-32 h-32 rounded-full p-1.5 bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-900 shadow-xl">
                                <div className="w-full h-full rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center border-4 border-white dark:border-[#121214]">
                                    {photoUrl ? (
                                        <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <Baby size={48} className="text-zinc-400 dark:text-zinc-600" />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="text-center space-y-3 mb-8">
                            <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">{formData.name}</h1>
                            <div className="flex justify-center">
                                <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5">
                                    <Hash size={14} className="text-zinc-500" />
                                    <span className="font-mono text-zinc-600 dark:text-zinc-300 font-bold tracking-wider">{formData.manual_id}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={handleSaveProfile}
                                disabled={isSaving}
                                className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-blue-600 dark:hover:bg-blue-500 hover:text-white dark:hover:text-white transition-all duration-300 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isSaving ? (
                                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                ) : <Save size={18} strokeWidth={2.5} />}
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="w-full bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Trash2 size={18} strokeWidth={2.5} /> Delete Account
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Right Column: Tabs ──────────────────────────────────────────── */}
                <div className="xl:col-span-8 space-y-6">
                    {/* Tab Nav */}
                    <div className="bg-white dark:bg-[#121214] p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 inline-flex w-full overflow-x-auto shadow-lg">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? 'bg-zinc-900 dark:bg-zinc-800 text-white shadow-md'
                                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                                }`}
                            >
                                <tab.icon size={16} /> {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800/60 rounded-[2rem] p-6 md:p-8 min-h-[500px] shadow-lg animate-in slide-in-from-bottom-4 duration-500">
                        {activeTab === 'info' && (
                            <ChildInfoTab
                                formData={formData}
                                handleChange={handleChange}
                                clientAge={calculatedAge}
                                user={user}
                            />
                        )}
                        {activeTab === 'membership' && (
                            <div className="animate-in fade-in duration-300">
                                <ChildMembershipTab
                                    subscriptions={subscriptions}
                                    hasActiveSub={hasActiveSub}
                                    setIsSubModalOpen={setIsSubModalOpen}
                                    setSelectedSub={setSelectedSub}
                                    selectedSub={selectedSub}
                                    toggleSubStatus={toggleSubStatus}
                                    handleSaveInBody={handleSaveInBody}
                                    clientAge={calculatedAge}
                                />
                            </div>
                        )}
                        {activeTab === 'history' && (
                            <ChildHistoryTab clientId={id} />
                        )}
                    </div>
                </div>
            </div>

            {/* ── Assign Plan Modal ───────────────────────────────────────────────── */}
            {isSubModalOpen && (
                <div
                    className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={e => { if (e.target === e.currentTarget) setIsSubModalOpen(false); }}
                >
                    <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
                                <Baby className="text-blue-500" /> Assign Child Plan
                            </h2>
                            <button
                                onClick={() => setIsSubModalOpen(false)}
                                className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateSub} className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1 block mb-1.5">Select Child Package</label>
                                <select
                                    required
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none focus:border-blue-500 transition-colors appearance-none"
                                    onChange={e => setNewSubData(prev => ({ ...prev, plan: e.target.value }))}
                                    value={newSubData.plan}
                                >
                                    <option value="">-- Choose Package --</option>
                                    {availablePlans.map(plan => (
                                        <option key={plan.id} value={plan.id}>
                                            {plan.name} ({plan.duration_days} days)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {user?.is_superuser && (
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1 block mb-1.5">Assign Trainer</label>
                                    <select
                                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none focus:border-blue-500 transition-colors appearance-none"
                                        onChange={e => setNewSubData(prev => ({ ...prev, trainer: e.target.value }))}
                                        value={newSubData.trainer}
                                    >
                                        <option value="">-- Auto (Self) --</option>
                                        {trainers.map(t => (
                                            <option key={t.id} value={t.id}>{t.first_name || t.username}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1 block mb-1.5">Start Date</label>
                                <input
                                    type="date"
                                    required
                                    value={newSubData.start_date}
                                    onChange={e => setNewSubData(prev => ({ ...prev, start_date: e.target.value }))}
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none focus:border-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all mt-2"
                            >
                                Confirm Assignment
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation Modal ───────────────────────────────────────── */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-500 mb-4">
                            <Trash2 size={28} />
                        </div>
                        <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Delete Account?</h3>
                        <p className="text-sm text-zinc-500 mb-6">
                            This will permanently delete <span className="font-bold text-zinc-900 dark:text-white">{formData.name}</span>'s account and all associated data. This cannot be undone.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="py-3.5 rounded-xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="py-3.5 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                ) : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default ChildDetails;