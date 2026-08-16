import os
import re
import uuid
import json
import base64
import mimetypes
import datetime
import logging
from flask import Flask, request, send_file, jsonify, send_from_directory, Blueprint
from flask_cors import CORS
from werkzeug.utils import secure_filename
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from PIL import Image as PILImage

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# app = Flask(__name__)
# app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB
# 
# # Restrict CORS in production — set CORS_ORIGINS env var
# cors_origins = os.environ.get('CORS_ORIGINS', '*')
# if cors_origins == '*':
#     CORS(app, resources={r"/api/*": {"origins": "*"}}, expose_headers=['X-Central-Sync', 'X-Central-Sync-Message'])
# else:
#     CORS(app, resources={r"/api/*": {"origins": cors_origins.split(',')}}, expose_headers=['X-Central-Sync', 'X-Central-Sync-Message'])
reg_bp = Blueprint('reg_bp', __name__)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.abspath(os.path.join(BASE_DIR, 'uploads'))
STUDENT_MASTER_IMG_FOLDER = os.path.abspath(os.path.join(UPLOAD_FOLDER, 'student_master_img'))
STUDENT_SIGNATURE_FOLDER = os.path.abspath(os.path.join(UPLOAD_FOLDER, 'student_signatures'))
INCOME_PROOF_FOLDER = os.path.abspath(os.path.join(UPLOAD_FOLDER, 'income_proofs'))
PDF_FOLDER = os.path.abspath(os.path.join(BASE_DIR, 'generated_pdfs'))

# Automatically create the target folders if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(STUDENT_MASTER_IMG_FOLDER, exist_ok=True)
os.makedirs(STUDENT_SIGNATURE_FOLDER, exist_ok=True)
os.makedirs(INCOME_PROOF_FOLDER, exist_ok=True)
os.makedirs(PDF_FOLDER, exist_ok=True)

# --- CENTRALIZED MYSQL INTEGRATION ---
# This connects to the SAME MySQL server/database used by the admin meal-portal app,
# so registrations submitted here become visible in the admin's Database Module.
MYSQL_HOST = os.environ.get('MYSQL_HOST', '127.0.0.1')
MYSQL_PORT = int(os.environ.get('MYSQL_PORT', '3306'))
MYSQL_USER = os.environ.get('MYSQL_USER', 'meal_app')
MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', 'Admin@RKMVC2')
MYSQL_DATABASE = os.environ.get('MYSQL_DATABASE', 'rkmvc_mealflow_db')
# Name of the dynamic table (as seen in the admin app's Database Module) that
# will hold submissions from this registration form.
REGISTRATIONS_TABLE = 'meal_registrations'


def _format_degree_year(val):
    if not val:
        return ''
    s = str(val).strip()
    s_lower = s.lower()
    if '1' in s_lower or 'first' in s_lower or s_lower == 'i':
        return '1st Year'
    elif '2' in s_lower or 'second' in s_lower or s_lower == 'ii':
        return '2nd Year'
    elif '3' in s_lower or 'third' in s_lower or s_lower == 'iii':
        return '3rd Year'
    elif 'graduat' in s_lower or 'complet' in s_lower:
        return 'Graduated'
    elif 'year' in s_lower:
        return s.title()
    else:
        return f"{s} Year" if not s.endswith('Year') else s

def _get_mysql_connection():
    import pymysql
    target_host = os.environ.get('MYSQL_HOST', os.environ.get('DB_HOST', '127.0.0.1'))
    hosts_to_try = [target_host, 'db', '127.0.0.1']
    for host_candidate in dict.fromkeys(hosts_to_try):
        try:
            return pymysql.connect(
                host=host_candidate,
                port=MYSQL_PORT,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                database=MYSQL_DATABASE,
                charset='utf8mb4',
                autocommit=True
            )
        except Exception:
            continue
    return pymysql.connect(
        host=target_host,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE,
        charset='utf8mb4',
        autocommit=True
    )


def _ensure_state_table(conn):
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS app_state (
                id INT PRIMARY KEY,
                data JSON NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)


def _registration_columns():
    return [
        { "name": "registration_id", "type": "TEXT", "primaryKey": True, "nullable": False },
        { "name": "app_no", "type": "TEXT", "nullable": True },
        { "name": "student_name", "type": "TEXT", "nullable": False },
        { "name": "dob_age", "type": "TEXT", "nullable": True },
        { "name": "course", "type": "TEXT", "nullable": True },
        { "name": "department", "type": "TEXT", "nullable": True },
        { "name": "degree_year", "type": "TEXT", "nullable": True },
        { "name": "dept_number", "type": "TEXT", "nullable": True },
        { "name": "email", "type": "TEXT", "nullable": True },
        { "name": "mobile_no", "type": "TEXT", "nullable": True },
        { "name": "father_name", "type": "TEXT", "nullable": True },
        { "name": "father_occupation", "type": "TEXT", "nullable": True },
        { "name": "forenoon_meal", "type": "BOOLEAN", "nullable": False },
        { "name": "afternoon_meal", "type": "BOOLEAN", "nullable": False },
        { "name": "is_ncc_student", "type": "BOOLEAN", "nullable": False },
        { "name": "annual_income", "type": "TEXT", "nullable": True },
        { "name": "distance_km", "type": "TEXT", "nullable": True },
        { "name": "status", "type": "TEXT", "nullable": False },
        { "name": "student_photo_base64", "type": "TEXT", "nullable": True },
        { "name": "applicant_signature_base64", "type": "TEXT", "nullable": True },
        { "name": "income_proof_filename", "type": "TEXT", "nullable": True },
        { "name": "income_proof_base64", "type": "TEXT", "nullable": True },
        { "name": "permanent_address", "type": "TEXT", "nullable": True },
        { "name": "permanent_pin", "type": "TEXT", "nullable": True },
        { "name": "local_address", "type": "TEXT", "nullable": True },
        { "name": "local_pin", "type": "TEXT", "nullable": True },
        { "name": "landline", "type": "TEXT", "nullable": True },
        { "name": "employment_type", "type": "TEXT", "nullable": True },
        { "name": "religion", "type": "TEXT", "nullable": True },
        { "name": "community", "type": "TEXT", "nullable": True },
        { "name": "last_year_id", "type": "TEXT", "nullable": True },
        { "name": "submitted_at", "type": "DATE", "nullable": False },
    ]


