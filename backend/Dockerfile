FROM python:3.10

# Install system dependencies for WeasyPrint and other libraries
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    libpango-1.0-0 \
    libharfbuzz0b \
    libffi-dev \
    libcairo2 \
    --no-install-recommends

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# The command to run in production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "run:app"]
