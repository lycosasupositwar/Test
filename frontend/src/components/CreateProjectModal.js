import React, { useState } from 'react';
import axios from 'axios';
import './Modal.css';

const API_URL = "/api";

function CreateProjectModal({ onClose, onProjectCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/projects`, { name, description });
      onProjectCreated(response.data);
      onClose(); // Close modal on success
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button onClick={onClose} className="modal-close-btn">&times;</button>
        <h3>Create New Project</h3>
        <form onSubmit={handleSubmit} className="add-project-form">
          <div className="form-group">
            <label htmlFor="projectName">Project Name</label>
            <input
              type="text"
              id="projectName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="projectDescription">Description (Optional)</label>
            <textarea
              id="projectDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a brief description"
            />
          </div>
          {error && <p className="error-message" style={{color: '#dc3545'}}>{error}</p>}
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreateProjectModal;
