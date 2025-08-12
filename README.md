# Metallographic Analysis

A modern, web-based application for metallographic image analysis, built with React, Flask, and OpenCV, and deployed with Docker.

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
2.  Once the containers are running, access the application by navigating to `http://<your-server-ip>:8080` in your web browser. If you are running it on your local machine, you can use `http://localhost:8080`.
