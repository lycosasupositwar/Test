import React, { useState } from 'react';
import axios from 'axios';
import './SampleList.css';

const API_URL = "/api";

function SampleList({ samples, onSampleSelect, selectedSample, onSampleDeleted, onSampleRenamed }) {
  const [error, setError] = useState('');

  const handleDeleteSample = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this sample?')) {
      try {
        await axios.delete(`${API_URL}/samples/${id}`);
        onSampleDeleted(id);
      } catch (err) {
        setError('Failed to delete sample.');
        console.error(err);
      }
    }
  };

  const handleRenameSample = (e, sample) => {
    e.stopPropagation();
    const newName = prompt("Enter new sample name:", sample.name);
    if (newName && newName.trim() !== "" && newName !== sample.name) {
      // The actual API call will be implemented in the next step.
      // For now, we'll call a prop function to update the state optimistically.
      onSampleRenamed(sample.id, newName);
    }
  };

  return (
    <div className="sample-list-container">
      {error && <p className="error-message">{error}</p>}
      <ul className="sample-list">
        {samples.map((sample) => (
          <li
            key={sample.id}
            onClick={() => onSampleSelect(sample)}
            className={selectedSample && selectedSample.id === sample.id ? 'selected' : ''}
          >
            <img src={`${API_URL}/samples/${sample.id}/thumbnail`} alt={sample.name} className="sample-thumbnail" />
            <div className="sample-info">
              <span className="sample-name">{sample.name}</span>
              <span className="sample-dimensions">
                {sample.results?.image_width_px} x {sample.results?.image_height_px}
              </span>
            </div>
            <div className="sample-actions">
              <button onClick={(e) => handleRenameSample(e, sample)} className="rename-btn" title="Rename">✏️</button>
              <button onClick={(e) => handleDeleteSample(e, sample.id)} className="delete-btn" title="Delete">🗑️</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SampleList;
