import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Group, Line as KonvaLine, Text, Rect } from 'react-konva';
import useImage from 'use-image';
import './ImageViewer.css';
import ImageViewerToolbar from './ImageViewerToolbar';

const ImageViewer = ({ sample, previewContours }) => {
  const [image] = useImage(sample ? `/uploads/${sample.image_filename}` : '', 'Anonymous');
  const [stage, setStage] = useState({
    scale: 1,
    x: 0,
    y: 0,
    rotation: 0,
  });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [pixelColor, setPixelColor] = useState(null);

  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stageNode = e.target.getStage();
    const oldScale = stageNode.scaleX();
    const pointer = stageNode.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stageNode.x()) / oldScale,
      y: (pointer.y - stageNode.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

    setStage(prev => ({
      ...prev,
      scale: newScale,
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    }));
  };

  const handleZoom = (factor) => {
    const stageNode = containerRef.current.getStage();
    const oldScale = stageNode.scaleX();
    const center = {
      x: stageNode.width() / 2,
      y: stageNode.height() / 2,
    };
     const mousePointTo = {
      x: (center.x - stageNode.x()) / oldScale,
      y: (center.y - stageNode.y()) / oldScale,
    };
    const newScale = oldScale * factor;
     setStage(prev => ({
      ...prev,
      scale: newScale,
      x: center.x - mousePointTo.x * newScale,
      y: center.y - mousePointTo.y * newScale,
    }));
  }

  const handleReset = () => {
    setStage({ scale: 1, x: 0, y: 0, rotation: 0 });
    if (image && containerRef.current) {
        const stageNode = containerRef.current.getStage();
        const scale = Math.min(
            stageNode.width() / image.width,
            stageNode.height() / image.height
        );
        setStage({
            scale: scale,
            x: (stageNode.width() - image.width * scale) / 2,
            y: (stageNode.height() - image.height * scale) / 2,
            rotation: 0
        });
    }
  };

  const handleRotate = () => {
    setStage(prev => ({ ...prev, rotation: (prev.rotation + 90) % 360 }));
  };

  const handleMouseMove = (e) => {
    const stageNode = e.target.getStage();
    const pos = stageNode.getPointerPosition();
    setMousePos(pos);

    // Get color from underlying image
    const imageNode = e.target.getStage().findOne('KonvaImage');
    if (imageNode) {
      const imageContext = imageNode.getLayer().getCanvas()._canvas.getContext('2d');
      const imageData = imageContext.getImageData(pos.x, pos.y, 1, 1).data;
      setPixelColor(`RGB(${imageData[0]}, ${imageData[1]}, ${imageData[2]})`);
    }
  };

  useEffect(() => {
    handleReset();
  }, [image, size]);


  if (!sample) {
    return (
      <div className="image-viewer-container placeholder">
        <h2>Select a sample to view</h2>
      </div>
    );
  }

  const renderScaleBar = () => {
    if (!sample?.scale_pixels_per_mm || !size.width) return null;

    const scale = stage.scale;
    const targetMicrons = 100; // e.g., 100 µm scale bar
    const lengthInMm = targetMicrons / 1000;
    const lengthInPixels = lengthInMm * sample.scale_pixels_per_mm * scale;

    return (
      <Group x={size.width - lengthInPixels - 20} y={size.height - 40}>
        <Rect width={lengthInPixels} height={5} fill="black" />
        <Text
          text={`${targetMicrons} µm`}
          fontSize={14}
          fill="black"
          y={-20}
          align="center"
          width={lengthInPixels}
        />
      </Group>
    );
  };

  return (
    <div className="image-viewer-container">
      <ImageViewerToolbar
        onZoomIn={() => handleZoom(1.2)}
        onZoomOut={() => handleZoom(1 / 1.2)}
        onReset={handleReset}
        onRotate={handleRotate}
      />
      <div className="status-bar">
        <span>{`X: ${mousePos.x.toFixed(0)}, Y: ${mousePos.y.toFixed(0)}`}</span>
        {pixelColor && <span>{pixelColor}</span>}
      </div>
      <div ref={containerRef} style={{flexGrow: 1, overflow: 'hidden'}}>
        <Stage
          width={size.width}
          height={size.height}
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          scaleX={stage.scale}
          scaleY={stage.scale}
          x={stage.x}
          y={stage.y}
          draggable
          ref={node => (containerRef.current.getStage = () => node)}
        >
          <Layer
            rotation={stage.rotation}
            offsetX={image ? image.width / 2 : 0}
            offsetY={image ? image.height / 2 : 0}
            x={size.width / 2}
            y={size.height / 2}
          >
            <KonvaImage image={image} name="KonvaImage" />
            {(previewContours || sample.results?.contours)?.map((contour, index) => (
              <Group key={index}>
                <KonvaLine
                  points={contour.flat(2)}
                  stroke={previewContours ? 'yellow' : 'cyan'}
                  strokeWidth={1.5 / stage.scale}
                  closed
                />
              </Group>
            ))}
          </Layer>
          <Layer>
            {renderScaleBar()}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

export default ImageViewer;
