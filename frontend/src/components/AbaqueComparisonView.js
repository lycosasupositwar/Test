import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './AbaqueComparisonView.css';

const API_URL = "/api";

function AbaqueComparisonView({ sample, onSelect, onClose }) {
  const [gValues, setGValues] = useState([4, 5, 6, 7]);
  const [charts, setCharts] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [overlay, setOverlay] = useState({ src: null, g: null });
  const [opacity, setOpacity] = useState(0.5);
  const canvasRef = useRef(null);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sample) return;
    const ctx = canvas.getContext('2d');

    const sampleImg = new Image();
    sampleImg.crossOrigin = "Anonymous";
    sampleImg.src = `/uploads/${sample.image_filename}`;

    sampleImg.onload = () => {
        canvas.width = sampleImg.width;
        canvas.height = sampleImg.height;
        ctx.drawImage(sampleImg, 0, 0);

        if (overlay.src) {
            const overlayImg = new Image();
            overlayImg.crossOrigin = "Anonymous";
            overlayImg.src = overlay.src;
            overlayImg.onload = () => {
                ctx.globalAlpha = opacity;

                const canvasRatio = canvas.width / canvas.height;
                const overlayRatio = overlayImg.width / overlayImg.height;
                let destWidth, destHeight, destX, destY;

                if (canvasRatio > overlayRatio) { // Canvas is wider than overlay
                    destHeight = canvas.height;
                    destWidth = destHeight * overlayRatio;
                } else { // Canvas is taller or same aspect ratio
                    destWidth = canvas.width;
                    destHeight = destWidth / overlayRatio;
                }

                destX = (canvas.width - destWidth) / 2;
                destY = (canvas.height - destHeight) / 2;

                ctx.drawImage(overlayImg, destX, destY, destWidth, destHeight);
                ctx.globalAlpha = 1.0; // Reset alpha
            };
        }
    };
  }, [sample, overlay, opacity]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  useEffect(() => {
    const fetchCharts = async () => {
      if (!sample) return;
      setIsLoading(true);
      setError('');
      try {
        const response = await axios.post(`${API_URL}/samples/${sample.id}/astm-chart`, {
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
  }, [sample, gValues]);

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

  const handleChartClick = (g, src) => {
    setOverlay({ src, g });
  };

  return (
    <div className="abaque-comparison-container">
        {/* Main Image in the center */}
        <div className="abaque-main-image-wrapper">
            <canvas ref={canvasRef}></canvas>
        </div>

        {/* Surrounding Charts */}
        {gValues.map((g, index) => (
            <div key={g} className={`abaque-chart-item pos-${index + 1}`} onClick={() => handleChartClick(g, charts[g])}>
                {isLoading ? (
                    <div className="loading-spinner"></div>
                ) : (
                    charts[g] && <>
                        <img src={charts[g]} alt={`ASTM Grain Size G=${g}`} />
                        <div className="chart-title">G = {g}</div>
                    </>
                )}
            </div>
        ))}

        <div className="abaque-controls">
            <div className="navigation-controls">
                <button onClick={handlePrev} disabled={gValues[0] <= 1}>Previous G-Values</button>
                <button onClick={handleNext}>Next G-Values</button>
            </div>
            <div className="opacity-control">
                <label htmlFor="opacity-slider">Overlay Opacity:</label>
                <input
                    type="range"
                    id="opacity-slider"
                    min="0"
                    max="1"
                    step="0.05"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                />
            </div>
            <button onClick={() => onSelect(overlay.g)} disabled={!overlay.g}>Validate G = {overlay.g}</button>
            <button onClick={onClose}>Hide Viewer</button>
        </div>
    </div>
  );
}

export default AbaqueComparisonView;
