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
                clean_id = str(student_reg_no).strip()
                cur.execute("""
                    SELECT * FROM student_meals 
                    WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(%s)) 
                       OR LOWER(TRIM(username)) = LOWER(TRIM(%s))
                    LIMIT 1
                """, (clean_id, clean_id))
                student = cur.fetchone()

                if not student:
                    cur.execute("""
                        SELECT * FROM meal_registrations 
                        WHERE LOWER(TRIM(department_roll_no)) = LOWER(TRIM(%s))
                           OR (student_id IS NOT NULL AND LOWER(TRIM(student_id)) = LOWER(TRIM(%s)))
                        LIMIT 1
                    """, (clean_id, clean_id))
                    reg = cur.fetchone()
                    if reg:
                        s_id = reg.get('department_roll_no') or reg.get('student_id') or clean_id
                        s_name = reg.get('student_name') or reg.get('name') or 'Student'
                        s_dept = reg.get('degree_department') or reg.get('department') or 'Student'
                        s_yr = reg.get('degree_year') or ''
                        s_email = reg.get('email')
                        s_mobile = reg.get('mobile_no') or reg.get('mobile')
                        cur.execute("""
                            INSERT INTO student_meals (student_id, name, username, grade_section, degree_year, email, mobile_no, password_hash, forenoon_meal, afternoon_meal)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, 'pass123', 1, 1)
                            ON DUPLICATE KEY UPDATE name=VALUES(name), degree_year=IF(student_meals.degree_year IS NULL OR student_meals.degree_year = '' OR student_meals.degree_year = 'Enrolled', VALUES(degree_year), student_meals.degree_year)
                        """, (s_id, s_name, s_id, s_dept, s_yr, s_email, s_mobile))
                        conn.commit()
                        cur.execute("SELECT * FROM student_meals WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(%s)) LIMIT 1", (s_id,))
                        student = cur.fetchone()
        finally:
            conn.close()
        
        if not student:
            return jsonify({"error": "Invalid student registration ID or password"}), 401
            
        # Check if student account is disabled due to graduation status
        deg_yr = str(student.get('degree_year') or '').strip().lower()
        if 'graduat' in deg_yr:
            return jsonify({"error": "The student is not studing this year."}), 403
            
        # Verify password dynamically against database bcrypt hash
        password_valid = False
        stored_hash = student.get('password_hash') or ''
        
        if stored_hash.startswith('$2'):
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

        # Check for photo in uploads/student_master_img
        s_id_clean = str(student['student_id']).strip()
        master_img_path = None
        master_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'registration_backend', 'uploads', 'student_master_img'))
        if os.path.exists(master_dir):
            for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']:
                candidate = os.path.join(master_dir, f"{s_id_clean}{ext}")
                if os.path.exists(candidate):
                    master_img_path = f"/uploads/student_master_img/{s_id_clean}{ext}"
                    break
                # Also check matching files
                for f in os.listdir(master_dir):
                    if f.startswith(s_id_clean) and any(f.endswith(e) for e in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']):
                        master_img_path = f"/uploads/student_master_img/{f}"
                        break
                if master_img_path:
                    break

        db_img = student.get('image_url') or student.get('image_path') or student.get('student_image_path') or ''
        if db_img and 'ui-avatars.com' in db_img:
            db_img = ''

        final_img = master_img_path or db_img or ''

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
                "degree_year": student.get('degree_year') or "",
                "mobile_no": student.get('mobile_no'),
                "forenoon_meal": bool(student.get('forenoon_meal')),
                "afternoon_meal": bool(student.get('afternoon_meal')),
                "image_url": final_img
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@student_bp.route('/auth/check-user', methods=['POST'])
@student_bp.route('/api/auth/check-user', methods=['POST'])
def student_check_user():
    try:
        data = request.get_json(silent=True) or {}
        student_reg_no = (
            data.get('register_no') or
            data.get('register_number') or
            data.get('student_id') or
            data.get('username') or ''
        ).strip()

        if not student_reg_no:
            return jsonify({"error": "Please enter your Registration Number"}), 400

        conn = get_db()
        try:
            with conn.cursor() as cur:
                clean_id = str(student_reg_no).strip()
                cur.execute("""
                    SELECT student_id, name, username, email, degree_year FROM student_meals 
                    WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(%s)) 
                       OR LOWER(TRIM(username)) = LOWER(TRIM(%s))
                    LIMIT 1
                """, (clean_id, clean_id))
                student = cur.fetchone()
        finally:
            conn.close()

        if not student:
            return jsonify({
                "exists": False,
                "error": "Student with this Registration Number was not found in the database."
            }), 404

        deg_yr = str(student.get('degree_year') or '').strip().lower()
        if 'graduat' in deg_yr:
            return jsonify({
                "exists": False,
                "error": "The student is not studing this year."
            }), 403

        return jsonify({
            "exists": True,
            "student_id": student['student_id'],
            "name": student.get('name'),
            "has_email": bool(student.get('email'))
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@student_bp.route('/auth/forgot-password', methods=['POST'])
@student_bp.route('/api/auth/forgot-password', methods=['POST'])
def student_forgot_password():
    try:
        data = request.get_json(silent=True) or {}
        student_reg_no = (
            data.get('register_no') or
            data.get('register_number') or
            data.get('student_id') or
            data.get('username') or ''
        ).strip()
        provided_email = (data.get('email') or '').strip()

        if not student_reg_no:
            return jsonify({"error": "Please enter your Registration Number"}), 400
        if not provided_email:
            return jsonify({"error": "Please enter your registered Email Address"}), 400

        conn = get_db()
        try:
            with conn.cursor() as cur:
                clean_id = str(student_reg_no).strip()
                cur.execute("""
                    SELECT * FROM student_meals 
                    WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(%s)) 
                       OR LOWER(TRIM(username)) = LOWER(TRIM(%s))
                    LIMIT 1
                """, (clean_id, clean_id))
                student = cur.fetchone()

                if not student:
                    return jsonify({"error": "Student with this Registration Number was not found in the database."}), 404

                deg_yr = str(student.get('degree_year') or '').strip().lower()
                if 'graduat' in deg_yr:
                    return jsonify({"error": "The student is not studing this year."}), 403

                db_email = (student.get('email') or '').strip()
                if not db_email or db_email.lower() != provided_email.lower():
                    return jsonify({"error": "The entered email address does not match our records for this Registration Number."}), 400

                # Generate clean unambiguous random password
                import secrets
                chars_upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
                chars_lower = "abcdefghijkmnopqrstuvwxyz"
                chars_digits = "23456789"
                chars_symbols = "@#!"

                raw_pwd = [
                    secrets.choice(chars_upper),
                    secrets.choice(chars_lower),
                    secrets.choice(chars_digits),
                    secrets.choice(chars_symbols)
                ]
                all_chars = chars_upper + chars_lower + chars_digits + chars_symbols
                raw_pwd += [secrets.choice(all_chars) for _ in range(6)]
                secrets.SystemRandom().shuffle(raw_pwd)
                new_password = "".join(raw_pwd)

                # Hash password with bcrypt and update DB FIRST
                salt = bcrypt.gensalt()
                hashed = bcrypt.hashpw(new_password.encode('utf-8'), salt).decode('utf-8')
                cur.execute("UPDATE student_meals SET password_hash = %s WHERE student_id = %s", (hashed, student['student_id']))
                conn.commit()
        finally:
            conn.close()

        # Build and dispatch email
        from admin_backend.email_service import get_smtp_config, _send_mime_message
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart

        cfg = get_smtp_config()
        msg = MIMEMultipart('alternative')
        msg['From'] = cfg['from']
        msg['To'] = provided_email
        msg['Subject'] = 'Ramakrishna Mission Vidyapith - Student Portal Password Reset'

        text_body = f"""Dear {student.get('name', 'Student')},

Your password for the RKMVC Student Meal Portal has been reset successfully.

Registration Number: {student['student_id']}
New Password: {new_password}

Login URL: {cfg.get('login_url', 'http://localhost:5050/student/')}

Please keep this password secure. You can now login with your new password.

Ramakrishna Mission Vidyapith
Mylapore, Chennai - 600 004."""

        html_body = f"""<html><body style="font-family: Arial, sans-serif; color: #333; margin: 0; padding: 10px;">
<div style="max-width: 600px; margin: 0 auto; background: #fff8f0; border: 1px solid #fbd5a5; border-radius: 12px; overflow: hidden;">
<div style="background: #ea580c; padding: 20px; text-align: center;">
<h2 style="color: #fff; margin: 0; font-size: 18px; font-weight: bold;">Ramakrishna Mission Vidyapith</h2>
<p style="color: #ffedd5; margin: 4px 0 0; font-size: 12px;">Student Meal Portal Password Reset</p>
</div>
<div style="padding: 24px;">
<p style="font-size: 14px;">Dear <strong>{student.get('name', 'Student')}</strong>,</p>
<p style="font-size: 13px;">Your password for the Student Meal Portal has been successfully reset.</p>
<div style="background: #fff; border: 1px solid #fed7aa; border-radius: 10px; padding: 18px; margin: 18px 0; text-align: center;">
<p style="font-size: 11px; color: #9a3412; font-weight: bold; text-transform: uppercase; margin: 0 0 6px;">Your New Unique Password</p>
<p style="font-size: 20px; font-family: monospace; font-weight: bold; color: #7c2d12; background: #fff7ed; padding: 10px 16px; border: 1px solid #fbd5a5; border-radius: 8px; margin: 0; display: inline-block;">{new_password}</p>
</div>
<p style="font-size: 13px; color: #4b5563;">You can use this password to sign into your portal at <a href="{cfg.get('login_url', '#')}" style="color: #ea580c; font-weight: bold;">Student Portal</a>.</p>
</div>
<div style="background: #ffedd5; padding: 12px; text-align: center; font-size: 11px; color: #9a3412;">
Ramakrishna Mission Vidyapith &bull; Mylapore, Chennai - 600 004.
</div>
</div></body></html>"""

        msg.attach(MIMEText(text_body, 'plain'))
        msg.attach(MIMEText(html_body, 'html'))
        
        try:
            _send_mime_message(cfg, msg)
        except Exception as mail_err:
            print("Notice: Email dispatch alert:", mail_err, flush=True)

        return jsonify({
            "message": "Password reset successfully. A new password has been sent to your email address.",
            "success": True,
            "student_email": provided_email
        }), 200
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
                conn.commit()
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
                  AND ((expiry_time IS NOT NULL AND expiry_time <= NOW()) 
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
    
    server_now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted_tokens = []
    for t in tokens:
        exp_val = t.get('expiry_time') or t.get('expires_at')
        if isinstance(exp_val, (datetime.datetime, datetime.date)):
            exp_str = exp_val.strftime("%Y-%m-%d %H:%M:%S")
        elif exp_val:
            exp_str = str(exp_val).replace('T', ' ')
        else:
            exp_str = None

        c_val = t.get('created_at')
        if isinstance(c_val, (datetime.datetime, datetime.date)):
            c_str = c_val.strftime("%Y-%m-%d %H:%M:%S")
        elif c_val:
            c_str = str(c_val).replace('T', ' ')
        else:
            c_str = server_now_str
        
        formatted_tokens.append({
            "id": t['id'],
            "token_uid": t['token_uid'],
            "student_id": t['student_id'],
            "meal_type": "Breakfast" if t.get('meal_type') == "forenoon" else "Lunch",
            "status": t.get('status'),
            "created_at": c_str,
            "generated_at": c_str,
            "scanned_at": t['scanned_at'].strftime("%Y-%m-%d %H:%M:%S") if isinstance(t.get('scanned_at'), (datetime.datetime, datetime.date)) else None,
            "approved_at": t['approved_at'].strftime("%Y-%m-%d %H:%M:%S") if isinstance(t.get('approved_at'), (datetime.datetime, datetime.date)) else None,
            "expires_at": exp_str,
            "expiry_time": exp_str,
            "server_current_time": server_now_str,
            "qr_data": t['token_uid']
        })

    active_tok = None
    if formatted_tokens and formatted_tokens[0]['status'] in ('active', 'approved', 'staff_verified', 'token_issued'):
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
