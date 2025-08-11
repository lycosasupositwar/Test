import React from 'react';
import './MeasurementTable.css';

function MeasurementTable({ measurements, onGrainHover }) {
  if (!measurements || measurements.length === 0) {
    return <p>No measurement data available.</p>;
  }

  // Round numbers for display
  const format = (num) => (typeof num === 'number' ? num.toFixed(3) : num);

  return (
    <div className="measurement-table-container">
      <h4>Grain Measurements</h4>
      <table>
        <thead>
          <tr>
            <th>Grain ID</th>
            <th>Area (mm²)</th>
            <th>Perimeter (mm)</th>
            <th>Equiv. Ø (mm)</th>
            <th>Orientation (°)</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map((grain) => (
            <tr
              key={grain.grain_id}
              onMouseEnter={() => onGrainHover(grain.grain_id)}
              onMouseLeave={() => onGrainHover(null)}
            >
              <td>{grain.grain_id}</td>
              <td>{format(grain.area_mm2)}</td>
              <td>{format(grain.perimeter_mm)}</td>
              <td>{format(grain.equiv_diameter_mm)}</td>
              <td>{format(grain.orientation_deg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default MeasurementTable;
