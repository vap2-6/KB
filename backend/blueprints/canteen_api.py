import os, datetime, json, base64, hmac, hashlib
from flask import Blueprint, request, jsonify
from admin_backend.models import StudentMeal, MealToken, MealTimeWindow, ScanAuditLog, db
from blueprints.auth import require_role as _require_role

canteen_bp = Blueprint('canteen_api', __name__)

QR_HMAC_SECRET = os.environ.get('QR_HMAC_SECRET')

@canteen_bp.route('/verify-token', methods=['POST'])
@canteen_bp.route('/canteen/verify-token', methods=['POST'])
@canteen_bp.route('/api/canteen/verify-token', methods=['POST'])
@_require_role('canteen_staff')
def verify_token():
    data = request.json or {}
    scanned_payload = data.get('scanned_payload', '')
    from flask import g
    scanner_id = getattr(g, 'user', {}).get('username', 'canteen_staff') if hasattr(g, 'user') else 'canteen_staff'
    if not scanned_payload:
        return jsonify({"error": "No QR payload"}), 400
    try:
        decoded = base64.urlsafe_b64decode(scanned_payload.encode()).decode()
        payload_part, sig = decoded.rsplit('.', 1)
        qr_data = json.loads(payload_part)
    except Exception:
        _log_scan(scanner_id, 'canteen_staff', 'token_qr', scanned_payload, None, None, 'invalid_signature')
        return jsonify({"result": "INVALID", "error": "Invalid QR format"}), 400
    expected_sig = hmac.new(QR_HMAC_SECRET.encode(), payload_part.encode(), hashlib.sha256).hexdigest()[:16]
    if not hmac.compare_digest(sig, expected_sig):
        _log_scan(scanner_id, 'canteen_staff', 'token_qr', scanned_payload, None, None, 'invalid_signature')
        return jsonify({"result": "INVALID", "error": "QR signature invalid"}), 400
    token_uid = qr_data.get('tu')
    student_id = qr_data.get('sid')
    meal_type = qr_data.get('mt')
    if not token_uid or not student_id:
        _log_scan(scanner_id, 'canteen_staff', 'token_qr', scanned_payload, student_id, token_uid, 'invalid_token')
        return jsonify({"result": "INVALID", "error": "Invalid token data"}), 400
    token = MealToken.query.filter_by(token_uid=token_uid).first()
    if not token:
        _log_scan(scanner_id, 'canteen_staff', 'token_qr', scanned_payload, student_id, token_uid, 'not_found')
        return jsonify({"result": "INVALID", "error": "Token not found"}), 404
    now = datetime.datetime.now()
    if token.status == 'redeemed':
        _log_scan(scanner_id, 'canteen_staff', 'token_qr', scanned_payload, student_id, token_uid, 'already_redeemed')
        return jsonify({"result": "ALREADY_REDEEMED", "token_uid": token_uid,
                        "detail": f"Redeemed at {token.redeemed_at.isoformat() if token.redeemed_at else 'unknown'}"}), 200
    if token.expiry_time and now > token.expiry_time:
        token.status = 'expired'
        db.session.commit()
        _log_scan(scanner_id, 'canteen_staff', 'token_qr', scanned_payload, student_id, token_uid, 'expired')
        return jsonify({"result": "EXPIRED", "token_uid": token_uid,
                        "detail": f"Token expired at {token.expiry_time.isoformat()}"}), 200
    active = MealTimeWindow.query.filter(
        MealTimeWindow.is_active == True,
        MealTimeWindow.meal_type == meal_type,
        MealTimeWindow.start_time <= now.time(),
        MealTimeWindow.end_time >= now.time()
    ).first()
    if not active:
        _log_scan(scanner_id, 'canteen_staff', 'token_qr', scanned_payload, student_id, token_uid, 'out_of_window')
        return jsonify({"result": "OUT_OF_WINDOW", "token_uid": token_uid,
                        "detail": "No active canteen window for this meal type"}), 200
    token.status = 'redeemed'
    token.redeemed_by = scanner_id
    token.redeemed_at = now
    db.session.commit()
    student = StudentMeal.query.filter_by(student_id=student_id).first()
    _log_scan(scanner_id, 'canteen_staff', 'token_qr', scanned_payload, student_id, token_uid, 'success')
    return jsonify({
        "result": "APPROVED", "token_uid": token_uid,
        "student": {"student_id": student.student_id, "name": student.name} if student else None,
        "meal_type": meal_type, "redeemed_at": now.isoformat()
    })

def _log_scan(scanner_id, scanner_role, scan_type, payload, student_id, token_uid, result, detail=None):
    log = ScanAuditLog(
        scanner_id=scanner_id, scanner_role=scanner_role, scan_type=scan_type,
        payload=payload, student_id=student_id, token_uid=token_uid,
        result=result, detail=detail
    )
    db.session.add(log)
    db.session.commit()
