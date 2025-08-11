FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# The command to run in production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "run:app"]
