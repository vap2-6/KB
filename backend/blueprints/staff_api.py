import os, datetime, json, base64, hmac, hashlib, uuid
from flask import Blueprint, request, jsonify
from admin_backend.models import StudentMeal, MealToken, MealTimeWindow, ScanAuditLog, db
from blueprints.auth import require_role as _require_role

staff_bp = Blueprint('staff_api', __name__)

QR_HMAC_SECRET = os.environ.get('QR_HMAC_SECRET')

@staff_bp.route('/approve', methods=['POST'])
@staff_bp.route('/staff/approve', methods=['POST'])
@staff_bp.route('/api/staff/approve', methods=['POST'])
@_require_role('approval_staff')
def approve_student():
    data = request.json or {}
    scanned_payload = data.get('scanned_payload', '')
    from flask import g
    scanner_id = getattr(g, 'user', {}).get('username', 'staff') if hasattr(g, 'user') else 'staff'
    if not scanned_payload:
        return jsonify({"error": "No QR payload"}), 400
    try:
        decoded = base64.urlsafe_b64decode(scanned_payload.encode()).decode()
        payload_part, sig = decoded.rsplit('.', 1)
        qr_data = json.loads(payload_part)
    except Exception:
        _log_scan(scanner_id, 'approval_staff', 'student_id_qr', scanned_payload, None, None, 'invalid_signature')
        return jsonify({"status": "INVALID", "error": "Invalid QR format"}), 400
    expected_sig = hmac.new(QR_HMAC_SECRET.encode(), payload_part.encode(), hashlib.sha256).hexdigest()[:16]
    if not hmac.compare_digest(sig, expected_sig):
        _log_scan(scanner_id, 'approval_staff', 'student_id_qr', scanned_payload, None, None, 'invalid_signature')
        return jsonify({"status": "INVALID", "error": "QR signature invalid"}), 400
    student_id = qr_data.get('sid')
    if not student_id:
        return jsonify({"error": "Invalid QR data"}), 400
    student = StudentMeal.query.filter_by(student_id=student_id).first()
    if not student:
        _log_scan(scanner_id, 'approval_staff', 'student_id_qr', scanned_payload, student_id, None, 'not_found')
        return jsonify({"status": "INVALID", "error": "Student not found"}), 404
    now = datetime.datetime.now()
    active = MealTimeWindow.query.filter(
        MealTimeWindow.is_active == True,
        MealTimeWindow.start_time <= now.time(),
        MealTimeWindow.end_time >= now.time()
    ).first()
    if not active:
        _log_scan(scanner_id, 'approval_staff', 'student_id_qr', scanned_payload, student_id, None, 'out_of_window')
        return jsonify({"status": "OUT_OF_WINDOW", "error": "No active meal window", "student": student.to_dict() if hasattr(student, 'to_dict') else {"student_id": student.student_id, "name": student.name}}), 200
    meal_type = active.meal_type
    existing = MealToken.query.filter(
        MealToken.student_id == student_id,
        MealToken.meal_type == meal_type,
        MealToken.created_at >= datetime.datetime.combine(now.date(), datetime.time.min),
        MealToken.status.notin_(['rejected', 'expired'])
    ).first()
    if existing:
        _log_scan(scanner_id, 'approval_staff', 'student_id_qr', scanned_payload, student_id, existing.token_uid, 'duplicate_meal')
        return jsonify({"status": "DUPLICATE", "error": "Token already exists for this meal today", "student": {"student_id": student.student_id, "name": student.name}}), 200
    token_uid = _generate_token_uid(meal_type)
    expiry_mins = max(30, int(getattr(active, 'expiry_minutes', 30) or 30))
    token_expiry = now + datetime.timedelta(minutes=expiry_mins)
    if active and hasattr(active, 'end_time') and active.end_time:
        try:
            window_end = datetime.datetime.combine(now.date(), datetime.datetime.strptime(str(active.end_time), '%H:%M:%S').time())
            window_expiry = window_end + datetime.timedelta(minutes=expiry_mins)
            expiry_dt = max(token_expiry, window_expiry)
        except Exception:
            expiry_dt = token_expiry
    else:
        expiry_dt = token_expiry

    token = MealToken(
        token_uid=token_uid, student_id=student_id, meal_type=meal_type,
        cached_student_name=getattr(student, 'name', None),
        cached_image_url=getattr(student, 'image_url', None),
        status='approved', scanned_by=scanner_id, scanned_at=now,
        approved_by=scanner_id, approved_at=now,
        token_issued_at=now, expiry_time=expiry_dt
    )
    db.session.add(token)
    db.session.commit()
    token_qr_payload = json.dumps({"tu": token_uid, "sid": student_id, "mt": meal_type, "exp": expiry_dt.isoformat()})
    token_sig = hmac.new(QR_HMAC_SECRET.encode(), token_qr_payload.encode(), hashlib.sha256).hexdigest()[:16]
    token_qr_data = base64.urlsafe_b64encode(f"{token_qr_payload}.{token_sig}".encode()).decode()
    token.token_qr_data = token_qr_data
    db.session.commit()
    _log_scan(scanner_id, 'approval_staff', 'student_id_qr', scanned_payload, student_id, token_uid, 'success')
    return jsonify({
        "status": "APPROVED", "token": _token_dict(token), "qr_data": token_qr_data,
        "student": {"student_id": student.student_id, "name": student.name, "grade_section": student.grade_section},
        "active_window": {"meal_type": meal_type, "start_time": str(active.start_time), "end_time": str(active.end_time)}
    })