def _normalize_image_for_pdf(src_path):
    """Ensure the image is a clean PNG suitable for ReportLab.

    If the source is already a normalized safe PNG, return it unchanged.
    """
    if src_path.lower().endswith('_safe.png'):
        return src_path

    try:
        with PILImage.open(src_path) as pil_img:
            pil_img = pil_img.convert('RGB')
            target_path = os.path.splitext(src_path)[0] + '_safe.png'
            pil_img.save(target_path, format='PNG')
            return target_path
    except Exception as e:
        logger.warning(f"Image normalization warning for {src_path}: {e}")
        return src_path


def push_registration_to_central_db(row):
    """
    Writes one submitted registration into the centralized MySQL database,
    inside the 'meal_registrations' SQL table.
    """
    conn = None
    try:
        conn = _get_mysql_connection()
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS meal_registrations (
                    registration_id VARCHAR(50) PRIMARY KEY,
                    app_no VARCHAR(50) NULL,
                    student_name VARCHAR(100) NOT NULL,
                    dob_age VARCHAR(50) NULL,
                    date_of_birth VARCHAR(50) NULL,
                    age INT NULL,
                    course VARCHAR(100) NULL,
                    department VARCHAR(100) NULL,
                    degree_year VARCHAR(20) NULL,
                    dept_number VARCHAR(50) NULL,
                    mobile_no VARCHAR(20) NULL,
                    email VARCHAR(100) NULL,
                    father_name VARCHAR(100) NULL,
                    father_occupation VARCHAR(100) NULL,
                    forenoon_meal TINYINT(1) DEFAULT 1,
                    afternoon_meal TINYINT(1) DEFAULT 1,
                    is_ncc_student TINYINT(1) NOT NULL DEFAULT 0,
                    annual_income VARCHAR(50) NULL,
                    distance_km VARCHAR(50) NULL,
                    permanent_address TEXT NULL,
                    permanent_pin VARCHAR(20) NULL,
                    local_address TEXT NULL,
                    local_pin VARCHAR(20) NULL,
                    landline VARCHAR(50) NULL,
                    employment_type VARCHAR(50) NULL,
                    religion VARCHAR(50) NULL,
                    community VARCHAR(50) NULL,
                    last_year_id VARCHAR(50) NULL,
                    student_image_path VARCHAR(512) NULL,
                    student_photo_url VARCHAR(512) NULL,
                    signature_path VARCHAR(512) NULL,
                    applicant_signature_url VARCHAR(512) NULL,
                    income_proof_path VARCHAR(512) NULL,
                    income_proof_url VARCHAR(512) NULL,
                    generated_pdf_url VARCHAR(512) NULL,
                    status ENUM('pending','approved','rejected') DEFAULT 'pending',
                    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_reg_status (status),
                    INDEX idx_reg_dept (dept_number),
                    INDEX idx_reg_mobile (mobile_no)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            """)

            for col, col_def in [
                ('date_of_birth', 'VARCHAR(50) NULL AFTER dob_age'),
                ('age', 'INT NULL AFTER date_of_birth'),
                ('student_image_path', 'VARCHAR(512) NULL'),
                ('signature_path', 'VARCHAR(512) NULL'),
                ('income_proof_path', 'VARCHAR(512) NULL'),
                ('student_photo_url', 'VARCHAR(512) NULL'),
                ('applicant_signature_url', 'VARCHAR(512) NULL'),
                ('income_proof_url', 'VARCHAR(512) NULL'),
                ('is_ncc_student', 'TINYINT(1) NOT NULL DEFAULT 0'),
            ]:
                try:
                    cur.execute(f"ALTER TABLE meal_registrations ADD COLUMN {col} {col_def}")
                except Exception:
                    pass

            cur.execute("""
                INSERT INTO meal_registrations (
                    registration_id, app_no, student_name, dob_age, date_of_birth, age, course, department,
                    degree_year, dept_number, mobile_no, email, father_name, father_occupation,
                    forenoon_meal, afternoon_meal, is_ncc_student, annual_income, distance_km, permanent_address,
                    permanent_pin, local_address, local_pin, landline, employment_type, religion,
                    community, last_year_id, student_image_path, student_photo_url, signature_path,
                    applicant_signature_url, income_proof_path, income_proof_url, generated_pdf_url, status
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s
                ) ON DUPLICATE KEY UPDATE
                    date_of_birth=VALUES(date_of_birth),
                    age=VALUES(age),
                    is_ncc_student=VALUES(is_ncc_student),
                    student_image_path=VALUES(student_image_path),
                    student_photo_url=VALUES(student_photo_url),
                    signature_path=VALUES(signature_path),
                    applicant_signature_url=VALUES(applicant_signature_url),
                    income_proof_path=VALUES(income_proof_path),
                    income_proof_url=VALUES(income_proof_url),
                    status=VALUES(status)
            """, (
                row.get('registration_id'), row.get('app_no'), row.get('student_name'), row.get('dob_age'),
                row.get('date_of_birth'), row.get('age'),
                row.get('course'), row.get('department'), row.get('degree_year'), row.get('dept_number'),
                row.get('mobile_no'), row.get('email'), row.get('father_name'), row.get('father_occupation'),
                bool(row.get('forenoon_meal')), bool(row.get('afternoon_meal')), bool(row.get('is_ncc_student')),
                row.get('annual_income'),
                row.get('distance_km'), row.get('permanent_address'), row.get('permanent_pin'),
                row.get('local_address'), row.get('local_pin'), row.get('landline'), row.get('employment_type'),
                row.get('religion'), row.get('community'), row.get('last_year_id'),
                row.get('student_image_path') or row.get('student_photo_url'),
                row.get('student_photo_url') or row.get('student_image_path'),
                row.get('signature_path') or row.get('applicant_signature_url'),
                row.get('applicant_signature_url') or row.get('signature_path'),
                row.get('income_proof_path') or row.get('income_proof_url'),
                row.get('income_proof_url') or row.get('income_proof_path'),
                row.get('generated_pdf_url'), row.get('status', 'pending')
            ))
        conn.commit()

        try:
            _ensure_state_table(conn)
            conn.autocommit(False)
            with conn.cursor() as cur:
                cur.execute("SELECT data FROM app_state WHERE id = 1 FOR UPDATE")
                existing = cur.fetchone()
                if existing is None:
                    state = {"users": [], "import_logs": [], "export_logs": [], "audit_logs": [], "tables": {}}
                else:
                    data_val = existing.get('data') if isinstance(existing, dict) else existing[0]
                    state = json.loads(data_val)
                    state.setdefault("tables", {})

                if REGISTRATIONS_TABLE not in state["tables"]:
                    state["tables"][REGISTRATIONS_TABLE] = {
                        "createdAt": datetime.datetime.utcnow().isoformat() + "Z",
                        "columns": _registration_columns(),
                        "rows": []
                    }

                state["tables"][REGISTRATIONS_TABLE]["rows"].append(row)
                if existing is None:
                    cur.execute("INSERT INTO app_state (id, data) VALUES (1, %s)", (json.dumps(state, ensure_ascii=False),))
                else:
                    cur.execute("UPDATE app_state SET data = %s WHERE id = 1", (json.dumps(state, ensure_ascii=False),))
            conn.commit()
        except Exception as sync_err:
            print(f"[app_state sync notice] {sync_err}")

        return True, "OK"
    except Exception as e:
        if conn:
            try: conn.rollback()
            except Exception: pass
        logger.error(f"Failed to write registration to MySQL database: {e}")
        return False, str(e)
    finally:
        if conn:
            try: conn.close()
            except Exception: pass


@reg_bp.route('/api/central-db/health', methods=['GET'])
def central_db_health():
    try:
        conn = _get_mysql_connection()
        conn.close()
        return jsonify({"connected": True})
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({"connected": False, "error": "Database connection failed"}), 503


# Serve the frontend file and local assets so visiting '/' does not produce 404
@reg_bp.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')


@reg_bp.route('/<path:filename>')
def serve_file(filename):
    return send_from_directory('.', filename)

@reg_bp.route('/api/register/check', methods=['GET'])
@reg_bp.route('/check', methods=['GET'])
def check_registration_duplicate():
    mobile = request.args.get('mobile', '').strip()
    dept = request.args.get('dept', '').strip()
    app_no = request.args.get('app_no', '').strip()
    if not mobile and not dept and not app_no:
        return jsonify({"error": "Provide mobile, dept, or app_no parameter"}), 400
    try:
        conn = _get_mysql_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT registration_id, dept_number, app_no, mobile_no, status 
                    FROM meal_registrations 
                    WHERE status IN ('pending', 'approved')
                      AND (
                        (%s != '' AND dept_number = %s) OR
                        (%s != '' AND app_no = %s AND app_no != 'N/A') OR
                        (%s != '' AND mobile_no = %s)
                      )
                """, (dept, dept, app_no, app_no, mobile, mobile))
                match = cur.fetchone()
                if match:
                    return jsonify({
                        "exists": True,
                        "error": "Application already submitted",
                        "tag": "use another registration number for a new form"
                    })
                
                cur.execute("SELECT data FROM app_state WHERE id = 1")
                row = cur.fetchone()
                if row:
                    state = json.loads(row[0])
                    table = state.get('tables', {}).get(REGISTRATIONS_TABLE, {})
                    for r in table.get('rows', []):
                        if r.get('status') in ('pending', 'approved'):
                            if (dept and r.get('dept_number') == dept) or \
                               (app_no and app_no not in ('N/A', '') and r.get('app_no') == app_no) or \
                               (mobile and r.get('mobile_no') == mobile):
                                return jsonify({
                                    "exists": True,
                                    "error": "Application already submitted",
                                    "tag": "use another registration number for a new form"
                                })
        finally:
            conn.close()

        pending_file = os.path.join(UPLOAD_FOLDER, 'pending_registrations.json')
        if os.path.exists(pending_file):
            try:
                with open(pending_file, 'r', encoding='utf-8') as pf:
                    pending_list = json.load(pf)
                    for r in pending_list:
                        if r.get('status', 'pending') in ('pending', 'approved'):
                            if (dept and r.get('dept_number') == dept) or \
                               (app_no and app_no not in ('N/A', '') and r.get('app_no') == app_no) or \
                               (mobile and r.get('mobile_no') == mobile):
                                return jsonify({
                                    "exists": True,
                                    "error": "Application already submitted",
                                    "tag": "use another registration number for a new form"
                                })
            except Exception:
                pass

        return jsonify({"exists": False})
    except Exception as e:
        logger.error(f"Check registration duplicate error: {e}")
        return jsonify({"exists": False, "check_error": str(e)})

