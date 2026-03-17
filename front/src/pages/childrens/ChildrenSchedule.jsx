import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Plus, Trash2, Play, Loader2, Clock, Calendar,
    X, ChevronRight, AlertCircle, Users
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, type = 'error', onClose }) => (
    <div className={`fixed bottom-6 right-6 z-[300] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-bottom-4 duration-300 ${
        type === 'error'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
    }`}>
        <AlertCircle size={18} />
        <span className="font-semibold text-sm">{message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-70"><X size={16} /></button>
    </div>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const formatTime12Hour = (time24) => {
    if (!time24) return null;
    if (/[apm]/i.test(time24)) return time24;
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
};

const getMostCommonTime = (kids) => {
    const times = kids.map(k => k.session_time).filter(Boolean);
    if (!times.length) return null;
    const count = {};
    times.forEach(t => { count[t] = (count[t] || 0) + 1; });
    const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
    return formatTime12Hour(best);
};

// ─── DayCard skeleton ─────────────────────────────────────────────────────────
const DayCardSkeleton = () => (
    <div className="relative flex flex-col h-[520px] rounded-[32px] overflow-hidden bg-white dark:bg-[#121214] border border-zinc-100 dark:border-zinc-800 animate-pulse">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 space-y-3">
            <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
            <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
            <div className="grid grid-cols-3 gap-2">
                <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
            </div>
        </div>
        <div className="flex-1 p-4 space-y-3">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-900/50 rounded-2xl" />
            ))}
        </div>
    </div>
);

