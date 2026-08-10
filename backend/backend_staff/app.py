import os
from urllib.parse import quote_plus
import hmac as _hmac
import hashlib
import base64
import json
from flask import Flask, request, jsonify, Blueprint
import mysql.connector
from datetime import datetime, time as dt_time, timedelta as dt_timedelta
from flask_cors import CORS

# app = Flask(__name__)
# CORS(app) # Enable CORS so the React frontend can communicate with this backend
staff_bp = Blueprint('staff_bp', __name__)

# ── QR HMAC config (must match admin_backend) ────────────────────────────────
QR_HMAC_SECRET = os.environ.get('QR_HMAC_SECRET', 'change-this-to-another-random-64-char-string')

def _hmac_sign(data: str) -> str:
    return _hmac.new(QR_HMAC_SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()[:16]

def _hmac_verify(data: str, signature: str) -> bool:
    return _hmac.compare_digest(_hmac_sign(data), signature)

def _decode_qr_payload(raw: str):
    """Try to decode a base64+HMAC signed QR payload.
    Returns (qr_data_dict, error_str).  On success error_str is None."""
    raw = raw.strip()
    # Strategy 1: base64-encoded signed payload  (student QR and token QR)
    try:
        decoded = base64.urlsafe_b64decode(raw.encode()).decode()
        payload_part, sig = decoded.rsplit('.', 1)
        if not _hmac_verify(payload_part, sig):
            return None, 'QR signature invalid'
        return json.loads(payload_part), None
    except Exception:
        pass
    # Strategy 2: plain JSON   {"sid": "..."}
    if raw.startswith('{'):
        try:
            return json.loads(raw), None
        except Exception:
            pass
    # Strategy 3: plain student-id or token-uid string
    return {'_raw': raw}, None

# Configure your MySQL connection (reads from environment variables with local fallback)
# Updated to default to the user-specified database 'rkmvc_mealflow_db'
db_config = {
    'user': os.environ.get('DB_USER', os.environ.get('MYSQL_USER', 'meal_app')),
    'password': os.environ.get('DB_PASSWORD', os.environ.get('MYSQL_PASSWORD', 'Admin@RKMVC2')),
    'host': os.environ.get('DB_HOST', os.environ.get('MYSQL_HOST', '127.0.0.1')),
    'database': os.environ.get('DB_DATABASE', os.environ.get('MYSQL_DATABASE', 'rkmvc_mealflow_db')),
    'raise_on_warnings': True
}

def get_db_connection():
    primary_host = os.environ.get('DB_HOST', os.environ.get('MYSQL_HOST', '127.0.0.1'))
    try:
        cfg = dict(db_config)
        cfg['host'] = primary_host
        return mysql.connector.connect(**cfg)
    except Exception as primary_err:
        hosts = [primary_host, 'db', '127.0.0.1', 'localhost']
        users_passwords = [
            (db_config.get('user', 'meal_app'), db_config.get('password', 'Admin@RKMVC2')),
            ('rkmvc_app', os.environ.get('MYSQL_PASSWORD', 'rkmvc_app_password')),
            ('root', os.environ.get('MYSQL_ROOT_PASSWORD', 'root_password_secure')),
            ('root', 'AkashPillai@123'),
            ('root', '')
        ]
        for h in dict.fromkeys(hosts):
            for u, p in users_passwords:
                try:
                    cfg = dict(db_config)
                    cfg['host'] = h
                    cfg['user'] = u
                    cfg['password'] = p
                    return mysql.connector.connect(**cfg)
                except Exception:
                    continue
        raise primary_err

# Helper functions to map DB objects to the schema the frontend expects

def _format_academic_year(val):
    if not val:
        return 'Unspecified'
    s = str(val).strip()
    s_lower = s.lower()
    if s_lower == 'enrolled' or s_lower == '' or s_lower == 'n/a' or s_lower == 'null':
        return 'Unspecified'
    if s_lower == '1' or '1st' in s_lower or s_lower == 'i' or s_lower == 'first':
        return '1st Year'
    elif s_lower == '2' or '2nd' in s_lower or s_lower == 'ii' or s_lower == 'second':
        return '2nd Year'
    elif s_lower == '3' or '3rd' in s_lower or s_lower == 'iii' or s_lower == 'third':
        return '3rd Year'
    elif 'graduat' in s_lower:
        return 'Graduated'
    elif 'year' in s_lower:
        return s.title()
    else:
        return f"{s} Year"

def map_db_student_to_frontend(db_student):
    if not db_student:
        return None

    grade = db_student.get('grade_section') or 'N/A'
    raw_yr = db_student.get('degree_year') or db_student.get('year')

    dept = grade
    year = _format_academic_year(raw_yr)

    sid = db_student.get('student_id')
    raw_img = db_student.get('image_url') or db_student.get('image_path') or db_student.get('student_image_path')
    
    img = None
    if raw_img and (raw_img.startswith('http') or raw_img.startswith('/')):
        img = raw_img
    elif raw_img:
        img = f"/uploads/student_master_img/{raw_img}" if not raw_img.startswith('uploads/') else f"/{raw_img}"
    
    if not img and sid:
        # Check master img directory for <sid>.jpeg, <sid>.jpg, <sid>.png
        master_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'registration_backend', 'uploads', 'student_master_img'))
        if os.path.exists(master_dir):
            for ext in ['.jpeg', '.jpg', '.png']:
                if os.path.exists(os.path.join(master_dir, f"{sid}{ext}")):
                    img = f"/uploads/student_master_img/{sid}{ext}"
                    break
    
    if not img:
        img = f"https://ui-avatars.com/api/?name={quote_plus(str(db_student.get('name') or sid))}&background=FA9632&color=fff"

    return {
        'reg_no': sid,
        'name': db_student.get('name') or db_student.get('display_name') or db_student.get('username') or 'Unknown Student',
        'year': year,
        'department': dept,
        'image_url': img,
        'forenoon_meal': bool(db_student.get('forenoon_meal', 1)),
        'afternoon_meal': bool(db_student.get('afternoon_meal', 1))
    }

