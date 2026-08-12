# MealFlow System Summary & Feature Guide

This document provides a clear summary of the **MealFlow System** architecture, key features, database schemas, and workflows.

---

## 1. System Overview

MealFlow is a comprehensive meal token and canteen management portal for **Ramakrishna Mission Vivekananda College (RKMVC)**.

### Key Portals
- **Student Portal**: Student registration, login, meal token status, QR code display, and token redemption history.
- **Admin Portal**: System settings, meal window schedule configuration, registration request approvals/rejections, student master details, token analytics, and automated academic year migrations.
- **Staff Portal**: Dual-mode student verification (QR scan / manual ID), token issuance, token redemption monitoring, export statement ledger, and **Volunteer Permitting & Pass Dispatch**.
- **Canteen Portal**: Canteen distribution counter verification, QR scanning, meal claiming (`Claimed`), and rejection tracking (`Rejected`).

---

## 2. Core Functional Modules

### A. Automated Student Academic Year Migration
- **Automatic Progression**: `1st Year` → `2nd Year` → `3rd Year` → `Graduated`.
- **Graduation Handling**: Students marked as `Graduated` automatically have their meal eligibility (`forenoon_meal = 0`, `afternoon_meal = 0`) disabled.
- **Annual Auto Scheduling**: When the scheduled date/time arrives, the migration executes automatically, and the scheduled date automatically rolls forward by **+1 year** (e.g. `2026-08-11` → `2027-08-11`).
- **Flexible Date Formats**: Supports `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, and `MM/DD/YYYY` inputs.
- **Draft Persistence**: Admin date/time inputs persist across page refreshes via browser `localStorage`.

### B. Guest Permitting & Multi-Channel Dispatch
- **Guest Meal Passes**: Staff members can issue guest passes with explicit pass counts (`1 Pass` for single meal or `2 Passes` for both meals).
- **GUS- Token Format**: Uses recognizable **`GUS-`** prefix (e.g. `GUS-1786468102`).
- **Dedicated Database Table**: All guest passes are stored in `guest_tokens` table with **zero dependency or pollution on `student_meals`**.
- **WhatsApp Integration**: Generates click-to-send WhatsApp links with formatted pass details and `GUS-` token IDs.
- **Email Pass Dispatch**: Sends branded HTML emails with embedded QR code tokens directly to guest email addresses.
- **Resend Email**: Allows staff to re-trigger email pass delivery with one click.

### C. Token Expiry & Window Schedule Configuration
- **Issuance-Based Expiry**: Meal tokens expire based on their issuance time duration (default: **30 minutes** after issuance).
- **Graceful Lifecycle**: Tokens automatically transition from `active` → `expired` when their lifetime elapses.

---

## 3. Database Schema Overview (`rkmvc_mealflow_db`)

| Table Name | Primary Purpose |
| :--- | :--- |
| `users` | Admin and Staff operator user accounts and RBAC roles (`admin`, `approval_staff`, `canteen_staff`). |
| `student_meals` | Master student directory containing registration numbers, credentials, degree year, and meal eligibility (`forenoon_meal`, `afternoon_meal`). |
| `meal_registrations` | Pending/approved/rejected student registration applications with uploaded identification photo, income proof, and signature document paths. |
| `meal_tokens` | Operational token ledger tracking issued meal passes, QR payloads, session types (`forenoon`/`afternoon`), and status (`active`, `approved`/`claimed`, `rejected`, `expired`). |
| `meal_windows` | Configured meal session timing windows, start/end times, active days of the week, and expiry durations. |
| `app_state` | Centralized JSON configuration state storing system settings, meal schedule configurations, and scheduled migration dates. |
| `scan_audit_log` | Append-only audit trail logging all terminal scans, staff actions, and token state changes. |

---

## 4. Operational Commands & Local Running

- **Start Local Server**: Run `./run-local.sh` from the repository root.
- **Database Settings**: MySQL running on `127.0.0.1:3306` (Database: `rkmvc_mealflow_db`, User: `meal_app`).
- **Build Frontends**:
  - `frontend-admin`: `npm run build`
  - `frontend-staff`: `npm run build`
  - `frontend-canteen`: `npm run build`
