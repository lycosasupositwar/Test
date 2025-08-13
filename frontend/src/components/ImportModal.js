import React from 'react';
import './ImportModal.css';
import AddSampleForm from './AddSampleForm';

const ImportModal = ({ project, onSampleAdded, onClose }) => {
  if (!project) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close-btn" onClick={onClose}>&times;</button>
        <h3>Import New Sample for {project.name}</h3>
        <AddSampleForm project={project} onSampleAdded={onSampleAdded} />
      </div>
    </div>
  );
};

export default ImportModal;