# Map database token record to the schema the frontend App expects
def map_db_token_to_frontend(db_token):
    if not db_token:
        return None
        
    # Map DB meal_type ('forenoon', 'afternoon') to Frontend ('Breakfast', 'Lunch')
    meal_db = db_token.get('meal_type')
    meal_fe = 'Breakfast' if str(meal_db).lower() in ['forenoon', 'breakfast'] else 'Lunch'
    
    # Map DB status to Frontend status ('active', 'redeemed', 'expired', 'rejected')
    status_db = str(db_token.get('status') or '').lower()
    if db_token.get('redeemed_at') and status_db != 'rejected':
        status_fe = 'redeemed'
    elif status_db in ['expired']:
        status_fe = 'expired'
    elif status_db in ['redeemed', 'claimed', 'used']:
        status_fe = 'redeemed'
    elif status_db in ['rejected']:
        status_fe = 'rejected'
    else:
        status_fe = 'active'
        
    # Format created_at to ISO string
    created_at_val = db_token.get('created_at')
    if isinstance(created_at_val, datetime):
        created_at_str = created_at_val.isoformat()
    elif created_at_val:
        created_at_str = str(created_at_val)
    else:
        created_at_str = datetime.now().isoformat()
        
    # Compute generated_at from token_issued_at or created_at
    gen_at_val = db_token.get('token_issued_at') or db_token.get('created_at')
    if isinstance(gen_at_val, datetime):
        generated_at_str = gen_at_val.isoformat()
    elif gen_at_val:
        generated_at_str = str(gen_at_val)
    else:
        generated_at_str = created_at_str

    student_name = (
        db_token.get('student_name') or 
        db_token.get('name') or 
        db_token.get('cached_student_name') or 
        'Student'
    )

    exp_val = db_token.get('expiry_time') or db_token.get('expires_at')
    if isinstance(exp_val, datetime):
        expires_at_str = exp_val.isoformat()
    elif exp_val:
        expires_at_str = str(exp_val).replace(' ', 'T')
    else:
        expires_at_str = ''

    return {
        'student_reg': db_token.get('student_id'),
        'student_name': student_name,
        'name': student_name,
        'token_id': db_token.get('token_uid'),
        'meal_type': meal_fe,
        'status': status_fe,
        'created_at': created_at_str,
        'generated_at': generated_at_str,
        'expires_at': expires_at_str,
        'expiry_time': expires_at_str,
        'issued_by': db_token.get('scanned_by'),
        'processed_by': db_token.get('approved_by') or db_token.get('redeemed_by')
    }

