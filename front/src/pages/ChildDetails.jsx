import React, { useState, useEffect, useContext, useMemo } from 'react';
import { ArrowLeft, Save, User, Trash2, Activity, Hash, Baby, ShieldCheck } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { BASE_URL } from '../api';
import { AuthContext } from '../context/AuthContext';
// IMPORT THE NEW CHILD INFO TAB
import ChildInfoTab from '../components/children/ChildInfoTab';
import ChildMembershipTab from '../components/children/ChildMembershipTab';

const ChildDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [loading, setLoading] = useState(true);
    const [photoUrl, setPhotoUrl] = useState(null);
    const [dbAge, setDbAge] = useState('');
    const [activeTab, setActiveTab] = useState('info');

    // --- UPDATED DATA STATE TO SUPPORT NEW FIELDS ---
    const [formData, setFormData] = useState({
        name: '', 
        manual_id: '', 
        phone: '', // Child's secondary phone
        parent_phone: '', // New Field
        country: 'Egypt', // New Field
        nature_of_work: '', // Used for "Sport Type"
        birth_date: '', 
        address: '',
        status: '', // Unused in UI now, but kept for backend compatibility if needed
        smoking: false, // Unused in UI
        sleep_hours: '', 
        notes: '',
        // New Training History Fields
        trained_gym_before: false,
        trained_coach_before: false,
        injuries: '', // Replaces smoker text
        created_at: ''
    });

    // --- SUBSCRIPTION STATE ---
    const [subscriptions, setSubscriptions] = useState([]);
    const [availablePlans, setAvailablePlans] = useState([]);
    const [trainers, setTrainers] = useState([]); 
    const [selectedSub, setSelectedSub] = useState(null);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    
    // Sub Form Data
    const [newSubData, setNewSubData] = useState({
        plan: '', 
        trainer: '', 
        start_date: new Date().toISOString().split('T')[0]
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

    const hasActiveSub = Array.isArray(subscriptions) ? subscriptions.some(sub => sub.is_active) : false;

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Child Details
                const res = await api.get(`/clients/${id}/`);
                const data = res.data;
                
                // Map API data to State (Including new fields if backend has them)
                setFormData({
                    name: data.name || '', 
                    manual_id: data.manual_id || '', 
                    phone: data.phone || '',
                    parent_phone: data.parent_phone || '', // Ensure backend sends this
                    country: data.country || 'Egypt',
                    nature_of_work: data.nature_of_work || '', // Maps to Sport
                    birth_date: data.birth_date || '', 
                    address: data.address || '', 
                    status: data.status || '',
                    trained_gym_before: data.trained_gym_before || false,
                    trained_coach_before: data.trained_coach_before || false,
                    injuries: data.injuries || '',
                    smoking: data.smoking || false, 
                    sleep_hours: data.sleep_hours || '', 
                    notes: data.notes || '',
                    created_at: data.created_at
                });
                
                setDbAge(data.age);
                if (data.photo_url) setPhotoUrl(data.photo_url.startsWith('http') ? data.photo_url : `${BASE_URL}${data.photo_url}`);

                // 2. Fetch Subscriptions
                const subRes = await api.get(`/client-subscriptions/?client_id=${id}`);
                setSubscriptions(subRes.data.results || subRes.data);

                // 3. Fetch ONLY Child Plans
                const plansRes = await api.get('/subscriptions/?target=child');
                setAvailablePlans(plansRes.data);

                // 4. If Admin, Fetch Trainers
                if (user?.is_superuser) {
                    const trainersRes = await api.get('/manage-trainers/');
                    setTrainers(trainersRes.data);
                }

            } catch (error) {
                console.error("Error fetching child data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, user]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        // Logic for boolean toggles vs inputs
        const finalValue = type === 'checkbox' ? checked : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSaveProfile = async () => {
        try {
            const payload = { ...formData };
            if (payload.sleep_hours === '') payload.sleep_hours = null;
            if (payload.birth_date === '') payload.birth_date = null;
            
            await api.patch(`/clients/${id}/`, payload);
            alert("Child profile updated successfully!");
        } catch (error) { alert("Error updating profile."); }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this child account?")) return;
        try {
            await api.delete(`/clients/${id}/`);
            navigate('/children');
        } catch (error) { alert("Error deleting account."); }
    };

    // --- SUBSCRIPTION LOGIC ---
    const handleCreateSub = async (e) => {
        e.preventDefault();
        try {
            const payload = { 
                client: id, 
                plan: newSubData.plan, 
                start_date: newSubData.start_date, 
                is_active: true 
            };

            if (user?.is_superuser) {
                if (newSubData.trainer) payload.trainer = newSubData.trainer;
            } else {
                payload.trainer = user.id;
            }

            await api.post('/client-subscriptions/', payload);
            
            const subRes = await api.get(`/client-subscriptions/?client_id=${id}`);
            setSubscriptions(subRes.data.results || subRes.data);
            
            setIsSubModalOpen(false);
            setNewSubData({ plan: '', trainer: '', start_date: new Date().toISOString().split('T')[0] });
        } catch (error) {
            alert(error.response?.data?.detail || "Error creating subscription.");
        }
    };

    const toggleSubStatus = async (e, sub) => {
        e.stopPropagation();
        if (!confirm(`Mark as ${sub.is_active ? 'Inactive' : 'Active'}?`)) return;
        try {
            await api.patch(`/client-subscriptions/${sub.id}/`, { is_active: !sub.is_active });
            const subRes = await api.get(`/client-subscriptions/?client_id=${id}`);
            setSubscriptions(subRes.data.results || subRes.data);
        } catch (error) { alert("Error updating status."); }
    };

    const handleSaveInBody = async (data) => {
        if (!selectedSub) return;
        try {
            await api.patch(`/client-subscriptions/${selectedSub.id}/`, {
                inbody_height: data.inbody_height, inbody_weight: data.inbody_weight,
                inbody_muscle: data.inbody_muscle, inbody_fat: data.inbody_fat,
                inbody_tbw: data.inbody_tbw, inbody_goal: data.inbody_goal,
                inbody_activity: data.inbody_activity, inbody_notes: data.inbody_notes,
            });
            alert("Child Stats Saved Successfully!");
            setSelectedSub(data);
        } catch (error) { alert("Error saving data"); }
    };

    if (loading) return <div className="flex justify-center items-center h-screen bg-[#09090b] text-blue-500"><Activity className="animate-spin mr-2" /> Loading...</div>;

    const tabs = [
        { id: 'info', label: 'Personal Info', icon: User },
        { id: 'membership', label: 'Membership', icon: ShieldCheck },
    ];

    return (
        <div className="min-h-screen bg-[#09090b] text-white p-4 lg:p-6 lg:pl-80 pt-20 lg:pt-6 transition-all animate-in fade-in duration-500">
            
            <div className="lg:hidden flex items-center justify-between mb-6">
                <button onClick={() => navigate('/children')} className="p-2 bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors"><ArrowLeft size={20} /></button>
                <div className="text-sm font-bold text-zinc-400">Child Profile</div>
                <div className="w-9" />
            </div>

            <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">
                
                {/* --- LEFT COLUMN: Profile Card --- */}
                <div className="xl:col-span-4 xl:sticky xl:top-6 space-y-4">
                    <div className="bg-[#121214] border border-zinc-800/60 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-900/20 to-transparent" />
                        
                        <div className="relative flex justify-center mb-4 mt-2">
                            <div className="w-32 h-32 rounded-full p-1.5 bg-gradient-to-br from-zinc-700 to-zinc-900 shadow-xl">
                                <div className="w-full h-full rounded-full overflow-hidden bg-zinc-950 flex items-center justify-center border-4 border-[#121214]">
                                    {photoUrl ? (
                                        <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <Baby size={48} className="text-zinc-600" />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="text-center space-y-3 mb-8">
                            <h1 className="text-2xl font-black text-white tracking-tight">{formData.name}</h1>
                            <div className="flex justify-center">
                                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5">
                                    <Hash size={14} className="text-zinc-500" />
                                    <span className="font-mono text-zinc-300 font-bold tracking-wider">{formData.manual_id}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button onClick={handleSaveProfile} className="w-full bg-white text-black hover:bg-blue-500 hover:text-white transition-all duration-300 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-95">
                                <Save size={18} strokeWidth={2.5} /> Save Changes
                            </button>
                            <button onClick={handleDelete} className="w-full bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95">
                                <Trash2 size={18} strokeWidth={2.5} /> Delete Account
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- RIGHT COLUMN: Tabs Content --- */}
                <div className="xl:col-span-8 space-y-6">
                    {/* Tabs Navigation */}
                    <div className="bg-[#121214] p-1.5 rounded-2xl border border-zinc-800 inline-flex w-full overflow-x-auto no-scrollbar shadow-lg">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); }}
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
                        
                        {/* --- RENDER NEW CHILD INFO TAB --- */}
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
                                    subscriptions={subscriptions} hasActiveSub={hasActiveSub}
                                    setIsSubModalOpen={setIsSubModalOpen} setSelectedSub={setSelectedSub} selectedSub={selectedSub}
                                    toggleSubStatus={toggleSubStatus} handleSaveInBody={handleSaveInBody}
                                    clientAge={calculatedAge}
                                />
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* --- ASSIGN CHILD PLAN MODAL (UNCHANGED LOGIC) --- */}
            {isSubModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#121214] border border-zinc-800 w-full max-w-md rounded-3xl p-6 relative shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-white flex items-center gap-2">
                                <Baby className="text-blue-500" /> Assign Child Plan
                            </h2>
                            <button onClick={() => setIsSubModalOpen(false)} className="text-zinc-500 hover:text-white"><Activity size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateSub} className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1 block mb-1.5">Select Child Package</label>
                                <select required className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white outline-none focus:border-blue-500 transition-colors appearance-none" onChange={(e) => setNewSubData({ ...newSubData, plan: e.target.value })}>
                                    <option value="">-- Choose Package --</option>
                                    {availablePlans.map(plan => (<option key={plan.id} value={plan.id}>{plan.name} ({plan.duration_days} days)</option>))}
                                </select>
                            </div>
                            
                            {user?.is_superuser && (
                                <div>
                                    <label className="text-xs font-bold text-zinc-500 uppercase ml-1 block mb-1.5">Assign Trainer</label>
                                    <select 
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white outline-none focus:border-blue-500 transition-colors appearance-none" 
                                        onChange={(e) => setNewSubData({ ...newSubData, trainer: e.target.value })}
                                        defaultValue=""
                                    >
                                        <option value="">-- Auto (Me) --</option>
                                        {trainers.map(t => (<option key={t.id} value={t.id}>{t.first_name || t.username}</option>))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase ml-1 block mb-1.5">Start Date</label>
                                <input type="date" required value={newSubData.start_date} onChange={(e) => setNewSubData({ ...newSubData, start_date: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3.5 text-white outline-none focus:border-blue-500 [color-scheme:dark]" />
                            </div>
                            
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all mt-2">
                                Confirm Assignment
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ChildDetails;