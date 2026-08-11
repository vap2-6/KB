# Database Documentation (`rkmvc_mealflow_db`)

This document provides a comprehensive guide to the schema, relationships, tables, and seeding rules designed for the **Meal Token System** database: `rkmvc_mealflow_db`.

The database is built on **MySQL (InnoDB)**, utilizing `utf8mb4` character set encoding and `utf8mb4_unicode_ci` collation for robust multi-language and symbol support.

---

## Entity-Relationship Model

```
       ┌────────────────────────┐
       │         users          │ (Admin & Staff Operators Only)
       └────────────────────────┘
         Role: admin, approval_staff, canteen_staff

       ┌────────────────────────┐         ┌────────────────────────┐
       │   meal_registrations   ├────────►│     student_meals      │◄────────────────────────┐ (Student details & credentials)
       └────────────────────────┘         └───────────┬────────────┘                         │
         Status: pending, approved,                   │ 1:N (fk_tokens_student)         │ 1:N (student_id)
                 rejected                             ▼                                 │
                                          ┌────────────────────────┐                 ┌───────┴────────┐
                                          │      meal_tokens       │◄───────────────┤scan_audit_log  │
                                          └────────────────────────┘  1:N            └────────────────┘
                                            Status: active, approved,  (token_uid)
                                                    rejected, expired
```

---

## Table Schemas

### 1. `users`
System operator identity table containing administrative and staff credentials and Role-Based Access Control (RBAC) levels.
* **Primary Key**: `id` (`VARCHAR(50)`)
* **Engines/Collation**: `InnoDB`, `utf8mb4_unicode_ci`

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(50)` | NO | *None* | Unique system identifier for operators (e.g. `usr_admin`). |
| `username` | `VARCHAR(50)` | NO | *None* | Alphanumeric handle (Unique key). |
| `email` | `VARCHAR(100)` | NO | *None* | Operator email address (Unique key). |
| `password_hash`| `VARCHAR(255)`| NO | *None* | Securely hashed password (bcrypt). |
| `role` | `ENUM(...)` | NO | `'approval_staff'` | Access level: `'admin'`, `'approval_staff'`, `'canteen_staff'`. |
| `display_name` | `VARCHAR(100)`| YES | `NULL` | Friendly name for the UI. |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Account creation timestamp. |

---

### 2. `student_meals`
Primary student account table containing registration numbers, student credentials, sections, verification images, and meal eligibility indicators.
* **Primary Key**: `student_id` (`VARCHAR(50)`)
* **Uniques**: `idx_student_username` on `username`

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `student_id` | `VARCHAR(50)` | NO | *None* | Institutional registration number (e.g. `STU101` / `243301034021`). |
| `username` | `VARCHAR(50)` | NO | *None* | Student login handle. |
| `email` | `VARCHAR(100)` | YES | `NULL` | Student contact email. |
| `password_hash`| `VARCHAR(255)`| NO | *None* | Securely hashed student password. |
| `name` | `VARCHAR(100)` | NO | *None* | Student full display name. |
| `grade_section`| `VARCHAR(100)`| NO | *None* | Department & year details (e.g. `Computer Applications`). |
| `forenoon_meal`| `TINYINT(1)` | NO | `1` | Breakfast eligibility boolean. |
| `afternoon_meal`| `TINYINT(1)` | NO | `1` | Lunch eligibility boolean. |
| `last_served_date`| `DATE` | YES | `NULL` | Log of the last date a meal was collected. |
| `qr_secret` | `VARCHAR(64)` | YES | `NULL` | Secret key for signing student identity. |
| `image_url` | `VARCHAR(512)`| YES | `NULL` | Public verification portrait URL. |
| `image_path` | `VARCHAR(512)`| YES | `NULL` | Storage path reference for student photo. |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Registration timestamp. |

---

### 3. `meal_tokens`
Active voucher transaction tracking ledger. Links Staff Portal token generation to Student Portal QR display and Canteen Staff scanning redemption.
* **Primary Key**: `id` (`INT AUTO_INCREMENT`)
* **Foreign Key**: `student_id` references `student_meals(student_id)` ON DELETE RESTRICT
* **Uniques**: `idx_token_uid` on `token_uid`

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | NO | *None* | Internal ID. |
| `token_uid` | `VARCHAR(50)` | NO | *None* | Globally unique business key (e.g. `TOK-1721200000`). |
| `student_id` | `VARCHAR(50)` | NO | *None* | Target student registration ID. |
| `cached_student_name` | `VARCHAR(100)` | YES | `NULL` | Denormalized display name for high-speed terminal reads. |
| `cached_image_url` | `VARCHAR(512)` | YES | `NULL` | Denormalized avatar portrait URL. |
| `meal_type` | `ENUM(...)` | NO | *None* | Session type: `'forenoon'`, `'afternoon'`. |
| `status` | `ENUM(...)` | NO | `'active'` | Token status lifecycle: `'active'`, `'approved'`, `'rejected'`, `'expired'`. |
| `scanned_by` | `VARCHAR(50)` | YES | `NULL` | Staff ID of issuing operator. |
| `scanned_at` | `TIMESTAMP` | YES | `NULL` | Scan timestamp. |
| `approved_by` | `VARCHAR(50)` | YES | `NULL` | Canteen staff ID who claimed or verified the token. |
| `approved_at` | `TIMESTAMP` | YES | `NULL` | Claim/approval timestamp. |
| `reject_reason`| `VARCHAR(255)`| YES | `NULL` | Reason if voucher is rejected. |
| `token_qr_data`| `VARCHAR(512)`| YES | `NULL` | Encoded token payload for QR rendering. |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP`| Base transaction timestamp. |

