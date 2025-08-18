import React, { useState } from 'react';
import './FileMenu.css';

function FileMenu({ onCreateProject, onSelectProject }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleCreate = () => {
    onCreateProject();
    setIsOpen(false);
  };

  const handleSelect = () => {
    onSelectProject();
    setIsOpen(false);
  };

  return (
    <div className="file-menu-container">
      <button className="file-menu-button" onClick={() => setIsOpen(!isOpen)}>
        File
      </button>
      {isOpen && (
        <div className="file-menu-dropdown">
          <button onClick={handleCreate}>New Project...</button>
          <button onClick={handleSelect}>Open Project...</button>
        </div>
      )}
    </div>
  );
}

export default FileMenu;
