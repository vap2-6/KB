FROM python:3.11-slim

WORKDIR /app

# Install native Linux packages required for image/PDF handling and timezone configuration
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc tzdata libjpeg62-turbo-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads generated_pdfs

EXPOSE 5000

# Runs your unified server engine under a production-ready WSGI server
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "--timeout", "120", "--reload", "--chdir", "/app/server", "main:app"]
