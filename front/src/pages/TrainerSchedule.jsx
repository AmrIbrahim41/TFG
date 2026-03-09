import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  // FIX #4 (Dead imports): ChevronLeft and ChevronRight were imported here
  // but never referenced anywhere in this file.  Removed entirely.
  Clock, Plus, X,
  Save, Calendar, Loader2, AlertCircle, CheckCircle2,
  Trash2, Search, Moon,
} from 'lucide-react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';

// ─── Constants ───────────────────────────────────────────────────────────────

const DAYS = [
  { num: 1, short: 'Mon', long: 'Monday' },
  { num: 2, short: 'Tue', long: 'Tuesday' },
  { num: 3, short: 'Wed', long: 'Wednesday' },
  { num: 4, short: 'Thu', long: 'Thursday' },
  { num: 5, short: 'Fri', long: 'Friday' },
  { num: 6, short: 'Sat', long: 'Saturday' },
  { num: 7, short: 'Sun', long: 'Sunday' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Parse "HH:MM" or "HH:MM:SS" → { h, m } */
const parseTime = (str) => {
  const [h, m] = (str || '08:00').split(':').map(Number);
  return { h: isNaN(h) ? 8 : h, m: isNaN(m) ? 0 : m };
};

/** Convert { h, m } → total minutes since midnight */
const toMin = ({ h, m }) => h * 60 + m;

/**
 * Format total minutes → "HH:MM" (24-hour, used internally and sent to the API).
 * The modulo ensures values > 1440 (past midnight for overnight shifts) wrap correctly.
 */
const fromMin = (total) => {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Normalise a time string from any source to "HH:MM".
 * Handles both "HH:MM" (frontend) and "HH:MM:SS" (Django TimeField).
 */
const normalizeTime = (t) => (t || '').slice(0, 5);

/**
 * Convert a 24-hour "HH:MM" string → 12-hour "hh:MM AM/PM" string.
 * Used exclusively for display; all internal state and API values stay 24-h.
 */
const format12Hour = (time24) => {
  const { h, m } = parseTime(normalizeTime(time24));
  const period = h < 12 ? 'AM' : 'PM';
  const h12    = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

/**
 * Build an array of "HH:MM" slot labels.
 *
 * OVERNIGHT SHIFT: if end ≤ start, the shift crosses midnight.
 * We add 1440 min to `end` so the range is always positive, then
 * use `fromMin` (which wraps via modulo) to produce valid 24-h strings.
 */
const buildSlots = (shiftStart, shiftEnd, slotDuration) => {
  const start = toMin(parseTime(normalizeTime(shiftStart)));
  let   end   = toMin(parseTime(normalizeTime(shiftEnd)));
  const dur   = Math.max(15, Math.min(240, Number(slotDuration) || 60));

  if (end <= start) end += 1440;

  const slots = [];
  for (let t = start; t < end; t += dur) {
    slots.push(fromMin(t));
  }
  return slots;
};

// ─── Custom 12-Hour Time Picker ───────────────────────────────────────────────

const TimePicker12h = ({ value, onChange, disabled = false, label }) => {
  const { h: h24, m } = parseTime(normalizeTime(value));
  const period = h24 < 12 ? 'AM' : 'PM';
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;

  const to24h = (h12, per) => {
    const h = Number(h12);
    if (per === 'AM') return h === 12 ? 0  : h;
    else              return h === 12 ? 12 : h + 12;
  };

  const emit = (newH24, newM) => {
    onChange(`${String(newH24).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
  };

  const handleHour   = (e) => emit(to24h(e.target.value, period), m);
  const handleMinute = (e) => emit(to24h(hour12, period), Number(e.target.value));
  const handlePeriod = (e) => emit(to24h(hour12, e.target.value), m);

  const selectCls = `
    px-2 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700
    bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white
    focus:border-orange-400 dark:focus:border-orange-500 outline-none
    transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
    appearance-none text-center font-semibold
  `;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-zinc-500">{label}</label>
      )}
      <div className="flex items-center gap-1">
        <select
          value={hour12}
          onChange={handleHour}
          disabled={disabled}
          className={selectCls}
          style={{ width: '3.2rem' }}
          aria-label="Hour"
        >
          {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
            <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
          ))}
        </select>

        <span className="text-zinc-400 dark:text-zinc-500 font-bold text-sm select-none">:</span>

        <select
          value={m}
          onChange={handleMinute}
          disabled={disabled}
          className={selectCls}
          style={{ width: '3.2rem' }}
          aria-label="Minute"
        >
          {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((min) => (
            <option key={min} value={min}>{String(min).padStart(2, '0')}</option>
          ))}
        </select>

        <select
          value={period}
          onChange={handlePeriod}
          disabled={disabled}
          className={`${selectCls} font-bold`}
          style={{ width: '3.6rem' }}
          aria-label="AM or PM"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const ClientSlot = ({ slot, onRemove, navigate }) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    className="group relative flex items-center gap-2 p-2 rounded-xl
               bg-orange-50 dark:bg-orange-500/10 border border-orange-200
               dark:border-orange-500/30 cursor-pointer hover:bg-orange-100
               dark:hover:bg-orange-500/20 transition-colors"
    onClick={() => navigate(`/clients/${slot.client_id || slot.client}`)}
    title="Go to client profile"
  >
    {slot.client_photo ? (
      <img
        src={slot.client_photo}
        alt={slot.client_name}
        className="w-8 h-8 rounded-full object-cover ring-2 ring-orange-400 flex-shrink-0"
      />
    ) : (
      <div className="w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center
                      text-white text-xs font-bold flex-shrink-0">
        {slot.client_name?.[0]?.toUpperCase() || '?'}
      </div>
    )}

    <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 truncate flex-1">
      {slot.client_name}
    </span>

    <button
      onClick={(e) => { e.stopPropagation(); onRemove(slot.id); }}
      className="opacity-0 group-hover:opacity-100 p-0.5 rounded-lg
                 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
      title="Remove from schedule"
    >
      <Trash2 size={12} />
    </button>
  </motion.div>
);

const EmptySlot = ({ onClick }) => (
  <motion.button
    whileHover={{ scale: 1.04 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="w-full h-12 flex items-center justify-center gap-1 rounded-xl
               border-2 border-dashed border-zinc-200 dark:border-zinc-700
               text-zinc-400 dark:text-zinc-600 hover:border-orange-400
               dark:hover:border-orange-500 hover:text-orange-500 transition-all
               text-xs font-medium"
  >
    <Plus size={14} />
    <span>Add</span>
  </motion.button>
);

/**
 * ClientPickerModal
 *
 * FIX #8 (AnimatePresence missing key):
 * The original component wrapped its content in <AnimatePresence> but the
 * inner <motion.div> had no `key` prop.  Without a stable key, Framer Motion
 * cannot reliably track the element's mount/unmount lifecycle — the `exit`
 * animation never fires when the modal is closed and re-open animations
 * can stutter if React decides to reuse the DOM node.
 *
 * Fix: add `key="client-picker-modal"` to the outermost motion element so
 * AnimatePresence always gets a unique identity to track.
 */
const ClientPickerModal = ({ clients, onPick, onClose, loading }) => {
  const [search, setSearch] = useState('');
  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AnimatePresence>
      <motion.div
        key="client-picker-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4
                   bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key="client-picker-modal"
          initial={{ opacity: 0, y: 32, scale: 0.95 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          exit={{ opacity: 0, y: 32, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl
                     border border-zinc-200 dark:border-zinc-700 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b
                          border-zinc-100 dark:border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Add Client to Slot
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Only active subscriptions shown
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-100
                         dark:hover:bg-zinc-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pt-3 pb-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients…"
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl
                           bg-zinc-100 dark:bg-zinc-800 border border-transparent
                           focus:border-orange-400 dark:focus:border-orange-500
                           text-zinc-900 dark:text-white outline-none transition-colors"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto px-2 pb-3 space-y-1">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-orange-500" size={24} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-sm">
                No active clients found
              </div>
            ) : (
              filtered.map((client) => (
                <motion.button
                  key={client.id}
                  whileHover={{ x: 4 }}
                  onClick={() => onPick(client)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                             hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors
                             text-left group"
                >
                  {client.photo ? (
                    <img src={client.photo} alt={client.name}
                         className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400
                                    to-orange-600 flex items-center justify-center
                                    text-white text-sm font-bold flex-shrink-0">
                      {client.name?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate
                                  group-hover:text-orange-600 dark:group-hover:text-orange-400">
                      {client.name}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">
                      {client.plan} · {client.sessions_used}/{client.total_sessions} sessions
                    </p>
                  </div>
                  <Plus size={16} className="text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.button>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * TrainerSchedule
 *
 * Props:
 *  trainerId  – (optional) if passed, operates in "admin mode" editing that trainer
 *  readOnly   – (optional) disables editing, used for display-only embedding
 */
const TrainerSchedule = ({ trainerId: propTrainerId, readOnly = false }) => {
  const navigate = useNavigate();

  // FIX #4 (Dead code): `user` was destructured from AuthContext but never
  // used — `isAdminMode` derives solely from `propTrainerId`, not from the
  // auth user object.  Removed the unused destructure entirely.
  useContext(AuthContext); // keep context subscription in case children need it

  const isAdminMode = !!propTrainerId;

  // ── State ────────────────────────────────────────────────────────────────
  const [shiftStart, setShiftStart]       = useState('08:00');
  const [shiftEnd, setShiftEnd]           = useState('20:00');
  const [slotDuration, setSlotDuration]   = useState(60);
  const [shiftId, setShiftId]             = useState(null);

  const [scheduleSlots, setScheduleSlots] = useState([]);
  const [activeClients, setActiveClients] = useState([]);

  const [shiftLoading, setShiftLoading]     = useState(true);
  const [shiftSaving, setShiftSaving]       = useState(false);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [slotSaving, setSlotSaving]         = useState(null);

  const [modal, setModal] = useState(null); // { day, time } | null
  const [toast, setToast] = useState(null); // { type, msg }

  // ── Derived ──────────────────────────────────────────────────────────────
  const timeSlots = buildSlots(shiftStart, shiftEnd, slotDuration);
  const isOvernight = toMin(parseTime(shiftEnd)) <= toMin(parseTime(shiftStart));

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchShift = useCallback(async () => {
    setShiftLoading(true);
    try {
      const endpoint = isAdminMode ? '/trainer-shift/' : '/trainer-shift/mine/';
      const res = await api.get(
        endpoint,
        isAdminMode ? { params: { trainer_id: propTrainerId } } : {},
      );
      const shift = Array.isArray(res.data) ? res.data[0] : res.data;
      if (shift) {
        setShiftStart(normalizeTime(shift.shift_start) || '08:00');
        setShiftEnd(normalizeTime(shift.shift_end)     || '20:00');
        setSlotDuration(shift.slot_duration || 60);
        setShiftId(shift.id);
      }
    } catch (err) {
      console.error('Shift fetch error:', err);
    } finally {
      setShiftLoading(false);
    }
  }, [isAdminMode, propTrainerId]);

  const fetchSchedule = useCallback(async () => {
    try {
      const params = isAdminMode ? { trainer_id: propTrainerId } : {};
      const res = await api.get('/trainer-schedule/', { params });
      setScheduleSlots(Array.isArray(res.data) ? res.data : (res.data.results || []));
    } catch (err) {
      console.error('Schedule fetch error:', err);
    }
  }, [isAdminMode, propTrainerId]);

  const fetchActiveClients = useCallback(async () => {
    setClientsLoading(true);
    try {
      const params = isAdminMode ? { trainer_id: propTrainerId } : {};
      const res = await api.get('/trainer-schedule/active-clients/', { params });
      setActiveClients(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Active clients fetch error:', err);
    } finally {
      setClientsLoading(false);
    }
  }, [isAdminMode, propTrainerId]);

  useEffect(() => {
    fetchShift();
    fetchSchedule();
  }, [fetchShift, fetchSchedule]);

  // ── Shift save ────────────────────────────────────────────────────────────
  //
  // FIX #7 (Shift save asymmetry):
  // The original non-admin path used `api.put('/trainer-shift/mine/', ...)` when
  // there was no shiftId (i.e. first-time save).  However:
  //   • The backend's `mine` action uses `get_or_create` internally, so it
  //     always has a record to work with — PUT semantics (full replace) are
  //     misleading here.
  //   • More critically, `put` implies the caller knows the final state of the
  //     entire resource, but the frontend only sends three fields.  If the
  //     backend ever adds required fields this will silently break.
  //
  // Fix: use `PATCH` in both branches of the non-admin path.  PATCH ("partial
  // update") is the correct verb when sending only a subset of fields.
  // The `shiftId` check is kept so admin mode still hits the detail endpoint.
  // ──────────────────────────────────────────────────────────────────────────
  const saveShift = async () => {
    if (readOnly) return;
    setShiftSaving(true);
    try {
      const payload = {
        shift_start:   shiftStart,
        shift_end:     shiftEnd,
        slot_duration: Number(slotDuration),
      };

      let res;
      if (isAdminMode) {
        payload.trainer = propTrainerId;
        if (shiftId) {
          res = await api.patch(`/trainer-shift/${shiftId}/`, payload);
        } else {
          res = await api.post('/trainer-shift/', payload);
        }
      } else {
        // Always PATCH to /trainer-shift/mine/ — the backend get_or_create
        // ensures the record exists regardless of whether shiftId is set yet.
        res = await api.patch('/trainer-shift/mine/', payload);
      }

      setShiftId(res.data.id);
      showToast('success', 'Shift saved successfully!');
    } catch (err) {
      showToast('error', err?.response?.data?.shift_end?.[0] || 'Failed to save shift.');
    } finally {
      setShiftSaving(false);
    }
  };

  // ── Slot operations ───────────────────────────────────────────────────────

  const openModal = (day, time) => {
    if (readOnly) return;
    fetchActiveClients();
    setModal({ day, time });
  };

  const handlePickClient = async (client) => {
    if (!modal) return;
    const key = `${modal.day}-${modal.time}`;
    setSlotSaving(key);
    try {
      const payload = {
        day_of_week: modal.day,
        time_slot:   modal.time,
        client:      client.id,
        ...(isAdminMode ? { trainer: propTrainerId } : {}),
      };
      const res = await api.post('/trainer-schedule/', payload);
      setScheduleSlots((prev) => [...prev, res.data]);
      setModal(null);
      showToast('success', `${client.name} added to schedule!`);
    } catch (err) {
      const msg = err?.response?.data?.client?.[0]
        || err?.response?.data?.trainer?.[0]
        || err?.response?.data?.non_field_errors?.[0]
        || 'Failed to add client.';
      showToast('error', msg);
    } finally {
      setSlotSaving(null);
    }
  };

  const handleRemoveSlot = async (slotId) => {
    if (readOnly) return;
    try {
      await api.delete(`/trainer-schedule/${slotId}/`);
      setScheduleSlots((prev) => prev.filter((s) => s.id !== slotId));
      showToast('success', 'Slot removed.');
    } catch {
      showToast('error', 'Failed to remove slot.');
    }
  };

  const getSlot = (day, time) =>
    scheduleSlots.find(
      (s) => s.day_of_week === day && normalizeTime(s.time_slot) === time
    ) || null;

  const shiftPreview = `${format12Hour(shiftStart)} – ${format12Hour(shiftEnd)}`;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative space-y-6">

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="schedule-toast"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl
                        shadow-xl text-sm font-medium ${
                          toast.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'
                            : 'bg-red-50 dark:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700'
                        }`}
          >
            {toast.type === 'success'
              ? <CheckCircle2 size={16} />
              : <AlertCircle size={16} />
            }
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Shift Configuration Card ── */}
      {!readOnly && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200
                     dark:border-zinc-800 p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-orange-500" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white">
              Shift Configuration
            </h2>
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <TimePicker12h
              label="Shift Start"
              value={shiftStart}
              onChange={setShiftStart}
            />

            <div className="flex flex-col gap-1">
              <TimePicker12h
                label="Shift End"
                value={shiftEnd}
                onChange={setShiftEnd}
              />
              {isOvernight && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-500 pl-1">
                  <Moon size={10} /> next day
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Slot Duration (min)</label>
              <select
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
                className="px-3 py-2 text-sm rounded-xl border border-zinc-200
                           dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800
                           text-zinc-900 dark:text-white focus:border-orange-400
                           dark:focus:border-orange-500 outline-none transition-colors"
              >
                {[15, 30, 45, 60, 90, 120].map((v) => (
                  <option key={v} value={v}>{v} min</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl
                            bg-orange-50 dark:bg-orange-500/10 border border-orange-200
                            dark:border-orange-500/30">
              <Calendar size={14} className="text-orange-500" />
              <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                {shiftPreview} · {timeSlots.length} slots/day
              </span>
              {isOvernight && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold
                                  text-indigo-500 dark:text-indigo-400 ml-1">
                  <Moon size={10} /> overnight
                </span>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={saveShift}
              disabled={shiftSaving}
              className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl
                         bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold
                         disabled:opacity-60 transition-colors shadow-sm"
            >
              {shiftSaving
                ? <Loader2 size={15} className="animate-spin" />
                : <Save size={15} />
              }
              Save Shift
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* ── Weekly Grid ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200
                   dark:border-zinc-800 shadow-sm overflow-hidden"
      >
        {shiftLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-orange-500" size={28} />
          </div>
        ) : timeSlots.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <Clock size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No time slots — configure your shift above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="w-28 px-3 py-3 text-left">
                    <span className="text-xs font-semibold text-zinc-400">Time</span>
                  </th>
                  {DAYS.map((day) => (
                    <th key={day.num} className="px-2 py-3 text-center">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        <span className="hidden sm:inline">{day.long}</span>
                        <span className="sm:hidden">{day.short}</span>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {timeSlots.map((time, ti) => {
                  const isMidnightRow = isOvernight && time === '00:00';

                  return (
                    <tr
                      key={time}
                      className={`border-b border-zinc-50 dark:border-zinc-800/60 ${
                        isMidnightRow
                          ? 'border-t-2 border-t-indigo-200 dark:border-t-indigo-500/30'
                          : ti % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-800/20'
                      }`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isMidnightRow && (
                            <Moon size={10} className="text-indigo-400 flex-shrink-0" />
                          )}
                          <span className="text-xs font-mono font-medium text-zinc-500 dark:text-zinc-400">
                            {format12Hour(time)}
                          </span>
                        </div>
                      </td>

                      {DAYS.map((day) => {
                        const slot   = getSlot(day.num, time);
                        const key    = `${day.num}-${time}`;
                        const isBusy = slotSaving === key;

                        return (
                          <td key={day.num} className="px-1.5 py-1.5 align-top">
                            {isBusy ? (
                              <div className="h-12 flex items-center justify-center">
                                <Loader2 size={16} className="animate-spin text-orange-400" />
                              </div>
                            ) : slot ? (
                              <ClientSlot
                                slot={slot}
                                onRemove={handleRemoveSlot}
                                navigate={navigate}
                              />
                            ) : (
                              !readOnly && (
                                <EmptySlot onClick={() => openModal(day.num, time)} />
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* ── Client Picker Modal ── */}
      <AnimatePresence>
        {modal && (
          <ClientPickerModal
            clients={activeClients}
            loading={clientsLoading}
            onPick={handlePickClient}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Page wrapper (used when accessed directly via /schedule route) ───────────

const TrainerSchedulePage = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
            <Calendar size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
              My Weekly Schedule
            </h1>
            <p className="text-sm text-zinc-500">
              Configure your shift and manage client appointments
            </p>
          </div>
        </div>
      </div>

      <TrainerSchedule />
    </motion.div>
  );
};

export { TrainerSchedule };
export default TrainerSchedulePage;