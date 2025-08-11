import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ProjectList.css';

const API_URL = 'http://localhost:5000/api';

function ProjectList({ onProjectSelect }) {
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/projects`);
      setProjects(response.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch projects. Is the backend running?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setError('Project name cannot be empty.');
      return;
    }
    try {
      const response = await axios.post(`${API_URL}/projects`, {
        name: newProjectName,
        description: newProjectDesc,
      });
      setProjects([response.data, ...projects]);
      setNewProjectName('');
      setNewProjectDesc('');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project.');
      console.error(err);
    }
  };

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

  return (
    <div className="project-list-container">
      <h2>Projects</h2>
      <div className="project-form">
        <h3>Create New Project</h3>
        <form onSubmit={handleCreateProject}>
          <input
            type="text"
            placeholder="Project Name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={newProjectDesc}
            onChange={(e) => setNewProjectDesc(e.target.value)}
          />
          <button type="submit">Create Project</button>
        </form>
        {error && <p className="error-message">{error}</p>}
      </div>

      <div className="projects">
        <h3>Existing Projects</h3>
        {loading && <p>Loading projects...</p>}
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <span onClick={() => onProjectSelect(project.id)} className="project-name">
                {project.name} ({project.sample_count} samples)
              </span>
              <button onClick={() => handleDeleteProject(project.id)} className="delete-btn">Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default ProjectList;
