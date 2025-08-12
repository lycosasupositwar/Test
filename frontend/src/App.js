import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import ProjectList from './components/ProjectList';
import SampleList from './components/SampleList';
import AddSampleForm from './components/AddSampleForm';
import Calibration from './components/Calibration';
import MeasurementTable from './components/MeasurementTable';
import EditorToolbar from './components/EditorToolbar';
import HistogramChart from './components/HistogramChart';
import MultiphaseAnalysis from './components/MultiphaseAnalysis';

const API_URL = "/api";

const generateColor = (index) => {
  const r = (index * 30) % 255;
  const g = (index * 50) % 255;
  const b = (index * 70) % 255;
  return `rgb(${r},${g},${b})`;
};

function App() {
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSample, setSelectedSample] = useState(null);
  const [newSample, setNewSample] = useState(null);
  const [highlightedGrainId, setHighlightedGrainId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [activeTool, setActiveTool] = useState('delete');
  const [localContours, setLocalContours] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const originalCanvasRef = useRef(null);
  const segmentedCanvasRef = useRef(null);
  const hitCanvasRef = useRef(null);

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setSelectedSample(null);
    setIsEditing(false);
  };

  const handleSampleSelect = (sample) => {
    setSelectedSample(sample);
    setIsEditing(false);
  };

  const handleSampleAdded = (addedSample) => {
    setNewSample(addedSample);
    setSelectedSample(addedSample);
  };

  const handleCalibrationUpdate = (updatedSample) => {
    setSelectedSample(updatedSample);
  };

  const handleMeasure = async () => {
    if (!selectedSample) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/api/samples/${selectedSample.id}/measure`);
      setSelectedSample(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to calculate measurements.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMultiphaseAnalysis = async (threshold) => {
    if (!selectedSample) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/api/samples/${selectedSample.id}/multiphase`, { threshold });
      setSelectedSample(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to calculate phase ratio.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAstmCalculation = async () => {
    if (!selectedSample) return;
    const magnificationStr = prompt("Enter image magnification (e.g., 100):");
    if (!magnificationStr) return;
    const magnification = parseFloat(magnificationStr);
    if (isNaN(magnification) || magnification <= 0) {
      alert("Invalid magnification.");
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/api/samples/${selectedSample.id}/astm-e112`, { magnification });
      setSelectedSample(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to calculate ASTM grain size.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnterEditMode = () => {
    if (selectedSample?.results?.contours) {
      setLocalContours(JSON.parse(JSON.stringify(selectedSample.results.contours)));
      setIsEditing(true);
      setHighlightedGrainId(null);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setLocalContours([]);
  };

  const handleSaveEdit = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/api/samples/${selectedSample.id}/retouch`, {
        contours: localContours,
      });
      setSelectedSample(response.data);
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save edits.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCanvasClickForEdit = (event) => {
    if (activeTool === 'delete') {
      const hitCtx = hitCanvasRef.current.getContext('2d');
      const rect = event.target.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const pixel = hitCtx.getImageData(x, y, 1, 1).data;
      if (pixel[3] === 0) return;
      const color = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
      const clickedIndex = localContours.findIndex((_, index) => generateColor(index) === color);
      if (clickedIndex > -1) {
        const newContours = [...localContours];
        newContours.splice(clickedIndex, 1);
        setLocalContours(newContours);
      }
    }
  };

  const draw = useCallback(() => {
    const contoursToDraw = isEditing ? localContours : selectedSample?.results?.contours;
    const originalCanvas = originalCanvasRef.current;
    if (!selectedSample || !contoursToDraw || !originalCanvas) {
      [originalCanvasRef, segmentedCanvasRef, hitCanvasRef].forEach(ref => {
        if (ref.current) {
          const ctx = ref.current.getContext('2d');
          ctx.clearRect(0, 0, ref.current.width, ref.current.height);
        }
      });
      setCanvasSize({ width: 0, height: 0 });
      return;
    }

    const segmentedCanvas = segmentedCanvasRef.current;
    const hitCanvas = hitCanvasRef.current;
    const originalCtx = originalCanvas.getContext('2d');
    const segmentedCtx = segmentedCanvas.getContext('2d');
    const hitCtx = hitCanvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = `/uploads/${selectedSample.image_filename}`;

    img.onload = () => {
      [originalCanvas, segmentedCanvas, hitCanvas].forEach(c => {
        if(c) { c.width = img.width; c.height = img.height; }
      });
      setCanvasSize({ width: img.width, height: img.height });
      originalCtx.drawImage(img, 0, 0);
      segmentedCtx.fillStyle = 'black';
      segmentedCtx.fillRect(0, 0, segmentedCanvas.width, segmentedCanvas.height);
      hitCtx.clearRect(0, 0, hitCanvas.width, hitCanvas.height);

      contoursToDraw.forEach((contour, index) => {
        const grainId = selectedSample.results?.measurements?.[index]?.grain_id || index + 1;
        const isHighlighted = grainId === highlightedGrainId && !isEditing;
        segmentedCtx.beginPath();
        segmentedCtx.moveTo(contour[0][0][0], contour[0][0][1]);
        for (let i = 1; i < contour.length; i++) {
          segmentedCtx.lineTo(contour[i][0][0], contour[i][0][1]);
        }
        segmentedCtx.closePath();
        if (isHighlighted) {
          segmentedCtx.fillStyle = 'rgba(255, 255, 0, 0.5)';
          segmentedCtx.fill();
        }
        segmentedCtx.strokeStyle = isEditing ? 'cyan' : 'white';
        segmentedCtx.lineWidth = 1;
        segmentedCtx.stroke();
        if (isEditing) {
          const color = generateColor(index);
          hitCtx.beginPath();
          hitCtx.moveTo(contour[0][0][0], contour[0][0][1]);
          for (let i = 1; i < contour.length; i++) {
            hitCtx.lineTo(contour[i][0][0], contour[i][0][1]);
          }
          hitCtx.closePath();
          hitCtx.fillStyle = color;
          hitCtx.fill();
        }
      });
    };
  }, [selectedSample, highlightedGrainId, isEditing, localContours]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className="App">
      <header className="App-header"><h1>Metallographic Analysis</h1></header>
      <main>
        <div className="main-layout">
          <div className="project-sidebar">
            <ProjectList onProjectSelect={handleProjectSelect} selectedProject={selectedProject} />
          </div>
          <div className="analysis-view">
            {selectedProject ? (
              <div className="project-workspace">
                <div className="sample-sidebar">
                  <h3>{selectedProject.name}</h3>
                  <AddSampleForm project={selectedProject} onSampleAdded={handleSampleAdded} />
                  <SampleList project={selectedProject} onSampleSelect={handleSampleSelect} newSample={newSample} selectedSample={selectedSample} />
                </div>
                <div className="canvas-area">
                  {selectedSample ? (
                    <>
                      {!isEditing ? (
                        <div className="controls-bar">
                          <Calibration sample={selectedSample} onCalibrationUpdate={handleCalibrationUpdate} originalCanvas={originalCanvasRef.current} canvasSize={canvasSize} />
                          <div className="measure-control">
                            <button onClick={handleMeasure} disabled={!selectedSample.scale_pixels_per_mm || isLoading}>
                              {isLoading ? 'Calculating...' : 'Calculate Measurements'}
                            </button>
                            {!selectedSample.scale_pixels_per_mm && <small>Calibration required</small>}
                          </div>
                          <button onClick={handleEnterEditMode} className="edit-btn">Manual Edit</button>
                          <div className="astm-control">
                              <button onClick={handleAstmCalculation} disabled={!selectedSample.results?.measurements || isLoading}>
                                  ASTM E112
                              </button>
                              {selectedSample.results?.astm_g && (
                                <span className="astm-result">
                                  G = {selectedSample.results.astm_g.toFixed(2)}
                                </span>
                              )}
                              {!selectedSample.results?.measurements && <small>Measurements required</small>}
                          </div>
                          <MultiphaseAnalysis sample={selectedSample} onCalculate={handleMultiphaseAnalysis} isLoading={isLoading} />
                          <div className="export-control">
                              <button onClick={() => window.open(`${API_URL}/api/samples/${selectedSample.id}/export/csv`)} disabled={!selectedSample.results?.measurements}>
                                  Export CSV
                              </button>
                          </div>
                        </div>
                      ) : (
                        <EditorToolbar activeTool={activeTool} onToolSelect={setActiveTool} onSave={handleSaveEdit} onCancel={handleCancelEdit} isSaving={isLoading} />
                      )}

                      {error && <p className="error-message">{error}</p>}
                      <div className="image-display">
                        <div className="canvas-wrapper">
                          <h4>Original Image: {selectedSample.name}</h4>
                          <canvas ref={originalCanvasRef}></canvas>
                          <div id="calibration-portal-target"></div>
                        </div>
                        <div>
                          <h4>Segmented Image {isEditing && <span className="editing-indicator">(Editing)</span>}</h4>
                          <canvas ref={segmentedCanvasRef} onClick={isEditing ? handleCanvasClickForEdit : null} className={isEditing ? 'editing' : ''}></canvas>
                          <canvas ref={hitCanvasRef} style={{ display: 'none' }} />
                        </div>
                      </div>
                      {selectedSample.results?.measurements && !isEditing && (
                        <div className="results-display">
                          <MeasurementTable measurements={selectedSample.results.measurements} onGrainHover={setHighlightedGrainId} />
                          <HistogramChart measurements={selectedSample.results.measurements} />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="placeholder"><h2>No sample selected</h2><p>Add a new sample or select one from the list.</p></div>
                  )}
                </div>
              </div>
            ) : (
              <div className="placeholder"><h2>Select a project to start</h2><p>Choose a project from the list on the left, or create a new one.</p></div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
