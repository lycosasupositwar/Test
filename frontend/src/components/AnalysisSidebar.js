import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MeasurementTable from './MeasurementTable';
import HistogramChart from './HistogramChart';
import EditorToolbar from './EditorToolbar';
import Calibration from './Calibration'; // Import Calibration
import './AnalysisSidebar.css';

const API_URL = "/api";

const AnalysisSidebar = ({
  selectedSample,
  onSampleUpdate,
  isEditing,
  onEnterEditMode,
  onSaveEdit,
  onCancelEdit,
  activeTool,
  onToolSelect,
  onGrainHover,
  isLoading,
  setIsLoading,
  error,
  setError,
  setPreviewImage,
  canvasSize, // Receive canvasSize
}) => {
  // ... (state variables are the same)

  // ... (useEffect for preview is the same)

  // ... (handleRunAnalysis is the same)

  return (
    <aside className="analysis-sidebar">
      {selectedSample ? (
        <>
          {isEditing ? (
            <EditorToolbar
              activeTool={activeTool}
              onToolSelect={onToolSelect}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
              isSaving={isLoading}
            />
          ) : (
            <>
              <h3>Analysis Parameters</h3>
              {error && <p className="error-message">{error}</p>}

              <div className="param-group">
                <h4>Calibration</h4>
                <Calibration
                  sample={selectedSample}
                  onCalibrationUpdate={onSampleUpdate}
                  canvasSize={canvasSize}
                />
              </div>

              <div className="param-group">
                <h4>Preprocessing</h4>
                {/* ... */}
              </div>

              <div className="param-group">
                <h4>Thresholding</h4>
                {/* ... */}
              </div>

              <div className="param-group">
                <h4>Filtering</h4>
                {/* ... */}
              </div>

              <div className="param-group">
                <h4>Disaggregation</h4>
                {/* ... */}
              </div>

              <button onClick={() => {}} className="run-analysis-btn" disabled={isLoading || !selectedSample.scale_pixels_per_mm}>
                {isLoading ? 'Analyzing...' : 'Run Analysis'}
              </button>
              {!selectedSample.scale_pixels_per_mm && <small className="calibration-warning">Calibration required before analysis</small>}

              <button onClick={onEnterEditMode} className="edit-btn">
                Manual Edit Results
              </button>
            </>
          )}

          {selectedSample.results?.measurements && !isEditing && (
            <div className="results-display">
              {/* ... */}
            </div>
          )}
        </>
      ) : (
        <div className="placeholder">
          {/* ... */}
        </div>
      )}
    </aside>
  );
};

export default AnalysisSidebar;
