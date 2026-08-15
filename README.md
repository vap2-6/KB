# RKMVC Meal Flow — Integrated Meal Token System

A complete, full-stack Ramakrishna Mission Vivekananda College (RKMVC) Meal Token System featuring interactive React (Vite) Frontends, a centralized Python (Flask) Backend API, and a MySQL Database. The system strictly adheres to the official `WORKFLOW.md` specifications and is fully containerized with Docker.

---

## 🏛️ Centralized Architecture & Nginx Reverse Proxy (Port 80 / 5050)

```
                               ┌────────────────────────────────────────┐
                               │           Web Browser Clients          │
                               └──────────────────┬─────────────────────┘
                                                  │ HTTP (Port :80 / :5050)
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │          Nginx Reverse Proxy           │
                               │  (Static SPA Server & Proxy Gateway)   │
                               └─┬────────────┬───────────┬───────────┬─┘
                                 │            │           │           │
                                 ▼ /admin/    ▼ /staff/   ▼ /student/ ▼ /register/
                               ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
                               │  Admin   │ │  Staff   │ │ Student  │ │ Register │
                               │  Portal  │ │  Portal  │ │  Portal  │ │  Form    │
                               └──────────┘ └──────────┘ └──────────┘ └──────────┘
                                                  │
                                                  │ API Proxy (/api/*)
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │        Python (Flask/Gunicorn)         │
                               │      Dedicated API & APScheduler       │
                               └──────────────────┬─────────────────────┘
                                                  │ (PyMySQL / InnoDB Engine)
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │             MySQL Database             │
                               │            (Port :3306 / :3307)        │
                               └────────────────────────────────────────┘
```

### Portal Routing & Endpoint Mapping
* **Portal Hub Landing Page:** `http://localhost:5050/` or `http://localhost/`
* **Student Registration Portal (`/frontend-reg`):** `http://localhost:5050/register/` — Public sign-up interface for students to fill registration details, review, and submit for admin approval.
* **Admin Portal (`/frontend-admin`):** `http://localhost:5050/admin/` — Supervisor portal featuring notification popups for pending registration requests, student roster management, and live token distribution history monitoring.
* **Staff Dining Portal (`/frontend-staff`):** `http://localhost:5050/staff/` — Dual-role terminal for:
  * **Approval Staff (`approval_staff`):** Scans student registration QR codes and generates meal tokens based on active time windows (7 AM - 10 AM Breakfast, 12 PM - 7 PM Lunch).
  * **Canteen Staff (`canteen_staff`):** Scans generated student QR codes, verifies student profile photo & name, and updates token status (`redeemed` / `rejected`).
* **Student Portal / Dining Kiosk (`/frontend-stud`):** `http://localhost:5050/student/` — Student portal featuring mandatory first-time password change, dual Breakfast & Lunch token cards, active QR code rendering, and real-time claimed status synchronization.
* **Central API Backend (`/backend`):** Central Python Flask/Gunicorn gateway mounted on `/api/` (handling `/api/admin`, `/api/staff`, `/api/student`, `/api/register`), proxied via Nginx.

---

## 🔄 Strict Workflow Implementation (`WORKFLOW.md`)

### 1. Student Registration Workflow (`/register/`)
* **Submission & Confirmation:** Students register by filling out personal details and uploading a photo. After clicking **Review**, details are shown for confirmation before submitting to `meal_registrations`. A confirmation message informs the student that their application has been sent for admin review.
* **Approval & Login Provisioning:** Once approved by the Admin, an email notification is generated with default login credentials (`username: student_id`, `password: pass123`). Only approved students can access the system.

### 2. Admin Portal Workflow (`/admin/`)
* **Registration Requests & Notifications:** When the Admin logs in, the top notification bell icon displays pending registration requests in a modal popup. Approvals activate the student account in `student_meals`; rejections mark the application as rejected.
* **Token History & Monitoring:** Admin **cannot** generate tokens directly for students. Admin monitors live generation, redemption, and audit logs under the **Token & Distribution** tab.

### 3. Staff Portal Workflow (`/staff/`)
* **Approval Staff (`approval_staff`):**
  * Scans student registration QR codes or enters register numbers to resolve mismatches and issue meal tokens.
  * **Strict Time-Window Token Generation Rules:**
    * **7:00 AM – 10:00 AM:** Generates **Breakfast Token** (`forenoon`).
    * **12:00 PM – 7:00 PM:** Generates **Lunch Token** (`afternoon`).
* **Canteen Staff (`canteen_staff`):**
  * Scans the student's active token QR code.
  * Validates the rendered student name, register number, and profile picture to manually confirm student presence.
  * Clicks **Claim / Approve** or **Reject**, updating the token status in the `meal_tokens` database table.

### 4. Student Portal Workflow (`/student/`)
* **Compulsory First-Time Password Change:** On first-time login (or when default password `pass123` is detected), the portal enforces a mandatory password change modal before granting access. New passwords are securely updated in MySQL `student_meals`.
* **Dual Token Components & Active QR Display:**
  * Features two distinct card components: **Breakfast Token** and **Lunch Token**.
  * Dynamic QR code is generated and displayed **only during the specific active time window**.
* **Real-Time Claimed Sync:**
  * When Canteen Staff redeems/claims a token in the backend, the Student Portal instantly updates the QR view to a green **"TOKEN UTILIZED / CLAIMED"** screen.
* **Transaction History:** All token generation and redemption events are recorded in `meal_tokens` and `scan_audit_log` and viewable in the student history tab.

---

## 🔒 System Authentication & Security

