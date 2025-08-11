import React from 'react';
import { Bar } from 'react-chartjs-2';
import './HistogramChart.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function HistogramChart({ measurements, dataKey = 'equiv_diameter_mm', title = 'Grain Size Distribution' }) {
  if (!measurements || measurements.length === 0) {
    return null;
  }

  // --- Data Binning Logic ---
  const values = measurements.map(m => m[dataKey]).filter(v => v != null);
  if (values.length === 0) return <p>No data available for histogram.</p>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const numBins = Math.min(Math.ceil(Math.sqrt(values.length)), 20); // Sensible number of bins
  const binWidth = (max - min) / numBins;

  const bins = Array(numBins).fill(0);
  const labels = Array(numBins).fill('');

  for (let i = 0; i < numBins; i++) {
    const binStart = min + i * binWidth;
    const binEnd = binStart + binWidth;
    labels[i] = `${binStart.toFixed(3)} - ${binEnd.toFixed(3)}`;
  }

  values.forEach(value => {
    let binIndex = Math.floor((value - min) / binWidth);
    // Handle the max value edge case
    if (binIndex === numBins) {
        binIndex = numBins - 1;
    }
    bins[binIndex]++;
  });

  // --- Chart.js Data and Options ---
  const data = {
    labels,
    datasets: [
      {
        label: 'Number of Grains',
        data: bins,
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: title,
      },
    },
    scales: {
        x: {
            title: {
                display: true,
                text: `Equivalent Diameter (mm)`
            }
        },
        y: {
            title: {
                display: true,
                text: 'Frequency (Count)'
            },
            beginAtZero: true
        }
    }
  };

  return (
    <div className="histogram-container">
        <Bar options={options} data={data} />
    </div>
  );
}

export default HistogramChart;
