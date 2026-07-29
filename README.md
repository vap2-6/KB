# RKMVC Meal Flow — Integrated Meal Token System

A complete, full-stack Ramakrishna Mission Vivekananda College (RKMVC) Meal Token System featuring interactive React (Vite) Frontends, a centralized Python (Flask) Backend API, and a MySQL Database. The system strictly adheres to the official `WORKFLOW.md` specifications and is fully containerized with Docker.

---

## 🏛️ Centralized Architecture & Unified Routing (Port 5050)

```
                               ┌────────────────────────────────────────┐
                               │           Web Browser Clients          │
                               └──────────────────┬─────────────────────┘
                                                  │ HTTP (Port :5050)
                                                  ▼
                               ┌────────────────────────────────────────┐
                               │        Central Flask Web Server        │
                               │        (Unified Gateway on :5050)      │
                               └─┬────────────┬───────────┬───────────┬─┘
                                 │            │           │           │
                                 ▼ /admin/    ▼ /staff/   ▼ /student/ ▼ /register/
                               ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
                               │  Admin   │ │  Staff   │ │ Student  │ │ Register │
                               │  Portal  │ │  Portal  │ │  Portal  │ │  Form    │
                               └──────────┘ └──────────┘ └──────────┘ └──────────┘
                                                  │
                                                  ▼ (MySQL Connector / Database Queries)
                               ┌────────────────────────────────────────┐
                               │             MySQL Database             │
                               │       (Port :3306, InnoDB Engine)      │
                               └────────────────────────────────────────┘
```

### Portal Routing & Endpoint Mapping
* **Portal Hub Landing Page:** `http://localhost:5050/`
* **Student Registration Portal (`/frontend-reg`):** `http://localhost:5050/register/` — Public sign-up interface for students to fill registration details, review, and submit for admin approval.
* **Admin Portal (`/frontend-admin`):** `http://localhost:5050/admin/` — Supervisor portal featuring notification popups for pending registration requests, student roster management, and live token distribution history monitoring.
* **Staff Dining Portal (`/frontend-staff`):** `http://localhost:5050/staff/` — Dual-role terminal for:
  * **Approval Staff (`approval_staff`):** Scans student registration QR codes and generates meal tokens based on active time windows (7 AM - 10 AM Breakfast, 12 PM - 7 PM Lunch).
  * **Canteen Staff (`canteen_staff`):** Scans generated student QR codes, verifies student profile photo & name, and updates token status (`redeemed` / `rejected`).
* **Student Portal / Dining Kiosk (`/frontend-stud`):** `http://localhost:5050/student/` — Student portal featuring mandatory first-time password change, dual Breakfast & Lunch token cards, active QR code rendering, and real-time claimed status synchronization.
* **Central API Backend (`/backend`):** Central gateway mounted on `/api/` (handling `/api/admin`, `/api/staff`, `/api/student`, `/api/register`).

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

## 🔒 Pre-Loaded Testing Credentials

| Role | Username / Staff ID / Reg No | Password | Access / Portal |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin` | `adminpassword` | Admin Dashboard (`/admin/`) |
| **Morning Warden** | `STAFF101` | `staffpassword` | Approval Staff Terminal (`/staff/`) |
| **Noon Warden** | `STAFF102` | `staffpassword` | Approval Staff Terminal (`/staff/`) |
| **Canteen Counter A** | `CANTEEN01` | `staffpassword` | Canteen Staff Terminal (`/staff/`) |
| **Canteen Counter B** | `CANTEEN02` | `staffpassword` | Canteen Staff Terminal (`/staff/`) |
| **Student 1** | `243301034021` | `pass123` | Student Portal (`/student/`) |
| **Student 2** | `STU101` | `pass123` | Student Portal (`/student/`) |
| **Student 3** | `STU102` | `pass123` | Student Portal (`/student/`) |

---

## 🛠️ Running the Application Locally

### Method 1: Local Script (`run-local.sh` or `main.py`)
```bash
# Run backend server directly (serves all frontends on port 5050)
python backend/server/main.py
```

### Method 2: Docker Compose Setup
```bash
cp .env.example .env
docker compose up --build -d
```