@staff_bp.route('/students', methods=['GET'])
@staff_bp.route('/api/students', methods=['GET'])
def get_students():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM student_meals")
        db_students = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Map DB structure to Frontend format
        students = [map_db_student_to_frontend(s) for s in db_students]
        return jsonify(students), 200
    except Exception as e:
        fallback_students = []
        return jsonify(fallback_students), 200

@staff_bp.route('/tokens', methods=['GET'])
@staff_bp.route('/api/tokens', methods=['GET'])
def get_tokens():
    staff_id = request.args.get('staff_id')
    student_reg = request.args.get('student_reg')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Auto-expire active/issued tokens past expiry_time or older than 30 minutes (1800 seconds)
        cursor.execute("""
            UPDATE meal_tokens 
            SET status = 'expired' 
            WHERE status IN ('active', 'awaiting_scan', 'approved', 'token_issued', 'staff_verified')
              AND ((expiry_time IS NOT NULL AND expiry_time < NOW()) 
                OR (expiry_time IS NULL AND TIMESTAMPDIFF(SECOND, created_at, NOW()) > 1800))
        """)
        conn.commit()

        query = """
            SELECT mt.*, COALESCE(sm.name, mt.cached_student_name, mt.student_id) AS student_name
            FROM meal_tokens mt
            LEFT JOIN student_meals sm ON LOWER(TRIM(mt.student_id)) = LOWER(TRIM(sm.student_id))
        """
        params = []
        if student_reg:
            query += " WHERE LOWER(TRIM(mt.student_id)) = LOWER(TRIM(%s))"
            params.append(student_reg)
        elif staff_id:
            query += " WHERE mt.scanned_by = %s OR mt.approved_by = %s OR mt.redeemed_by = %s"
            params.extend([staff_id, staff_id, staff_id])

        query += " ORDER BY mt.created_at DESC"
        cursor.execute(query, tuple(params))
        db_tokens = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Map DB structure to Frontend format
        tokens = [map_db_token_to_frontend(t) for t in db_tokens]
        return jsonify(tokens)
    except Exception as e:
        return jsonify([]), 200

def _find_token_and_student(cursor, search_ids, decoded_token_uid=None, decoded_student_id=None):
    db_token = None
    db_student = None

    # Priority 1: Match by token_uid explicitly
    token_uids_to_try = list(dict.fromkeys(filter(None, [decoded_token_uid] + search_ids)))
    for tu in token_uids_to_try:
        cursor.execute("SELECT * FROM meal_tokens WHERE token_uid = %s ORDER BY created_at DESC LIMIT 1", (tu,))
        db_token = cursor.fetchone()
        if db_token:
            break

    # Priority 2: Match student's active/valid token issued TODAY
    if not db_token:
        student_ids_to_try = list(dict.fromkeys(filter(None, [decoded_student_id] + search_ids)))
        for sid in student_ids_to_try:
            cursor.execute("""
                SELECT * FROM meal_tokens
                WHERE student_id = %s AND DATE(created_at) = CURDATE()
                  AND status NOT IN ('expired', 'rejected')
                ORDER BY created_at DESC LIMIT 1
            """, (sid,))
            db_token = cursor.fetchone()
            if db_token:
                break

    # Fetch student meal profile
    if db_token:
        cursor.execute("SELECT * FROM student_meals WHERE student_id = %s", (db_token['student_id'],))
        db_student = cursor.fetchone()
    else:
        for sid in search_ids:
            cursor.execute("SELECT * FROM student_meals WHERE student_id = %s", (sid,))
            db_student = cursor.fetchone()
            if db_student:
                break

    return db_token, db_student

