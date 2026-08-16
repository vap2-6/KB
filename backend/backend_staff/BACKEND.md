# Backend Application Guide (`backend/app.py`)

The backend component of the **Meal Token System** is a lightweight, highly efficient REST API service built with **Python**, **Flask**, and **mysql-connector-python**.

It manages communication between the interactive React client-side application and the high-performance MySQL relational database.

---

## 1. Core Technologies & Files

* **Language**: Python 3.8+
* **Framework**: Flask (v3.0+)
* **CORS Support**: `flask-cors` (ensures cross-origin requests from the React client on Port 3000 are approved)
* **DB Driver**: `mysql-connector-python` (native thread-safe driver)
* **Entry Point**: `backend/app.py`
* **Dependencies**: `backend/requirements.txt`
* **Docker Containerization**: `backend/Dockerfile`

---

## 2. Environment Variables & DB Connection

The backend reads connection parameters directly from the system environment to match production or container environments securely, falling back to localhost defaults:

```python
db_config = {
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', 'password'),
    'host': os.environ.get('DB_HOST', '127.0.0.1'),
    'database': os.environ.get('DB_DATABASE', 'rkmvc_mealflow_db'),
    'raise_on_warnings': True
}
```

---

## 3. Data Adaptation & Mapping Logic

The MySQL database schema is structured for enterprise relational storage, while the React frontend expects simpler, lightweight objects. To avoid complex code in React, the Flask backend does the heavy lifting of mapping formats.

### Student Mapping
Converts relational `student_meals` and `users` data into a simple frontend structure:
* Converts `grade_section` string (e.g., `"2nd Year - Computer Science"`) into separate fields: `year` and `department`.
* Maps `student_id` to `reg_no`.
* Dynamically sets a default fallback visual avatar if `image_url` is missing.

### Token Mapping
Converts `meal_tokens` transaction states to clean frontend state properties:
* Maps database `meal_type` enum (`'forenoon'`, `'afternoon'`) to user-friendly titles (`'Breakfast'`, `'Lunch'`).
* Maps database transaction states (`'awaiting_scan'`, `'token_issued'`, `'approved'`, `'rejected'`, `'redeemed'`, `'expired'`) to 3 primary UI states: `'active'`, `'approved'`, or `'rejected'`.
* Ensures timestamp fields are returned as standard ISO-8601 strings.

---

## 4. REST API Endpoint Reference

### `GET /api/students`
* **Description**: Returns all registered student profiles linked with their user display names.
* **Response Status**: `200 OK`
* **JSON Format**:
  ```json
  [
    {
      "reg_no": "220101",
      "name": "Alice Smith",
      "year": "2nd Year",
      "department": "Computer Science",
      "image_url": "https://ui-avatars.com/api/?name=Alice+Smith&background=random"
    }
  ]
  ```

---

### `GET /api/tokens`
* **Description**: Retrieves a history of issued and processed meal tokens.
* **Query Parameters**:
  * `staff_id` (Optional) - Filters logs processed or scanned by a specific staff operator.
* **Response Status**: `200 OK`
* **JSON Format**:
  ```json
  [
    {
      "student_reg": "220101",
      "token_id": "TOK-123456",
      "meal_type": "Lunch",
      "status": "approved",
      "created_at": "2026-07-18T02:15:30.123456",
      "issued_by": "STAFF101",
      "processed_by": "STAFF101"
    }
  ]
  ```

---

### `GET /api/tokens/<token_id>`
* **Description**: Fetches detailed validation data for a single specific token.
* **Response Status**: `200 OK` (or `404 Not Found` if token doesn't exist)
* **JSON Format**:
  ```json
  {
    "token": {
      "student_reg": "220101",
      "token_id": "TOK-123456",
      "meal_type": "Lunch",
      "status": "active",
      "created_at": "2026-07-18T02:15:30.123456",
      "issued_by": "STAFF101",
      "processed_by": null
    },
    "student": {
      "reg_no": "220101",
      "name": "Alice Smith",
      "year": "2nd Year",
      "department": "Computer Science",
      "image_url": "https://ui-avatars.com/api/?name=Alice+Smith&background=random"
    }
  }
  ```

---

### `POST /api/tokens`
* **Description**: Generates a new meal token for a student profile.
* **Validation Rules**:
  1. Student registration number must exist in `student_meals`.
  2. Student must not have another active meal token pending scan.
  3. Inserts an audit trace in `scan_audit_log` recording the success or reason for failure.
* **Request JSON Body**:
  ```json
  {
    "student_reg": "220101",
    "meal_type": "Breakfast",
    "staff_id": "STAFF101"
  }
  ```
* **Response Status**: `201 Created`
* **JSON Format**:
  ```json
  {
    "message": "Token issued successfully",
    "token_id": "TOK-1721200000"
  }
  ```

---

### `PATCH /api/tokens/<token_id>`
* **Description**: Approves or Rejects an active meal token upon scanning at the canteen service terminal.
* **Validation Rules**:
  1. Target token must exist.
  2. Commits result, processing timestamp, and operator signature to `meal_tokens`.
  3. Records a security telemetry trace in `scan_audit_log`.
* **Request JSON Body**:
  ```json
  {
    "status": "approved",
    "staff_id": "STAFF101"
  }
  ```
* **Response Status**: `200 OK`
* **JSON Format**:
  ```json
  {
    "message": "Token updated successfully"
  }
  ```

---

## 5. Security Auditing & Logs

Every issue or state-change request triggers automated telemetry logging inside `scan_audit_log`. 
If a student attempts to scan an eligible code twice, or a staff member scans an invalid or expired token barcode, the application logs the details with an appropriate failure signature (e.g. `duplicate_meal`, `invalid_token`) to allow system administrators to easily review activity and prevent unauthorized access.
