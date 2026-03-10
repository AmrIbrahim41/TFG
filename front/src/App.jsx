import React, { useContext, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import PageTransition from './components/PageTransition';

// ── Lazy-loaded pages ────────────────────────────────────────────────────────
const Dashboard             = lazy(() => import('./pages/Dashboard'));
const Clients               = lazy(() => import('./pages/Clients'));
const ClientDetails         = lazy(() => import('./pages/ClientDetails'));
const AdminTrainers         = lazy(() => import('./pages/AdminTrainers'));
const Subscriptions         = lazy(() => import('./pages/Subscriptions'));
const WorkoutEditor         = lazy(() => import('./pages/WorkoutEditor'));
const FoodDatabase          = lazy(() => import('./pages/FoodDatabase'));
const ManualNutritionPlan   = lazy(() => import('./pages/ManualNutritionPlan'));
const ManualTrainingPlan    = lazy(() => import('./pages/ManualTrainingPlan'));
const Children              = lazy(() => import('./pages/childrens/Children'));
const ChildDetails          = lazy(() => import('./pages/childrens/ChildDetails'));
const TrainerProfile        = lazy(() => import('./pages/TrainerProfile'));

// ── NEW pages ────────────────────────────────────────────────────────────────
const TrainerSchedulePage   = lazy(() => import('./pages/TrainerSchedule.jsx'));
const AdminTrainerDetails   = lazy(() => import('./pages/Admintrainerdetails.jsx'));

// ── Group Session Components ─────────────────────────────────────────────────
const SessionPlanner        = lazy(() => import('./pages/childrens/SessionPlanner'));
const LiveSession           = lazy(() => import('./pages/childrens/LiveSession'));

// ── Loading fallback ─────────────────────────────────────────────────────────
const LoadingFallback = () => (
  <div className="flex items-center justify-center w-full min-h-[80vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500" />
  </div>
);

// ── Auth guard ───────────────────────────────────────────────────────────────
const PrivateRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  return user ? children : <Navigate to="/login" replace />;
};

/**
 * AdminRoute – redirects non-admins to home.
 * Wraps routes that should only be accessible to is_superuser users.
 */
const AdminRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_superuser) return <Navigate to="/" replace />;
  return children;
};

// ── Route Adapters for Group Session ─────────────────────────────────────────
// These wrappers extract shared state from React Router's location object
// and map them into the highly decoupled props required by the new components.

const SessionPlannerPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  const day = state.day || 'Today';
  const childrenData = state.children || [];
  const initialExercises = state.exercises || [];

  return (
    <SessionPlanner
      day={day}
      childrenCount={childrenData.length}
      initialExercises={initialExercises}
      // التعديل هنا: تم إزالة الحالة التي تسبب الـ Navigation Loop
      onClose={() => navigate('/children')}
      onStartLiveSession={(validExercises) => {
        navigate('/group-session/live', {
          state: { ...state, exercises: validExercises }
        });
      }}
    />
  );
};

const LiveSessionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  const day = state.day || 'Today';
  const childrenData = state.children || [];
  const exercises = state.exercises || [];

  // Security fallback: if accessed directly without planning exercises, route back to setup
  if (exercises.length === 0) {
    return <Navigate to="/group-session/setup" state={state} replace />;
  }

  return (
    <LiveSession
      day={day}
      children={childrenData}
      exercises={exercises}
      // التعديل هنا أيضاً للحماية من نفس المشكلة
      onClose={() => navigate('/children')}
      onEditPlan={() => {
        navigate('/group-session/setup', {
          state: { ...state, exercises }
        });
      }}
    />
  );
};

// ── Animated routes (must be inside Router to use useLocation) ───────────────
const AnimatedRoutes = () => {
  const location = useLocation();
  const { user } = useContext(AuthContext);

  return (
    <div className="flex bg-zinc-100 dark:bg-[#09090b] min-h-screen transition-colors duration-300">

      {/* Sidebar is rendered outside Routes so it is unaffected by page transitions */}
      {user && <Sidebar />}

      <main className={`flex-1 w-full transition-all duration-300 ${
        user ? 'pt-24 lg:pt-0 lg:pl-72 px-4 md:px-6 lg:px-8' : ''
      }`}>
        <Suspense fallback={<LoadingFallback />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>

              {/* ── Public ── */}
              <Route
                path="/login"
                element={user ? <Navigate to="/" replace /> : <Login />}
              />

              {/* ── Protected (all authenticated users) ── */}
              <Route path="/" element={
                <PrivateRoute><PageTransition><Dashboard /></PageTransition></PrivateRoute>
              } />

              <Route path="/profile" element={
                <PrivateRoute><PageTransition><TrainerProfile /></PageTransition></PrivateRoute>
              } />

              <Route path="/clients" element={
                <PrivateRoute><PageTransition><Clients /></PageTransition></PrivateRoute>
              } />

              <Route path="/clients/:id" element={
                <PrivateRoute><PageTransition><ClientDetails /></PageTransition></PrivateRoute>
              } />

              <Route path="/subscriptions" element={
                <PrivateRoute><PageTransition><Subscriptions /></PageTransition></PrivateRoute>
              } />

              <Route path="/training-plan/:planId/day/:splitId" element={
                <PrivateRoute><PageTransition><WorkoutEditor /></PageTransition></PrivateRoute>
              } />

              <Route path="/food-database" element={
                <PrivateRoute><PageTransition><FoodDatabase /></PageTransition></PrivateRoute>
              } />

              <Route path="/quick-plan" element={
                <PrivateRoute><PageTransition><ManualNutritionPlan /></PageTransition></PrivateRoute>
              } />

              <Route path="/quick-workout" element={
                <PrivateRoute><PageTransition><ManualTrainingPlan /></PageTransition></PrivateRoute>
              } />

              <Route path="/children" element={
                <PrivateRoute><PageTransition><Children /></PageTransition></PrivateRoute>
              } />

              <Route path="/children/:id" element={
                <PrivateRoute><PageTransition><ChildDetails /></PageTransition></PrivateRoute>
              } />

              <Route path="/schedule" element={
                <PrivateRoute>
                  <PageTransition>
                    <TrainerSchedulePage />
                  </PageTransition>
                </PrivateRoute>
              } />

              {/* ── NEW: Group Session Split Routes ── */}
              {/* تمت إزالة PageTransition لمنع تضارب الأنيميشن مع fixed inset-0 */}
              <Route path="/group-session/setup" element={
                <PrivateRoute>
                  <SessionPlannerPage />
                </PrivateRoute>
              } />

              <Route path="/group-session/live" element={
                <PrivateRoute>
                  <LiveSessionPage />
                </PrivateRoute>
              } />

              {/* ── Admin-only routes ── */}
              <Route path="/admin" element={
                <AdminRoute><PageTransition><AdminTrainers /></PageTransition></AdminRoute>
              } />

              <Route path="/admin/trainers/:trainerId" element={
                <AdminRoute>
                  <PageTransition>
                    <AdminTrainerDetails />
                  </PageTransition>
                </AdminRoute>
              } />

            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
    </div>
  );
};

// ─── Root App ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AnimatedRoutes />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;