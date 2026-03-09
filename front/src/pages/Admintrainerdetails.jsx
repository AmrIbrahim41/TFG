import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Calendar, Users, BarChart2, Loader2, AlertCircle,
  User, CheckCircle, Clock, TrendingUp, Activity, Award,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import api from '../api';
import { TrainerSchedule } from './TrainerSchedule.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'clients', label: 'Clients & Stats', icon: Users },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Stat card in the top summary row */
const StatCard = ({ icon: Icon, label, value, color = 'orange', delay = 0 }) => {
  const colorMap = {
    orange: 'bg-orange-50 dark:bg-orange-500/10 text-orange-500 border-orange-100 dark:border-orange-500/20',
    blue: 'bg-blue-50   dark:bg-blue-500/10   text-blue-500   border-blue-100   dark:border-blue-500/20',
    green: 'bg-green-50  dark:bg-green-500/10  text-green-500  border-green-100  dark:border-green-500/20',
    violet: 'bg-violet-50 dark:bg-violet-500/10 text-violet-500 border-violet-100 dark:border-violet-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`flex items-center gap-3 p-4 rounded-2xl border ${colorMap[color]} flex-1 min-w-[120px]`}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/60 dark:bg-zinc-900/40">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs font-medium opacity-70">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </motion.div>
  );
};

/** Sessions progress bar for each client row */
const SessionProgress = ({ used, total }) => {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const color =
    pct >= 90 ? 'bg-red-500' :
      pct >= 70 ? 'bg-orange-500' :
        'bg-green-500';

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-xs font-mono text-zinc-500 w-14 text-right whitespace-nowrap">
        {used}/{total > 0 ? total : '∞'}
      </span>
    </div>
  );
};

/** Custom tooltip for the recharts bar chart */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700
                      rounded-xl px-3 py-2 shadow-xl text-xs">
        <p className="font-semibold text-zinc-900 dark:text-white mb-1">{label}</p>
        <p className="text-orange-500 font-bold">{payload[0].value} sessions</p>
      </div>
    );
  }
  return null;
};

/** Activity feed row */
const ActivityRow = ({ entry, index }) => {
  const isGroup = entry.type === 'group';
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-start gap-3 py-3 border-b border-zinc-50 dark:border-zinc-800 last:border-0"
    >
      <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isGroup
          ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-500'
          : 'bg-orange-100 dark:bg-orange-500/20 text-orange-500'
        }`}>
        {isGroup ? <Users size={13} /> : <User size={13} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
          {entry.client_name}
        </p>
        <p className="text-xs text-zinc-500 truncate">{entry.session_name}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isGroup
            ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400'
            : 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
          }`}>
          {isGroup ? 'Group' : '1:1'}
        </span>
        <p className="text-xs text-zinc-400 mt-1">
          {entry.date
            ? new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
            : '—'}
        </p>
      </div>
    </motion.div>
  );
};

// ─── Clients & Stats Tab ──────────────────────────────────────────────────────