def _generate_token_uid(meal_type):
    prefix = "FN" if meal_type == 'forenoon' else "AN"
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"

def _token_dict(t):
    return {
        "uid": t.token_uid, "token_uid": t.token_uid, "student_id": t.student_id,
        "student_name": (t.student_info.name if t.student_info else None) or t.cached_student_name or t.student_id,
        "meal_type": t.meal_type, "status": t.status,
        "scanned_by": t.scanned_by, "approved_by": t.approved_by,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "redeemed_at": t.redeemed_at.isoformat() if t.redeemed_at else None,
        "expiry_time": t.expiry_time.isoformat() if t.expiry_time else None
    }

def _log_scan(scanner_id, scanner_role, scan_type, payload, student_id, token_uid, result, detail=None):
    log = ScanAuditLog(
        scanner_id=scanner_id, scanner_role=scanner_role, scan_type=scan_type,
        payload=payload, student_id=student_id, token_uid=token_uid,
        result=result, detail=detail
    )
    db.session.add(log)
    db.session.commit()

def _decode_qr(scanned_payload):
    decoded = base64.urlsafe_b64decode(scanned_payload.encode()).decode()
    payload_part, sig = decoded.rsplit('.', 1)
    qr_data = json.loads(payload_part)
    expected_sig = hmac.new(QR_HMAC_SECRET.encode(), payload_part.encode(), hashlib.sha256).hexdigest()[:16]
    if not hmac.compare_digest(sig, expected_sig):
        return None, "QR signature invalid"
    return qr_data, None

def _get_active_window():
    now = datetime.datetime.now()
    return MealTimeWindow.query.filter(
        MealTimeWindow.is_active == True,
        MealTimeWindow.start_time <= now.time(),
        MealTimeWindow.end_time >= now.time()
    ).first()

@staff_bp.route('/verify', methods=['POST'])
@staff_bp.route('/staff/verify', methods=['POST'])
@staff_bp.route('/api/staff/verify', methods=['POST'])
@_require_role('approval_staff')
def verify_student():
    data = request.json or {}
    scanned_payload = data.get('scanned_payload', '')
    if not scanned_payload:
        return jsonify({"error": "No QR payload"}), 400
    qr_data, err = _decode_qr(scanned_payload)
    if err:
        return jsonify({"status": "INVALID", "error": err}), 400
    student_id = qr_data.get('sid')
    if not student_id:
        return jsonify({"error": "Invalid QR data"}), 400
    student = StudentMeal.query.filter_by(student_id=student_id).first()
    if not student:
        return jsonify({"status": "INVALID", "error": "Student not found"}), 404
    active = _get_active_window()
    return jsonify({
        "status": "OK",
        "student": {"student_id": student.student_id, "name": student.name, "grade_section": student.grade_section},
        "active_window": {
            "meal_type": active.meal_type if active else None,
            "start_time": str(active.start_time) if active else None,
            "end_time": str(active.end_time) if active else None
        } if active else None
    })

@staff_bp.route('/reject', methods=['POST'])
@staff_bp.route('/staff/reject', methods=['POST'])
@staff_bp.route('/api/staff/reject', methods=['POST'])
@_require_role('approval_staff')
def reject_student():
    data = request.json or {}
    scanned_payload = data.get('scanned_payload', '')
    from flask import g
    scanner_id = getattr(g, 'user', {}).get('username', 'staff') if hasattr(g, 'user') else 'staff'
    if not scanned_payload:
        return jsonify({"error": "No QR payload"}), 400
    qr_data, err = _decode_qr(scanned_payload)
    if err:
        return jsonify({"status": "INVALID", "error": err}), 400
    student_id = qr_data.get('sid')
    _log_scan(scanner_id, 'approval_staff', 'student_id_qr', scanned_payload, student_id, None, 'rejected')
    return jsonify({"status": "REJECTED", "student_id": student_id})
