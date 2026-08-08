import os
import hmac as _hmac
import hashlib
import base64
import json
import re
import mysql.connector
from datetime import datetime, time as dt_time, timedelta as dt_timedelta
from flask import Flask, request, jsonify, Blueprint
import bcrypt

canteen_bp = Blueprint('canteen_bp', __name__)

QR_HMAC_SECRET = os.environ.get('QR_HMAC_SECRET', 'change-this-to-another-random-64-char-string')

def _hmac_sign(data: str) -> str:
    return _hmac.new(QR_HMAC_SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()[:16]

def _hmac_verify(data: str, signature: str) -> bool:
    return _hmac.compare_digest(_hmac_sign(data), signature)

def _decode_qr_payload(raw: str):
    raw = (raw or '').strip()
    try:
        decoded = base64.urlsafe_b64decode(raw.encode()).decode()
        payload_part, sig = decoded.rsplit('.', 1)
        if not _hmac_verify(payload_part, sig):
            return None, 'QR signature invalid'
        return json.loads(payload_part), None
    except Exception:
        pass
    if raw.startswith('{'):
        try:
            return json.loads(raw), None
        except Exception:
            pass
    return {'_raw': raw}, None

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

    img = db_student.get('image_url') or db_student.get('image_path') or db_student.get('student_image_path') or f"https://ui-avatars.com/api/?name={db_student.get('student_id')}&background=random"

    return {
        'reg_no': db_student.get('student_id'),
        'name': db_student.get('name') or db_student.get('display_name') or db_student.get('username') or 'Unknown Student',
        'year': year,
        'department': dept,
        'image_url': img,
        'forenoon_meal': bool(db_student.get('forenoon_meal', 1)),
        'afternoon_meal': bool(db_student.get('afternoon_meal', 1))
    }

def map_db_token_to_frontend(db_token):
    if not db_token:
        return None
    meal_db = db_token.get('meal_type')
    meal_fe = 'Breakfast' if str(meal_db).lower() in ['forenoon', 'breakfast'] else 'Lunch'
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
    created_at_val = db_token.get('created_at')
    created_at_str = created_at_val.isoformat() if isinstance(created_at_val, datetime) else (str(created_at_val) if created_at_val else datetime.now().isoformat())
    gen_at_val = db_token.get('token_issued_at') or db_token.get('created_at')
    generated_at_str = gen_at_val.isoformat() if isinstance(gen_at_val, datetime) else (str(gen_at_val) if gen_at_val else created_at_str)
    student_name = db_token.get('student_name') or db_token.get('name') or db_token.get('cached_student_name') or 'Student'
    return {
        'student_reg': db_token.get('student_id'),
        'student_name': student_name,
        'name': student_name,
        'token_id': db_token.get('token_uid'),
        'meal_type': meal_fe,
        'status': status_fe,
        'created_at': created_at_str,
        'generated_at': generated_at_str,
        'expires_at': str(db_token.get('expires_at') or db_token.get('expiry_time') or ''),
        'issued_by': db_token.get('scanned_by'),
        'processed_by': db_token.get('approved_by') or db_token.get('redeemed_by')
    }

def _find_token_and_student(cursor, search_ids, decoded_token_uid=None, decoded_student_id=None):
    db_token = None
    db_student = None

    token_uids_to_try = list(dict.fromkeys(filter(None, [decoded_token_uid] + search_ids)))
    for tu in token_uids_to_try:
        cursor.execute("SELECT * FROM meal_tokens WHERE token_uid = %s ORDER BY created_at DESC LIMIT 1", (tu,))
        db_token = cursor.fetchone()
        if db_token:
            break

    if not db_token:
        student_ids_to_try = list(dict.fromkeys(filter(None, [decoded_student_id] + search_ids)))
        for sid in student_ids_to_try:
            cursor.execute("""
                SELECT * FROM meal_tokens
                WHERE student_id = %s AND DATE(created_at) = CURDATE()
                ORDER BY created_at DESC LIMIT 1
            """, (sid,))
            db_token = cursor.fetchone()
            if db_token:
                break

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

@canteen_bp.route('/students', methods=['GET'])
@canteen_bp.route('/api/students', methods=['GET'])
def get_canteen_students():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM student_meals")
        db_students = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify([map_db_student_to_frontend(s) for s in db_students])
    except Exception as e:
        return jsonify([]), 200

@canteen_bp.route('/auth/login', methods=['POST'])
@canteen_bp.route('/login', methods=['POST'])
@canteen_bp.route('/api/login', methods=['POST'])
def canteen_login():
    data = request.json or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE username = %s AND role IN ('admin', 'canteen_staff')", (username,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        if not user:
            return jsonify({'error': 'Invalid username or password'}), 401
        stored_hash = user.get('password_hash') or ''
        valid = False
        if stored_hash.startswith('$2b$') or stored_hash.startswith('$2a$'):
            try:
                valid = bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
            except Exception:
                valid = False
        else:
            valid = (password == stored_hash)
        if not valid:
            return jsonify({'error': 'Invalid username or password'}), 401
        return jsonify({
            'token': f'canteen-token-{user["id"]}',
            'user': {
                'id': user['id'],
                'username': user['username'],
                'role': user['role'],
                'display_name': user.get('display_name') or user['username']
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@canteen_bp.route('/tokens', methods=['GET'])
@canteen_bp.route('/api/tokens', methods=['GET'])
def get_canteen_tokens():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            UPDATE meal_tokens 
            SET status = 'expired' 
            WHERE status IN ('active', 'awaiting_scan', 'approved', 'token_issued', 'staff_verified')
              AND ((expiry_time IS NOT NULL AND expiry_time < NOW()) 
                OR (expiry_time IS NULL AND TIMESTAMPDIFF(SECOND, created_at, NOW()) > 1800))
        """)
        conn.commit()

        cursor.execute("""
            SELECT mt.*, COALESCE(sm.name, mt.cached_student_name, mt.student_id) AS student_name
            FROM meal_tokens mt
            LEFT JOIN student_meals sm ON LOWER(TRIM(mt.student_id)) = LOWER(TRIM(sm.student_id))
            WHERE DATE(mt.created_at) = CURDATE()
            ORDER BY mt.created_at DESC
        """)
        db_tokens = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify([map_db_token_to_frontend(t) for t in db_tokens])
    except Exception as e:
        return jsonify([]), 200

@canteen_bp.route('/tokens/<token_id>', methods=['GET'])
@canteen_bp.route('/api/tokens/<token_id>', methods=['GET'])
def verify_canteen_token(token_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        qr_data, _ = _decode_qr_payload(token_id)

        decoded_token_uid = qr_data.get('tu') if qr_data else None
        decoded_student_id = qr_data.get('sid') if qr_data else None
        if qr_data and not decoded_student_id and not decoded_token_uid:
            decoded_student_id = qr_data.get('_raw')

        search_ids = list(dict.fromkeys(filter(None, [decoded_token_uid, decoded_student_id, token_id])))
        db_token, db_student = _find_token_and_student(cursor, search_ids, decoded_token_uid, decoded_student_id)

        cursor.close()
        conn.close()

        if not db_token and not db_student:
            return jsonify({'error': 'Token or Student not found'}), 404

        return jsonify({
            'token': map_db_token_to_frontend(db_token) if db_token else None,
            'student': map_db_student_to_frontend(db_student) if db_student else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@canteen_bp.route('/tokens/<token_id>', methods=['PATCH'])
@canteen_bp.route('/api/tokens/<token_id>', methods=['PATCH'])
@canteen_bp.route('/redeem', methods=['POST'])
@canteen_bp.route('/api/redeem', methods=['POST'])
def redeem_token(token_id=None):
    data = request.json or {}
    token_target = token_id or data.get('token_id') or data.get('token_uid') or data.get('payload')
    canteen_staff_id = data.get('staff_id') or 'canteen_staff'

    if not token_target:
        return jsonify({'error': 'Missing token target'}), 400

    qr_data, _ = _decode_qr_payload(token_target)
    decoded_token_uid = qr_data.get('tu') if qr_data else None
    decoded_student_id = qr_data.get('sid') if qr_data else None
    raw_id = qr_data.get('_raw') if qr_data else token_target
    search_ids = list(dict.fromkeys(filter(None, [decoded_token_uid, decoded_student_id, raw_id, token_target])))

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        token, _ = _find_token_and_student(cursor, search_ids, decoded_token_uid, decoded_student_id)

        if not token:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Token not found for redemption'}), 404

        if token.get('status') in ['redeemed', 'claimed', 'used'] and token.get('redeemed_at'):
            cursor.close()
            conn.close()
            return jsonify({'error': f"Token has already been redeemed at {token['redeemed_at'].isoformat() if isinstance(token['redeemed_at'], datetime) else token['redeemed_at']}"}), 409

        cursor.execute("SELECT * FROM meal_tokens WHERE token_uid = %s AND expiry_time IS NOT NULL AND expiry_time <= NOW()", (token['token_uid'],))
        if cursor.fetchone():
            cursor.execute("UPDATE meal_tokens SET status = 'expired' WHERE token_uid = %s", (token['token_uid'],))
            conn.commit()
            cursor.close()
            conn.close()
            return jsonify({'error': 'Token has expired and cannot be redeemed'}), 400

        cursor.execute("""
            UPDATE meal_tokens
            SET status = 'redeemed', redeemed_by = %s, redeemed_at = CURRENT_TIMESTAMP
            WHERE token_uid = %s
        """, (canteen_staff_id, token['token_uid']))

        cursor.execute("""
            INSERT INTO scan_audit_log (scanner_id, scanner_role, scan_type, payload, student_id, token_uid, result, detail)
            VALUES (%s, 'canteen_staff', 'token_qr', %s, %s, %s, 'success', 'Meal redeemed successfully')
        """, (canteen_staff_id, token_target, token['student_id'], token['token_uid']))
        conn.commit()

        cursor.close()
        conn.close()
        return jsonify({'message': 'Meal redeemed successfully!', 'token_uid': token['token_uid']})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@canteen_bp.route('/scan', methods=['POST'])
@canteen_bp.route('/api/scan', methods=['POST'])
def canteen_scan_qr():
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

        search_ids = list(dict.fromkeys(filter(None, [decoded_token_uid, decoded_student_id, raw_id])))

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        db_token, db_student = _find_token_and_student(cursor, search_ids, decoded_token_uid, decoded_student_id)

        cursor.close()
        conn.close()

        if not db_token and not db_student:
            return jsonify({'error': 'No student or token found for scanned code'}), 404

        return jsonify({
            'token': map_db_token_to_frontend(db_token) if db_token else None,
            'student': map_db_student_to_frontend(db_student) if db_student else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@canteen_bp.route('/stats', methods=['GET'])
@canteen_bp.route('/api/stats', methods=['GET'])
def get_canteen_stats():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('redeemed', 'claimed') THEN 1 ELSE 0 END) as redeemed,
                SUM(CASE WHEN status IN ('active', 'approved', 'token_issued') THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status IN ('expired', 'rejected') THEN 1 ELSE 0 END) as expired
            FROM meal_tokens
            WHERE DATE(created_at) = CURDATE()
        """)
        stats = cursor.fetchone() or {'total': 0, 'redeemed': 0, 'active': 0, 'expired': 0}
        cursor.close()
        conn.close()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'total': 0, 'redeemed': 0, 'active': 0, 'expired': 0}), 200



@canteen_bp.route('/students/<reg_no>', methods=['GET'])
@canteen_bp.route('/api/students/<reg_no>', methods=['GET'])
def get_canteen_student(reg_no):
    try:
        clean_reg = (reg_no or '').strip()
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT * FROM student_meals 
            WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(%s))
               OR LOWER(TRIM(username)) = LOWER(TRIM(%s))
            LIMIT 1
        """, (clean_reg, clean_reg))
        db_student = cursor.fetchone()
        cursor.close()
        conn.close()

        if not db_student:
            return jsonify({'error': f"Student record '{clean_reg}' not found"}), 404

        return jsonify(map_db_student_to_frontend(db_student))
    except Exception as e:
        return jsonify({'error': str(e)}), 500
