import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Modal.css';

const API_URL = '/api';

function SelectProjectModal({ onClose, onProjectSelect }) {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/projects`);
      setProjects(response.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch projects.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDeleteProject = async (id) => {
    if (window.confirm('Are you sure you want to delete this project and all its samples?')) {
      try {
        await axios.delete(`${API_URL}/projects/${id}`);
        setProjects(projects.filter((p) => p.id !== id));
        setError('');
      } catch (err) {
        setError('Failed to delete project.');
        console.error(err);
      }
    }
  };

  const handleSelect = (project) => {
    onProjectSelect(project);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button onClick={onClose} className="modal-close-btn">&times;</button>
        <h3>Select a Project</h3>
        {error && <p className="error-message" style={{color: '#dc3545'}}>{error}</p>}
        <div className="projects">
          {loading && <p>Loading projects...</p>}
          <ul>
            {projects.map((project) => (
              <li
                key={project.id}
                onClick={() => handleSelect(project)}
              >
                <span className="project-name">
                  {project.name} ({project.sample_count} samples)
                </span>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id);}} className="delete-btn">Delete</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default SelectProjectModal;
