import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './AuthPage.css';

const AuthPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const { login, register } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) {
                await login(username, password);
            } else {
                await register(username, password);
            }
            // The parent component will detect the auth change and redirect
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${isLogin ? 'login' : 'register'}`);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form-wrapper">
                <h2>{isLogin ? 'Login' : 'Register'}</h2>
                <form onSubmit={handleSubmit}>
                    {error && <p className="error-message">{error}</p>}
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="auth-button">
                        {isLogin ? 'Login' : 'Register'}
                    </button>
                </form>
                <button onClick={() => setIsLogin(!isLogin)} className="toggle-auth-button">
                    {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
                </button>
            </div>
        </div>
    );
};

export default AuthPage;
