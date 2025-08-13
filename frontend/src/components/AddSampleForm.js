import React, { useState, useCallback } from 'react';
import axios from 'axios';
import './AddSampleForm.css';

const API_URL = "/api";

function AddSampleForm({ project, onSampleAdded }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback((selectedFile) => {
    if (selectedFile) {
      setFile(selectedFile);
      // Auto-fill name field if it's empty
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    }
  }, [name]);

  const handleFileChange = (e) => {
    handleFileSelect(e.target.files[0]);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an image file.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter a name for the sample.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name.trim());

    try {
      setIsUploading(true);
      setError('');
      const response = await axios.post(`${API_URL}/projects/${project.id}/samples`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSampleAdded(response.data);
      // Reset form
      setName('');
      setFile(null);
    } catch (err)
      setError(err.response?.data?.error || 'Failed to add sample.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="add-sample-form-container">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="sample-name">Sample Name</label>
          <input
            type="text"
            id="sample-name"
            placeholder="Enter sample name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {file ? (
            <p className="file-name-display">Selected file: {file.name}</p>
          ) : (
            <p>Drag & drop an image file here, or click to select</p>
          )}
          <input
            type="file"
            id="sample-file-input"
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/bmp,image/tiff"
            style={{ display: 'none' }}
          />
          <label htmlFor="sample-file-input" className="browse-files-label">
            Browse Files
          </label>
        </div>
        <button type="submit" disabled={isUploading || !file}>
          {isUploading ? 'Uploading...' : 'Add and Segment'}
        </button>
      </form>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default AddSampleForm;
