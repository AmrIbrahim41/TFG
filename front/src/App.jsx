import React, { useContext, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
// Trainer's own weekly schedule page
const TrainerSchedulePage   = lazy(() => import('./pages/TrainerSchedule.jsx'));
// Admin oversight detail page (schedule + clients/stats for a specific trainer)
const AdminTrainerDetails   = lazy(() => import('./pages/Admintrainerdetails.jsx'));

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

              {/* ── NEW: Trainer's own schedule ──
                  Accessible by all authenticated users (trainers manage their own schedule).
                  Route: /schedule */}
              <Route path="/schedule" element={
                <PrivateRoute>
                  <PageTransition>
                    <TrainerSchedulePage />
                  </PageTransition>
                </PrivateRoute>
              } />

              {/* ── Admin-only routes ── */}
              <Route path="/admin" element={
                <AdminRoute><PageTransition><AdminTrainers /></PageTransition></AdminRoute>
              } />

              {/* ── NEW: Admin Trainer Oversight ──
                  Clicking a trainer card in AdminTrainers navigates here.
                  Route: /admin/trainers/:trainerId */}
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