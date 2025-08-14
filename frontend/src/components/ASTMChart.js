import React, { useState } from 'react';
import axios from 'axios';
import './ASTMChart.css';

const API_URL = "/api";

function ASTMChart({ sample, isLoading, setIsLoading, setError }) {
  const [chart, setChart] = useState(null);
  const [magnification, setMagnification] = useState(100);

  const handleGenerateChart = async () => {
    if (!sample) return;
    setIsLoading(true);
    setError('');
    setChart(null);
    try {
      const response = await axios.post(`${API_URL}/api/samples/${sample.id}/astm-chart`,
        { magnification },
        { responseType: 'blob' }
      );
      const imageUrl = URL.createObjectURL(response.data);
      setChart(imageUrl);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate ASTM chart.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="astm-chart-container">
      <h4>ASTM E112 Comparison Chart</h4>
      <div className="chart-controls">
        <label htmlFor="magnification">Magnification:</label>
        <input
          type="number"
          id="magnification"
          value={magnification}
          onChange={(e) => setMagnification(e.target.value)}
          disabled={isLoading}
        />
        <button onClick={handleGenerateChart} disabled={isLoading || !sample}>
          {isLoading ? 'Generating...' : 'Generate Chart'}
        </button>
      </div>
      {chart && (
        <div className="chart-display">
          <img src={chart} alt="ASTM E112 Comparison Chart" />
        </div>
      )}
    </div>
  );
}

export default ASTMChart;