---

### 4. `scan_audit_log`
Write-intensive append-only telemetry logging table tracking terminal activities, scans, and outcomes.
* **Primary Key**: `id` (`BIGINT AUTO_INCREMENT`)

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `BIGINT` | NO | *None* | High capacity record index. |
| `scanner_id` | `VARCHAR(50)` | NO | *None* | Identity of terminal unit/operator. |
| `scanner_role`| `ENUM(...)` | NO | *None* | `'approval_staff'`, `'canteen_staff'`. |
| `scan_type` | `ENUM(...)` | NO | *None* | Type: `'student_id_qr'`, `'token_qr'`. |
| `payload` | `VARCHAR(512)`| NO | *None* | Scanned payload string. |
| `student_id` | `VARCHAR(50)` | YES | `NULL` | Extracted Student ID. |
| `token_uid` | `VARCHAR(50)` | YES | `NULL` | Extracted Token UID. |
| `result` | `ENUM(...)` | NO | *None* | Action outcome: `'success'`, `'invalid_token'`, `'already_redeemed'`, `'expired'`, `'out_of_window'`, `'duplicate_meal'`, etc. |
| `detail` | `VARCHAR(255)`| YES | `NULL` | Additional trace details. |
| `created_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Audit occurrence timestamp. |

---

### 5. `meal_registrations`
Standalone student registration applications ledger storing applicant details and file pointer URLs for uploaded photos, signatures, pay slips, and generated application PDFs.
* **Primary Key**: `registration_id` (`VARCHAR(50)`)
* **Indexes**: `idx_reg_status` (`status`), `idx_reg_dept` (`dept_number`), `idx_reg_mobile` (`mobile_no`)

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `registration_id` | `VARCHAR(50)` | NO | *None* | Unique registration identifier (e.g. `REG_a1b2c3d4e5`). |
| `app_no` | `VARCHAR(50)` | YES | `NULL` | Optional application serial number. |
| `student_name` | `VARCHAR(100)` | NO | *None* | Student full legal name. |
| `dept_number` | `VARCHAR(50)` | YES | `NULL` | Department Roll/Reg Number. |
| `mobile_no` | `VARCHAR(20)` | YES | `NULL` | Primary contact mobile number. |
| `email` | `VARCHAR(100)` | YES | `NULL` | Student contact email address. |
| `student_photo_url` | `VARCHAR(512)`| YES | `NULL` | Server file path URL to student passport photo. |
| `applicant_signature_url` | `VARCHAR(512)`| YES | `NULL` | Server file path URL to student signature image. |
| `income_proof_url` | `VARCHAR(512)`| YES | `NULL` | Server file path URL to pay slip / income proof file. |
| `generated_pdf_url` | `VARCHAR(512)`| YES | `NULL` | Server file path URL to compiled PDF application document. |
| `status` | `ENUM(...)` | NO | `'pending'` | Registration lifecycle: `'pending'`, `'approved'`, `'rejected'`. |
| `submitted_at` | `TIMESTAMP` | NO | `CURRENT_TIMESTAMP` | Form submission timestamp. |

---

### 5. `app_state`
Global system state & JSON configuration store. Backs Admin Meal Timing controls (`meal_timings`) and live system settings.
* **Primary Key**: `id` (`INT`)

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | NO | *None* | Configuration index (`1`). |
| `data` | `JSON` | NO | *None* | JSON blob containing `meal_timings` (Breakfast/Lunch hours and grace periods) and system states. |
| `updated_at` | `DATETIME` | YES | `CURRENT_TIMESTAMP` | Last updated timestamp. |

---

### 6. `audit_logs`
Immutable database write mutation ledger.
* **Primary Key**: `id` (`VARCHAR(50)`)

---

### 7. `data_io_logs`
System data import/export telemetry tracker.
* **Primary Key**: `id` (`VARCHAR(50)`)

---

## System Authentication

1. **System Operators (`users`)**:
   * Administrative and staff accounts (`admin`, `approval_staff`, `canteen_staff`) are managed securely via system initialization and the Admin Portal user management module.

2. **Registered Students (`student_meals`)**:
   * No student records are pre-seeded. Students register via the registration workflow (`/register/`) or administrative import.
