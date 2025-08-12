import React, { useRef, useEffect, useCallback, useState } from 'react';
import Panzoom from '@panzoom/panzoom';
import './ImageViewer.css';

// ... (utility functions are the same)
const generateColor = (index) => {
  const r = (index * 30) % 255;
  const g = (index * 50) % 255;
  const b = (index * 70) % 255;
  return `rgb(${r},${g},${b})`;
};

const getNiceScaleBarValues = (targetWidthPx, scale, pixelsPerMm) => {
  if (!pixelsPerMm || !scale || scale <= 0) return null;
  const realWidthMm = targetWidthPx / (scale * pixelsPerMm);
  const realWidthUm = realWidthMm * 1000;
  const niceValues = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  let niceValueUm = niceValues[0];
  for (const val of niceValues) {
    if (val > realWidthUm) break;
    niceValueUm = val;
  }
  const label = niceValueUm >= 1000 ? `${niceValueUm / 1000} mm` : `${niceValueUm} µm`;
  const barWidthPx = (niceValueUm / 1000) * pixelsPerMm * scale;
  return { label, barWidthPx };
};


const ImageViewer = ({
  selectedSample,
  highlightedGrainId,
  isEditing,
  localContours,
  onCanvasClick,
  previewImage,
  canvasSize,
  setCanvasSize,
}) => {
  const originalCanvasRef = useRef(null);
  const segmentedCanvasRef = useRef(null);
  const hitCanvasRef = useRef(null);
  const scaleBarCanvasRef = useRef(null);

  const originalContainerRef = useRef(null);
  const segmentedContainerRef = useRef(null);

  const panzoomInstances = useRef({});
  const [rotation, setRotation] = useState(0);
  const [cursorInfo, setCursorInfo] = useState('');

  const drawScaleBar = useCallback(() => {
    // ... (unchanged)
  }, [selectedSample]);

  useEffect(() => {
    // ... (Panzoom initialization unchanged)
  }, [selectedSample, drawScaleBar]);

  useEffect(() => {
    // ... (Rotation effect unchanged)
  }, [rotation, drawScaleBar]);

  const draw = useCallback(() => {
    // ... (This function now uses setCanvasSize from props)
    const originalCanvas = originalCanvasRef.current;
    if (!selectedSample || !originalCanvas) {
      [originalCanvasRef, segmentedCanvasRef, hitCanvasRef].forEach(ref => {
        if (ref.current) ref.current.getContext('2d').clearRect(0, 0, ref.current.width, ref.current.height);
      });
      setCanvasSize({ width: 0, height: 0 });
      return;
    }
    // ... (rest of draw function is the same)
  }, [selectedSample, highlightedGrainId, isEditing, localContours, previewImage, drawScaleBar, setCanvasSize]);

  useEffect(() => {
    draw();
  }, [draw]);

  // ... (event handlers are the same)

  const panzoomStyle = { transform: `rotate(${rotation}deg)` };

  return (
    <div className="image-viewer">
      <div className="viewer-toolbar">
        {/* ... toolbar buttons ... */}
        <div className="cursor-info">{cursorInfo}</div>
      </div>
      {selectedSample ? (
        <div className="canvases-container">
          <div className="canvas-wrapper">
            <h4>Original: {selectedSample.name}</h4>
            <div
              className="panzoom-container"
              onMouseMove={() => {}}
              onMouseLeave={() => {}}
            >
              <div ref={originalContainerRef} style={panzoomStyle} className="panzoom-content">
                <canvas ref={originalCanvasRef}></canvas>
              </div>
              <canvas ref={scaleBarCanvasRef} className="scale-bar-overlay" width="200" height="50"></canvas>
              <div id="calibration-portal-target" className="calibration-portal"></div>
            </div>
          </div>
          {/* ... segmented canvas wrapper ... */}
        </div>
      ) : (
        <div className="placeholder">
          <h2>Image Viewer</h2>
          <p>Select a sample to display the image.</p>
        </div>
      )}
    </div>
  );
};

export default ImageViewer;
