import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
    ArrowLeft, Save, User, Trash2, Calendar, 
    Activity, ShieldCheck, MapPin, Hash, Utensils  
} from 'lucide-react';


import api, { BASE_URL } from '../api';
import { AuthContext } from '../context/AuthContext';
import ClientInfoTab from '../components/clients/ClientInfoTab';
import ClientMembershipTab from '../components/clients/ClientMembershipTab';
import ClientTrainingTab from '../components/clients/ClientTrainingTab';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ClientNutritionTab from '../components/clients/ClientNutritionTab';

const ClientDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const location = useLocation();

    const [loading, setLoading] = useState(true);
    const [isEditingDate, setIsEditingDate] = useState(false);
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'info');

    // Data States
    const [formData, setFormData] = useState({
        name: '', manual_id: '', phone: '',
        nature_of_work: '', birth_date: '', address: '',
        status: 'Single', smoking: false, sleep_hours: '', notes: '',
        created_at: '' // Added for "Since" Year
    });

    // We keep the DB age as a fallback, but rely on calculation
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

    // --- INSTANT AGE CALCULATION ---
    const calculatedAge = useMemo(() => {
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
        return dbAge || '--';
    }, [formData.birth_date, dbAge]);

    const hasActiveSub = subscriptions.some(sub => sub.is_active);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const clientRes = await api.get(`/clients/${id}/`);
                const data = clientRes.data;
                setFormData({
                    name: data.name || '', manual_id: data.manual_id || '', phone: data.phone || '',
                    nature_of_work: data.nature_of_work || '', birth_date: data.birth_date || '',
                    address: data.address || '', status: data.status || 'Single',
                    smoking: data.smoking || false, sleep_hours: data.sleep_hours || '', notes: data.notes || '',
                    created_at: data.created_at
                });
                setDbAge(data.age);
                setIsSubscribed(data.is_subscribed);
                if (data.photo_url) setPhotoUrl(data.photo_url.startsWith('http') ? data.photo_url : `${BASE_URL}${data.photo_url}`);

                const subRes = await api.get(`/client-subscriptions/?client_id=${id}`);
                setSubscriptions(subRes.data);

                const plansRes = await api.get('/subscriptions/');
                setAvailablePlans(plansRes.data);

                if (user?.is_superuser) {
                    const trainersRes = await api.get('/manage-trainers/');
                    setTrainers(trainersRes.data);
                }
            } catch (error) { console.error("Error fetching data", error); }
            finally { setLoading(false); }
        };
        fetchData();
    }, [id, user]);

    // --- Actions ---
    const handleSaveProfile = async () => {
        try {
            const payload = { ...formData };
            if (payload.sleep_hours === '') payload.sleep_hours = null;
            if (payload.birth_date === '') payload.birth_date = null;
            await api.patch(`/clients/${id}/`, payload);
            alert("Profile updated successfully!");
        } catch (error) { alert("Error updating profile."); }
    };

    const handleDeleteClient = async () => {
        if (!confirm("⚠️ PERMANENT ACTION\n\nAre you sure you want to delete this athlete? All history, workouts, and data will be lost forever.")) return;
        try {
            await api.delete(`/clients/${id}/`);
            navigate('/clients');
        } catch (error) {
            alert("Could not delete client. Ensure all subscriptions are cancelled first.");
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    // --- Subscription Logic ---
    const handleCreateSub = async (e) => {
        e.preventDefault();
        try {
            const payload = { client: id, plan: newSubData.plan, start_date: newSubData.start_date, is_active: true };
            if (user?.is_superuser && newSubData.trainer) payload.trainer = newSubData.trainer;
            await api.post('/client-subscriptions/', payload);
            const subRes = await api.get(`/client-subscriptions/?client_id=${id}`);
            setSubscriptions(subRes.data);
            setIsSubscribed(true);
            setIsSubModalOpen(false);
            setNewSubData({ plan: '', trainer: '', start_date: new Date().toISOString().split('T')[0] });
        } catch (error) {
            alert(error.response?.data?.is_active?.[0] || "Error creating subscription.");
        }
    };

    const toggleSubStatus = async (e, sub) => {
        e.stopPropagation();
        if (!confirm(`Mark as ${sub.is_active ? 'Inactive' : 'Active'}?`)) return;
        try {
            await api.patch(`/client-subscriptions/${sub.id}/`, { is_active: !sub.is_active });
            const subRes = await api.get(`/client-subscriptions/?client_id=${id}`);
            setSubscriptions(subRes.data);
            setIsSubscribed(subRes.data.some(s => s.is_active));
        } catch (error) { alert("Error updating status."); }
    };

    const handleSaveInBody = async () => {
        if (!selectedSub) return;
        try {
            await api.patch(`/client-subscriptions/${selectedSub.id}/`, {
                inbody_height: selectedSub.inbody_height, inbody_weight: selectedSub.inbody_weight,
                inbody_muscle: selectedSub.inbody_muscle, inbody_fat: selectedSub.inbody_fat,
                inbody_tbw: selectedSub.inbody_tbw, inbody_goal: selectedSub.inbody_goal,
                inbody_activity: selectedSub.inbody_activity, inbody_notes: selectedSub.inbody_notes,
                sessions_used: selectedSub.sessions_used
            });
            alert("Data Saved Successfully!");
        } catch (error) { alert("Error saving data"); }
    };

    if (loading) return <div className="flex justify-center items-center h-screen bg-[#09090b] text-orange-500"><Activity className="animate-spin mr-2" /> Loading Profile...</div>;

    const tabs = [
        { id: 'info', label: 'Personal Info', icon: User },
        { id: 'membership', label: 'Membership', icon: ShieldCheck },
        { id: 'training', label: 'Training Log', icon: Activity },
        { id: 'diet', label: 'Nutrition', icon: Utensils },  // ← Changed from Calendar

    ];

    return (
        <div className="min-h-screen bg-[#09090b] text-white p-4 lg:p-6 lg:pl-80 pt-20 lg:pt-6 transition-all animate-in fade-in duration-500">

            <div className="lg:hidden flex items-center justify-between mb-6">
                <button onClick={() => navigate('/clients')} className="p-2 bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors"><ArrowLeft size={20} /></button>
                <div className="text-sm font-bold text-zinc-400">Athlete Profile</div>
                <div className="w-9" />
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">

                {/* --- LEFT COLUMN: Sticky Profile Card --- */}
                <div className="xl:col-span-4 xl:sticky xl:top-6 space-y-4">
                    <div className="bg-[#121214] border border-zinc-800/60 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">

                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-zinc-800 to-transparent opacity-20" />

                        <div className="relative flex justify-center mb-4 mt-2">
                            <div className="w-32 h-32 rounded-full p-1.5 bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-xl">
                                <div className="w-full h-full rounded-full overflow-hidden bg-zinc-950 flex items-center justify-center border-4 border-[#121214]">
                                    {photoUrl ? (
                                        <img src={photoUrl} alt="Profile" className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                                    ) : (
                                        <User size={48} className="text-zinc-600" />
                                    )}
                                </div>
                            </div>
                            <div className={`absolute bottom-0 bg-[#121214] px-3 py-1 rounded-full border ${isSubscribed ? 'border-green-500/30 text-green-500 shadow-green-900/20' : 'border-red-500/30 text-red-500 shadow-red-900/20'} shadow-lg flex items-center gap-1.5`}>
                                <div className={`w-2 h-2 rounded-full ${isSubscribed ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                <span className="text-xs font-bold uppercase tracking-wider">{isSubscribed ? 'Active' : 'Inactive'}</span>
                            </div>
                        </div>

                        <div className="text-center space-y-3 mb-8">
                            <h1 className="text-2xl font-black text-white tracking-tight">{formData.name}</h1>

                            {/* --- BOXED ID --- */}
                            <div className="flex justify-center">
                                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
                                    <Hash size={14} className="text-zinc-500" />
                                    <span className="font-mono text-zinc-300 font-bold tracking-wider">{formData.manual_id}</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            <div className="bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center">
                                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Age</span>
                                {/* --- UPDATED DYNAMIC AGE --- */}
                                <span className="text-lg font-bold text-white">{calculatedAge}</span>
                            </div>
                            <div className="bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800/50 flex flex-col items-center">
                                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Since</span>
                                {/* --- DYNAMIC YEAR --- */}
                                <span className="text-lg font-bold text-white">
                                    {formData.created_at ? new Date(formData.created_at).getFullYear() : new Date().getFullYear()}
                                </span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={handleSaveProfile}
                                className="w-full bg-white text-black hover:bg-orange-500 hover:text-white transition-all duration-300 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-white/5 active:scale-95"
                            >
                                <Save size={18} strokeWidth={2.5} /> Save Changes
                            </button>

                            {(user?.is_superuser || !isSubscribed) && (
                                <button
                                    onClick={handleDeleteClient}
                                    className="w-full group bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <Trash2 size={18} strokeWidth={2.5} className="group-hover:animate-bounce" /> Clear Customer
                                </button>
                            )}
                        </div>
                    </div>

                    {/* --- REMOVED PHONE SECTION FROM HERE --- */}

                    {/* Simplified Address Only Box */}
                    {formData.address && (
                        <div className="bg-[#121214] border border-zinc-800/60 rounded-3xl p-5 shadow-lg">
                            <div className="flex items-center gap-3 text-zinc-400">
                                <div className="p-2 bg-zinc-900 rounded-lg"><MapPin size={16} /></div>
                                <span className="text-sm font-medium truncate">{formData.address}</span>
                            </div>
                        </div>
                    )}
                </div>


                {/* --- RIGHT COLUMN: Tabs & Main Content --- */}
                <div className="xl:col-span-8 space-y-6">
                    <div className="bg-[#121214] p-1.5 rounded-2xl border border-zinc-800 inline-flex w-full overflow-x-auto no-scrollbar shadow-lg">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setSelectedSub(null); }}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === tab.id
                                        ? 'bg-zinc-800 text-white shadow-md'
                                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                                    }`}
                            >
                                <tab.icon size={16} /> {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="bg-[#121214] border border-zinc-800/60 rounded-[2rem] p-6 md:p-8 min-h-[500px] shadow-2xl relative animate-in slide-in-from-bottom-4 duration-500">
                        {activeTab === 'info' && (
                            <div className="animate-in fade-in duration-300">
                                <ClientInfoTab
                                    formData={formData} handleChange={handleChange}
                                    isEditingDate={isEditingDate} setIsEditingDate={setIsEditingDate}
                                    clientAge={calculatedAge} user={user}
                                />
                            </div>
                        )}
                        {activeTab === 'membership' && (
                            <div className="animate-in fade-in duration-300">
                                <ClientMembershipTab
                                    subscriptions={subscriptions} hasActiveSub={hasActiveSub}
                                    setIsSubModalOpen={setIsSubModalOpen} setSelectedSub={setSelectedSub} selectedSub={selectedSub}
                                    toggleSubStatus={toggleSubStatus} handleSaveInBody={handleSaveInBody}
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
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sub Modal (Unchanged) */}
            {isSubModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#121214] border border-zinc-800 w-full max-w-md rounded-3xl p-6 relative shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-white">Assign Plan</h2>
                            <button onClick={() => setIsSubModalOpen(false)} className="text-zinc-500 hover:text-white"><Activity size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateSub} className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1 block mb-1.5">Select Plan</label>
                                <select required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white outline-none focus:border-orange-500 transition-colors appearance-none" onChange={(e) => setNewSubData({ ...newSubData, plan: e.target.value })}>
                                    <option value="">-- Choose Plan --</option>
                                    {availablePlans.map(plan => (<option key={plan.id} value={plan.id}>{plan.name} ({plan.duration_days} days)</option>))}
                                </select>
                            </div>
                            {user?.is_superuser && (
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1 block mb-1.5">Assign Trainer</label>
                                    <select className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white outline-none focus:border-orange-500 transition-colors appearance-none" onChange={(e) => setNewSubData({ ...newSubData, trainer: e.target.value })}>
                                        <option value="">-- Auto (Me) --</option>
                                        {trainers.map(t => (<option key={t.id} value={t.id}>{t.username}</option>))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1 block mb-1.5">Start Date</label>
                                <input type="date" required value={newSubData.start_date} onChange={(e) => setNewSubData({ ...newSubData, start_date: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white outline-none focus:border-orange-500 [color-scheme:dark]" />
                            </div>
                            <button type="submit" className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-orange-900/20 active:scale-95 transition-all mt-2">
                                Confirm Assignment
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientDetails;