import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from "jwt-decode";
import { useNavigate } from 'react-router-dom';
import api from '../api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => 
        localStorage.getItem('authTokens') ? jwtDecode(localStorage.getItem('authTokens')) : null
    );
    const [authTokens, setAuthTokens] = useState(() => 
        localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null
    );
    const [loading, setLoading] = useState(true);

    // FIX: Automatically attach token to API whenever it exists (even after refresh)
    useEffect(() => {
        if (authTokens) {
            api.defaults.headers['Authorization'] = 'Bearer ' + authTokens.access;
            setUser(jwtDecode(authTokens.access));
        } else {
            delete api.defaults.headers['Authorization'];
            setUser(null);
        }
        setLoading(false);
    }, [authTokens]);

    const loginUser = async (username, password) => {
        try {
            const response = await api.post('/auth/login/', { username, password });
            setAuthTokens(response.data);
            localStorage.setItem('authTokens', JSON.stringify(response.data));
            return true;
        } catch (error) {
            console.error("Login failed", error);
            alert("Invalid credentials");
            return false;
        }
    };

    const logoutUser = () => {
        setAuthTokens(null);
        setUser(null);
        localStorage.removeItem('authTokens');
        delete api.defaults.headers['Authorization']; // Cleanup
    };

    const contextData = {
        user,
        loginUser,
        logoutUser,
        authTokens
    };

    return (
        <AuthContext.Provider value={contextData}>
            {loading ? null : children}
        </AuthContext.Provider>
    );
};