@reg_bp.route('/fetch-student', methods=['GET'])
@reg_bp.route('/api/register/fetch-student', methods=['GET'])
def fetch_student_by_dept_number():
    dept_number = (request.args.get('dept_number') or request.args.get('dept') or '').strip()
    if not dept_number:
        return jsonify({"already_registered": False, "found": False, "error": "Department number required"}), 400

    try:
        conn = _get_mysql_connection()
        try:
            with conn.cursor() as cur:
                # 1a. Check meal_registrations table for existing application
                cur.execute("""
                    SELECT registration_id, dept_number, student_name, status 
                    FROM meal_registrations 
                    WHERE (LOWER(TRIM(dept_number)) = %s OR LOWER(TRIM(registration_id)) = %s OR LOWER(TRIM(app_no)) = %s)
                      AND status IN ('pending', 'approved')
                    LIMIT 1
                """, (dept_number.lower(), dept_number.lower(), dept_number.lower()))
                reg_match = cur.fetchone()
                if reg_match:
                    return jsonify({
                        "already_registered": True,
                        "exists": True,
                        "found": True,
                        "message": "Already registered with this Department Number",
                        "status": reg_match.get('status')
                    })

                # 1b. Check student_meals table for approved student account
                cur.execute("""
                    SELECT student_id, name FROM student_meals 
                    WHERE LOWER(TRIM(student_id)) = %s LIMIT 1
                """, (dept_number.lower(),))
                sm_match = cur.fetchone()
                if sm_match:
                    return jsonify({
                        "already_registered": True,
                        "exists": True,
                        "found": True,
                        "message": "Already registered with this Department Number",
                        "status": "approved"
                    })

                # 1c. Check app_state table for meal_registrations
                cur.execute("SELECT data FROM app_state WHERE id = 1")
                row = cur.fetchone()
                app_state_data = None
                if row:
                    raw_data = row[0] if isinstance(row, (tuple, list)) else row.get('data') if isinstance(row, dict) else row
                    app_state_data = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
                    if isinstance(app_state_data, dict):
                        table = app_state_data.get('tables', {}).get(REGISTRATIONS_TABLE, {})
                        for r in table.get('rows', []):
                            r_dept = (r.get('dept_number') or r.get('registration_id') or r.get('app_no') or '').strip().lower()
                            if r_dept == dept_number.lower() and r.get('status') in ('pending', 'approved'):
                                return jsonify({
                                    "already_registered": True,
                                    "exists": True,
                                    "found": True,
                                    "message": "Already registered with this Department Number",
                                    "status": r.get('status')
                                })

                # 1d. Check pending_registrations.json file
                pending_file = os.path.join(UPLOAD_FOLDER, 'pending_registrations.json')
                if os.path.exists(pending_file):
                    try:
                        with open(pending_file, 'r', encoding='utf-8') as pf:
                            pending_list = json.load(pf)
                            for r in pending_list:
                                r_dept = (r.get('dept_number') or r.get('registration_id') or r.get('app_no') or '').strip().lower()
                                if r_dept == dept_number.lower() and r.get('status', 'pending') in ('pending', 'approved'):
                                    return jsonify({
                                        "already_registered": True,
                                        "exists": True,
                                        "found": True,
                                        "message": "Already registered with this Department Number",
                                        "status": r.get('status', 'pending')
                                    })
                    except Exception:
                        pass

                # Step 2: Student is not registered yet. Search master tables / imported CSV tables
                found_student = None

                # Search in app_state tables (where CSV files are imported by Admin)
                if app_state_data and isinstance(app_state_data, dict):
                    tables_dict = app_state_data.get('tables', {})
                    for tbl_name, tbl_info in tables_dict.items():
                        if tbl_name == REGISTRATIONS_TABLE:
                            continue
                        rows = tbl_info.get('rows', [])
                        for r in rows:
                            r_dept = (r.get('dept_number') or r.get('department_number') or r.get('student_id') or r.get('roll_no') or r.get('reg_no') or r.get('dept_no') or '').strip()
                            if r_dept == dept_number:
                                found_student = {
                                    "student_name": r.get('student_name') or r.get('name') or r.get('full_name'),
                                    "course": r.get('course') or r.get('degree') or r.get('grade_section'),
                                    "department": r.get('department') or r.get('dept') or r.get('branch'),
                                    "degree_year": r.get('degree_year') or r.get('year') or r.get('year_of_study'),
                                    "date_of_birth": r.get('date_of_birth') or r.get('dob'),
                                    "age": r.get('age'),
                                    "mobile_no": r.get('mobile_no') or r.get('phone') or r.get('mobile'),
                                    "email": r.get('email'),
                                    "father_name": r.get('father_name') or r.get('father_s_name') or r.get('parent_name'),
                                    "father_occupation": r.get('father_occupation'),
                                    "employment_type": r.get('employment_type'),
                                    "annual_income": r.get('annual_income') or r.get('income'),
                                    "permanent_address": r.get('permanent_address') or r.get('address'),
                                    "permanent_pin": r.get('permanent_pin') or r.get('pincode') or r.get('pin'),
                                    "local_address": r.get('local_address'),
                                    "local_pin": r.get('local_pin'),
                                    "religion": r.get('religion'),
                                    "community": r.get('community'),
                                    "distance_km": r.get('distance_km'),
                                    "forenoon_meal": r.get('forenoon_meal'),
                                    "afternoon_meal": r.get('afternoon_meal')
                                }
                                break
                        if found_student:
                            break

                # Search physical MySQL tables
                if not found_student:
                    cur.execute("SHOW TABLES")
                    raw_tables = cur.fetchall()
                    db_tables = [list(t.values())[0] if isinstance(t, dict) else t[0] for t in raw_tables]
                    for tbl in db_tables:
                        if tbl in ('app_state', 'schema_migrations', 'meal_registrations', 'users', 'meal_tokens', 'scan_audit_log', 'import_logs', 'export_logs', 'audit_logs'):
                            continue
                        try:
                            cur.execute(f"DESCRIBE `{tbl}`")
                            cols = [c['Field'].lower() if isinstance(c, dict) else c[0].lower() for c in cur.fetchall()]
                            dept_col = next((c for c in cols if c in ('dept_number', 'department_number', 'student_id', 'roll_no', 'reg_no', 'dept_no')), None)
                            if dept_col:
                                cur.execute(f"SELECT * FROM `{tbl}` WHERE `{dept_col}` = %s LIMIT 1", (dept_number,))
                                st_row = cur.fetchone()
                                if st_row:
                                    found_student = {
                                        "student_name": st_row.get('student_name') or st_row.get('name') or st_row.get('full_name'),
                                        "course": st_row.get('course') or st_row.get('degree') or st_row.get('grade_section'),
                                        "department": st_row.get('department') or st_row.get('dept') or st_row.get('branch'),
                                        "degree_year": st_row.get('degree_year') or st_row.get('year'),
                                        "date_of_birth": st_row.get('date_of_birth') or st_row.get('dob'),
                                        "age": st_row.get('age'),
                                        "mobile_no": st_row.get('mobile_no') or st_row.get('phone') or st_row.get('mobile'),
                                        "email": st_row.get('email'),
                                        "father_name": st_row.get('father_name') or st_row.get('parent_name'),
                                        "father_occupation": st_row.get('father_occupation'),
                                        "employment_type": st_row.get('employment_type'),
                                        "annual_income": st_row.get('annual_income') or st_row.get('income'),
                                        "permanent_address": st_row.get('permanent_address') or st_row.get('address'),
                                        "permanent_pin": st_row.get('permanent_pin') or st_row.get('pincode') or st_row.get('pin'),
                                        "local_address": st_row.get('local_address'),
                                        "local_pin": st_row.get('local_pin'),
                                        "religion": st_row.get('religion'),
                                        "community": st_row.get('community'),
                                        "distance_km": st_row.get('distance_km'),
                                        "student_photo_url": st_row.get('student_photo_url') or st_row.get('photo_url') or st_row.get('image_url') or st_row.get('image_path') or st_row.get('photo_path') or st_row.get('img_path') or st_row.get('photo') or st_row.get('image')
                                    }
                                    break
                        except Exception:
                            continue

                # Auto-detect image file on disk in student_master_img by dept_number / roll_no
                disk_photo_url = None
                possible_subdirs = ['student_master_img']
                possible_exts = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']
                search_bases = [
                    os.path.join(BASE_DIR, 'registration_backend', 'uploads'),
                    os.path.join(BASE_DIR, 'uploads'),
                    UPLOAD_FOLDER,
                    STUDENT_MASTER_IMG_FOLDER
                ]
                for sub in possible_subdirs:
                    for ext in possible_exts:
                        fname = f"{dept_number}{ext}"
                        for base in search_bases:
                            fpath = os.path.join(base, sub, fname) if not base.endswith(sub) else os.path.join(base, fname)
                            if os.path.exists(fpath):
                                disk_photo_url = f"/uploads/{sub}/{fname}"
                                break
                        if disk_photo_url:
                            break
                    if disk_photo_url:
                        break

                if not found_student and disk_photo_url:
                    found_student = {
                        "student_photo_url": disk_photo_url
                    }
                elif found_student:
                    if disk_photo_url:
                        found_student['student_photo_url'] = disk_photo_url
                    elif not found_student.get('student_photo_url'):
                        photo_val = (found_student.get('photo_url') or found_student.get('image_url') or 
                                     found_student.get('image_path') or found_student.get('photo_path') or 
                                     found_student.get('img_path') or found_student.get('photo') or found_student.get('image'))
                        if photo_val and str(photo_val).strip():
                            p_str = str(photo_val).strip()
                            if p_str.startswith('http://') or p_str.startswith('https://') or p_str.startswith('data:'):
                                found_student['student_photo_url'] = p_str
                            else:
                                if not p_str.startswith('/'):
                                    p_str = '/' + p_str
                                if not p_str.startswith('/uploads/'):
                                    p_str = '/uploads/' + p_str.lstrip('/')
                                found_student['student_photo_url'] = p_str

                if found_student:
                    cleaned_student = {k: v for k, v in found_student.items() if v is not None}
                    return jsonify({
                        "already_registered": False,
                        "found": True,
                        "student": cleaned_student
                    })
                else:
                    return jsonify({
                        "already_registered": False,
                        "found": False,
                        "message": "No pre-filled details found for this Department Number"
                    })

        finally:
            conn.close()

    except Exception as e:
        logger.error(f"Error in fetch_student_by_dept_number: {e}")
        return jsonify({
            "already_registered": False,
            "found": False,
            "error": str(e)
        }), 500

