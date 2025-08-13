import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ImageExplorer.css';

const API_URL = "/api";

const ImageExplorer = ({ onProjectSelect, onSampleSelect, refreshSamplesToken }) => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [samples, setSamples] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch projects on component mount
  useEffect(() => {
    axios.get(`${API_URL}/projects`)
      .then(response => {
        setProjects(response.data);
      })
      .catch(err => {
        setError('Failed to fetch projects.');
        console.error(err);
      });
  }, []);

  // Fetch samples when a project is selected
  useEffect(() => {
    if (selectedProject) {
      setIsLoading(true);
      axios.get(`${API_URL}/projects/${selectedProject.id}/samples`)
        .then(response => {
          setSamples(response.data);
          setIsLoading(false);
        })
        .catch(err => {
          setError('Failed to fetch samples.');
          console.error(err);
          setIsLoading(false);
        });
    } else {
      setSamples([]);
    }
  }, [selectedProject, refreshSamplesToken]);

  const handleProjectClick = (project) => {
    setSelectedProject(project);
    onProjectSelect(project);
    onSampleSelect(null); // Deselect sample when project changes
  };

  const handleSampleClick = (sample) => {
    onSampleSelect(sample);
  };

  const handleSampleDelete = (e, sampleId) => {
    e.stopPropagation(); // Prevent sample selection
    if (window.confirm('Are you sure you want to delete this sample?')) {
      axios.delete(`${API_URL}/samples/${sampleId}`)
        .then(() => {
          setSamples(samples.filter(s => s.id !== sampleId));
          onSampleSelect(null);
        })
        .catch(err => {
          setError('Failed to delete sample.');
          console.error(err);
        });
    }
  };

  const handleSampleRename = (e, sample) => {
    e.stopPropagation();
    const newName = prompt('Enter new name for the sample:', sample.name);
    if (newName && newName.trim() !== '') {
      axios.put(`${API_URL}/samples/${sample.id}`, { name: newName.trim() })
        .then(response => {
          setSamples(samples.map(s => s.id === sample.id ? response.data : s));
          onSampleSelect(response.data);
        })
        .catch(err => {
          setError('Failed to rename sample.');
          console.error(err);
        });
    }
  };


  return (
    <aside className="image-explorer">
      <div className="project-list-section">
        <h3>Projects</h3>
        <ul className="project-list">
          {projects.map(project => (
            <li
              key={project.id}
              className={`project-item ${selectedProject?.id === project.id ? 'selected' : ''}`}
              onClick={() => handleProjectClick(project)}
            >
              {project.name}
            </li>
          ))}
        </ul>
      </div>

      {selectedProject && (
        <div className="sample-list-section">
          <h4>Samples for {selectedProject.name}</h4>
          {isLoading && <p>Loading samples...</p>}
          {error && <p className="error-message">{error}</p>}
          <ul className="sample-list">
            {samples.map(sample => (
              <li key={sample.id} className="sample-item" onClick={() => handleSampleClick(sample)}>
                <img
                  src={`/uploads/${sample.image_filename}`}
                  alt={sample.name}
                  className="sample-thumbnail"
                />
                <div className="sample-info">
                  <span className="sample-name">{sample.name}</span>
                  <span className="sample-dimensions">
                    {sample.results?.image_width_px} x {sample.results?.image_height_px}
                  </span>
                </div>
                <div className="sample-actions">
                  <button onClick={(e) => handleSampleRename(e, sample)} title="Rename">✏️</button>
                  <button onClick={(e) => handleSampleDelete(e, sample.id)} title="Delete">🗑️</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};

export default ImageExplorer;
