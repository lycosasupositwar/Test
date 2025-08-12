import React, { useState } from 'react';
import axios from 'axios';
import './AddSampleForm.css';

const API_URL = 'http://backend:5000/api';

function AddSampleForm({ project, onSampleAdded }) {
  const [sampleName, setSampleName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleAddSample = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select an image file.');
      return;
    }
    if (!sampleName.trim()) {
      setError('Please enter a name for the sample.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('name', sampleName);

    try {
      setIsUploading(true);
      setError('');
      const response = await axios.post(`${API_URL}/projects/${project.id}/samples`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      onSampleAdded(response.data);
      // Reset form
      setSampleName('');
      setSelectedFile(null);
      if (document.getElementById('file-input')) {
        document.getElementById('file-input').value = '';
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add sample.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="add-sample-form-container">
      <h4>Add New Sample</h4>
      <form onSubmit={handleAddSample}>
        <input
          type="text"
          placeholder="Sample Name"
          value={sampleName}
          onChange={(e) => setSampleName(e.target.value)}
          required
        />
        <input
          type="file"
          id="file-input"
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/bmp,image/tiff"
          required
        />
        <button type="submit" disabled={isUploading}>
          {isUploading ? 'Uploading...' : 'Add and Segment'}
        </button>
      </form>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default AddSampleForm;
