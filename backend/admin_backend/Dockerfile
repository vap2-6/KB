# ---- STAGE 1: Build the React Frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /app

COPY frontend-admin/package*.json ./
RUN npm install

COPY frontend-admin/ . 
RUN npx vite build

# ---- STAGE 2: Python/Flask Backend Production Runtime ----
FROM python:3.11-slim
WORKDIR /app

# Install native system dependencies required for production architectures
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    tzdata \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy your requirements text file right into the workspace
COPY backend/server/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy all core unified code modules into the image space
COPY . .

# Copy the built React assets directly from Stage 1 into the Flask directory
COPY --from=frontend-build /app/dist ./backend/dist

# Create storage pathways needed by registration profiles
RUN mkdir -p backend/uploads backend/generated_pdfs

ENV NODE_ENV=production
EXPOSE 5000

# CRITICAL FIX: Explicitly forces Gunicorn to work directly inside the server folder context
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "3", "--timeout", "120", "--chdir", "/app/backend/server", "main:app"]
