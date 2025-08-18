import React from 'react';
import './ASTMChart.css';

function ASTMChart({ chartUrl }) {
  if (!chartUrl) {
    return null;
  }

  return (
    <div className="astm-chart-container">
      <h4>ASTM E112 Comparison Chart</h4>
      <div className="chart-display">
        <img src={chartUrl} alt="ASTM E112 Comparison Chart" />
      </div>
    </div>
  );
}

export default ASTMChart;
