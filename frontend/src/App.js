import React, { useState } from 'react';
import './App.css';
import Header from './components/Header';
import Footer from './components/Footer';
import ImageExplorer from './components/ImageExplorer';
import ImageViewer from './components/ImageViewer';
import AnalysisSidebar from './components/AnalysisSidebar';
import { useAuth } from './hooks/useAuth';
import AuthPage from './pages/AuthPage';

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  // State for the main application
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSample, setSelectedSample] = useState(null);
  const [highlightedGrainId, setHighlightedGrainId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTool, setActiveTool] = useState('delete');
  const [localContours, setLocalContours] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // State for API calls within the main app
  const [isAppLoading, setIsAppLoading] = useState(false);
  const [appError, setAppError] = useState('');


  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setSelectedSample(null);
    setIsEditing(false);
    setPreviewImage(null);
  };

  const handleSampleSelect = (sample) => {
    setSelectedSample(sample);
    setIsEditing(false);
    setPreviewImage(null);
  };

  const handleSampleUpdate = (updatedSample) => {
    setSelectedSample(updatedSample);
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

  if (isLoading) {
    return <div>Loading application...</div>;
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="App">
      <Header selectedSample={selectedSample} />
      <main className="main-workspace">
        <ImageExplorer
          onProjectSelect={handleProjectSelect}
          onSampleSelect={handleSampleSelect}
          selectedProject={selectedProject}
          onSampleUpdate={handleSampleUpdate}
        />
        <ImageViewer
          selectedSample={selectedSample}
          highlightedGrainId={highlightedGrainId}
          isEditing={isEditing}
          localContours={localContours}
          onCanvasClick={() => {}} // Placeholder, will be implemented with edit tools
          previewImage={previewImage}
          canvasSize={canvasSize}
          setCanvasSize={setCanvasSize}
        />
        <AnalysisSidebar
          selectedSample={selectedSample}
          onSampleUpdate={handleSampleUpdate}
          isEditing={isEditing}
          onEnterEditMode={handleEnterEditMode}
          onCancelEdit={handleCancelEdit}
          activeTool={activeTool}
          onToolSelect={setActiveTool}
          onGrainHover={setHighlightedGrainId}
          isLoading={isAppLoading}
          setIsLoading={setIsAppLoading}
          error={appError}
          setError={setAppError}
          setPreviewImage={setPreviewImage}
          canvasSize={canvasSize}
        />
      </main>
      <Footer />
    </div>
  );
}

export default App;
