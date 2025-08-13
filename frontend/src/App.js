import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Desktop.css';
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
  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState(null);
  const [highlightedGrainId, setHighlightedGrainId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [activeTool, setActiveTool] = useState('delete');
  const [localContours, setLocalContours] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [panels, setPanels] = useState({
    projectList: {
      isOpen: true,
      position: { x: 20, y: 140 },
      size: { width: 300, height: 400 }
    },
    sampleList: {
      isOpen: false,
      position: { x: 340, y: 140 },
      size: { width: 300, height: 400 }
    },
    imageDisplay: {
      isOpen: false,
      position: { x: 660, y: 140 },
      size: { width: 800, height: 600 }
    },
    results: {
      isOpen: false,
      position: { x: 340, y: 560 },
      size: { width: 300, height: 300 }
    }
  });

  const originalCanvasRef = useRef(null);
  const segmentedCanvasRef = useRef(null);
  const hitCanvasRef = useRef(null);

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setSamples([]);
    setSelectedSample(null);
    setIsEditing(false);
    setPanels(prev => ({
      ...prev,
      sampleList: { ...prev.sampleList, isOpen: true },
      imageDisplay: { ...prev.imageDisplay, isOpen: false },
      results: { ...prev.results, isOpen: false }
    }));
  };

  useEffect(() => {
    document.body.style.margin = '0';
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
    setPanels(prev => ({
      ...prev,
      imageDisplay: { ...prev.imageDisplay, isOpen: true },
      results: { ...prev.results, isOpen: !!sample.results?.measurements }
    }));
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

  const togglePanel = (panelName) => {
    setPanels(prev => ({
      ...prev,
      [panelName]: { ...prev[panelName], isOpen: !prev[panelName].isOpen }
    }));
  };

  const renderPanel = (name, title, content) => {
    const panel = panels[name];
    if (!panel.isOpen) return null;

    return (
      <div className="window" style={{
        position: 'absolute',
        left: panel.position.x,
        top: panel.position.y,
        width: panel.size.width,
        height: panel.size.height
      }}>
        <div className="title-bar">
          <div className="title-bar-text">{title}</div>
          <div className="title-bar-controls">
            <button aria-label="Minimize"></button>
            <button aria-label="Maximize"></button>
            <button aria-label="Close" onClick={() => togglePanel(name)}></button>
          </div>
        </div>
        <div className="window-body">
          {content}
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Metallographic Analysis</h1>
        <div className="controls-bar">
          <button onClick={handleMeasure} disabled={!selectedSample || !selectedSample.scale_pixels_per_mm || isLoading}>
            {isLoading ? 'Calculating...' : 'Measure'}
          </button>
          <button onClick={handleEnterEditMode} disabled={!selectedSample?.results?.contours} className="edit-btn">Edit</button>
          <button onClick={handleAstmCalculation} disabled={!selectedSample?.results?.measurements || isLoading}>
            ASTM E112
          </button>
          <MultiphaseAnalysis sample={selectedSample} onCalculate={handleMultiphaseAnalysis} isLoading={isLoading} />
          <button onClick={() => window.open(`${API_URL}/api/samples/${selectedSample.id}/export/csv`)} disabled={!selectedSample?.results?.measurements}>
            Export CSV
          </button>
        </div>
      </header>
      <main>
        {renderPanel('projectList', 'Projects', <ProjectList onProjectSelect={handleProjectSelect} selectedProject={selectedProject} />)}

        {selectedProject && renderPanel('sampleList', `Samples - ${selectedProject.name}`, (
          <>
            <AddSampleForm project={selectedProject} onSampleAdded={handleSampleAdded} />
            <SampleList
              samples={samples}
              onSampleSelect={handleSampleSelect}
              selectedSample={selectedSample}
              onSampleDeleted={handleSampleDeleted}
            />
          </>
        ))}

        {selectedSample && renderPanel('imageDisplay', `Image - ${selectedSample.name}`, (
          <>
            {isEditing && <EditorToolbar activeTool={activeTool} onToolSelect={setActiveTool} onSave={handleSaveEdit} onCancel={handleCancelEdit} isSaving={isLoading} />}
            {error && <p className="error-message">{error}</p>}
            <div className="image-display">
              <div className="canvas-wrapper">
                <canvas ref={originalCanvasRef}></canvas>
                <div id="calibration-portal-target"></div>
              </div>
              <div>
                <canvas ref={segmentedCanvasRef} onClick={isEditing ? handleCanvasClickForEdit : null} className={isEditing ? 'editing' : ''}></canvas>
                <canvas ref={hitCanvasRef} style={{ display: 'none' }} />
              </div>
            </div>
            <Calibration sample={selectedSample} onCalibrationUpdate={handleCalibrationUpdate} originalCanvas={originalCanvasRef.current} canvasSize={canvasSize} />
          </>
        ))}

        {selectedSample?.results?.measurements && !isEditing && renderPanel('results', 'Results', (
          <div className="results-display">
            <MeasurementTable measurements={selectedSample.results.measurements} onGrainHover={setHighlightedGrainId} />
            <HistogramChart measurements={selectedSample.results.measurements} />
          </div>
        ))}
      </main>
    </div>
  );
}

export default App;
