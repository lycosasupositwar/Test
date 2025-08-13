import React, { useState, useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';
import './Header.css';

const Header = ({ onImportClick, onExportAnnotatedImage, onExportCsv }) => {
  const [isExportMenuOpen, setExportMenuOpen] = useState(false);
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <header className="app-header">
      <div className="logo">MetalloWeb</div>
      <nav className="main-menu">
        <ul>
          <li><button onClick={onImportClick}>📂 Import</button></li>
          <li><a href="#calibration">📏 Calibration</a></li>
          <li><a href="#analysis">🔍 Analysis</a></li>
          <li
            className="dropdown-container"
            onMouseEnter={() => setExportMenuOpen(true)}
            onMouseLeave={() => setExportMenuOpen(false)}
          >
            <button>📤 Export</button>
            {isExportMenuOpen && (
              <ul className="dropdown-menu">
                <li><button onClick={onExportAnnotatedImage}>Annotated Image</button></li>
                <li><button onClick={onExportCsv}>CSV Data</button></li>
              </ul>
            )}
          </li>
        </ul>
      </nav>
      <div className="header-icons">
        <button onClick={toggleTheme} className="theme-toggle-btn">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <span>👤</span>
      </div>
    </header>
  );
};

export default Header;
