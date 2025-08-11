import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './SampleList.css';

const API_URL = 'http://localhost:5000/api';

function SampleList({ project, onSampleSelect, newSample, selectedSample }) {
  const [samples, setSamples] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchSamples = useCallback(async () => {
    if (!project) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/projects/${project.id}/samples`);
      setSamples(response.data);
      setError('');
    } catch (err) {
      setError('Failed to fetch samples.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    fetchSamples();
  }, [fetchSamples]);

  useEffect(() => {
    // Add the new sample to the top of the list when it's created
    if (newSample && !samples.find(s => s.id === newSample.id)) {
      setSamples([newSample, ...samples]);
    }
  }, [newSample, samples]);

  const handleDeleteSample = async (e, id) => {
    e.stopPropagation(); // Prevent the li's onClick from firing
    if (window.confirm('Are you sure you want to delete this sample?')) {
      try {
        await axios.delete(`${API_URL}/samples/${id}`);
        setSamples(samples.filter((s) => s.id !== id));
        // If the deleted sample was the selected one, unselect it
        if (selectedSample && selectedSample.id === id) {
          onSampleSelect(null);
        }
      } catch (err) {
        setError('Failed to delete sample.');
        console.error(err);
      }
    }
  };

  if (!project) {
    return null;
  }

  return (
    <div className="sample-list-container">
      <h4>Samples</h4>
      {loading && <p>Loading samples...</p>}
      {error && <p className="error-message">{error}</p>}
      <ul>
        {samples.map((sample) => (
          <li
            key={sample.id}
            onClick={() => onSampleSelect(sample)}
            className={selectedSample && selectedSample.id === sample.id ? 'selected' : ''}
          >
            <span className="sample-name">
              {sample.name}
            </span>
            <button onClick={(e) => handleDeleteSample(e, sample.id)} className="delete-btn">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SampleList;
