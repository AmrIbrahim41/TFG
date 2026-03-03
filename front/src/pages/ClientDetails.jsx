import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { 
    ArrowLeft, Save, User, Trash2, Activity, ShieldCheck, MapPin, Hash, Utensils, Loader2, X
} from 'lucide-react';

import api from '../api';
// IMPORTANT: Do NOT import BASE_URL or prepend it to photo fields.
// The backend now returns full absolute URIs for all image fields.
import { AuthContext } from '../context/AuthContext';
import ClientInfoTab from '../components/clients/ClientInfoTab';
import ClientMembershipTab from '../components/clients/ClientMembershipTab';
import ClientTrainingTab from '../components/clients/ClientTrainingTab';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ClientNutritionTab from '../components/clients/ClientNutritionTab';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------
const ClientDetailsSkeleton = () => (
    <div className="py-6 lg:py-8 transition-colors">
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
            {/* Left column skeleton */}
            <div className="xl:col-span-4 space-y-4">
                <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800/60 rounded-3xl p-6 animate-pulse">
                    <div className="flex justify-center mb-4 mt-2">
                        <div className="w-32 h-32 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                    <div className="space-y-3 mb-8">
                        <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-xl mx-auto w-3/4" />
                        <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg mx-auto w-1/2" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-8">
                        <div className="h-16 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                        <div className="h-16 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                    </div>
                    <div className="space-y-3">
                        <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                        <div className="h-12 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                    </div>
                </div>
            </div>
            {/* Right column skeleton */}
            <div className="xl:col-span-8 space-y-6">
                <div className="h-16 bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 rounded-2xl animate-pulse" />
                <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800/60 rounded-[2rem] p-6 md:p-8 min-h-[500px] animate-pulse">
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-14 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const ClientDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const location = useLocation();

    const [loading, setLoading] = useState(true);
    const [isEditingDate, setIsEditingDate] = useState(false);
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'info');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCreatingSub, setIsCreatingSub] = useState(false);
    const [isTogglingSubId, setIsTogglingSubId] = useState(null);
    const [isSavingInBody, setIsSavingInBody] = useState(false);

    // Data States
    const [formData, setFormData] = useState({
        name: '', manual_id: '', phone: '',
        nature_of_work: '', birth_date: '', address: '',
        status: 'Single', smoking: false, sleep_hours: '', notes: '',
        created_at: ''
    });

    const [dbAge, setDbAge] = useState('');
    const [photoUrl, setPhotoUrl] = useState(null);
    const [isSubscribed, setIsSubscribed] = useState(false);

    // Subscriptions
    const [subscriptions, setSubscriptions] = useState([]);
    const [availablePlans, setAvailablePlans] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [selectedSub, setSelectedSub] = useState(null);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [newSubData, setNewSubData] = useState({
        plan: '', trainer: '', start_date: new Date().toISOString().split('T')[0]
    });

    // Memoized age calculation
    const calculatedAge = useMemo(() => {
        if (formData.birth_date) {
            const today = new Date();
            const birthDate = new Date(formData.birth_date);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
            return age;
        }
        return dbAge || '--';
    }, [formData.birth_date, dbAge]);

    const hasActiveSub = useMemo(
        () => Array.isArray(subscriptions) ? subscriptions.some(sub => sub.is_active) : false,
        [subscriptions]
    );

    // ---------------------------------------------------------------------------
    // Data Fetching — with cleanup flag to prevent state update after unmount
    // ---------------------------------------------------------------------------
    useEffect(() => {
        let cancelled = false;

        const fetchData = async () => {
            try {
                const [clientRes, subRes, plansRes] = await Promise.all([
                    api.get(`/clients/${id}/`),
                    api.get(`/client-subscriptions/?client_id=${id}`),
                    api.get('/subscriptions/?target=adult'),
                ]);

                if (cancelled) return;

                const data = clientRes.data;
                setFormData({
                    name: data.name || '',
                    manual_id: data.manual_id || '',
                    phone: data.phone || '',
                    nature_of_work: data.nature_of_work || '',
                    birth_date: data.birth_date || '',
                    address: data.address || '',
                    status: data.status || 'Single',
                    smoking: data.smoking || false,
                    sleep_hours: data.sleep_hours || '',
                    notes: data.notes || '',
                    created_at: data.created_at,
                });
                setDbAge(data.age);
                setIsSubscribed(data.is_subscribed);

                // Backend returns absolute URI — no need to check or prepend BASE_URL
                if (data.photo_url) setPhotoUrl(data.photo_url);

                const newSubs = subRes.data.results || subRes.data;
                setSubscriptions(newSubs);
                setAvailablePlans(plansRes.data);

                if (user?.is_superuser) {
                    const trainersRes = await api.get('/manage-trainers/');
                    if (!cancelled) setTrainers(trainersRes.data);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Error fetching client data', error);
                    toast.error('Failed to load client profile.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchData();
        return () => { cancelled = true; };
    }, [id, user]);

    // ---------------------------------------------------------------------------
    // Handlers — wrapped in useCallback for stable references
    // ---------------------------------------------------------------------------
    const handleChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }, []);

    const handleSaveProfile = useCallback(async () => {
        if (!formData.name.trim()) {
            toast.error('Name cannot be empty.');
            return;
        }
        setIsSaving(true);
        try {
            const payload = { ...formData };
            if (payload.sleep_hours === '') payload.sleep_hours = null;
            if (payload.birth_date === '') payload.birth_date = null;
            await api.patch(`/clients/${id}/`, payload);
            toast.success('Profile updated successfully!');
        } catch (error) {
            toast.error('Error updating profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    }, [formData, id]);

    const handleDeleteClient = useCallback(async () => {
        if (!window.confirm('⚠️ PERMANENT ACTION\n\nAre you sure you want to delete this athlete? All history, workouts, and data will be lost forever.')) return;
        setIsDeleting(true);
        try {
            await api.delete(`/clients/${id}/`);
            navigate('/clients');
        } catch (error) {
            toast.error('Could not delete client. Ensure all subscriptions are cancelled first.');
            setIsDeleting(false);
        }
    }, [id, navigate]);

    const handleCreateSub = useCallback(async (e) => {
        e.preventDefault();
        if (!newSubData.plan) {
            toast.error('Please select a plan.');
            return;
        }
        setIsCreatingSub(true);
        try {
            const payload = {
                client: id,
                plan: newSubData.plan,
                start_date: newSubData.start_date,
                is_active: true,
            };
            if (user?.is_superuser && newSubData.trainer) payload.trainer = newSubData.trainer;
            await api.post('/client-subscriptions/', payload);

            const subRes = await api.get(`/client-subscriptions/?client_id=${id}`);
            const newSubs = subRes.data.results || subRes.data;
            setSubscriptions(newSubs);
            setIsSubscribed(true);
            setIsSubModalOpen(false);
            setNewSubData({ plan: '', trainer: '', start_date: new Date().toISOString().split('T')[0] });
            toast.success('Plan assigned successfully!');
        } catch (error) {
            toast.error(error.response?.data?.is_active?.[0] || 'Error creating subscription.');
        } finally {
            setIsCreatingSub(false);
        }
    }, [id, newSubData, user]);

    const toggleSubStatus = useCallback(async (e, sub) => {
        e.stopPropagation();
        if (!window.confirm(`Mark as ${sub.is_active ? 'Inactive' : 'Active'}?`)) return;
        setIsTogglingSubId(sub.id);
        try {
            await api.patch(`/client-subscriptions/${sub.id}/`, { is_active: !sub.is_active });
            const subRes = await api.get(`/client-subscriptions/?client_id=${id}`);
            const newSubs = subRes.data.results || subRes.data;
            setSubscriptions(newSubs);
            setIsSubscribed(newSubs.some(s => s.is_active));
            toast.success(`Subscription marked as ${!sub.is_active ? 'Active' : 'Inactive'}.`);
        } catch (error) {
            toast.error('Error updating subscription status.');
        } finally {
            setIsTogglingSubId(null);
        }
    }, [id]);

    const handleSaveInBody = useCallback(async () => {
        if (!selectedSub) return;
        setIsSavingInBody(true);
        try {
            await api.patch(`/client-subscriptions/${selectedSub.id}/`, {
                inbody_height: selectedSub.inbody_height,
                inbody_weight: selectedSub.inbody_weight,
                inbody_muscle: selectedSub.inbody_muscle,
                inbody_fat: selectedSub.inbody_fat,
                inbody_tbw: selectedSub.inbody_tbw,
                inbody_goal: selectedSub.inbody_goal,
                inbody_activity: selectedSub.inbody_activity,
                inbody_notes: selectedSub.inbody_notes,
                sessions_used: selectedSub.sessions_used,
            });
            toast.success('InBody data saved successfully!');
        } catch (error) {
            toast.error('Error saving InBody data.');
        } finally {
            setIsSavingInBody(false);
        }
    }, [selectedSub]);

    const handleTabChange = useCallback((tabId) => {
        setActiveTab(tabId);
        setSelectedSub(null);
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsSubModalOpen(false);
        setNewSubData({ plan: '', trainer: '', start_date: new Date().toISOString().split('T')[0] });
    }, []);

    // ---------------------------------------------------------------------------
    // Tabs config (stable — defined outside render, memoized)
    // ---------------------------------------------------------------------------
    const tabs = useMemo(() => [
        { id: 'info',       label: 'Personal Info', icon: User },
        { id: 'membership', label: 'Membership',    icon: ShieldCheck },
        { id: 'training',   label: 'Training Log',  icon: Activity },
        { id: 'diet',       label: 'Nutrition',     icon: Utensils },
    ], []);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    if (loading) return <ClientDetailsSkeleton />;

    return (
        <div className="text-zinc-900 dark:text-white py-6 lg:py-8 transition-colors animate-in fade-in duration-500">

            {/* Mobile Header */}
            <div className="lg:hidden flex items-center justify-between mb-6">
                <button
                    onClick={() => navigate('/clients')}
                    className="p-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors border border-zinc-300 dark:border-zinc-800"
                >
                    <ArrowLeft size={20} className="text-zinc-600 dark:text-white" />
                </button>
                <div className="text-sm font-bold text-zinc-500 dark:text-zinc-400">Athlete Profile</div>
                <div className="w-9" />
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">

                {/* ── LEFT COLUMN: Sticky Profile Card ─────────────────────────── */}
                <div className="xl:col-span-4 xl:sticky xl:top-6 space-y-4">
                    <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800/60 rounded-3xl p-6 shadow-xl dark:shadow-2xl relative overflow-hidden group transition-colors duration-300">

                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-zinc-200 to-transparent dark:from-zinc-800 dark:to-transparent opacity-50 dark:opacity-20" />

                        {/* Avatar */}
                        <div className="relative flex justify-center mb-4 mt-2">
                            <div className="w-32 h-32 rounded-full p-1.5 bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-900 shadow-xl">
                                <div className="w-full h-full rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center border-4 border-zinc-50 dark:border-[#121214]">
                                    {photoUrl ? (
                                        <img
                                            src={photoUrl}
                                            alt="Profile"
                                            className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500"
                                        />
                                    ) : (
                                        <User size={48} className="text-zinc-400 dark:text-zinc-600" />
                                    )}
                                </div>
                            </div>
                            <div className={`absolute bottom-0 bg-zinc-50 dark:bg-[#121214] px-3 py-1 rounded-full border shadow-lg flex items-center gap-1.5 ${isSubscribed ? 'border-green-500/30 text-green-600 dark:text-green-500 shadow-green-900/20' : 'border-red-500/30 text-red-600 dark:text-red-500 shadow-red-900/20'}`}>
                                <div className={`w-2 h-2 rounded-full ${isSubscribed ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                <span className="text-xs font-bold uppercase tracking-wider">{isSubscribed ? 'Active' : 'Inactive'}</span>
                            </div>
                        </div>

                        {/* Name & ID */}
                        <div className="text-center space-y-3 mb-8">
                            <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">{formData.name}</h1>
                            <div className="flex justify-center">
                                <div className="flex items-center gap-2 bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-1.5">
                                    <Hash size={14} className="text-zinc-500" />
                                    <span className="font-mono text-zinc-600 dark:text-zinc-300 font-bold tracking-wider">{formData.manual_id}</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            <div className="bg-zinc-100 dark:bg-zinc-900/50 p-3 rounded-2xl border border-zinc-300 dark:border-zinc-800/50 flex flex-col items-center">
                                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Age</span>
                                <span className="text-lg font-bold text-zinc-900 dark:text-white">{calculatedAge}</span>
                            </div>
                            <div className="bg-zinc-100 dark:bg-zinc-900/50 p-3 rounded-2xl border border-zinc-300 dark:border-zinc-800/50 flex flex-col items-center">
                                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Since</span>
                                <span className="text-lg font-bold text-zinc-900 dark:text-white">
                                    {formData.created_at ? new Date(formData.created_at).getFullYear() : new Date().getFullYear()}
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            <button
                                onClick={handleSaveProfile}
                                disabled={isSaving}
                                className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black hover:bg-orange-600 dark:hover:bg-orange-500 hover:text-white dark:hover:text-white transition-all duration-300 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-black/5 dark:shadow-white/5 active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
                            >
                                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} strokeWidth={2.5} />}
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>

                            {(user?.is_superuser || !isSubscribed) && (
                                <button
                                    onClick={handleDeleteClient}
                                    disabled={isDeleting}
                                    className="w-full group bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-500 hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white transition-all duration-300 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60 disabled:pointer-events-none"
                                >
                                    {isDeleting
                                        ? <Loader2 size={18} className="animate-spin" />
                                        : <Trash2 size={18} strokeWidth={2.5} className="group-hover:animate-bounce" />
                                    }
                                    {isDeleting ? 'Deleting...' : 'Clear Customer'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Address Box */}
                    {formData.address && (
                        <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800/60 rounded-3xl p-5 shadow-lg transition-colors">
                            <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
                                <div className="p-2 bg-zinc-200 dark:bg-zinc-900 rounded-lg"><MapPin size={16} /></div>
                                <span className="text-sm font-medium truncate">{formData.address}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── RIGHT COLUMN: Tabs & Main Content ─────────────────────────── */}
                <div className="xl:col-span-8 space-y-6">

                    {/* Tabs Container */}
                    <div className="bg-zinc-50 dark:bg-[#121214] p-1.5 rounded-2xl border border-zinc-300 dark:border-zinc-800 inline-flex w-full overflow-x-auto no-scrollbar shadow-lg transition-colors">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-zinc-900 dark:bg-zinc-800 text-white shadow-md'
                                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-900'
                                }`}
                            >
                                <tab.icon size={16} /> {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800/60 rounded-[2rem] p-6 md:p-8 min-h-[500px] shadow-2xl relative animate-in slide-in-from-bottom-4 duration-500 transition-colors">
                        {activeTab === 'info' && (
                            <div className="animate-in fade-in duration-300">
                                <ClientInfoTab
                                    formData={formData}
                                    handleChange={handleChange}
                                    isEditingDate={isEditingDate}
                                    setIsEditingDate={setIsEditingDate}
                                    clientAge={calculatedAge}
                                    user={user}
                                />
                            </div>
                        )}
                        {activeTab === 'membership' && (
                            <div className="animate-in fade-in duration-300">
                                <ClientMembershipTab
                                    subscriptions={subscriptions}
                                    hasActiveSub={hasActiveSub}
                                    setIsSubModalOpen={setIsSubModalOpen}
                                    setSelectedSub={setSelectedSub}
                                    selectedSub={selectedSub}
                                    toggleSubStatus={toggleSubStatus}
                                    isTogglingSubId={isTogglingSubId}
                                    handleSaveInBody={handleSaveInBody}
                                    isSavingInBody={isSavingInBody}
                                    clientAge={calculatedAge}
                                />
                            </div>
                        )}
                        {activeTab === 'training' && (
                            <div className="animate-in fade-in duration-300">
                                <ClientTrainingTab subscriptions={subscriptions} />
                            </div>
                        )}
                        {activeTab === 'diet' && (
                            <div className="animate-in fade-in duration-300">
                                <ClientNutritionTab
                                    subscriptions={subscriptions}
                                    clientAge={calculatedAge}
                                    clientData={{ id }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Assign Plan Modal ──────────────────────────────────────────── */}
            {isSubModalOpen && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-zinc-50 dark:bg-[#121214] border border-zinc-300 dark:border-zinc-800 w-full max-w-md rounded-3xl p-6 relative shadow-2xl animate-in zoom-in-95 duration-200 transition-colors">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-zinc-900 dark:text-white">Assign Plan</h2>
                            <button
                                onClick={handleCloseModal}
                                className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateSub} className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1 block mb-1.5">Select Plan</label>
                                <select
                                    required
                                    className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none focus:border-orange-500 transition-colors appearance-none"
                                    value={newSubData.plan}
                                    onChange={(e) => setNewSubData({ ...newSubData, plan: e.target.value })}
                                >
                                    <option value="">-- Choose Plan --</option>
                                    {availablePlans.map(plan => (
                                        <option key={plan.id} value={plan.id}>{plan.name} ({plan.duration_days} days)</option>
                                    ))}
                                </select>
                            </div>
                            {user?.is_superuser && (
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1 block mb-1.5">Assign Trainer</label>
                                    <select
                                        className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none focus:border-orange-500 transition-colors appearance-none"
                                        value={newSubData.trainer}
                                        onChange={(e) => setNewSubData({ ...newSubData, trainer: e.target.value })}
                                    >
                                        <option value="">-- Auto (Me) --</option>
                                        {trainers.map(t => (<option key={t.id} value={t.id}>{t.username}</option>))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1 block mb-1.5">Start Date</label>
                                <input
                                    type="date"
                                    required
                                    value={newSubData.start_date}
                                    onChange={(e) => setNewSubData({ ...newSubData, start_date: e.target.value })}
                                    className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-900 dark:text-white outline-none focus:border-orange-500 [color-scheme:light] dark:[color-scheme:dark]"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isCreatingSub}
                                className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-orange-500/20 dark:shadow-orange-900/20 active:scale-95 transition-all mt-2 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
                            >
                                {isCreatingSub ? <><Loader2 size={18} className="animate-spin" /> Assigning...</> : 'Confirm Assignment'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientDetails;
