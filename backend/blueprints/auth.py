import os, jwt
from functools import wraps
from flask import request, jsonify

def require_role(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            auth_header = request.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                return jsonify({"error": "Unauthorized"}), 401
            secret = os.environ.get('JWT_SECRET')
            try:
                payload = jwt.decode(auth_header.split(' ')[1], secret, algorithms=["HS256"])
            except Exception:
                return jsonify({"error": "Invalid token"}), 401
            if payload.get('role') not in roles:
                return jsonify({"error": "Forbidden"}), 403
            from flask import g
            g.user = payload
            return f(*args, **kwargs)
        return decorated
    return decorator