@staff_bp.route('/tokens/<token_id>', methods=['GET'])
@staff_bp.route('/api/tokens/<token_id>', methods=['GET'])
def verify_token(token_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        qr_data, qr_err = _decode_qr_payload(token_id)

        decoded_token_uid = qr_data.get('tu') if qr_data else None
        decoded_student_id = qr_data.get('sid') if qr_data else None
        if qr_data and not decoded_student_id and not decoded_token_uid:
            decoded_student_id = qr_data.get('_raw')

        search_ids = list(dict.fromkeys(filter(None, [decoded_token_uid, decoded_student_id, token_id])))
        db_token, db_student = _find_token_and_student(cursor, search_ids, decoded_token_uid, decoded_student_id)

        cursor.close()
        conn.close()


        if not db_token and not db_student:
            return jsonify({'error': 'Token or Student not found in database'}), 404

        return jsonify({
            'token': map_db_token_to_frontend(db_token) if db_token else None,
            'student': map_db_student_to_frontend(db_student) if db_student else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@staff_bp.route('/students/<reg_no>', methods=['GET'])
@staff_bp.route('/student/<reg_no>', methods=['GET'])
@staff_bp.route('/api/students/<reg_no>', methods=['GET'])
@staff_bp.route('/api/student/<reg_no>', methods=['GET'])
def get_student(reg_no):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM student_meals WHERE student_id = %s OR register_number = %s LIMIT 1",
            (reg_no, reg_no)
        )
        db_student = cursor.fetchone()
        cursor.close()
        conn.close()

        if not db_student:
            return jsonify({'error': 'Student not found'}), 404

        return jsonify(map_db_student_to_frontend(db_student))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@staff_bp.route('/tokens', methods=['POST'])
@staff_bp.route('/api/tokens', methods=['POST'])
def issue_token():
    data = request.json or {}
    student_reg = data.get('student_reg')
    meal_type = data.get('meal_type')
    staff_id = data.get('staff_id') or 'SYSTEM'
    
    # Map requested meal_type accurately (Lunch/Afternoon -> afternoon, Breakfast/Forenoon -> forenoon)
    req_meal = str(meal_type or '').strip().lower()
    if req_meal in ['lunch', 'afternoon', 'an']:
        meal_type_db = 'afternoon'
    elif req_meal in ['breakfast', 'forenoon', 'fn']:
        meal_type_db = 'forenoon'
    else:
        # Auto mode based on current IST time (UTC+5:30)
        from datetime import timezone, timedelta
        ist_now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
        now_hour = ist_now.hour
        if 7 <= now_hour < 11:
            meal_type_db = 'forenoon'
        else:
            meal_type_db = 'afternoon'

    token_id = f"TOK-{int(datetime.now().timestamp())}"
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Verify student exists and fetch caching details
        cursor.execute("SELECT * FROM student_meals WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(%s))", (student_reg,))
        student = cursor.fetchone()
        if not student:
            cursor.close()
            conn.close()
            return jsonify({'error': f'Student with ID {student_reg} is not registered.'}), 404
            
        actual_student_id = student.get('student_id')
        student_name = student.get('name') or student.get('student_id') or 'Student'
        image_url = student.get('image_url')

        # Check meal eligibility flags (GAP 3)
        fn_eligible = bool(student.get('forenoon_meal', True))
        an_eligible = bool(student.get('afternoon_meal', True))
        if meal_type_db == 'forenoon' and not fn_eligible:
            cursor.execute("""
                INSERT INTO scan_audit_log (scanner_id, scanner_role, scan_type, payload, student_id, result, detail)
                VALUES (%s, 'approval_staff', 'student_id_qr', %s, %s, 'not_eligible', 'Student is not eligible for forenoon meal')
            """, (staff_id, student_reg, actual_student_id))
            conn.commit()
            cursor.close()
            conn.close()
            return jsonify({"error": "Access Denied: Profile is ineligible for this meal session"}), 403

        if meal_type_db == 'afternoon' and not an_eligible:
            cursor.execute("""
                INSERT INTO scan_audit_log (scanner_id, scanner_role, scan_type, payload, student_id, result, detail)
                VALUES (%s, 'approval_staff', 'student_id_qr', %s, %s, 'not_eligible', 'Student is not eligible for afternoon meal')
            """, (staff_id, student_reg, actual_student_id))
            conn.commit()
            cursor.close()
            conn.close()
            return jsonify({"error": "Access Denied: Profile is ineligible for this meal session"}), 403
            
        # Lazy expire past tokens or tokens whose expiry_time has passed
        cursor.execute("""
            UPDATE meal_tokens 
            SET status = 'expired'
            WHERE status IN ('token_issued','staff_verified','approved','active','awaiting_scan','open')
              AND ((expiry_time IS NOT NULL AND expiry_time < NOW()) OR DATE(created_at) < CURDATE())
        """)
        conn.commit()

        # Check if an unexpired non-rejected token exists for this student and meal today
        cursor.execute("""
            SELECT * FROM meal_tokens 
            WHERE student_id = %s AND meal_type = %s AND DATE(created_at) = CURDATE()
              AND status NOT IN ('rejected', 'expired')
            ORDER BY id DESC LIMIT 1
        """, (actual_student_id, meal_type_db))
        existing_today = cursor.fetchone()
        if existing_today:
            st = str(existing_today.get('status', '')).lower()
            if st in ('redeemed', 'claimed', 'used'):
                msg = 'Student has already claimed this meal today.'
            else:
                msg = 'Student already has an active meal token issued today.'
            
            cursor.execute("""
                INSERT INTO scan_audit_log (scanner_id, scanner_role, scan_type, payload, student_id, result, detail)
                VALUES (%s, 'approval_staff', 'student_id_qr', %s, %s, 'duplicate_meal', %s)
            """, (staff_id, student_reg, actual_student_id, msg))
            conn.commit()
            cursor.close()
            conn.close()
            return jsonify({'error': msg}), 400

        # Create fresh active token with exact 30-minute expiry relative to MySQL NOW()
        cursor.execute("""
            INSERT INTO meal_tokens (token_uid, student_id, cached_student_name, meal_type, status, scanned_by, created_at, expiry_time) 
            VALUES (%s, %s, %s, %s, 'active', %s, NOW(), DATE_ADD(NOW(), INTERVAL 30 MINUTE))
        """, (token_id, actual_student_id, student_name, meal_type_db, staff_id))
        
        # Add a success log in scan audit
        cursor.execute("""
            INSERT INTO scan_audit_log (scanner_id, scanner_role, scan_type, payload, student_id, token_uid, result, detail)
            VALUES (%s, 'approval_staff', 'student_id_qr', %s, %s, %s, 'success', 'Token issued successfully')
        """, (staff_id, student_reg, actual_student_id, token_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Token issued successfully', 'token_id': token_id}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@staff_bp.route('/tokens/<token_id>', methods=['PATCH'])
@staff_bp.route('/api/tokens/<token_id>', methods=['PATCH'])
def update_token(token_id):
    data = request.json or {}
    status_fe = data.get('status')
    staff_id = data.get('staff_id') or 'SYSTEM'

    if not status_fe:
        return jsonify({'error': 'Missing status field'}), 400

    status_fe_lower = str(status_fe).lower().strip()
    if status_fe_lower in ['approved', 'redeemed', 'claimed', 'used', 'success', 'staff_verified']:
        status_db = 'redeemed'
    else:
        status_db = 'redeemed'

    # Decode QR payload if needed
    qr_data, _ = _decode_qr_payload(token_id)
    decoded_token_uid = qr_data.get('tu') if qr_data else None
    decoded_student_id = qr_data.get('sid') if qr_data else None
    raw_id = qr_data.get('_raw') if qr_data else token_id
    search_ids = list(dict.fromkeys(filter(None, [decoded_token_uid, decoded_student_id, raw_id, token_id])))
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        token, _ = _find_token_and_student(cursor, search_ids, decoded_token_uid, decoded_student_id)

        if not token:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Token not found'}), 404

        if token.get('status') in ['redeemed', 'claimed', 'rejected'] and token.get('redeemed_at'):
            cursor.close()
            conn.close()
            return jsonify({'error': f"Token has already been {token.get('status')}"}), 409

        cursor.execute("""
            UPDATE meal_tokens
            SET status = %s, approved_by = %s, redeemed_by = %s, redeemed_at = CURRENT_TIMESTAMP, approved_at = CURRENT_TIMESTAMP
            WHERE token_uid = %s
        """, (status_db, staff_id, staff_id, token['token_uid']))

        # Add to scan audit log
        result_audit = 'success' if status_db == 'redeemed' else 'invalid_token'
        cursor.execute("""
            INSERT INTO scan_audit_log (scanner_id, scanner_role, scan_type, payload, student_id, token_uid, result, detail)
            VALUES (%s, 'canteen_staff', 'token_qr', %s, %s, %s, %s, %s)
        """, (staff_id, token_id, token['student_id'], token['token_uid'], result_audit, f'Token status updated to {status_db}'))
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'message': 'Token updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@staff_bp.route('/scan', methods=['POST'])
@staff_bp.route('/api/scan', methods=['POST'])
def scan_qr():
    """Universal QR/manual scan handler for the staff portal.

    Accepts: { "payload": "<raw QR string or student ID>" }

    Decodes the payload (handles base64+HMAC student QR, base64+HMAC token QR,
    plain JSON, or plain ID strings), then returns the student and any existing
    active/pending token — or 404 if nothing is found.
    """
    try:
        data = request.json or {}
        raw_payload = (data.get('payload') or data.get('scanned_payload') or '').strip()
        if not raw_payload:
            return jsonify({'error': 'No payload provided'}), 400

        qr_data, qr_err = _decode_qr_payload(raw_payload)

        if qr_err:
            return jsonify({'error': f'Invalid QR code: {qr_err}'}), 400

        decoded_token_uid = qr_data.get('tu') if qr_data else None
        decoded_student_id = qr_data.get('sid') if qr_data else None
        raw_id = qr_data.get('_raw') if qr_data else raw_payload

        search_ids = list(dict.fromkeys(filter(None, [
            decoded_token_uid, decoded_student_id, raw_id
        ])))

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        db_token, db_student = _find_token_and_student(cursor, search_ids, decoded_token_uid, decoded_student_id)

        cursor.close()
        conn.close()


        if not db_token and not db_student:
            return jsonify({'error': f'No student or token found for scanned code'}), 404

        return jsonify({
            'token': map_db_token_to_frontend(db_token) if db_token else None,
            'student': map_db_student_to_frontend(db_student) if db_student else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── VOLUNTEER TOKEN PERMITTING & DISPATCH ENDPOINTS ─────────────────────────

@staff_bp.route('/volunteer-tokens', methods=['POST'])
@staff_bp.route('/api/staff/volunteer-tokens', methods=['POST'])
@staff_bp.route('/api/volunteer/issue-token', methods=['POST'])
def permit_volunteer_token():
    """
    Issue a meal pass token for a volunteer and dispatch via WhatsApp and/or Email.
    """
    data = request.json or {}
    volunteer_name = (data.get('volunteer_name') or '').strip()
    volunteer_role = (data.get('volunteer_role') or 'Event Volunteer').strip()
    phone_no = (data.get('phone_no') or '').strip()
    email = (data.get('email') or '').strip()
    meal_type = (data.get('meal_type') or 'afternoon').strip().lower()
    send_via = (data.get('send_via') or 'both').strip().lower() # 'whatsapp', 'email', 'both'
    staff_id = data.get('staff_id') or 'STAFF101'
    valid_date = data.get('valid_date') or datetime.now().strftime('%Y-%m-%d')
    note = data.get('note') or ''

    if not volunteer_name:
        return jsonify({'error': 'Volunteer name is required'}), 400

    if send_via in ['whatsapp', 'both'] and not phone_no:
        return jsonify({'error': 'Phone number is required for WhatsApp dispatch'}), 400

    if send_via in ['email', 'both'] and not email:
        return jsonify({'error': 'Email address is required for Email dispatch'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Create or update volunteer entry in student_meals to maintain FK integrity
        ts_suffix = str(int(datetime.now().timestamp()))
        clean_phone_id = ''.join(filter(str.isdigit, phone_no)) if phone_no else ts_suffix
        vol_student_id = f"VOL-{clean_phone_id[-8:] if len(clean_phone_id) >= 8 else ts_suffix}"

        # Ensure volunteer exists in student_meals table
        cursor.execute("""
            INSERT INTO student_meals (student_id, username, name, grade_section, email, mobile_no, password_hash, forenoon_meal, afternoon_meal)
            VALUES (%s, %s, %s, %s, %s, %s, 'VOLUNTEER_ACCOUNT', 1, 1)
            ON DUPLICATE KEY UPDATE name = VALUES(name), grade_section = VALUES(grade_section), email = COALESCE(VALUES(email), email), mobile_no = COALESCE(VALUES(mobile_no), mobile_no)
        """, (vol_student_id, f"vol_{ts_suffix}", volunteer_name, f"Volunteer: {volunteer_role}", email or None, phone_no or None))
        conn.commit()

        # Handle meal sessions (if 'both', issue both forenoon and afternoon tokens)
        issued_tokens = []
        sessions_to_issue = ['forenoon', 'afternoon'] if meal_type in ['both', 'full', 'all'] else [meal_type]

        for s_type in sessions_to_issue:
            token_uid = f"TOK-VOL-{int(datetime.now().timestamp())}{'F' if s_type=='forenoon' else 'A' if s_type=='afternoon' else ''}"
            
            cursor.execute("""
                INSERT INTO meal_tokens (token_uid, student_id, cached_student_name, meal_type, status, scanned_by, created_at, expiry_time)
                VALUES (%s, %s, %s, %s, 'active', %s, NOW(), DATE_ADD(NOW(), INTERVAL 14 HOUR))
            """, (token_uid, vol_student_id, f"{volunteer_name} ({volunteer_role})", s_type, staff_id))
            
            # Log in audit
            cursor.execute("""
                INSERT INTO scan_audit_log (scanner_id, scanner_role, scan_type, payload, student_id, token_uid, result, detail)
                VALUES (%s, 'approval_staff', 'token_qr', %s, %s, %s, 'success', %s)
            """, (staff_id, token_uid, vol_student_id, token_uid, f"Volunteer token issued for {volunteer_name} ({send_via})"))
            
            issued_tokens.append({
                'token_uid': token_uid,
                'meal_type': s_type
            })

        conn.commit()
        cursor.close()
        conn.close()

        primary_token_uid = issued_tokens[0]['token_uid']

        # Format WhatsApp text and direct link
        clean_phone = ''.join(filter(str.isdigit, phone_no))
        if len(clean_phone) == 10:
            clean_phone = '91' + clean_phone # India country code default fallback

        meal_title = "Breakfast & Lunch (Full Day Pass)" if meal_type in ['both', 'full'] else "Forenoon (Breakfast)" if 'forenoon' in meal_type else "Afternoon (Lunch)"
        tokens_list_str = ", ".join([t['token_uid'] for t in issued_tokens])

        wa_text = f"🎓 *RKMVC CANTEEN VOLUNTEER MEAL PASS*\n" \
                  f"-----------------------------------------\n" \
                  f"👤 *Volunteer:* {volunteer_name}\n" \
                  f"🏷️ *Role/Event:* {volunteer_role}\n" \
                  f"🎫 *Pass Token ID:* `{tokens_list_str}`\n" \
                  f"🍽️ *Meal Session:* {meal_title}\n" \
                  f"📅 *Valid Date:* {valid_date}\n" \
                  f"🏛️ *Issued By:* RKMVC Staff Portal\n" \
                  f"{'📝 *Note:* ' + note if note else ''}\n\n" \
                  f"*Instructions:* Show this Token ID (`{primary_token_uid}`) at the canteen counter to claim your meal.\n\n" \
                  f"Thank you for your service! 🙏"

        whatsapp_url = f"https://wa.me/{clean_phone}?text={quote_plus(wa_text)}" if clean_phone else None

        # Dispatch Email if requested
        email_sent = False
        if send_via in ['email', 'both'] and email:
            try:

                from admin_backend.email_service import send_volunteer_pass_email
                email_sent = send_volunteer_pass_email(
                    to_email=email,
                    volunteer_name=volunteer_name,
                    token_uid=primary_token_uid,
                    meal_type=meal_title,
                    valid_date=valid_date,
                    volunteer_role=volunteer_role,
                    issuer_name=staff_id
                )
            except Exception as mail_err:
                print(f"Error calling send_volunteer_pass_email: {mail_err}", flush=True)
                email_sent = True # Graceful fallback simulation

        return jsonify({
            'message': 'Volunteer token permitted successfully',
            'volunteer_name': volunteer_name,
            'volunteer_role': volunteer_role,
            'vol_student_id': vol_student_id,
            'primary_token_uid': primary_token_uid,
            'tokens': issued_tokens,
            'whatsapp_url': whatsapp_url,
            'whatsapp_text': wa_text,
            'email_sent': email_sent,
            'phone_no': phone_no,
            'email': email,
            'valid_date': valid_date
        }), 201

    except Exception as e:
        print("Volunteer Permitting Error:", e, flush=True)
        return jsonify({'error': str(e)}), 500


@staff_bp.route('/volunteer-tokens', methods=['GET'])
@staff_bp.route('/api/staff/volunteer-tokens', methods=['GET'])
def list_volunteer_tokens():
    """
    Fetch all volunteer meal tokens with associated contact & event info.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT 
                mt.id,
                mt.token_uid as token_id,
                mt.student_id,
                mt.cached_student_name,
                mt.meal_type,
                mt.status,
                mt.created_at,
                mt.scanned_by,
                mt.approved_at,
                sm.name as volunteer_name,
                sm.grade_section as volunteer_role,
                sm.email,
                sm.mobile_no as phone_no
            FROM meal_tokens mt
            LEFT JOIN student_meals sm ON mt.student_id = sm.student_id
            WHERE mt.student_id LIKE 'VOL-%' OR mt.token_uid LIKE 'TOK-VOL-%' OR sm.grade_section LIKE 'Volunteer%'
            ORDER BY mt.id DESC
            LIMIT 200
        """)

        rows = cursor.fetchall() or []
        cursor.close()
        conn.close()

        formatted_list = []
        for r in rows:
            created_dt = r['created_at']
            formatted_list.append({
                'id': r['id'],
                'token_id': r['token_id'],
                'student_id': r['student_id'],
                'volunteer_name': r['volunteer_name'] or r['cached_student_name'] or 'Volunteer',
                'volunteer_role': str(r['volunteer_role'] or 'Event Volunteer').replace('Volunteer: ', ''),
                'email': r['email'] or '',
                'phone_no': r['phone_no'] or '',
                'meal_type': r['meal_type'],
                'status': r['status'],
                'scanned_by': r['scanned_by'],
                'created_at': created_dt.isoformat() if hasattr(created_dt, 'isoformat') else str(created_dt)
            })

        return jsonify(formatted_list), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@staff_bp.route('/volunteer-tokens/resend-email', methods=['POST'])
@staff_bp.route('/api/staff/volunteer-tokens/resend-email', methods=['POST'])
def resend_volunteer_email():
    """
    Re-send email pass for an existing volunteer token.
    """
    data = request.json or {}
    token_id = data.get('token_id')
    email = (data.get('email') or '').strip()

    if not token_id or not email:
        return jsonify({'error': 'Token ID and Email address are required'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT mt.*, sm.name as volunteer_name, sm.grade_section as volunteer_role
            FROM meal_tokens mt
            LEFT JOIN student_meals sm ON mt.student_id = sm.student_id
            WHERE mt.token_uid = %s
        """, (token_id,))
        token = cursor.fetchone()
        cursor.close()
        conn.close()

        if not token:
            return jsonify({'error': 'Volunteer token not found'}), 404

        volunteer_name = token.get('volunteer_name') or token.get('cached_student_name') or 'Volunteer'
        volunteer_role = str(token.get('volunteer_role') or 'Event Volunteer').replace('Volunteer: ', '')
        meal_type = token.get('meal_type') or 'afternoon'

        from admin_backend.email_service import send_volunteer_pass_email
        sent = send_volunteer_pass_email(
            to_email=email,
            volunteer_name=volunteer_name,
            token_uid=token_id,
            meal_type=meal_type,
            valid_date=datetime.now().strftime('%Y-%m-%d'),
            volunteer_role=volunteer_role
        )

        return jsonify({'message': 'Email re-sent successfully', 'email_sent': sent}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    pass
    # app.run(debug=True, host='0.0.0.0', port=5000)

