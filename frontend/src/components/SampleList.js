import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './SampleList.css';

const API_URL = "/api";

function SampleList({ samples, onSampleSelect, selectedSample, onSampleDeleted }) {
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

  return (
    <div className="sample-list-container">
      <h4>Samples</h4>
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
