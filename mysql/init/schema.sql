CREATE DATABASE IF NOT EXISTS `rkmvc_mealflow_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `rkmvc_mealflow_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================================
-- 1. SYSTEM OPERATORS (Admin & Staff ONLY)
-- Core authentication and RBAC entity for administrative and staff accounts.
-- =========================================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(50) NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'approval_staff', 'canteen_staff') NOT NULL DEFAULT 'approval_staff',
  `display_name` VARCHAR(100) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_users_username` (`username`),
  UNIQUE KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================================
-- 2. STUDENT ACCOUNTS & MEAL ELIGIBILITY
-- Primary student repository containing profile details, meal entitlements,
-- credentials, and profile image storage references.
-- =========================================================================
CREATE TABLE IF NOT EXISTS `student_meals` (
  `student_id` VARCHAR(50) NOT NULL, -- Institutional Alphanumeric Identifier (e.g., STU101 / 243301034021)
  `username` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `grade_section` VARCHAR(100) NOT NULL,
  `forenoon_meal` TINYINT(1) NOT NULL DEFAULT 1,
  `afternoon_meal` TINYINT(1) NOT NULL DEFAULT 1,
  `last_served_date` DATE NULL,
  `qr_secret` VARCHAR(64) NULL,
  `image_url` VARCHAR(512) NULL DEFAULT NULL,  -- Storage bucket/URL pointer
  `image_path` VARCHAR(512) NULL DEFAULT NULL, -- Local storage filepath
  `previous_degree_year` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`),
  UNIQUE KEY `idx_student_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================================
-- 2B. GRADUATED STUDENTS ARCHIVE
-- Historical alumni archive holding graduated student profiles.
-- =========================================================================
CREATE TABLE IF NOT EXISTS `graduated_students` (
  `student_id` VARCHAR(50) NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100) NULL,
  `password_hash` VARCHAR(255) NULL,
  `name` VARCHAR(100) NOT NULL,
  `grade_section` VARCHAR(100) NOT NULL,
  `degree_year` VARCHAR(50) NOT NULL DEFAULT 'Graduated',
  `previous_degree_year` VARCHAR(50) NULL,
  `graduation_year` INT NOT NULL,
  `graduated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `forenoon_meal` TINYINT(1) NOT NULL DEFAULT 0,
  `afternoon_meal` TINYINT(1) NOT NULL DEFAULT 0,
  `qr_secret` VARCHAR(64) NULL,
  `image_url` VARCHAR(512) NULL DEFAULT NULL,
  `image_path` VARCHAR(512) NULL DEFAULT NULL,
  PRIMARY KEY (`student_id`),
  INDEX `idx_grad_year` (`graduation_year`),
  INDEX `idx_grad_time` (`graduated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================================
-- 3. MEAL TOKENS
-- Voucher transaction tracking ledger linking staff issuance to student QR scanning.
-- Status lifecycle: active -> approved (claimed) or rejected / expired.
-- =========================================================================
CREATE TABLE IF NOT EXISTS `meal_tokens` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `token_uid` VARCHAR(50) NOT NULL,
  `student_id` VARCHAR(50) NOT NULL,
  `cached_student_name` VARCHAR(100) NULL, -- High-speed read optimization
  `cached_image_url` VARCHAR(512) NULL,     -- Kiosk profile portrait cache
  `meal_type` ENUM('forenoon', 'afternoon') NOT NULL,
  `status` ENUM('active', 'approved', 'rejected', 'expired') NOT NULL DEFAULT 'active',
  `scanned_by` VARCHAR(50) NULL,
  `scanned_at` TIMESTAMP NULL,
  `approved_by` VARCHAR(50) NULL,
  `approved_at` TIMESTAMP NULL,
  `reject_reason` VARCHAR(255) NULL,
  `token_qr_data` VARCHAR(512) NULL, 
  `token_issued_at` TIMESTAMP NULL,
  `redeemed_by` VARCHAR(50) NULL,
  `redeemed_at` TIMESTAMP NULL,
  `expiry_time` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_token_uid` (`token_uid`),
  INDEX `idx_student_lookup` (`student_id`),
  INDEX `idx_status_tracker` (`status`),
  INDEX `idx_meal_reporting` (`meal_type`, `created_at`),
  CONSTRAINT `fk_tokens_student` FOREIGN KEY (`student_id`) REFERENCES `student_meals` (`student_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================================
-- 4. SCAN AUDIT LOG
-- Dedicated write-heavy telemetry table capturing all terminal scans.
-- =========================================================================
CREATE TABLE IF NOT EXISTS `scan_audit_log` (
  `id` BIGINT AUTO_INCREMENT NOT NULL,
  `scanner_id` VARCHAR(50) NOT NULL,
  `scanner_role` ENUM('approval_staff', 'canteen_staff') NOT NULL,
  `scan_type` ENUM('student_id_qr', 'token_qr') NOT NULL,
  `payload` VARCHAR(512) NOT NULL, 
  `student_id` VARCHAR(50) NULL,
  `token_uid` VARCHAR(50) NULL,
  `result` ENUM('success', 'invalid_token', 'already_redeemed', 'expired', 'out_of_window', 'duplicate_meal', 'not_eligible', 'generation_disabled', 'invalid_signature', 'not_found') NOT NULL,
  `detail` VARCHAR(255) NULL, 
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_scanner_perf` (`scanner_id`, `created_at`),
  INDEX `idx_fraud_check` (`student_id`, `result`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================================
-- 5. APP STATE
-- Global system state & meal timing configurations.
-- =========================================================================
CREATE TABLE IF NOT EXISTS `app_state` (
  `id` INT PRIMARY KEY,
  `data` JSON NOT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================================
-- 6. AUDIT LOGS
-- Immutable database write tracking ledger.
-- =========================================================================
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(50) NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `table_name` VARCHAR(50) NOT NULL,
  `details` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_audit_user` (`username`),
  INDEX `idx_audit_time` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================================
-- 7. SYSTEM I/O TRACKING
-- Data import/export log.
-- =========================================================================
CREATE TABLE IF NOT EXISTS `data_io_logs` (
  `id` VARCHAR(50) NOT NULL,
  `direction` ENUM('IMPORT', 'EXPORT') NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `records_processed` INT NOT NULL DEFAULT 0,
  `format` ENUM('csv', 'excel', 'json') NOT NULL DEFAULT 'csv',
  `status` ENUM('SUCCESS', 'FAILED', 'PARTIAL') NOT NULL DEFAULT 'SUCCESS',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_io_time` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default meal timings into app_state
INSERT INTO `app_state` (`id`, `data`) VALUES
(1, '{"meal_timings": {"forenoon": {"start": "07:30", "end": "10:00", "expiry": 15}, "afternoon": {"start": "12:00", "end": "14:30", "expiry": 15}}}')
ON DUPLICATE KEY UPDATE data=VALUES(data);

SET FOREIGN_KEY_CHECKS = 1;
