import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import './Header.css';

const API_URL = "/api";

const Header = ({ selectedSample }) => {
  const { user, logout } = useAuth();
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to logout", error);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [exportMenuRef]);

  const canExport = selectedSample && selectedSample.results?.measurements;

  return (
    <header className="app-header">
      <div className="header-logo">
        <a href="/">MetalloWeb</a>
      </div>
      <nav className="header-nav">
        <a href="#import">📂 Import</a>
        <a href="#calibration">📏 Calibration</a>
        <a href="#analysis">🔍 Analysis</a>
        <div className="nav-item-dropdown" ref={exportMenuRef}>
          <button
            className="nav-button"
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            disabled={!canExport}
          >
            📤 Export
          </button>
          {isExportMenuOpen && (
            <div className="dropdown-menu">
              <a href={`${API_URL}/samples/${selectedSample.id}/export/csv`} target="_blank" rel="noopener noreferrer">Export as CSV</a>
              <a href={`${API_URL}/samples/${selectedSample.id}/export/pdf`} target="_blank" rel="noopener noreferrer">Export as PDF</a>
            </div>
          )}
        </div>
      </nav>
      <div className="header-actions">
        <a href="#language" title="Switch Language">🌐</a>
        <a href="#settings" title="Settings">⚙️</a>
        {user ? (
          <div className="user-info">
            <span>{user.username}</span>
            <button onClick={handleLogout} className="logout-btn" title="Logout">Logout</button>
          </div>
        ) : (
          <a href="#profile" title="User Profile">👤</a>
        )}
      </div>
    </header>
  );
};

export default Header;
