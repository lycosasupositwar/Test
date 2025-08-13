import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="app-footer">
      <div className="footer-info">
        <span>Version 1.0.0</span>
        <a href="#docs">ASTM E112 Docs</a>
        <a href="#support">Technical Support</a>
      </div>
      <div className="copyright">
        &copy; 2024 MetalloWeb
      </div>
    </footer>
  );
};

export default Footer;
