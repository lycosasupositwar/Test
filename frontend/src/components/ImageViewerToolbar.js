import React from 'react';
import './ImageViewerToolbar.css';

const ImageViewerToolbar = ({ onZoomIn, onZoomOut, onReset, onRotate }) => {
  return (
    <div className="image-viewer-toolbar">
      <button onClick={onZoomIn} title="Zoom In">🔍+</button>
      <button onClick={onZoomOut} title="Zoom Out">🔍-</button>
      <button onClick={onReset} title="Reset View">🔄</button>
      <button onClick={onRotate} title="Rotate">↪️</button>
    </div>
  );
};

export default ImageViewerToolbar;
