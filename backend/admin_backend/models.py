from admin_backend.extensions import db
from sqlalchemy import Column, Integer, String, Time, Boolean, DateTime, Text, Enum, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

class SystemRole(db.Model):
    __tablename__ = 'system_roles'
    id = Column(Integer, primary_key=True, autoincrement=True)
    role_name = Column(String(50), unique=True, nullable=False)

class UserAccount(db.Model):
    __tablename__ = 'users'
    id = Column(String(50), primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum('admin','approval_staff','canteen_staff'), nullable=False, default='approval_staff')
    display_name = Column(String(100))
    created_at = Column(DateTime, server_default=func.current_timestamp())

class StudentMeal(db.Model):
    __tablename__ = 'student_meals'
    student_id = Column(String(50), primary_key=True)
    username = Column(String(50), unique=True, nullable=True)
    email = Column(String(100), nullable=True)
    password_hash = Column(String(255), nullable=True)
    name = Column(String(100), nullable=False)
    grade_section = Column(String(100), nullable=False)
    degree_year = Column(String(50), nullable=True)
    mobile_no = Column(String(50), nullable=True)
    forenoon_meal = Column(Boolean, default=True)
    afternoon_meal = Column(Boolean, default=True)
    last_served_date = Column(DateTime, nullable=True)
    qr_secret = Column(String(64), nullable=True)
    image_url = Column(String(512), nullable=True)
    image_path = Column(String(512), nullable=True)
    student_image_path = Column(String(512), nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())

    tokens = relationship('MealToken', back_populates='student_info', foreign_keys='MealToken.student_id')

class MealToken(db.Model):
    __tablename__ = 'meal_tokens'
    id = Column(Integer, primary_key=True, autoincrement=True)
    token_uid = Column(String(50), unique=True, nullable=False)
    student_id = Column(String(50), ForeignKey('student_meals.student_id'), nullable=False)
    cached_student_name = Column(String(100), nullable=True)
    cached_image_url = Column(String(512), nullable=True)
    meal_type = Column(Enum('forenoon','afternoon'), nullable=False)
    status = Column(Enum('active','approved','rejected','expired'), default='active')
    scanned_by = Column(String(50), nullable=True)
    scanned_at = Column(DateTime, nullable=True)
    approved_by = Column(String(50), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    reject_reason = Column(String(255), nullable=True)
    token_qr_data = Column(Text, nullable=True)
    token_issued_at = Column(DateTime, nullable=True)
    redeemed_by = Column(String(50), nullable=True)
    redeemed_at = Column(DateTime, nullable=True)
    expiry_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())

    student_info = relationship('StudentMeal', back_populates='tokens', foreign_keys=[student_id])

    __table_args__ = (
        Index('idx_token_uid', 'token_uid'),
        Index('idx_student', 'student_id'),
        Index('idx_status', 'status'),
        Index('idx_student_meal_status', 'student_id', 'meal_type', 'status'),
    )

class ScanAuditLog(db.Model):
    __tablename__ = 'scan_audit_log'
    id = Column(Integer, primary_key=True, autoincrement=True)
    scanner_id = Column(String(50), nullable=False)
    scanner_role = Column(Enum('approval_staff','canteen_staff'), nullable=False)
    scan_type = Column(Enum('student_id_qr','token_qr'), nullable=False)
    payload = Column(Text, nullable=False)
    student_id = Column(String(50), nullable=True)
    token_uid = Column(String(50), nullable=True)
    result = Column(Enum('success','invalid_token','already_redeemed','expired','out_of_window',
        'duplicate_meal','not_eligible','generation_disabled','invalid_signature','not_found'), nullable=False)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())

    __table_args__ = (
        Index('idx_scanner', 'scanner_id'),
        Index('idx_created', 'created_at'),
    )

class AppState(db.Model):
    __tablename__ = 'app_state'
    id = Column(Integer, primary_key=True)
    data = Column(Text, nullable=False)
    updated_at = Column(DateTime, server_default=func.current_timestamp(), onupdate=func.current_timestamp())

class MealTimeWindow(db.Model):
    __tablename__ = 'meal_windows'
    id = Column(Integer, primary_key=True, autoincrement=True)
    meal_type = Column(Enum('forenoon', 'afternoon'), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.current_timestamp())

class MealRegistration(db.Model):
    __tablename__ = 'meal_registrations'
    registration_id = Column(String(50), primary_key=True)
    app_no = Column(String(50), nullable=True)
    student_name = Column(String(100), nullable=False)
    dob_age = Column(String(50), nullable=True)
    course = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    degree_year = Column(String(20), nullable=True)
    dept_number = Column(String(50), nullable=True)
    mobile_no = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    father_name = Column(String(100), nullable=True)
    father_occupation = Column(String(100), nullable=True)
    forenoon_meal = Column(Boolean, default=True)
    afternoon_meal = Column(Boolean, default=True)
    annual_income = Column(String(50), nullable=True)
    distance_km = Column(String(50), nullable=True)
    permanent_address = Column(Text, nullable=True)
    permanent_pin = Column(String(20), nullable=True)
    local_address = Column(Text, nullable=True)
    local_pin = Column(String(20), nullable=True)
    landline = Column(String(50), nullable=True)
    employment_type = Column(String(50), nullable=True)
    religion = Column(String(50), nullable=True)
    community = Column(String(50), nullable=True)
    last_year_id = Column(String(50), nullable=True)
    student_photo_url = Column(String(512), nullable=True)
    applicant_signature_url = Column(String(512), nullable=True)
    income_proof_url = Column(String(512), nullable=True)
    generated_pdf_url = Column(String(512), nullable=True)
    status = Column(Enum('pending','approved','rejected'), default='pending')
    submitted_at = Column(DateTime, server_default=func.current_timestamp())

    __table_args__ = (
        Index('idx_reg_status', 'status'),
        Index('idx_reg_dept', 'dept_number'),
        Index('idx_reg_mobile', 'mobile_no'),
    )

