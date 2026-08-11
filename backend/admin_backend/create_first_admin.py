#!/usr/bin/env python3
"""
One-off script to create the first Admin account.
Run this AFTER the app has started at least once (so the `users` table exists).

Usage:
    python create_first_admin.py
"""
import os
import sys
import uuid
import getpass
import bcrypt
import pymysql

MYSQL_HOST = os.environ.get('MYSQL_HOST', '127.0.0.1')
MYSQL_PORT = int(os.environ.get('MYSQL_PORT', '3306'))
MYSQL_USER = os.environ.get('MYSQL_USER', 'meal_app')
MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', 'Admin@RKMVC2')
MYSQL_DATABASE = os.environ.get('MYSQL_DATABASE', 'rkmvc_mealflow_db')

def main():
    print("── Create First Admin Account ──")
    username = input("Username: ").strip()
    email = input("Email: ").strip()
    display_name = input("Display name (optional, press Enter to use username): ").strip() or username
    password = getpass.getpass("Password (min 6 chars): ")
    if len(password) < 6:
        print("Password must be at least 6 characters.")
        sys.exit(1)
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print("Passwords do not match.")
        sys.exit(1)

    pw_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode()
    uid = "usr_" + uuid.uuid4().hex[:9]

    conn = pymysql.connect(
        host=MYSQL_HOST, port=MYSQL_PORT, user=MYSQL_USER,
        password=MYSQL_PASSWORD, database=MYSQL_DATABASE,
        charset='utf8mb4', autocommit=True
    )
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE username = %s OR email = %s", (username, email))
            if cur.fetchone():
                print(f"Error: username '{username}' or email '{email}' is already taken.")
                sys.exit(1)
            cur.execute(
                "INSERT INTO users (id, username, email, password_hash, role, display_name) "
                "VALUES (%s, %s, %s, %s, 'admin', %s)",
                (uid, username, email, pw_hash, display_name)
            )
        print(f"\nAdmin account '{username}' created successfully! You can now log in at http://localhost:3000")
    finally:
        conn.close()

if __name__ == '__main__':
    main()
