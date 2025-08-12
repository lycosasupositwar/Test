FROM python:3.10

# System dependencies for WeasyPrint were removed as they fail to install in this environment.

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# The command to run in production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "run:app"]
