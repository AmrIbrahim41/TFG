import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Clients from './pages/Clients';
import ClientDetails from './pages/ClientDetails';
import Login from './pages/Login';
import AdminTrainers from './pages/AdminTrainers';
import Subscriptions from './pages/Subscriptions';
import WorkoutEditor from './pages/WorkoutEditor'; 
import FoodDatabase from './pages/FoodDatabase'; // <--- IMPORT THIS


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
            <Route path="/" element={<PrivateRoute><Navigate to="/clients" /></PrivateRoute>} />
            <Route path="/clients" element={<PrivateRoute><Clients /></PrivateRoute>} />
            <Route path="/clients/:id" element={<PrivateRoute><ClientDetails /></PrivateRoute>} />
            <Route path="/admin" element={<PrivateRoute><AdminTrainers /></PrivateRoute>} />
            <Route path="/subscriptions" element={<PrivateRoute><Subscriptions /></PrivateRoute>} />
            <Route path="/training-plan/:planId/day/:splitId" element={<PrivateRoute><WorkoutEditor /></PrivateRoute>} />
            <Route path="/food-database" element={<PrivateRoute><FoodDatabase /></PrivateRoute>} />
            
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;