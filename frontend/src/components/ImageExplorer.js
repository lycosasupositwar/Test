import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ProjectList from './ProjectList';
import SampleList from './SampleList';
import AddSampleForm from './AddSampleForm';
import './ImageExplorer.css';

const API_URL = "/api";

const ImageExplorer = ({ onProjectSelect, onSampleSelect, selectedProject, onSampleUpdate }) => {
  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedProject) {
      setIsLoading(true);
      setSamples([]); // Clear old samples
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
  }, [selectedProject]);

  const handleSampleAdded = (addedSample) => {
    setSamples([addedSample, ...samples]);
    handleSampleSelect(addedSample);
  };

  const handleSampleDeleted = (deletedSampleId) => {
    setSamples(samples.filter(s => s.id !== deletedSampleId));
    if (selectedSample && selectedSample.id === deletedSampleId) {
      handleSampleSelect(null);
    }
  };

  const handleSampleRenamed = async (sampleId, newName) => {
    setError('');
    try {
      const response = await axios.put(`${API_URL}/samples/${sampleId}`, { name: newName });
      const updatedSample = response.data;

      // Update the list of samples
      const newSamples = samples.map(s => (s.id === sampleId ? updatedSample : s));
      setSamples(newSamples);

      // If the renamed sample is the currently selected one, update it in the parent as well
      if (selectedSample && selectedSample.id === sampleId) {
        onSampleUpdate(updatedSample);
      }

    } catch (err) {
      setError('Failed to rename sample.');
      console.error(err);
    }
  };

  const handleSampleSelect = (sample) => {
    setSelectedSample(sample);
    onSampleSelect(sample);
  }

  return (
    <aside className="image-explorer">
      <div className="projects-section">
        <ProjectList onProjectSelect={onProjectSelect} selectedProject={selectedProject} />
      </div>

      <div className="samples-section">
        {selectedProject ? (
          <>
            <h3>{selectedProject.name}</h3>
            <AddSampleForm project={selectedProject} onSampleAdded={handleSampleAdded} />
            {isLoading && <p>Loading samples...</p>}
            {error && <p className="error-message">{error}</p>}
            <SampleList
              samples={samples}
              onSampleSelect={handleSampleSelect}
              selectedSample={selectedSample}
              onSampleDeleted={handleSampleDeleted}
              onSampleRenamed={handleSampleRenamed}
            />
          </>
        ) : (
          <div className="placeholder">
            <p>Select a project to view samples.</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default ImageExplorer;
