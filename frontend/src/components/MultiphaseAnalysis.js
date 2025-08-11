import React, { useState } from 'react';
import './MultiphaseAnalysis.css';

function MultiphaseAnalysis({ sample, onCalculate, isLoading }) {
  const [threshold, setThreshold] = useState(128);

  const handleSubmit = (e) => {
    e.preventDefault();
    onCalculate(threshold);
  };

  const multiphaseResults = sample.results?.multiphase;

  return (
    <div className="multiphase-container">
      <h4>Multiphase Analysis</h4>
      <form onSubmit={handleSubmit}>
        <div className="threshold-slider">
          <label htmlFor="threshold">Threshold: {threshold}</label>
          <input
            type="range"
            id="threshold"
            min="0"
            max="255"
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value))}
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Calculating...' : 'Calculate Phase Ratio'}
        </button>
      </form>

      {multiphaseResults && (
        <div className="multiphase-results">
          <h5>Results (Threshold: {multiphaseResults.threshold})</h5>
          <p>
            <strong>Phase 1 (White):</strong> {multiphaseResults.phase_1_percent.toFixed(2)}%
          </p>
          <p>
            <strong>Phase 2 (Black):</strong> {multiphaseResults.phase_2_percent.toFixed(2)}%
          </p>
          <div className="preview-image">
            <h6>Thresholded Preview</h6>
            <img src={multiphaseResults.preview_image} alt="Thresholded preview" />
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiphaseAnalysis;