// ─── Component ────────────────────────────────────────────────────────────────
const ChildrenSchedule = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const [trainers, setTrainers] = useState([]);
    const [selectedCoach, setSelectedCoach] = useState(null);
    const [scheduleData, setScheduleData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingInit, setLoadingInit] = useState(true);
    const [toast, setToast] = useState(null);

    // Modals
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);
    const [activeChildren, setActiveChildren] = useState([]);
    const [childToAdd, setChildToAdd] = useState('');
    const [sessionTime, setSessionTime] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Confirm delete
    const [pendingDelete, setPendingDelete] = useState(null);
    
    // Repeat Session State
    const [pendingRepeat, setPendingRepeat] = useState(null);

    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    const showToast = useCallback((message, type = 'error') => {
        setToast({ message, type });
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, []);

    // ── Init ──────────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const init = async () => {
            try {
                const trainersRes = await api.get('/manage-trainers/');
                if (cancelled) return;
                const trainerList = trainersRes.data.results || trainersRes.data;
                setTrainers(trainerList);

                // BUG #5 FIX: ابدأ بـ tab المدرب الحالي لو موجود في القائمة،
                // بدل ما تبدأ دايمًا بأول مدرب في القائمة.
                // الكود السابق كان يحدد trainerList[0] دايمًا، لو المدرب الحالي
                // مش الأول هيشوف جدول مدرب تاني أول ما يفتح الصفحة.
                if (trainerList.length > 0) {
                    // نحاول نجيب user من الـ token المحلي أو من أي context متاح
                    const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
                    const currentUserId = storedUser?.id;
                    const matchedTrainer = currentUserId
                        ? trainerList.find(t => t.id === currentUserId)
                        : null;
                    setSelectedCoach((matchedTrainer || trainerList[0]).id);
                }

                // BUG #4 FIX: جلب كل الأطفال مع pagination كاملة بدل تحديد 100 فقط.
                // الكود السابق: api.get('/clients/?is_child=true&page_size=100')
                // كان يُفوّت الأطفال بعد الـ 100 الأول وده bug صامت.
                // الإصلاح: loop على كل الصفحات حتى ما يبقاش في next page.
                let allChildren = [];
                let url = '/clients/?is_child=true&page_size=100';
                while (url) {
                    const res = await api.get(url);
                    if (cancelled) return;
                    const pageData = res.data.results ?? res.data;
                    allChildren = [...allChildren, ...pageData];
                    if (res.data.next) {
                        // نستخدم فقط الـ search params من الـ next URL لتجنب CORS أو domain issues
                        try {
                            const nextUrlObj = new URL(res.data.next);
                            url = `/clients/${nextUrlObj.search}`;
                        } catch {
                            url = null;
                        }
                    } else {
                        url = null;
                    }
                }
                setActiveChildren(allChildren.filter(c => c.is_subscribed));
            } catch (err) {
                if (!cancelled) showToast('Failed to load initial data.');
            } finally {
                if (!cancelled) setLoadingInit(false);
            }
        };
        init();
        return () => { cancelled = true; };
    }, []); // eslint-disable-line

    // ── Fetch schedule ────────────────────────────────────────────────────
    const fetchSchedule = useCallback(async () => {
        if (!selectedCoach) return;
        setLoading(true);
        try {
            const res = await api.get(`/coach-schedules/?trainer_id=${selectedCoach}`);
            setScheduleData(res.data.results || res.data);
        } catch {
            showToast('Failed to load schedule.');
        } finally {
            setLoading(false);
        }
    }, [selectedCoach, showToast]);

    useEffect(() => {
        if (selectedCoach) fetchSchedule();
    }, [selectedCoach, fetchSchedule]);

    // ── Get Children Helper ───────────────────────────────────────────────
    const getChildrenForDay = useCallback(
        (day) => {
            // BUG #6 FIX: الكود السابق كان يُخفي الأطفال اللي انتهت اشتراكاتهم
            // بصمت تام — فالمدرب مش عارف ليه اختفى الطفل من الجدول.
            // الإصلاح: نرجع كل الأطفال في اليوم المطلوب بغض النظر عن حالة الاشتراك،
            // ونضيف خاصية is_expired لكل طفل عشان الـ UI يعرض badge "Expired".
            // المعالجة البصرية موجودة في الـ render أدناه.
            const activeClientIds = new Set(activeChildren.map(c => c.id));
            return scheduleData
                .filter(i => i.day === day)
                .map(i => ({
                    ...i,
                    is_expired: !(activeClientIds.has(i.client) || activeClientIds.has(i.client_id))
                }));
        },
        [scheduleData, activeChildren]
    );

    // ── Handle repeat session from location state ─────────────────────────
    useEffect(() => {
        if (location.state?.action === 'repeat_session') {
            setPendingRepeat({
                day: location.state.day,
                exercises: location.state.exercises || []
            });
            // Clear the state so it doesn't loop on re-renders
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Wait until data is loaded to execute the repeat session navigation
    useEffect(() => {
        if (pendingRepeat && !loading && !loadingInit) {
            navigate('/group-session/setup', {
                state: {
                    day: pendingRepeat.day,
                    children: getChildrenForDay(pendingRepeat.day),
                    exercises: pendingRepeat.exercises
                }
            });
            setPendingRepeat(null);
        }
    }, [pendingRepeat, loading, loadingInit, getChildrenForDay, navigate]);

    // ── Add child to schedule ─────────────────────────────────────────────
    const handleAdd = async () => {
        if (!childToAdd || !selectedDay) return;
        setActionLoading(true);
        try {
            await api.post('/coach-schedules/', {
                coach: parseInt(selectedCoach),
                client: parseInt(childToAdd),
                day: selectedDay,
                session_time: sessionTime || null
            });
            setIsAddModalOpen(false);
            setChildToAdd('');
            setSessionTime('');
            showToast('Athlete added to schedule!', 'success');
            fetchSchedule();
        } catch (err) {
            const detail = err.response?.data?.error || err.response?.data?.detail;
            showToast(detail || 'Could not add athlete. They might already be in this class.');
        } finally {
            setActionLoading(false);
        }
    };

    // ── Set group time ────────────────────────────────────────────────────
    const handleSetGroupTime = async () => {
        if (!sessionTime || !selectedDay) return;
        setActionLoading(true);
        const kidsInDay = getChildrenForDay(selectedDay);
        try {
            await Promise.all(kidsInDay.map(kid =>
                api.patch(`/coach-schedules/${kid.id}/`, {
                    session_time: sessionTime
                })
            ));
            setIsTimeModalOpen(false);
            setSessionTime('');
            showToast('Group time updated!', 'success');
            fetchSchedule();
        } catch {
            showToast('Error setting group time.');
        } finally {
            setActionLoading(false);
        }
    };

    // ── Remove ────────────────────────────────────────────────────────────
    const handleRemove = async (id) => {
        try {
            await api.delete(`/coach-schedules/${id}/`);
            setScheduleData(prev => prev.filter(item => item.id !== id));
            setPendingDelete(null);
        } catch {
            showToast('Failed to remove athlete.');
        }
    };

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-10">

            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Kids Schedule</h1>
                    <p className="text-zinc-500 font-medium">Manage weekly group sessions</p>
                </div>

                {/* Coach Tabs */}
                {!loadingInit && (
                    <div className="bg-white dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex gap-1 shadow-sm overflow-x-auto max-w-full shrink-0">
                        {trainers.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedCoach(t.id)}
                                className={`px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-200 ${
                                    selectedCoach === t.id
                                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-md scale-[1.02]'
                                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                }`}
                            >
                                {t.first_name || t.username}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Grid */}
            {(loading || loadingInit) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {DAYS.map(d => <DayCardSkeleton key={d} />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {DAYS.map(day => {
                        const kids = getChildrenForDay(day);
                        const commonTime = getMostCommonTime(kids);
                        const isToday = day === todayName;

                        return (
                            <div
                                key={day}
                                className={`relative flex flex-col h-[520px] rounded-[32px] overflow-hidden transition-all duration-300 ${
                                    isToday
                                        ? 'bg-white dark:bg-zinc-900 ring-4 ring-orange-500/20 shadow-2xl shadow-orange-500/10 z-10 scale-[1.02]'
                                        : 'bg-white dark:bg-[#121214] border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-xl shadow-zinc-200/50 dark:shadow-none'
                                }`}
                            >
                                {/* Card Header */}
                                <div className={`p-5 pb-4 border-b border-zinc-100 dark:border-zinc-800/50 ${isToday ? 'bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/10 dark:to-transparent' : 'bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-transparent'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className={`text-xl font-black tracking-tight ${isToday ? 'text-orange-600 dark:text-orange-500' : 'text-zinc-800 dark:text-zinc-100'}`}>
                                                {day}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                {kids.length > 0 && (
                                                    <div className="flex -space-x-2">
                                                        {kids.slice(0, 3).map(k => (
                                                            <div key={k.id} className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-200 overflow-hidden">
                                                                {k.client_photo
                                                                    ? <img src={k.client_photo} className="w-full h-full object-cover" alt="" loading="lazy" />
                                                                    : <div className="w-full h-full bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center"><Users size={10} /></div>
                                                                }
                                                            </div>
                                                        ))}
                                                        {kids.length > 3 && (
                                                            <div className="w-7 h-7 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                                                                +{kids.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <span className={`text-xs font-bold ${isToday ? 'text-orange-600/70' : 'text-zinc-400'}`}>
                                                    {kids.length} {kids.length === 1 ? 'Athlete' : 'Athletes'}
                                                </span>
                                            </div>
                                        </div>
                                        {commonTime && (
                                            <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-sm ${isToday ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                                                <Clock size={12} />
                                                {commonTime}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Grid */}
                                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                        <button
                                            onClick={() => { setSelectedDay(day); setIsAddModalOpen(true); }}
                                            className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-black hover:opacity-90 transition-all text-xs font-bold"
                                        >
                                            <Plus size={14} strokeWidth={3} /> Add
                                        </button>
                                        <button
                                            onClick={() => { setSelectedDay(day); setIsTimeModalOpen(true); }}
                                            disabled={kids.length === 0}
                                            className="flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors text-xs font-bold"
                                        >
                                            <Clock size={14} /> Time
                                        </button>
                                        <button
                                            onClick={() => {
                                                navigate('/group-session/setup', {
                                                    state: {
                                                        day: day,
                                                        children: getChildrenForDay(day),
                                                        exercises: [] // Start a fresh session
                                                    }
                                                });
                                            }}
                                            disabled={kids.length === 0}
                                            className="w-10 flex items-center justify-center rounded-2xl bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:shadow-none transition-all"
                                            title="Start Session"
                                        >
                                            <Play size={16} fill="currentColor" />
                                        </button>
                                    </div>
                                </div>

                                {/* List Body */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-900/20">
                                    {kids.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
                                            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 text-zinc-400">
                                                <Calendar size={20} />
                                            </div>
                                            <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">No sessions yet</span>
                                            <button
                                                onClick={() => { setSelectedDay(day); setIsAddModalOpen(true); }}
                                                className="mt-2 text-xs font-bold text-orange-600 hover:underline"
                                            >
                                                Add First Athlete
                                            </button>
                                        </div>
                                    ) : (
                                        kids.map(k => (
                                            <div key={k.id} className={`group relative flex items-center gap-3.5 p-3 rounded-2xl border shadow-sm transition-all duration-200 ${
                                                k.is_expired
                                                    ? 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-70'
                                                    : 'bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:shadow-md hover:border-orange-200 dark:hover:border-orange-900/50'
                                            }`}>
                                                <div className="relative shrink-0">
                                                    {k.client_photo ? (
                                                        <img
                                                            src={k.client_photo}
                                                            className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 object-cover ring-2 ring-white dark:ring-zinc-800"
                                                            alt=""
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 ring-2 ring-white dark:ring-zinc-800 flex items-center justify-center text-zinc-400">
                                                            <Users size={16} />
                                                        </div>
                                                    )}
                                                    {/* BUG #6 FIX: إظهار مؤشر ملوّن حسب حالة الاشتراك */}
                                                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white dark:border-zinc-900 rounded-full ${k.is_expired ? 'bg-zinc-400' : 'bg-green-500'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white truncate">{k.client_name}</h4>
                                                    {/* BUG #6 FIX: إظهار badge "Expired" للأطفال المنتهية اشتراكاتهم */}
                                                    {k.is_expired ? (
                                                        <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded-md mt-0.5 block w-fit">
                                                            Subscription Expired
                                                        </span>
                                                    ) : k.session_time ? (
                                                        <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300 px-1.5 py-0.5 rounded-md mt-0.5 w-fit">
                                                            <Clock size={10} />{formatTime12Hour(k.session_time)}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-zinc-400 italic mt-0.5 block">No time set</span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => setPendingDelete(k.id)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                                                    title="Remove"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Add Modal ──────────────────────────────────────────────────────── */}
            {isAddModalOpen && (
                <div
                    className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={e => { if (e.target === e.currentTarget) { setIsAddModalOpen(false); setChildToAdd(''); setSessionTime(''); } }}
                >
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                            <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                                Add to <span className="text-orange-500">{selectedDay}</span>
                            </h3>
                            <button onClick={() => { setIsAddModalOpen(false); setChildToAdd(''); setSessionTime(''); }} className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-900 transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Select Athlete</label>
                                <div className="relative">
                                    <select
                                        className="w-full appearance-none bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-4 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
                                        onChange={e => setChildToAdd(e.target.value)}
                                        value={childToAdd}
                                    >
                                        <option value="">Choose an active child...</option>
                                        {activeChildren.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                        <ChevronRight size={16} className="rotate-90" />
                                    </div>
                                </div>
                                {activeChildren.length === 0 && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 ml-1">No active children with subscriptions found.</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Time (Optional)</label>
                                <input
                                    type="time"
                                    value={sessionTime}
                                    onChange={e => setSessionTime(e.target.value)}
                                    className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-4 text-zinc-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                />
                                <p className="text-[10px] text-zinc-400 ml-1">Displayed in 12H format automatically.</p>
                            </div>
                            <button
                                onClick={handleAdd}
                                disabled={!childToAdd || actionLoading}
                                className="w-full py-4 rounded-2xl font-bold text-lg bg-zinc-900 dark:bg-white text-white dark:text-black hover:opacity-90 shadow-xl shadow-zinc-900/20 disabled:opacity-50 disabled:shadow-none transition-all mt-2 flex items-center justify-center gap-2"
                            >
                                {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Add Athlete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Time Modal ─────────────────────────────────────────────────────── */}
            {isTimeModalOpen && (
                <div
                    className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={e => { if (e.target === e.currentTarget) { setIsTimeModalOpen(false); setSessionTime(''); } }}
                >
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                            <Clock size={32} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-1">Set Group Time</h3>
                        <p className="text-sm text-zinc-500 font-medium mb-6">
                            Update time for all athletes in <span className="text-zinc-900 dark:text-white font-bold">{selectedDay}</span>
                        </p>
                        <input
                            type="time"
                            value={sessionTime}
                            onChange={e => setSessionTime(e.target.value)}
                            className="w-full bg-zinc-100 dark:bg-zinc-950 border-2 border-transparent focus:border-blue-500 rounded-2xl p-4 text-center text-4xl font-black text-zinc-900 dark:text-white font-mono outline-none transition-colors mb-6"
                            autoFocus
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setIsTimeModalOpen(false); setSessionTime(''); }}
                                className="py-3.5 rounded-xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSetGroupTime}
                                disabled={!sessionTime || actionLoading}
                                className="py-3.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                            >
                                {actionLoading ? <Loader2 className="animate-spin" size={18} /> : 'Update All'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirm Delete Overlay ─────────────────────────────────────────── */}
            {pendingDelete !== null && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-xs rounded-3xl p-6 shadow-2xl text-center animate-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 mx-auto rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-500 mb-4">
                            <Trash2 size={24} />
                        </div>
                        <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-2">Remove Athlete?</h3>
                        <p className="text-sm text-zinc-500 mb-6">This will remove them from this day's schedule.</p>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setPendingDelete(null)} className="py-3 rounded-xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                                Cancel
                            </button>
                            <button onClick={() => handleRemove(pendingDelete)} className="py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/20">
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default ChildrenSchedule;