const ClientsStatsTab = ({ trainerId }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/admin-trainer-oversight/${trainerId}/details/`);
        setData(res.data);
      } catch (err) {
        setError('Failed to load trainer details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (trainerId) load();
  }, [trainerId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-red-500">
        <AlertCircle size={32} />
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  const { clients = [], chart_data = [], session_activity = [] } = data || {};

  const totalSessions = session_activity.length;
  const activeDays = chart_data.filter((d) => d.sessions > 0).length;

  return (
    <div className="space-y-6">

      {/* ── Mini Stats Row ── */}
      <div className="flex flex-wrap gap-3">
        <StatCard icon={Users} label="Active Clients" value={clients.length} color="orange" delay={0} />
        <StatCard icon={Activity} label="Sessions (7 days)" value={totalSessions} color="blue" delay={0.05} />
        <StatCard icon={Calendar} label="Active Days" value={activeDays} color="green" delay={0.10} />
        <StatCard icon={Award} label="Total Assigned" value={clients.length} color="violet" delay={0.15} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ── Bar Chart ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3 bg-white dark:bg-zinc-900 rounded-2xl border
                     border-zinc-200 dark:border-zinc-800 p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-5">
            <BarChart2 size={16} className="text-orange-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Sessions — Last 7 Days
            </h3>
          </div>
          {chart_data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <BarChart2 size={28} className="mb-2 opacity-40" />
              <p className="text-sm">No sessions in the last 7 days</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chart_data} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"
                  className="dark:stroke-zinc-700/60" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(249,115,22,0.06)' }} />
                <Bar dataKey="sessions" radius={[6, 6, 0, 0]}>
                  {chart_data.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.sessions > 0 ? '#f97316' : '#e4e4e7'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* ── Activity Feed ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border
                     border-zinc-200 dark:border-zinc-800 p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-orange-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Recent Activity
            </h3>
          </div>
          <div className="overflow-y-auto max-h-56 pr-1">
            {session_activity.length === 0 ? (
              <div className="text-center py-10 text-zinc-400 text-sm">
                No recent activity
              </div>
            ) : (
              session_activity.slice(0, 12).map((entry, i) => (
                <ActivityRow key={i} entry={entry} index={i} />
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Clients Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200
                   dark:border-zinc-800 shadow-sm overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b
                        border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-orange-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
              Assigned Clients
            </h3>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full
                           bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400">
            {clients.length} active
          </span>
        </div>

        {clients.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 text-sm">
            No active clients assigned to this trainer
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Attendance</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Expires</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {clients.map((client, i) => (
                  <motion.tr
                    key={client.client_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-t border-zinc-50 dark:border-zinc-800 hover:bg-zinc-50
                               dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                    onClick={() => navigate(`/clients/${client.client_id}`)}
                  >
                    {/* Client name + avatar */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {client.client_photo ? (
                          <img
                            src={client.client_photo}
                            alt={client.client_name}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400
                                          to-orange-600 flex items-center justify-center
                                          text-white text-xs font-bold flex-shrink-0">
                            {client.client_name?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="font-semibold text-zinc-900 dark:text-white truncate">
                          {client.client_name}
                        </span>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded-lg
                                       bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                        {client.plan_name}
                      </span>
                    </td>

                    {/* Attendance progress */}
                    <td className="px-4 py-3">
                      <SessionProgress used={client.sessions_used} total={client.total_sessions} />
                    </td>

                    {/* Expiry */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-zinc-500">
                        {client.end_date
                          ? new Date(client.end_date).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: '2-digit'
                          })
                          : '—'
                        }
                      </span>
                    </td>

                    {/* Arrow */}
                    <td className="px-4 py-3">
                      <ChevronRight size={14} className="text-zinc-400" />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ─── Main AdminTrainerDetails Page ───────────────────────────────────────────

const AdminTrainerDetails = () => {
  const { trainerId } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('schedule');
  const [trainer, setTrainer] = useState(null);
  const [trainerLoading, setTrainerLoading] = useState(true);

  // Fetch trainer basic info on mount
  useEffect(() => {
    const load = async () => {
      setTrainerLoading(true);
      try {
        const res = await api.get(`/manage-trainers/${trainerId}/`);
        setTrainer(res.data);
      } catch (err) {
        console.error('Failed to load trainer:', err);
      } finally {
        setTrainerLoading(false);
      }
    };
    if (trainerId) load();
  }, [trainerId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6"
    >

      {/* ── Back Button + Trainer Header ── */}
      <div className="flex items-start gap-4">
        <motion.button
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/admin')}
          className="mt-1 p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800
                     hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </motion.button>

        <div className="flex-1">
          {trainerLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-40 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
                <div className="h-3 w-24 bg-zinc-100 dark:bg-zinc-700 rounded-lg animate-pulse" />
              </div>
            </div>
          ) : trainer ? (
            <div className="flex items-center gap-4">
              {/* Trainer avatar placeholder */}
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600
                              flex items-center justify-center text-white text-lg font-bold shadow-sm">
                {(trainer.first_name || trainer.username)?.[0]?.toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {trainer.first_name || trainer.username}
                </h1>
                <p className="text-sm text-zinc-500">
                  @{trainer.username}
                  {trainer.email && ` · ${trainer.email}`}
                </p>
              </div>

              {/* Trainer badge */}
              <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 px-3 py-1
                               rounded-full text-xs font-semibold
                               bg-orange-50 dark:bg-orange-500/10
                               text-orange-700 dark:text-orange-400
                               border border-orange-200 dark:border-orange-500/30">
                <Award size={12} />
                Trainer
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle size={18} />
              Trainer not found
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-2xl w-fit
                      border border-zinc-200 dark:border-zinc-700">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold
                          transition-colors ${isActive
                  ? 'text-white'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-tab-bg"
                  className="absolute inset-0 bg-orange-500 rounded-xl shadow-sm"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon size={15} className="relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'schedule' && (
          <motion.div
            key="schedule"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
          >
            {/* Admin schedule: pass trainerId so the component operates in admin mode */}
            <TrainerSchedule trainerId={Number(trainerId)} />
          </motion.div>
        )}

        {activeTab === 'clients' && (
          <motion.div
            key="clients"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
          >
            <ClientsStatsTab trainerId={Number(trainerId)} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminTrainerDetails;