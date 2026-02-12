import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';

// Pages Imports...
import Dashboard from './pages/Dashboard'; 
import Clients from './pages/Clients';
import ClientDetails from './pages/ClientDetails';
import AdminTrainers from './pages/AdminTrainers';
import Subscriptions from './pages/Subscriptions';
import WorkoutEditor from './pages/WorkoutEditor';
import FoodDatabase from './pages/FoodDatabase';
import ManualNutritionPlan from './pages/ManualNutritionPlan';
import ManualTrainingPlan from './pages/ManualTrainingPlan';
import Children from './pages/childrens/Children';
import ChildDetails from './pages/childrens/ChildDetails';
import SessionDetail from './pages/SessionDetail';
import TrainerProfile from './pages/TrainerProfile';

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
      <main className="flex-1 w-full transition-all duration-300 pt-24 lg:pt-0 lg:pl-72">
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
            <Routes>
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
              <Route path="/children/history/:id" element={<SessionDetail />} />

            </Routes>
          </div>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;