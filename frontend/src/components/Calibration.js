import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Calibration.css';

const API_URL = 'http://backend:5000/api';

function Calibration({ sample, onCalibrationUpdate, originalCanvas }) {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [points, setPoints] = useState([]);
  const [error, setError] = useState('');
  const overlayCanvasRef = useRef(null);

  useEffect(() => {
    if (isCalibrating && originalCanvas) {
      const overlay = overlayCanvasRef.current;
      const ctx = overlay.getContext('2d');
      overlay.width = originalCanvas.width;
      overlay.height = originalCanvas.height;
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.fill();
      });

      if (points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [points, isCalibrating, originalCanvas]);

  const handleCanvasClick = (event) => {
    if (!isCalibrating || points.length >= 2 || !originalCanvas) return;

    const canvas = overlayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const newPoints = [...points, { x, y }];
    setPoints(newPoints);

    if (newPoints.length === 2) {
      calculateAndSaveScale(newPoints);
    }
  };

  const calculateAndSaveScale = async (currentPoints) => {
    const realDistanceStr = prompt("Enter the real-world distance between the points (in mm):");
    if (!realDistanceStr) {
      resetCalibration();
      return;
    }

    const realDistance = parseFloat(realDistanceStr);
    if (isNaN(realDistance) || realDistance <= 0) {
      alert("Invalid distance. Please enter a positive number.");
      resetCalibration();
      return;
    }

    const pixelDistance = Math.sqrt(
      Math.pow(currentPoints[1].x - currentPoints[0].x, 2) +
      Math.pow(currentPoints[1].y - currentPoints[0].y, 2)
    );

    const scale = pixelDistance / realDistance;

    try {
      setError('');
      const response = await axios.post(`${API_URL}/samples/${sample.id}/calibrate`, {
        scale_pixels_per_mm: scale,
      });
      alert(`Scale saved successfully: ${scale.toFixed(2)} pixels/mm`);
      onCalibrationUpdate(response.data);
      resetCalibration();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save scale.');
      console.error(err);
      resetCalibration();
    }
  };

  const toggleCalibration = () => {
    if (isCalibrating) {
      resetCalibration();
    } else {
      setIsCalibrating(true);
    }
  };

  const resetCalibration = () => {
    setIsCalibrating(false);
    setPoints([]);
    const overlay = overlayCanvasRef.current;
    if (overlay) {
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
  };

  return (
    <div className="calibration-container">
      <div>
        {sample.scale_pixels_per_mm ? (
          <p>Current Scale: {sample.scale_pixels_per_mm.toFixed(2)} px/mm</p>
        ) : (
          <p>No scale set.</p>
        )}
        <button onClick={toggleCalibration}>
          {isCalibrating ? 'Cancel' : 'Set Scale'}
        </button>
      </div>
      {isCalibrating && <p className="calibration-instructions">Click two points on the original image.</p>}
      {error && <p className="error-message">{error}</p>}

      {isCalibrating &&
        <canvas
          ref={overlayCanvasRef}
          onClick={handleCanvasClick}
          className="calibration-overlay"
        />
      }
    </div>
  );
}

export default Calibration;
