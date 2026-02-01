import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';

// Pages
import Dashboard from './pages/Dashboard'; // <--- IMPORT DASHBOARD
import Clients from './pages/Clients';
import ClientDetails from './pages/ClientDetails';
import AdminTrainers from './pages/AdminTrainers';
import Subscriptions from './pages/Subscriptions';
import WorkoutEditor from './pages/WorkoutEditor';
import FoodDatabase from './pages/FoodDatabase';
import ManualNutritionPlan from './pages/ManualNutritionPlan';
import ManualTrainingPlan from './pages/ManualTrainingPlan';
import Children from './pages/Children';
import ChildDetails from './pages/ChildDetails';


// Component to protect routes
const PrivateRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  return user ? <><Sidebar /><main className="flex-1">{children}</main></> : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="flex bg-[#09090b] min-h-screen">
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Protected Routes */}
            {/* CHANGE: Point "/" to Dashboard instead of redirecting to clients */}
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

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
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;