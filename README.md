# Metallobox Web

A modern, web-based clone of the Metallobox software for metallographic image analysis, built with React, Flask, and OpenCV, and deployed with Docker.

## Tech Stack

-   **Frontend**: React, Chart.js
-   **Backend**: Python, Flask, OpenCV, SQLAlchemy, Pandas, WeasyPrint, Shapely
-   **Database**: SQLite
-   **Deployment**: Docker Compose, Nginx, Gunicorn

## Deployment

**Prerequisites:**
-   Docker
-   Docker Compose

**Running the Application:**

1.  From the root directory, run the following command:
    ```bash
    docker-compose up --build
    ```
2.  Once the containers are running, access the application:
    -   **Frontend:** `http://localhost:8080`
    -   **Backend API:** `http://localhost:5000`
