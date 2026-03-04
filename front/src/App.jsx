import React, { useContext, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';

// --- تطبيق الـ Lazy Loading على الصفحات (يتم تحميلها عند الحاجة فقط) ---
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
  <div className="flex items-center justify-center w-full min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  return user ? (
    <>
      <Sidebar />
      {/* FIXED LAYOUT:
        1. lg:pl-72: This creates the space for the sidebar ONCE.
        2. pt-24 lg:pt-0: Handles mobile header spacing.
        3. w-full: Ensures content takes full remaining width.
      */}
      <main className="flex-1 w-full transition-all duration-300 pt-24 lg:pt-0 lg:pl-72 px-4 md:px-6 lg:px-8">
        {children}
      </main>
    </>
  ) : (
    <Navigate to="/login" />
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <div className="flex bg-zinc-100 dark:bg-[#09090b] min-h-screen transition-colors duration-300">
            {/* تغليف المسارات بـ Suspense ليعرض مؤشر التحميل ريثما يتم جلب ملف الصفحة */}
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* صفحة تسجيل الدخول تركناها عادية بدون Lazy Loading لكي تفتح فوراً */}
                <Route path="/login" element={<Login />} />

                {/* Protected Routes */}
                <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><TrainerProfile /></PrivateRoute>} />
                <Route path="/clients" element={<PrivateRoute><Clients /></PrivateRoute>} />
                <Route path="/clients/:id" element={<PrivateRoute><ClientDetails /></PrivateRoute>} />
                <Route path="/admin" element={<PrivateRoute><AdminTrainers /></PrivateRoute>} />
                <Route path="/subscriptions" element={<PrivateRoute><Subscriptions /></PrivateRoute>} />
                <Route path="/training-plan/:planId/day/:splitId" element={<PrivateRoute><WorkoutEditor /></PrivateRoute>} />
                <Route path="/food-database" element={<PrivateRoute><FoodDatabase /></PrivateRoute>} />
                <Route path="/quick-plan" element={<PrivateRoute><ManualNutritionPlan /></PrivateRoute>} />
                <Route path="/quick-workout" element={<PrivateRoute><ManualTrainingPlan /></PrivateRoute>} />
                <Route path="/children" element={<PrivateRoute><Children /></PrivateRoute>} />
                <Route path="/children/:id" element={<PrivateRoute><ChildDetails /></PrivateRoute>} />
              </Routes>
            </Suspense>
          </div>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;