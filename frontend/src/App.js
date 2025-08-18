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
import ASTMChart from './components/ASTMChart';
import './components/ASTMChart.css';

const API_URL = "/api";

const generateColor = (index) => {
  const r = (index * 30) % 255;
  const g = (index * 50) % 255;
  const b = (index * 70) % 255;
  return `rgb(${r},${g},${b})`;
};

function App() {
  const [selectedProject, setSelectedProject] = useState(null);
  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState(null);
  const [highlightedGrainId, setHighlightedGrainId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [activeTool, setActiveTool] = useState('delete');
  const [localContours, setLocalContours] = useState([]);
  const [isInterceptToolActive, setIsInterceptToolActive] = useState(false);
  const [interceptMarks, setInterceptMarks] = useState([]);
  const [astmChartUrl, setAstmChartUrl] = useState(null);

  const originalCanvasRef = useRef(null);
  const segmentedCanvasRef = useRef(null);
  const hitCanvasRef = useRef(null);
  const testLinesRef = useRef([]);

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setSamples([]);
    setSelectedSample(null);
    setIsEditing(false);
  };

  useEffect(() => {
    if (selectedProject) {
      setIsLoading(true);
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
    }
  }, [selectedProject]);

  const handleSampleSelect = (sample) => {
    setSelectedSample(sample);
    setIsEditing(false);
    setAstmChartUrl(null);
  };

  const handleSampleAdded = (addedSample) => {
    setSamples([addedSample, ...samples]);
    setSelectedSample(addedSample);
  };

  const handleSampleDeleted = (deletedSampleId) => {
    setSamples(samples.filter(s => s.id !== deletedSampleId));
    if (selectedSample && selectedSample.id === deletedSampleId) {
      setSelectedSample(null);
    }
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

  const handleInterceptCalculation = async () => {
    if (!selectedSample || testLinesRef.current.length === 0) return;

    const totalLengthPx = testLinesRef.current.reduce((acc, line) => {
        return acc + Math.sqrt((line.endX - line.startX)**2 + (line.endY - line.startY)**2);
    }, 0);

    const totalIntercepts = interceptMarks.length;

    if (totalIntercepts === 0) {
        alert("Please mark the intercepts on the test lines before calculating.");
        return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/api/samples/${selectedSample.id}/astm-e112-intercept`, {
        total_line_length_px: totalLengthPx,
        total_intercepts: totalIntercepts,
      });
      // Update sample with new ASTM value from intercept method
      setSelectedSample(prev => ({
        ...prev,
        results: {
          ...prev.results,
          astm_g_intercept: response.data.astm_g_intercept,
        }
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to calculate ASTM grain size by intercept.');
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

  const handleGenerateASTMChart = async () => {
    if (!selectedSample) return;
    const magnificationStr = prompt("Enter image magnification for chart generation (e.g., 100):");
    if (!magnificationStr) return;
    const magnification = parseFloat(magnificationStr);
    if (isNaN(magnification) || magnification <= 0) {
      alert("Invalid magnification.");
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.post(
        `${API_URL}/api/samples/${selectedSample.id}/astm-chart`,
        { magnification },
        { responseType: 'blob' }
      );
      const imageUrl = URL.createObjectURL(response.data);
      setAstmChartUrl(imageUrl);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate ASTM chart.');
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

  const toggleInterceptTool = () => {
    setIsInterceptToolActive(!isInterceptToolActive);
    // Reset editing mode when entering/exiting intercept mode
    setIsEditing(false);
    setInterceptMarks([]); // Clear marks when toggling mode
  };

  const handleCanvasClickForIntercept = (event) => {
    const canvas = originalCanvasRef.current;
    if (!canvas || !isInterceptToolActive) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const CLICK_THRESHOLD = 10; // 10px tolerance

    for (const line of testLinesRef.current) {
      const isHorizontal = line.startY === line.endY;
      const isVertical = line.startX === line.endX;

      if (isHorizontal) {
        if (x >= line.startX && x <= line.endX && Math.abs(y - line.startY) < CLICK_THRESHOLD) {
          setInterceptMarks(prev => [...prev, { x, y, lineType: 'h' }]);
          return;
        }
      } else if (isVertical) {
        if (y >= line.startY && y <= line.endY && Math.abs(x - line.startX) < CLICK_THRESHOLD) {
          setInterceptMarks(prev => [...prev, { x, y, lineType: 'v' }]);
          return;
        }
      }
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
      if (!hitCanvasRef.current) return;
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
    const originalCanvas = originalCanvasRef.current;
    if (!selectedSample) {
        if(originalCanvas) {
            const ctx = originalCanvas.getContext('2d');
            ctx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
        }
        return;
    }

    const hitCanvas = hitCanvasRef.current;
    const originalCtx = originalCanvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = `/uploads/${selectedSample.image_filename}`;

    img.onload = () => {
      originalCanvas.width = img.width;
      originalCanvas.height = img.height;
      if (hitCanvas) {
        hitCanvas.width = img.width;
        hitCanvas.height = img.height;
      }
      originalCtx.drawImage(img, 0, 0);

      const contoursToDraw = isEditing ? localContours : selectedSample?.results?.contours;

      if (contoursToDraw) {
        if (isEditing && hitCanvas) {
            const hitCtx = hitCanvas.getContext('2d');
            hitCtx.clearRect(0, 0, hitCanvas.width, hitCanvas.height);

            contoursToDraw.forEach((contour, index) => {
                originalCtx.beginPath();
                originalCtx.moveTo(contour[0][0][0], contour[0][0][1]);
                for (let i = 1; i < contour.length; i++) {
                    originalCtx.lineTo(contour[i][0][0], contour[i][0][1]);
                }
                originalCtx.closePath();
                originalCtx.strokeStyle = 'cyan';
                originalCtx.lineWidth = 1;
                originalCtx.stroke();

                const color = generateColor(index);
                hitCtx.beginPath();
                hitCtx.moveTo(contour[0][0][0], contour[0][0][1]);
                for (let i = 1; i < contour.length; i++) {
                    hitCtx.lineTo(contour[i][0][0], contour[i][0][1]);
                }
                hitCtx.closePath();
                hitCtx.fillStyle = color;
                hitCtx.fill();
            });
        } else if (!isEditing) {
            contoursToDraw.forEach(contour => {
                originalCtx.beginPath();
                originalCtx.moveTo(contour[0][0][0], contour[0][0][1]);
                for (let i = 1; i < contour.length; i++) {
                    originalCtx.lineTo(contour[i][0][0], contour[i][0][1]);
                }
                originalCtx.closePath();
                originalCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                originalCtx.lineWidth = 1;
                originalCtx.stroke();
            });
        }
      }

      if (isInterceptToolActive) {
        const { width, height } = img;
        const newTestLines = [
            { startX: 0, startY: height / 2, endX: width, endY: height / 2 },
            { startX: width / 2, startY: 0, endX: width / 2, endY: height },
        ];
        testLinesRef.current = newTestLines;

        originalCtx.strokeStyle = 'red';
        originalCtx.lineWidth = 2;
        originalCtx.globalAlpha = 0.8;
        testLinesRef.current.forEach(line => {
            originalCtx.beginPath();
            originalCtx.moveTo(line.startX, line.startY);
            originalCtx.lineTo(line.endX, line.endY);
            originalCtx.stroke();
        });
        originalCtx.globalAlpha = 1.0;

        originalCtx.strokeStyle = 'cyan';
        originalCtx.lineWidth = 2;
        const MARK_LENGTH = 10;
        interceptMarks.forEach(mark => {
            originalCtx.beginPath();
            if (mark.lineType === 'h') {
                originalCtx.moveTo(mark.x, mark.y - MARK_LENGTH / 2);
                originalCtx.lineTo(mark.x, mark.y + MARK_LENGTH / 2);
            } else {
                originalCtx.moveTo(mark.x - MARK_LENGTH / 2, mark.y);
                originalCtx.lineTo(mark.x + MARK_LENGTH / 2, mark.y);
            }
            originalCtx.stroke();
        });
      } else {
        testLinesRef.current = [];
      }
    };
  }, [selectedSample, isEditing, localContours, isInterceptToolActive, interceptMarks]);

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
                  <SampleList
                    samples={samples}
                    onSampleSelect={handleSampleSelect}
                    selectedSample={selectedSample}
                    onSampleDeleted={handleSampleDeleted}
                  />
                </div>
                <div className="canvas-area">
                  {selectedSample ? (
                    <>
                      {!isEditing && (
                        <div className="controls-bar">
                          <Calibration sample={selectedSample} onCalibrationUpdate={handleCalibrationUpdate} originalCanvas={originalCanvasRef.current} />
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
                           <div className="astm-control">
                              <button onClick={handleGenerateASTMChart} disabled={isLoading || !selectedSample}>
                                  ASTM Comparison Chart
                              </button>
                          </div>
                          <div className="intercept-mode-control">
                            <button onClick={toggleInterceptTool} disabled={!selectedSample}>
                              {isInterceptToolActive ? "Exit Intercept Test" : "Start Intercept Test"}
                            </button>
                          </div>
                          {isInterceptToolActive && (
                            <>
                              <button onClick={() => setInterceptMarks([])} disabled={interceptMarks.length === 0}>Clear Marks</button>
                              <button onClick={handleInterceptCalculation} disabled={interceptMarks.length === 0 || isLoading}>
                                  {isLoading ? 'Calculating...' : 'Calculate ASTM G'}
                              </button>
                              <span>Total Intercepts: {interceptMarks.length}</span>
                              {selectedSample?.results?.astm_g_intercept && (
                                  <span className="astm-result">
                                      G (Intercept) = {selectedSample.results.astm_g_intercept.toFixed(2)}
                                  </span>
                              )}
                            </>
                          )}
                          <MultiphaseAnalysis sample={selectedSample} onCalculate={handleMultiphaseAnalysis} isLoading={isLoading} />
                          <div className="export-control">
                              <button onClick={() => window.open(`${API_URL}/api/samples/${selectedSample.id}/export/csv`)} disabled={!selectedSample.results?.measurements}>
                                  Export CSV
                              </button>
                          </div>
                        </div>
                      )}
                      {isEditing && (
                        <EditorToolbar
                          activeTool={activeTool}
                          onToolSelect={setActiveTool}
                          onSave={handleSaveEdit}
                          onCancel={handleCancelEdit}
                          isSaving={isLoading}
                        />
                      )}

                      {error && <p className="error-message">{error}</p>}
                      <div className="canvas-wrapper single-view">
                          <h4>Original Image: {selectedSample.name}</h4>
                          <canvas
                            ref={originalCanvasRef}
                            onClick={
                              isInterceptToolActive ? handleCanvasClickForIntercept :
                              isEditing ? handleCanvasClickForEdit : null
                            }
                            className={isInterceptToolActive || isEditing ? 'editing' : ''}
                          ></canvas>
                          <canvas ref={hitCanvasRef} style={{ display: 'none' }} />
                          <div id="calibration-portal-target"></div>
                      </div>
                      {selectedSample.results?.measurements && !isEditing && (
                        <div className="results-display">
                          <MeasurementTable measurements={selectedSample.results.measurements} onGrainHover={setHighlightedGrainId} />
                          <HistogramChart measurements={selectedSample.results.measurements} />
                          <ASTMChart chartUrl={astmChartUrl} />
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