Administrative and staff terminal access is controlled via system-provisioned operator credentials and role-based permissions (`admin`, `approval_staff`, `canteen_staff`). Student accounts are created dynamically through the registration portal (`/register/`) or administrative import.

---

## 📋 Software Requirements & Prerequisites

Before running the application, ensure the following core software components are installed on your environment:

### Core System Requirements
| Software / Dependency | Required Version | Purpose / Role | Installation / Command |
| :--- | :--- | :--- | :--- |
| **Node.js & npm** | `18.0+` (LTS recommended) | Building React SPAs (`frontend-*`) | Download from [nodejs.org](https://nodejs.org) |
| **Python** | `3.10+` | Executing Flask API Backend, SQLAlchemy, & `APScheduler` | Download from [python.org](https://www.python.org) |
| **MySQL Server** | `8.0+` (or MariaDB) | Primary relational database (`rkmvc_mealflow_db`) | `python setup_local_db.py` (or Docker) |
| **Nginx Web Server** | `1.24+` | High-performance Reverse Proxy & Static SPA Server | `winget install nginxinc.nginx` (or Docker container) |
| **Docker Desktop** | *(Optional/Recommended)* | Containerized orchestration (`docker compose up -d`) | Download from [docker.com](https://www.docker.com/products/docker-desktop/) |

---

### Python Backend Dependencies 
Installed automatically during `./run-local.sh` or via `pip install -r backend/server/requirements.txt`:
* **Web Framework & Rate Limiting:** `Flask==3.0.3`, `Flask-CORS==4.0.1`, `Flask-Limiter==3.8.0`
* **Database & ORM:** `PyMySQL==1.1.1`, `mysql-connector-python==8.4.0`, `SQLAlchemy==2.0.36`, `Flask-SQLAlchemy==3.1.1`
* **Event-Driven Task Scheduler:** `APScheduler==3.10.4` (Manages zero-polling Academic Year Migration)
* **Authentication & Cryptography:** `PyJWT==2.8.0`, `bcrypt==4.1.2`, `cryptography==42.0.5`
* **Document & Image Utilities:** `reportlab==4.1.0` (PDFs), `qrcode[pil]`, `Pillow>=11.0.0`, `openpyxl==3.1.5`
* **WSGI Production Server:** `gunicorn==23.0.0`

---

## 🛠️ Running the Application Locally

There are two supported ways to run this project: **Docker Compose** (recommended — no manual DB setup) or a **local, no-Docker setup** (Python + MySQL installed directly on your machine).

In both cases, the Flask backend automatically creates all database tables and seeds default login accounts on first startup (see `_ensure_tables()` in `backend/admin_backend/app.py`) — you never need to run or edit `mysql/init/schema.sql` yourself.

### 0. First-time setup (both methods)
```bash
cp .env.example .env
```
Open `.env` and adjust `MYSQL_ROOT_PASSWORD`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `JWT_SECRET` if you want non-default values. The defaults work fine for local development.

---

### Method 1: Docker Compose (recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

1. **Build the four frontends first** (the containers serve pre-built static files, they don't build them on start):
   ```bash
   cd frontend-admin && npm install && npm run build && cd ..
   cd frontend-staff && npm install && npm run build && cd ..
   cd frontend-stud  && npm install && npm run build && cd ..
   cd frontend-reg   && npm install && npm run build && cd ..
   ```
2. **Start everything:**
   ```bash
   docker compose up -d --build
   ```
   Docker automatically creates the MySQL database and `meal_app` user from your `.env` values on the container's first-ever run.
3. Visit **http://localhost:5050**.

> **Note:** MySQL only runs its `/docker-entrypoint-initdb.d` init scripts against a completely empty data volume. If you'd previously started the `db` container and it created an empty/broken volume, wipe it first with `docker compose down -v`, then re-run `docker compose up -d --build` for a guaranteed clean init.

---

### Method 2: Local, no Docker (`run-local.sh`)

Requires Python 3.11+, Node.js 18+, and a MySQL server (8.0+) installed and running locally.

1. **One-time database setup** — creates the `rkmvc_mealflow_db` database and the `meal_app` MySQL user (the one thing the app can't do for itself):
   ```bash
   pip install pymysql --break-system-packages   # if not already installed
   python setup_local_db.py
   ```
   You'll be prompted for your local MySQL admin username/password (default `root`) to perform this one-time setup. It does **not** create any tables — the app does that automatically on startup.

2. **Run the app:**
   ```bash
   ./run-local.sh
   ```
   (On Windows, use Git Bash or WSL: `bash run-local.sh`.)

   This script installs Python dependencies, builds all four frontends, and starts the Flask backend on port 5050. All database tables and default login accounts are created automatically the first time it starts — watch for `--- DB SCHEMAS AND SEED USERS INITIALIZED ---` in the logs.

3. Visit **http://localhost:5050**.

**Alternative — run the backend directly without the script** (useful once you've already built the frontends once):
```bash
pip install -r backend/server/requirements.txt --break-system-packages
python backend/server/main.py
```

---

### Troubleshooting
* **`Access denied for user 'meal_app'@'localhost'`** — your local MySQL doesn't have the app's database/user yet. Run `python setup_local_db.py` (Method 2, step 1).
* **`Failed to fetch table records` / similar API errors after pulling new code** — make sure you rebuilt the frontend (`npm run build` in the relevant `frontend-*` folder) and restarted the backend, since Flask serves the static `dist/` output, not your source files directly.
* **Docker: table not found in phpMyAdmin/Adminer but works in the app** — Docker's init scripts only run once against an empty volume; run `docker compose down -v` and start again for a clean slate.

