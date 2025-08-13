import React, { useState, useEffect, useRef } from 'react';
import './AnalysisPanel.css';

const AnalysisPanel = ({ sample, onParamsChange, isLoading }) => {
  const [params, setParams] = useState({
    autoLighting: true,
    removeNoise: 5,
    jointType: 'grayscale',
    thresholdMin: 85,
    thresholdMax: 170,
    jointThreshold: 128,
    carbideThreshold: 200,
    minGrainDiameter: 10,
    disaggregation: 'medium',
  });

  const debounceTimeout = useRef(null);

  useEffect(() => {
    // When params change, call the parent after a short delay
    clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => {
      onParamsChange(params);
    }, 300); // 300ms debounce delay
  }, [params, onParamsChange]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setParams(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  if (!sample) {
    return (
      <aside className="analysis-panel">
        <h3>Analysis Parameters</h3>
        <p className="placeholder-text">Select a sample to see analysis options.</p>
      </aside>
    );
  }

  return (
    <aside className="analysis-panel">
      <h3>Analysis Parameters</h3>

      <div className="panel-section">
        <h4>Preprocessing</h4>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="autoLighting"
              checked={params.autoLighting}
              onChange={handleChange}
            />
            Auto lighting correction
          </label>
        </div>
        <div className="form-group">
          <label htmlFor="removeNoise">Remove noise/isolated points</label>
          <input
            type="range"
            id="removeNoise"
            name="removeNoise"
            min="0"
            max="20"
            value={params.removeNoise}
            onChange={handleChange}
          />
          <span>{params.removeNoise}</span>
        </div>
      </div>

      <div className="panel-section">
        <h4>Thresholding</h4>
        {/* Joint type radio buttons would go here */}
        <div className="form-group">
          <label htmlFor="jointThreshold">Joint Threshold: {params.jointThreshold}</label>
          <input
            type="range"
            id="jointThreshold"
            name="jointThreshold"
            min="0"
            max="255"
            value={params.jointThreshold}
            onChange={handleChange}
          />
        </div>
        <div className="form-group">
          <label htmlFor="carbideThreshold">Carbide Threshold: {params.carbideThreshold}</label>
          <input
            type="range"
            id="carbideThreshold"
            name="carbideThreshold"
            min="0"
            max="255"
            value={params.carbideThreshold}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="panel-section">
        <h4>Filtering</h4>
        <div className="form-group">
          <label htmlFor="minGrainDiameter">Min Grain Diameter (µm): {params.minGrainDiameter}</label>
          <input
            type="range"
            id="minGrainDiameter"
            name="minGrainDiameter"
            min="0"
            max="100"
            value={params.minGrainDiameter}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="panel-section">
        <h4>Disaggregation</h4>
        <div className="form-group">
          <label htmlFor="disaggregation">Level</label>
          <select
            id="disaggregation"
            name="disaggregation"
            value={params.disaggregation}
            onChange={handleChange}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div className="form-group">
          <label htmlFor="jointThreshold">Joint Threshold: {params.jointThreshold}</label>
          <input
            type="range"
            id="jointThreshold"
            name="jointThreshold"
            min="0"
            max="255"
            value={params.jointThreshold}
            onChange={handleChange}
          />
          {isLoading && <span className="loading-indicator">Updating preview...</span>}
        </div>
        <div className="form-group">
          <label htmlFor="carbideThreshold">Carbide Threshold: {params.carbideThreshold}</label>
          <input
            type="range"
            id="carbideThreshold"
            name="carbideThreshold"
            min="0"
            max="255"
            value={params.carbideThreshold}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="panel-section">
        <h4>Filtering</h4>
        <div className="form-group">
          <label htmlFor="minGrainDiameter">Min Grain Diameter (µm): {params.minGrainDiameter}</label>
          <input
            type="range"
            id="minGrainDiameter"
            name="minGrainDiameter"
            min="0"
            max="100"
            value={params.minGrainDiameter}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="panel-section">
        <h4>Disaggregation</h4>
        <div className="form-group">
          <label htmlFor="disaggregation">Level</label>
          <select
            id="disaggregation"
            name="disaggregation"
            value={params.disaggregation}
            onChange={handleChange}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <button className="run-analysis-btn">Run Analysis</button>
    </aside>
  );
};

export default AnalysisPanel;
