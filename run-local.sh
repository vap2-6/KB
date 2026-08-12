#!/usr/bin/env bash
# --- Run RKMVC Meal Flow Admin App locally -----------------
# Prereqs: Node.js 18+, Python 3.10+, and either Docker Desktop or a reachable MySQL server.
#
# Usage (run from an ALREADY OPEN terminal, don't double-click this file):
#   ./run-local.sh
#
# This builds the React admin frontend and starts the Flask backend, which
# serves both the API and the built frontend on http://localhost:5050
# ------------------------------------------------------------

trap 'echo; echo "── Script stopped. Press Enter to close this window. ──"; read -r' EXIT

set -e

# Determine project root path
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# --- Load .env ---
ENV_FILE=""
if [ -f ".env" ]; then
  ENV_FILE=".env"
elif [ -f "backend/server/.env" ]; then
  ENV_FILE="backend/server/.env"
else
  echo "ERROR: No .env file found."
  echo "Copy .env.example to .env and fill it in first."
  exit 1
fi
ENV_FILE_ABS="$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")"

echo "Loading environment variables from $ENV_FILE_ABS"

while IFS='=' read -r key value; do
  case "$key" in
    ''|'#'*) continue ;;
  esac
  key="$(echo "$key" | tr -d '\r' | xargs)"
  value="$(echo "$value" | tr -d '\r')"
  value="${value%\"}"; value="${value#\"}"
  export "$key=$value"
done < "$ENV_FILE"

export MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
export MYSQL_PORT="${MYSQL_PORT:-3306}"

echo
echo "── Resolved database settings (from $ENV_FILE) ──"
echo "   MYSQL_HOST     = $MYSQL_HOST"
echo "   MYSQL_PORT     = $MYSQL_PORT"
echo "   MYSQL_USER     = $MYSQL_USER"
echo "   MYSQL_DATABASE = $MYSQL_DATABASE"
echo "   MYSQL_PASSWORD = $([ -n "$MYSQL_PASSWORD" ] && echo "(set, ${#MYSQL_PASSWORD} chars)" || echo "(EMPTY!)")"
echo

if [ -z "$JWT_SECRET" ] || [ -z "$QR_HMAC_SECRET" ]; then
  echo "ERROR: JWT_SECRET and QR_HMAC_SECRET must be set in $ENV_FILE"
  exit 1
fi
if [ -z "$MYSQL_USER" ] || [ -z "$MYSQL_DATABASE" ] || [ -z "$MYSQL_PASSWORD" ]; then
  echo "ERROR: MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE must be set in $ENV_FILE"
  exit 1
fi

case "$MYSQL_PORT" in
  *[!0-9]*|'')
    echo "ERROR: MYSQL_PORT must be a number (received '$MYSQL_PORT')."
    exit 1
    ;;
esac

PYTHON_CMD=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PYTHON_CMD="$candidate"
    break
  fi
done
if [ -z "$PYTHON_CMD" ]; then
  echo "ERROR: Could not find 'python3' or 'python' on your PATH."
  exit 1
fi
echo "Using Python command: $PYTHON_CMD ($($PYTHON_CMD --version))"

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: 'npm' not found on your PATH. Install Node.js 18+ first."
  exit 1
fi
echo "Using npm: $(npm --version)"

export VITE_API_URL="http://localhost:5050"
export REACT_APP_API_URL="http://localhost:5050"

echo
echo "Installing Python dependencies"
cd "$PROJECT_ROOT/backend/server"
if ! "$PYTHON_CMD" -m pip install -r requirements.txt --break-system-packages 2>/dev/null; then
  "$PYTHON_CMD" -m pip install -r requirements.txt
fi

mysql_probe() {
  "$PYTHON_CMD" -c 'import os, pymysql; conn = pymysql.connect(host=os.environ["MYSQL_HOST"], port=int(os.environ["MYSQL_PORT"]), user=os.environ["MYSQL_USER"], password=os.environ["MYSQL_PASSWORD"], database=os.environ["MYSQL_DATABASE"], connect_timeout=3); conn.close()'
}

start_compose_database() {
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed but Docker Desktop is not running."
    return 1
  fi
  echo "Starting the project's MySQL container..."
  docker compose up -d db
}

echo
echo "Checking MySQL connection ($MYSQL_HOST:$MYSQL_PORT as user '$MYSQL_USER')"
if ! mysql_probe; then
  echo "Configured MySQL is not ready; attempting to start the project's database."
  if ! start_compose_database; then
    echo
    echo "ERROR: Cannot reach MySQL at $MYSQL_HOST:$MYSQL_PORT and could not start Docker MySQL."
    echo "Start Docker Desktop (or your MySQL service), then run ./run-local.sh again."
    exit 1
  fi
  echo "Waiting for MySQL to accept the configured application credentials..."
  db_ready=false
  for attempt in $(seq 1 30); do
    if mysql_probe >/dev/null 2>&1; then
      db_ready=true
      break
    fi
    sleep 2
  done
  if [ "$db_ready" != true ]; then
    echo "ERROR: MySQL did not become usable within 60 seconds."
    echo "Run 'docker compose logs db' to see the database startup error."
    exit 1
  fi
fi
echo "MySQL connection verified."

for frontend_dir in frontend-admin frontend-staff frontend-canteen frontend-stud frontend-reg; do
  echo
  echo "── Building $frontend_dir ──"
  cd "$PROJECT_ROOT/$frontend_dir"
  npm install
  VITE_API_URL="http://localhost:5050" REACT_APP_API_URL="http://localhost:5050" npm run build
done

echo "Starting Unified Flask backend on http://localhost:5050"
cd "$PROJECT_ROOT/backend/server"
"$PYTHON_CMD" main.py
