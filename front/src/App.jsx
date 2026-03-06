import React, { useContext, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import PageTransition from './components/PageTransition'; // استدعاء مكون الأنيميشن

// --- تطبيق الـ Lazy Loading على الصفحات ---
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const ClientDetails = lazy(() => import('./pages/ClientDetails'));
const AdminTrainers = lazy(() => import('./pages/AdminTrainers'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const WorkoutEditor = lazy(() => import('./pages/WorkoutEditor'));
const FoodDatabase = lazy(() => import('./pages/FoodDatabase'));
const ManualNutritionPlan = lazy(() => import('./pages/ManualNutritionPlan'));
const ManualTrainingPlan = lazy(() => import('./pages/ManualTrainingPlan'));
const Children = lazy(() => import('./pages/childrens/Children'));
const ChildDetails = lazy(() => import('./pages/childrens/ChildDetails'));
const TrainerProfile = lazy(() => import('./pages/TrainerProfile'));

// مكون بسيط يظهر أثناء تحميل الصفحة المطلوبة
const LoadingFallback = () => (
  <div className="flex items-center justify-center w-full min-h-[80vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
  </div>
);

// PrivateRoute أصبح مسؤول فقط عن الحماية وتوجيه المستخدم (بدون هيكل الـ UI)
const PrivateRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  return user ? children : <Navigate to="/login" replace />;
};

// مكون منفصل للراوتس عشان نقدر نستخدم useLocation
const AnimatedRoutes = () => {
  const location = useLocation();
  const { user } = useContext(AuthContext);

  return (
    <div className="flex bg-zinc-100 dark:bg-[#09090b] min-h-screen transition-colors duration-300">
      
      {/* الـ Sidebar ثابت برا الـ Routes عشان ميتأثرش بالأنيميشن بين الصفحات */}
      {user && <Sidebar />}

      <main className={`flex-1 w-full transition-all duration-300 ${user ? 'pt-24 lg:pt-0 lg:pl-72 px-4 md:px-6 lg:px-8' : ''}`}>
        <Suspense fallback={<LoadingFallback />}>
          {/* AnimatePresence مع mode="wait" لضمان خروج الصفحة القديمة قبل دخول الجديدة */}
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              
              {/* إذا كان مسجل دخول وحاول يروح للوجين، نرجعه للرئيسية */}
              <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

              {/* Protected Routes مغلفة بـ PageTransition */}
              <Route path="/" element={<PrivateRoute><PageTransition><Dashboard /></PageTransition></PrivateRoute>} />
              <Route path="/profile" element={<PrivateRoute><PageTransition><TrainerProfile /></PageTransition></PrivateRoute>} />
              <Route path="/clients" element={<PrivateRoute><PageTransition><Clients /></PageTransition></PrivateRoute>} />
              <Route path="/clients/:id" element={<PrivateRoute><PageTransition><ClientDetails /></PageTransition></PrivateRoute>} />
              <Route path="/admin" element={<PrivateRoute><PageTransition><AdminTrainers /></PageTransition></PrivateRoute>} />
              <Route path="/subscriptions" element={<PrivateRoute><PageTransition><Subscriptions /></PageTransition></PrivateRoute>} />
              <Route path="/training-plan/:planId/day/:splitId" element={<PrivateRoute><PageTransition><WorkoutEditor /></PageTransition></PrivateRoute>} />
              <Route path="/food-database" element={<PrivateRoute><PageTransition><FoodDatabase /></PageTransition></PrivateRoute>} />
              <Route path="/quick-plan" element={<PrivateRoute><PageTransition><ManualNutritionPlan /></PageTransition></PrivateRoute>} />
              <Route path="/quick-workout" element={<PrivateRoute><PageTransition><ManualTrainingPlan /></PageTransition></PrivateRoute>} />
              <Route path="/children" element={<PrivateRoute><PageTransition><Children /></PageTransition></PrivateRoute>} />
              <Route path="/children/:id" element={<PrivateRoute><PageTransition><ChildDetails /></PageTransition></PrivateRoute>} />
              
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          {/* استدعاء المكون اللي جواه الـ Routes والأنيميشن */}
          <AnimatedRoutes />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;