FROM python:3.10

# Install system dependencies for WeasyPrint and other libraries
# Using the official list from WeasyPrint documentation for Debian/Ubuntu
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    python3-pip \
    python3-setuptools \
    python3-wheel \
    python3-cffi \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    --no-install-recommends

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# The command to run in production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "run:app"]
