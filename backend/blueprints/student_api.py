import os, datetime, json, base64, hmac, hashlib, bcrypt, jwt
from flask import Blueprint, request, jsonify, g
from admin_backend.app import get_db
from blueprints.auth import require_role as _require_role

student_bp = Blueprint('student_api', __name__)

JWT_SECRET = os.environ.get('JWT_SECRET', 'secretkey')

def generate_student_token(student):
    student_id = str(student.get('student_id') or student.get('username') or '')
    student_name = str(student.get('name') or '')
    payload = {
        "id": student_id,
        "username": student_id,
        "role": "student",
        "display_name": student_name,
        "student_id": student_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

@student_bp.route('/auth/login', methods=['POST'])
@student_bp.route('/api/auth/login', methods=['POST'])
def student_auth_login():
    try:
        data = request.get_json(silent=True) or {}
        student_reg_no = (
            data.get('register_no') or
            data.get('register_number') or
            data.get('student_id') or
            data.get('username') or ''
        ).strip()
        password = data.get('password', '')
        if not student_reg_no or not password:
            return jsonify({"error": "Student Register No and password required"}), 400
            
        conn = get_db()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM student_meals WHERE student_id = %s OR username = %s LIMIT 1", (student_reg_no, student_reg_no))
                student = cur.fetchone()
        finally:
            conn.close()
        
        if not student:
            return jsonify({"error": "Invalid student registration ID or password"}), 401
            
        # Verify password dynamically against database bcrypt hash
        password_valid = False
        stored_hash = student.get('password_hash') or ''
        
        if stored_hash.startswith('$2b$') or stored_hash.startswith('$2a$'):
            try:
                password_valid = bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
            except Exception:
                password_valid = False
        else:
            # Plaintext fallback check ONLY if legacy database row stored unhashed string
            password_valid = (password == stored_hash)
            
        if not password_valid:
            return jsonify({"error": "Invalid student registration ID or password"}), 401
            
        # First-time default password reset requirement check (GAP 1)
        require_change = (password == "pass123")
        if not require_change and stored_hash:
            if stored_hash == "pass123":
                require_change = True
            elif stored_hash.startswith('$2b$') or stored_hash.startswith('$2a$'):
                try:
                    require_change = bcrypt.checkpw(b"pass123", stored_hash.encode('utf-8'))
                except Exception:
                    pass

        token = generate_student_token(student)
        return jsonify({
            "token": token,
            "require_password_change": require_change,
            "require_password_reset": require_change,
            "user": {
                "id": student['student_id'],
                "username": student['student_id'],
                "email": student.get('email'),
                "role": "student",
                "display_name": student.get('name'),
                "student_id": student['student_id'],
                "department": student.get('grade_section'),
                "grade_section": student.get('grade_section'),
                "degree_year": student.get('degree_year') or "1st Year",
                "mobile_no": student.get('mobile_no'),
                "forenoon_meal": bool(student.get('forenoon_meal')),
                "afternoon_meal": bool(student.get('afternoon_meal')),
                "image_url": student.get('image_url')
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@student_bp.route('/auth/change-password', methods=['POST'])
@student_bp.route('/api/auth/change-password', methods=['POST'])
def change_password():
    try:
        data = request.json or {}
        username = data.get('username', '').strip()
        new_password = data.get('new_password', '')
        if not username or not new_password:
            return jsonify({"error": "Username and new password required"}), 400

        try:
            hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        except Exception:
            hashed = new_password

        conn = get_db()
        try:
            with conn.cursor() as cur:
                cur.execute("UPDATE student_meals SET password_hash = %s WHERE student_id = %s OR username = %s", (hashed, username, username))
        finally:
            conn.close()

        return jsonify({"message": "Password updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

QR_HMAC_SECRET = os.environ.get('QR_HMAC_SECRET', 'qrsecretkey')

@student_bp.route('/identity', methods=['GET'])
@student_bp.route('/student/identity', methods=['GET'])
@student_bp.route('/api/student/identity', methods=['GET'])
@_require_role('student')
def get_identity():
    student_id = getattr(g, 'user', {}).get('student_id') if hasattr(g, 'user') else None
    if not student_id:
        return jsonify({"error": "No student profile linked"}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM student_meals WHERE student_id = %s LIMIT 1", (student_id,))
            profile = cur.fetchone()
    finally:
        conn.close()

    payload = json.dumps({"sid": student_id, "ts": datetime.datetime.utcnow().isoformat()})
    sig = hmac.new(QR_HMAC_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    qr_data = base64.urlsafe_b64encode(f"{payload}.{sig}".encode()).decode()
    return jsonify({
        "student_id": student_id,
        "name": profile.get('name') if profile else None,
        "forenoon_meal": bool(profile.get('forenoon_meal')) if profile else None,
        "afternoon_meal": bool(profile.get('afternoon_meal')) if profile else None,
        "image_url": profile.get('image_url') if profile else None,
        "qr_data": qr_data,
        "qr_url": f"/api/student/qr-image"
    })

@student_bp.route('/profile', methods=['GET'])
@student_bp.route('/student/profile', methods=['GET'])
@student_bp.route('/api/student/profile', methods=['GET'])
def get_student_profile():
    sid = request.args.get('student_id') or request.args.get('register_no') or request.args.get('id')
    if not sid:
        return jsonify({"error": "student_id required"}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM student_meals WHERE student_id = %s OR username = %s LIMIT 1", (sid, sid))
            student = cur.fetchone()
    finally:
        conn.close()

    if not student:
        return jsonify({"error": "Student not found"}), 404
    return jsonify({
        "id": student['student_id'],
        "name": student['name'],
        "email": student.get('email') or "N/A",
        "dept": student.get('grade_section') or "N/A",
        "degree_year": student.get('degree_year') or "N/A",
        "mobile_no": student.get('mobile_no') or "N/A",
        "forenoon_meal": bool(student.get('forenoon_meal')),
        "afternoon_meal": bool(student.get('afternoon_meal')),
        "image_url": student.get('image_url')
    })

@student_bp.route('/active-token', methods=['GET'])
@student_bp.route('/student/active-token', methods=['GET'])
@student_bp.route('/api/student/active-token', methods=['GET'])
@_require_role('student')
def get_active_token():
    student_id = getattr(g, 'user', {}).get('student_id') if hasattr(g, 'user') else None
    if not student_id:
        return jsonify({"error": "No student profile linked"}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE meal_tokens 
                SET status = 'expired' 
                WHERE status IN ('active', 'awaiting_scan', 'approved', 'token_issued', 'staff_verified')
                  AND ((expiry_time IS NOT NULL AND expiry_time < NOW()) 
                    OR (expiry_time IS NULL AND TIMESTAMPDIFF(SECOND, created_at, NOW()) > 1800))
            """)

            now = datetime.datetime.now()
            today_start = datetime.datetime.combine(now.date(), datetime.time.min)
            
            cur.execute("""
                SELECT * FROM meal_tokens
                WHERE student_id = %s AND created_at >= %s AND status IN ('active', 'approved', 'expired', 'redeemed', 'rejected')
                ORDER BY created_at DESC
            """, (student_id, today_start))
            tokens = cur.fetchall()
    finally:
        conn.close()
    
    formatted_tokens = []
    for t in tokens:
        formatted_tokens.append({
            "id": t['id'],
            "token_uid": t['token_uid'],
            "student_id": t['student_id'],
            "meal_type": "Breakfast" if t.get('meal_type') == "forenoon" else "Lunch",
            "status": t.get('status'),
            "created_at": t['created_at'].isoformat() if t.get('created_at') else None,
            "scanned_at": t['scanned_at'].isoformat() if t.get('scanned_at') else None,
            "approved_at": t['approved_at'].isoformat() if t.get('approved_at') else None,
            "qr_data": t['token_uid']
        })

    active_tok = None
    if formatted_tokens and formatted_tokens[0]['status'] == 'active':
        active_tok = {
            "token_uid": formatted_tokens[0]['token_uid'],
            "meal_type": formatted_tokens[0]['meal_type'],
            "status": formatted_tokens[0]['status'],
            "qr_data": formatted_tokens[0]['token_uid']
        }

    return jsonify({
        "tokens": formatted_tokens,
        "active_token": active_tok
    })