@reg_bp.route('/api/register', methods=['POST'])
@reg_bp.route('/api/register/submit', methods=['POST'])
@reg_bp.route('/submit', methods=['POST'])
@reg_bp.route('/', methods=['POST'])
@reg_bp.route('', methods=['POST'])
def register_student():
    try:
        # Support both JSON and multipart/form-data
        data = request.json if request.is_json else request.form

        # 1. Grab text data from the incoming form or json fields
        app_no = data.get('app_no', 'N/A')
        student_name = data.get('student_name')
        dob_age = data.get('dob_age')
        course = data.get('course')
        department = data.get('department')
        raw_year = (data.get('degree_year') or data.get('year') or '').strip()
        if not raw_year:
            return jsonify({"error": "Year of Degree (1st Year, 2nd Year, or 3rd Year) is required to submit application."}), 400
        degree_year = _format_degree_year(raw_year)
        dept_number = (data.get('dept_number') or '').strip()
        if not dept_number or not re.match(r'^\d{13}$', dept_number):
            return jsonify({"error": "Department Number must be exactly 13 digits."}), 400

        date_of_birth = (data.get('date_of_birth') or '').strip()
        age_str = (data.get('age') or '').strip()
        if not date_of_birth and dob_age:
            match = re.search(r'\d{2}/\d{2}/\d{4}', dob_age)
            if match:
                date_of_birth = match.group(0)

        calc_age = None
        if age_str.isdigit():
            calc_age = int(age_str)
        elif date_of_birth:
            try:
                parts = date_of_birth.split('/')
                if len(parts) == 3:
                    day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
                    today = datetime.date.today()
                    calc_age = today.year - year - ((today.month, today.day) < (month, day))
            except Exception:
                pass

        if not dob_age and date_of_birth:
            dob_age = f"{date_of_birth} ({calc_age} Years)" if calc_age is not None else date_of_birth
        permanent_address = data.get('permanent_address')
        permanent_pin = data.get('permanent_pin')
        local_address = data.get('local_address')
        local_pin = data.get('local_pin')
        landline = data.get('landline', 'N/A')
        mobile_no = data.get('mobile_no')
        email = data.get('email')
        father_name = data.get('father_name')
        father_occupation = data.get('father_occupation')
        employment_type = data.get('employment_type')
        religion = data.get('religion', 'General')
        community = data.get('community', 'General')
        annual_income = data.get('annual_income')
        distance_km = data.get('distance_km')
        last_year_id = data.get('last_year_id', 'N/A')
        if annual_income:
            try:
                annual_income = str(float(str(annual_income).replace(',', '').strip()))
            except Exception:
                annual_income = "0"
        else:
            annual_income = "0"

        if distance_km:
            try:
                distance_km = str(float(str(distance_km).replace(',', '').strip()))
            except Exception:
                distance_km = "0"
        else:
            distance_km = "0"
        forenoon_meal = bool(data.get('forenoon_meal'))
        afternoon_meal = bool(data.get('afternoon_meal'))
        both_meal = bool(data.get('both_meal'))
        if both_meal or (not forenoon_meal and not afternoon_meal):
            forenoon_meal = True
            afternoon_meal = True
        is_ncc_student = bool(data.get('is_ncc_student'))
        if not religion:
            return jsonify({"error": "Religion is required."}), 400
        if not community:
            return jsonify({"error": "Community is required."}), 400

        # 1b. Check for duplicate submission by registration no (dept_number), app_no, or mobile_no
        try:
            dup_conn = _get_mysql_connection()
            try:
                with dup_conn.cursor() as dup_cur:
                    dup_cur.execute("""
                        SELECT registration_id, dept_number, app_no, mobile_no, status 
                        FROM meal_registrations 
                        WHERE status IN ('pending', 'approved')
                          AND (
                            (%s != '' AND dept_number = %s) OR
                            (%s != '' AND app_no = %s AND app_no != 'N/A') OR
                            (%s != '' AND mobile_no = %s)
                          )
                    """, (dept_number or '', dept_number or '', app_no or '', app_no or '', mobile_no or '', mobile_no or ''))
                    if dup_cur.fetchone():
                        return jsonify({
                            "error": "Application already submitted",
                            "tag": "use another registration number for a new form",
                            "details": "DUPLICATE_REGISTRATION"
                        }), 409

                    dup_cur.execute("SELECT data FROM app_state WHERE id = 1")
                    dup_row = dup_cur.fetchone()
                    if dup_row:
                        dup_data_val = dup_row.get('data') if isinstance(dup_row, dict) else dup_row[0]
                        dup_state = json.loads(dup_data_val)
                        dup_table = dup_state.get('tables', {}).get(REGISTRATIONS_TABLE, {})
                        for existing in dup_table.get('rows', []):
                            if existing.get('status') in ('pending', 'approved'):
                                if (dept_number and existing.get('dept_number') == dept_number) or \
                                   (app_no and app_no not in ('N/A', '') and existing.get('app_no') == app_no) or \
                                   (mobile_no and existing.get('mobile_no') == mobile_no):
                                    return jsonify({
                                        "error": "Application already submitted",
                                        "tag": "use another registration number for a new form",
                                        "details": "DUPLICATE_REGISTRATION"
                                    }), 409
            finally:
                dup_conn.close()
        except Exception as dup_err:
            logger.warning(f"Duplicate DB check error: {dup_err}")
            pass  # Fall back gracefully

        # Determine unique student register code for filename normalization
        reg_code = secure_filename(str(dept_number or app_no or f"REG_{uuid.uuid4().hex[:8]}").strip().replace(' ', '_'))

        # 2. Assign Passport Photo from uploads/student_master_img folder
        photo_file = request.files.get('student_photo') or request.files.get('student_image') or request.files.get('photo')
        photo_path = ""
        photo_rel_path = ""
        if photo_file and getattr(photo_file, 'filename', ''):
            orig_name = secure_filename(photo_file.filename)
            ext = os.path.splitext(orig_name)[1].lower() if orig_name else '.png'
            safe_name = f"{reg_code}_photo{ext}"
            photo_path = os.path.join(STUDENT_MASTER_IMG_FOLDER, safe_name)
            photo_file.save(photo_path)
            photo_rel_path = f"/uploads/student_master_img/{safe_name}"
        else:
            found_master = None
            possible_exts = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']
            for check_id in [dept_number, reg_code]:
                if check_id:
                    for ext in possible_exts:
                        candidate = f"{str(check_id).strip()}{ext}"
                        if os.path.exists(os.path.join(STUDENT_MASTER_IMG_FOLDER, candidate)):
                            found_master = candidate
                            break
                if found_master:
                    break

            if found_master:
                photo_rel_path = f"/uploads/student_master_img/{found_master}"
            else:
                safe_name = f"{reg_code}_photo.png"
                photo_path = os.path.join(STUDENT_MASTER_IMG_FOLDER, safe_name)
                if not os.path.exists(photo_path):
                    with open(photo_path, 'wb') as f:
                        f.write(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="))
                photo_rel_path = f"/uploads/student_master_img/{safe_name}"

        # Save Signature directly into uploads/student_signatures folder
        signature_file = request.files.get('applicant_signature') or request.files.get('signature') or request.files.get('student_signature')
        signature_path = ""
        sig_rel_path = ""
        if signature_file and getattr(signature_file, 'filename', ''):
            orig_name = secure_filename(signature_file.filename)
            ext = os.path.splitext(orig_name)[1].lower() if orig_name else '.png'
            sig_safe = f"{reg_code}_signature{ext}"
            signature_path = os.path.join(STUDENT_SIGNATURE_FOLDER, sig_safe)
            signature_file.save(signature_path)
            sig_rel_path = f"/uploads/student_signatures/{sig_safe}"
        else:
            sig_safe = f"{reg_code}_signature.png"
            signature_path = os.path.join(STUDENT_SIGNATURE_FOLDER, sig_safe)
            with open(signature_path, 'wb') as f:
                f.write(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="))
            sig_rel_path = f"/uploads/student_signatures/{sig_safe}"

        # Save Income Proof directly into uploads/income_proofs folder
        income_proof_file = request.files.get('income_proof') or request.files.get('income_document')
        income_proof_filename = ""
        income_rel_path = ""
        if income_proof_file and getattr(income_proof_file, 'filename', ''):
            orig_name = secure_filename(income_proof_file.filename)
            ext = os.path.splitext(orig_name)[1].lower() or '.pdf'
            safe_name = f"{reg_code}_income{ext}"
            income_proof_path = os.path.join(INCOME_PROOF_FOLDER, safe_name)
            income_proof_file.save(income_proof_path)
            income_proof_filename = safe_name
            income_rel_path = f"/uploads/income_proofs/{safe_name}"
        else:
            safe_name = f"{reg_code}_income.pdf"
            income_proof_path = os.path.join(INCOME_PROOF_FOLDER, safe_name)
            with open(income_proof_path, 'wb') as f:
                f.write(b"%PDF-1.4 %EOF")
            income_proof_filename = safe_name
            income_rel_path = f"/uploads/income_proofs/{safe_name}"

        # 3. Define unique filename and destination path for the PDF
        student_name_clean = secure_filename(str(student_name or 'Student')).strip().replace(' ', '_') or 'Student'
        filename = f"Meal_Application_{student_name_clean}.pdf"
        local_pdf_path = os.path.join(PDF_FOLDER, filename)


        # 4. Generate and compile the PDF design layout
        doc = SimpleDocTemplate(local_pdf_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        story = []
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle('TitleStyle', fontName='Helvetica-Bold', fontSize=18, textColor=colors.HexColor('#78350f'), alignment=1)
        sub_title = ParagraphStyle('SubStyle', fontName='Helvetica', fontSize=10, textColor=colors.HexColor('#4b5563'), alignment=1)
        badge_style = ParagraphStyle('BadgeStyle', fontName='Helvetica-Bold', fontSize=12, textColor=colors.HexColor('#7c2d12'), alignment=1)
        label_style = ParagraphStyle('LabelStyle', fontName='Helvetica-Bold', fontSize=11, textColor=colors.HexColor('#1f2937'))
        val_style = ParagraphStyle('ValStyle', fontName='Helvetica', fontSize=11, textColor=colors.HexColor('#374151'))

        # Header: logo at left and title/subtitle centered to the right
        logo_path_local = 'logo_img.png'
        logo_element = None
        if os.path.exists(logo_path_local):
            try:
                logo_element = Image(logo_path_local, width=60, height=60)
            except Exception:
                logo_element = None

        header_text = '<b>RAMAKRISHNA MISSION VIDYAPITH</b><br/>' + \
                      '<font size=10>MYLAPORE, CHENNAI - 600 004.</font><br/><br/>' + \
                      '<u>APPLICATION FOR FREE NOON MEALS ID</u>'
        header_par = Paragraph(header_text, title_style)

        # If logo available, create a two-column table for header; otherwise just add the header paragraph
        if logo_element:
            header_table = Table([[logo_element, header_par]], colWidths=[70, 420])
            header_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('ALIGN', (1,0), (1,0), 'CENTER'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))
            story.append(header_table)
        else:
            story.append(header_par)

        story.append(Spacer(1, 18))

        meal_session = "None selected"
        if both_meal or (forenoon_meal and afternoon_meal):
            meal_session = "Both Forenoon and Afternoon Meals"
        elif forenoon_meal:
            meal_session = "Forenoon Meal"
        elif afternoon_meal:
            meal_session = "Afternoon Meal"

        photo_element = Paragraph("[ No Photo ]", val_style)
        if photo_path and os.path.exists(photo_path):
            try:
                normalized_photo = _normalize_image_for_pdf(photo_path)
                photo_element = Image(normalized_photo, width=95, height=120)
            except Exception:
                photo_element = Paragraph("[ Photo unavailable ]", val_style)

        data_rows = [
            [Paragraph("Name of the Student", label_style), Paragraph(f":  {student_name}", val_style), photo_element],
            [Paragraph("Date of Birth", label_style), Paragraph(f":  {dob_age}", val_style), ""],
            [Paragraph("Course", label_style), Paragraph(f":  {course}", val_style), ""],
            [Paragraph("Department", label_style), Paragraph(f":  {department}", val_style), ""],
            [Paragraph("Year of Degree", label_style), Paragraph(f":  {degree_year}", val_style), ""],
            [Paragraph("Department Number", label_style), Paragraph(f":  {dept_number}", val_style), ""],
            [Paragraph("Mobile Number", label_style), Paragraph(f":  {mobile_no}", val_style), ""],
            [Paragraph("Landline Number", label_style), Paragraph(f":  {landline}", val_style), ""],
            [Paragraph("Parent/Guardian Name", label_style), Paragraph(f":  {father_name}", val_style), ""],
            [Paragraph("Parent/Guardian Occupation", label_style), Paragraph(f":  {father_occupation}", val_style), ""],
            [Paragraph("Employment Sector", label_style), Paragraph(f":  {employment_type}", val_style), ""],
            [Paragraph("Annual Income", label_style), Paragraph(f":  Rs. {float(annual_income or 0):,.2f}" if str(annual_income or '').replace('.','',1).isdigit() else f":  Rs. {annual_income or 0}", val_style), ""],
            [Paragraph("Religion", label_style), Paragraph(f":  {religion}", val_style), ""],
            [Paragraph("Community", label_style), Paragraph(f":  {community}", val_style), ""],
            [Paragraph("Distance to College", label_style), Paragraph(f":  {distance_km} Km", val_style), ""],
            [Paragraph("Meal Session Required", label_style), Paragraph(f":  {meal_session}", val_style), ""],
            [Paragraph("NCC Student", label_style), Paragraph(f":  {'Yes' if is_ncc_student else 'No'}", val_style), ""],
            [Paragraph("Permanent Address", label_style), Paragraph(f":  {permanent_address} (PIN: {permanent_pin})", val_style), ""],
        [Paragraph("Local Address", label_style), Paragraph(f":  {local_address} (PIN: {local_pin})", val_style), ""]
        ]

        table = Table(data_rows, colWidths=[160, 260, 120])
        table.setStyle(TableStyle([
            ('SPAN', (2, 0), (2, 4)),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (1, -1), 'LEFT'),
            ('ALIGN', (2, 0), (2, 4), 'CENTER'),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(table)
        story.append(Spacer(1, 40))

        # Create signature elements with student signature if available
        student_sig_element = Paragraph("Student Signature", label_style)
        if signature_path and os.path.exists(signature_path):
            try:
                normalized_signature = _normalize_image_for_pdf(signature_path)
                student_sig_element = Image(normalized_signature, width=100, height=50)
            except Exception:
                student_sig_element = Paragraph("[ Signature unavailable ]", label_style)

        # Show signature image on the first row and the labels on the second row
        sig_data = [
            [Paragraph("", label_style), student_sig_element, Paragraph("", label_style)],
            [Paragraph("Coordinator Signature", label_style), Paragraph("Student Signature", label_style), Paragraph("Secretary Signature", label_style)]
        ]
        sig_table = Table(sig_data, colWidths=[180, 180, 180])
        sig_table.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 10),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,0), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,0), 8)
        ]))
        story.append(sig_table)

        # Build and write the PDF directly into your 'generated_pdfs' folder
        doc.build(story)

        # 5. Push this registration into the centralized MySQL database, so it
        # becomes visible in the admin meal-portal app's Database Module.
        registration_row = {
            "registration_id": "REG_" + uuid.uuid4().hex[:10],
            "app_no": app_no,
            "student_name": student_name,
            "dob_age": dob_age,
            "date_of_birth": date_of_birth,
            "age": calc_age,
            "course": course,
            "department": department,
            "degree_year": degree_year,
            "dept_number": dept_number,
            "mobile_no": mobile_no,
            "email": email or "",
            "father_name": father_name,
            "father_occupation": father_occupation,
            "forenoon_meal": forenoon_meal,
            "afternoon_meal": afternoon_meal,
            "is_ncc_student": is_ncc_student,
            "annual_income": annual_income,
            "distance_km": distance_km,
            "permanent_address": permanent_address,
            "permanent_pin": permanent_pin,
            "local_address": local_address,
            "local_pin": local_pin,
            "landline": landline,
            "employment_type": employment_type,
            "religion": religion,
            "community": community,
            "last_year_id": last_year_id,
            "student_image_path": photo_rel_path,
            "student_photo_url": photo_rel_path,
            "signature_path": sig_rel_path,
            "applicant_signature_url": sig_rel_path,
            "income_proof_path": income_rel_path,
            "income_proof_url": income_rel_path,
            "income_proof_filename": income_proof_filename,
            "generated_pdf_url": f"/generated_pdfs/{filename}",
            "status": "pending",
            "submitted_at": datetime.datetime.utcnow().isoformat() + "Z"
        }
        sync_ok, sync_message = push_registration_to_central_db(registration_row)

        # 6. Push the compiled PDF document back to the mobile browser for download
        response = send_file(local_pdf_path, as_attachment=True, download_name=filename, mimetype='application/pdf')
        # Let the frontend know whether the request actually reached the
        # centralized admin database, since a failed sync would otherwise be silent.
        response.headers['X-Central-Sync'] = 'success' if sync_ok else 'failed'
        response.headers['X-Central-Sync-Message'] = sync_message.replace('\n', ' ').replace('\r', ' ')[:200]
        response.headers['Access-Control-Expose-Headers'] = 'X-Central-Sync, X-Central-Sync-Message'
        return response

    except Exception as e:
        logger.exception("Registration error")
        return jsonify({"error": "Registration submission failed. Please try again.", "details": str(e)}), 500

if __name__ == '__main__':
    # Local/dev entrypoint. In Docker/production, gunicorn is invoked directly
    # from the Dockerfile CMD (gunicorn app:app --bind 0.0.0.0:8000), so this
    # block only runs during `python app.py` for local development.
    port = int(os.environ.get('PORT', 8000))
    logger.info(f"Starting Flask dev server on 0.0.0.0:{port}")
    # app.run(host='0.0.0.0', port=port, debug=False)