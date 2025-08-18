import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './InteractiveASTMViewer.css';

const API_URL = "/api";

function InteractiveASTMViewer({ sample, magnification, onSelect, onClose }) {
  const [gValues, setGValues] = useState([1, 2, 3, 4]);
  const [charts, setCharts] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCharts = async () => {
      if (!sample || !magnification) return;
      setIsLoading(true);
      setError('');
      try {
        const response = await axios.post(`${API_URL}/samples/${sample.id}/astm-chart`, {
          magnification,
          g_values: gValues,
        });
        setCharts(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch ASTM charts.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCharts();
  }, [sample, magnification, gValues]);

  const handlePrev = () => {
    setGValues(prev => {
      const start = Math.max(1, prev[0] - 4);
      return Array.from({ length: 4 }, (_, i) => start + i);
    });
  };

  const handleNext = () => {
    setGValues(prev => {
        const start = prev[0] + 4;
        if (start > 14) return prev; // Max G value
        return Array.from({ length: 4 }, (_, i) => start + i);
    });
  };

  return (
    <div className="interactive-viewer-container">
        <button onClick={onClose} className="close-btn">&times;</button>
        <h3>ASTM E112 Comparison</h3>
        <p>Select the grain size that best matches your sample.</p>
        {error && <p className="error-message">{error}</p>}
        {isLoading ? (
          <div className="loading-spinner"></div>
        ) : (
          <div className="charts-grid">
            {gValues.map(g => (
              <div key={g} className="chart-item" onClick={() => onSelect(g)}>
                <img src={charts[g]} alt={`ASTM Grain Size G=${g}`} />
                <div className="chart-title">G = {g}</div>
              </div>
            ))}
          </div>
        )}
        <div className="navigation-controls">
          <button onClick={handlePrev} disabled={gValues[0] <= 1}>Previous</button>
          <button onClick={handleNext}>Next</button>
        </div>
    </div>
  );
}

export default InteractiveASTMViewer;
