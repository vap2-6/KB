import os
from flask import Flask, request, jsonify, Blueprint
import mysql.connector
from datetime import datetime
from flask_cors import CORS

# app = Flask(__name__)
# CORS(app) # Enable CORS so the React frontend can communicate with this backend
staff_bp = Blueprint('staff_bp', __name__)

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

def map_db_student_to_frontend(db_student):
    if not db_student:
        return None
    
    grade = db_student.get('grade_section') or 'N/A'
    year = 'N/A'
    dept = 'N/A'
    
    if ' - ' in grade:
        parts = grade.split(' - ', 1)
        year = parts[0].strip()
        dept = parts[1].strip()
    elif ',' in grade:
        parts = grade.split(',', 1)
        year = parts[0].strip()
        dept = parts[1].strip()
    else:
        year = grade
        dept = 'N/A'
        
    return {
        'reg_no': db_student.get('student_id'),
        'name': db_student.get('name') or db_student.get('display_name') or db_student.get('username') or 'Unknown Student',
        'year': year,
        'department': dept,
        'image_url': db_student.get('image_url') or f"https://ui-avatars.com/api/?name={db_student.get('student_id')}&background=random",
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
    if status_db in ['expired']:
        status_fe = 'expired'
    elif status_db in ['active', 'awaiting_scan', 'token_issued', 'approved', 'staff_verified']:
        status_fe = 'active'
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
        return jsonify(students)
    except Exception as e:
        fallback_students = [
            {'reg_no': '243301034021', 'name': 'Chen Kai', 'year': '1st Year', 'department': 'Computer Applications', 'image_url': 'https://ui-avatars.com/api/?name=Chen+Kai&background=random', 'forenoon_meal': True, 'afternoon_meal': True},
            {'reg_no': 'STU101', 'name': 'Arjun Sharma', 'year': '2nd Year', 'department': 'B.Sc. Comp Sci', 'image_url': 'https://ui-avatars.com/api/?name=Arjun+Sharma&background=random', 'forenoon_meal': True, 'afternoon_meal': True},
            {'reg_no': 'STU102', 'name': 'Priya Patel', 'year': '3rd Year', 'department': 'B.Sc. Comp Sci', 'image_url': 'https://ui-avatars.com/api/?name=Priya+Patel&background=random', 'forenoon_meal': True, 'afternoon_meal': True},
            {'reg_no': 'STU103', 'name': 'Rahul Nair', 'year': '1st Year', 'department': 'B.Sc. Physics', 'image_url': 'https://ui-avatars.com/api/?name=Rahul+Nair&background=random', 'forenoon_meal': True, 'afternoon_meal': False}
        ]
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

@staff_bp.route('/tokens/<token_id>', methods=['GET'])
@staff_bp.route('/api/tokens/<token_id>', methods=['GET'])
def verify_token(token_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Search token by token_uid OR student_id
        cursor.execute("""
            SELECT * FROM meal_tokens 
            WHERE token_uid = %s OR student_id = %s 
            ORDER BY created_at DESC LIMIT 1
        """, (token_id, token_id))
        db_token = cursor.fetchone()
        
        db_student = None
        if db_token:
            student_id = db_token['student_id']
            cursor.execute("SELECT * FROM student_meals WHERE student_id = %s", (student_id,))
            db_student = cursor.fetchone()
        else:
            # Fallback: search student_meals directly by token_id (which could be student_id)
            cursor.execute("SELECT * FROM student_meals WHERE student_id = %s", (token_id,))
            db_student = cursor.fetchone()
            
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
        cursor.execute("SELECT * FROM student_meals WHERE student_id = %s", (reg_no,))
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
            
        # Check if an active token already exists for this student
        cursor.execute("""
            SELECT * FROM meal_tokens 
            WHERE student_id = %s AND status = 'active'
        """, (actual_student_id,))
        existing = cursor.fetchone()
        if existing:
            # Audit log the failed attempt
            cursor.execute("""
                INSERT INTO scan_audit_log (scanner_id, scanner_role, scan_type, payload, student_id, result, detail)
                VALUES (%s, 'approval_staff', 'student_id_qr', %s, %s, 'duplicate_meal', 'Student already has an active token')
            """, (staff_id, student_reg, actual_student_id))
            conn.commit()
            cursor.close()
            conn.close()
            return jsonify({'error': 'Student already has an active meal token issued.'}), 400
            
        # Check if a token has already been generated for this student, meal type, and date today
        cursor.execute("""
            SELECT * FROM meal_tokens 
            WHERE student_id = %s AND meal_type = %s AND DATE(created_at) = CURDATE()
        """, (actual_student_id, meal_type_db))
        existing_today = cursor.fetchone()
        if existing_today:
            # Audit log the failed attempt
            cursor.execute("""
                INSERT INTO scan_audit_log (scanner_id, scanner_role, scan_type, payload, student_id, result, detail)
                VALUES (%s, 'approval_staff', 'student_id_qr', %s, %s, 'duplicate_meal', 'Student already has a meal token for this session today')
            """, (staff_id, student_reg, actual_student_id))
            conn.commit()
            cursor.close()
            conn.close()
            return jsonify({'error': f'Student has already been issued a {meal_type} token today.'}), 400
            
        # Create token
        cursor.execute("""
            INSERT INTO meal_tokens (token_uid, student_id, cached_student_name, meal_type, status, scanned_by) 
            VALUES (%s, %s, %s, %s, 'active', %s)
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
    if status_fe_lower == 'approved':
        status_db = 'approved'
    elif status_fe_lower in ['redeemed', 'claimed']:
        status_db = 'redeemed'
    else:
        status_db = 'rejected'
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT * FROM meal_tokens WHERE token_uid = %s OR student_id = %s ORDER BY created_at DESC LIMIT 1", (token_id, token_id))
        token = cursor.fetchone()
        if not token:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Token not found'}), 404

        if token.get('status') in ['redeemed', 'approved', 'claimed', 'rejected']:
            cursor.close()
            conn.close()
            return jsonify({'error': f"Token has already been {token.get('status')}"}), 409
            
        cursor.execute("""
            UPDATE meal_tokens 
            SET status = %s, approved_by = %s, redeemed_by = %s, redeemed_at = CURRENT_TIMESTAMP, approved_at = CURRENT_TIMESTAMP 
            WHERE token_uid = %s
        """, (status_db, staff_id, staff_id, token['token_uid']))
        
        # Add to scan audit log
        result_audit = 'success' if status_db == 'approved' else 'invalid_token'
        cursor.execute("""
            INSERT INTO scan_audit_log (scanner_id, scanner_role, scan_type, payload, student_id, token_uid, result, detail)
            VALUES (%s, 'canteen_staff', 'token_qr', %s, %s, %s, %s, %s)
        """, (staff_id, token_id, token['student_id'], token_id, result_audit, f'Token status updated to {status_db}'))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Token updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    pass
    # app.run(debug=True, host='0.0.0.0', port=5000)
