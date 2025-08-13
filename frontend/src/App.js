import React, { useState, useEffect, useContext } from 'react';
import { ThemeContext } from './contexts/ThemeContext';

import './App.css';

import Header from './components/Header';
import Footer from './components/Footer';
import ImageExplorer from './components/ImageExplorer';
import ImportModal from './components/ImportModal';
import ImageViewer from './components/ImageViewer';
import AnalysisPanel from './components/AnalysisPanel';

import axios from 'axios';

function App() {
  const { theme } = useContext(ThemeContext);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSample, setSelectedSample] = useState(null);
  const [analysisParams, setAnalysisParams] = useState(null);
  const [previewContours, setPreviewContours] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);

  // This is a bit of a hack to force the ImageExplorer to refetch samples.
  // A better solution would be a more robust state management library.
  const [sampleAddedToken, setSampleAddedToken] = useState(0);

  useEffect(() => {
    if (analysisParams && selectedSample) {
      setIsLoadingPreview(true);
      axios.post(`/api/samples/${selectedSample.id}/preview_segmentation`, analysisParams)
        .then(response => {
          setPreviewContours(response.data.contours);
        })
        .catch(console.error)
        .finally(() => setIsLoadingPreview(false));
    }
  }, [analysisParams, selectedSample]);

  const handleSampleSelect = (sample) => {
    setSelectedSample(sample);
    setPreviewContours(null); // Clear preview when sample changes
  };

  const handleSampleAdded = (newSample) => {
    setImportModalOpen(false);
    setSelectedSample(newSample);
    setSampleAddedToken(t => t + 1); // Trigger refetch
  };

  const handleExportAnnotatedImage = () => {
    if (!selectedSample) return;
    const contours = previewContours || selectedSample.results?.contours;
    if (!contours) {
      alert('No contours to export.');
      return;
    }
    axios.post(`/api/samples/${selectedSample.id}/export/annotated_image`, { contours }, { responseType: 'blob' })
      .then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `sample_${selectedSample.id}_annotated.jpg`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch(console.error);
  };

  const handleExportCsv = () => {
    if (!selectedSample) return;
    if (!selectedSample.results?.measurements) {
        alert('No measurement data to export. Please run analysis first.');
        return;
    }
    window.open(`/api/samples/${selectedSample.id}/export/csv`);
  };

  return (
    <div className={`App ${theme}`}>
      <Header
        onImportClick={() => setImportModalOpen(true)}
        onExportAnnotatedImage={handleExportAnnotatedImage}
        onExportCsv={handleExportCsv}
      />
      <main className="main-content">
        <div className="left-sidebar">
          <ImageExplorer
            onProjectSelect={setSelectedProject}
            onSampleSelect={handleSampleSelect}
            refreshSamplesToken={sampleAddedToken}
          />
        </div>
        <div className="center-panel">
          <ImageViewer sample={selectedSample} previewContours={previewContours} />
        </div>
        <div className="right-sidebar">
          <AnalysisPanel
            sample={selectedSample}
            onParamsChange={setAnalysisParams}
            isLoading={isLoadingPreview}
          />
        </div>
      </main>
      <Footer />
      {isImportModalOpen && (
        <ImportModal
          project={selectedProject}
          onSampleAdded={handleSampleAdded}
          onClose={() => setImportModalOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
