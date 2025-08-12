import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = "/api";
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkUser = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data } = await axios.get(`${API_URL}/@me`);
            setUser(data);
        } catch (error) {
            console.log('No user logged in');
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkUser();
    }, [checkUser]);

    const login = async (username, password) => {
        const { data } = await axios.post(`${API_URL}/login`, { username, password });
        setUser(data);
        return data;
    };

    const register = async (username, password) => {
        const { data } = await axios.post(`${API_URL}/register`, { username, password });
        setUser(data);
        return data;
    };

    const logout = async () => {
        await axios.post(`${API_URL}/logout`);
        setUser(null);
    };

    const value = {
        user,
        isLoading,
        isAuthenticated: !isLoading && !!user,
        login,
        register,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
