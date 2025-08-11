# Metallobox Web

A modern, web-based clone of the Metallobox software for metallographic image analysis, built with React, Flask, and OpenCV, and deployed with Docker.

## Features

This application provides a comprehensive suite of tools for metallographic analysis, including:

-   **Project Management:** Create and manage distinct projects to organize your work.
-   **Sample Management:** Upload and manage multiple image samples (JPG, PNG, BMP, TIFF) within each project.
-   **Automatic Segmentation:** Utilizes OpenCV's Otsu thresholding to automatically detect and segment grain structures from an uploaded image.
-   **Manual Editing:** A dedicated editing mode allows for fine-tuning of the segmentation results. Currently supports deleting individual grains, with a framework for more advanced tools like splitting.
-   **Scale Calibration:** Interactively set the image scale (pixels per millimeter) by drawing a line of a known length on the image.
-   **Automatic Measurements:** Once calibrated, automatically calculate key properties for every grain, including:
    -   Area (mm²)
    -   Perimeter (mm)
    -   Equivalent Diameter (mm)
    -   Orientation (°)
-   **Data Visualization:**
    -   View measurement data in a clear, sortable table.
    -   Hover over a grain in the table to see it highlighted on the segmented image.
    -   Automatically generate a grain size distribution histogram from the measurement data.
-   **ASTM E112 Analysis:** Perform a standard planimetric grain size analysis to calculate the ASTM grain size number (G).
-   **Multiphase Analysis:** Calculate the percentage ratio of two phases (e.g., ferrite and pearlite) using a simple intensity threshold.
-   **Data Export:**
    -   **CSV:** Export all raw grain measurement data to a CSV file.
    -   **PDF:** Generate a comprehensive, print-ready PDF report summarizing the analysis for a sample, including summary statistics, images, and the full measurement table.

## Tech Stack

-   **Frontend**: React, Chart.js
-   **Backend**: Python, Flask, OpenCV, SQLAlchemy, Pandas, WeasyPrint, Shapely
-   **Database**: SQLite
-   **Deployment**: Docker Compose, Nginx, Gunicorn

## Deployment

The application is containerized with Docker and optimized for a production environment.

**Prerequisites:**
-   Docker
-   Docker Compose

**Running the Application:**

1.  Clone this repository.
2.  From the root directory (`metallobox-clone/`), run the following command:

    ```bash
    docker-compose up --build
    ```
3.  Once the containers are built and running, you can access the application:
    -   **Frontend:** `http://localhost:8080`
    -   **Backend API:** `http://localhost:5000`

**Data Persistence:**

-   The SQLite database file (`metallobox.db`) is stored in a Docker named volume (`db-data`), ensuring it persists across container restarts.
-   All uploaded sample images are stored in the `uploads/` directory, which is mounted as a volume from the host machine. This ensures your images are not lost.

## API Overview

The backend provides a RESTful API for all application functions. Key endpoints include:

-   `GET /api/projects`
-   `POST /api/projects`
-   `POST /api/projects/<id>/samples`
-   `POST /api/samples/<id>/calibrate`
-   `POST /api/samples/<id>/measure`
-   `POST /api/samples/<id>/astm-e112`
-   `POST /api/samples/<id>/multiphase`
-   `GET /api/samples/<id>/export/csv`
-   `GET /api/samples/<id>/export/pdf`
-   `uploads/<filename>` (for serving images)
