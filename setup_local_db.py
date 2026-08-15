#!/usr/bin/env python3
"""
One-time local database bootstrapper.

This script does NOT create tables — the Flask app (backend/server/main.py)
already creates its full schema and seeds default users automatically on
every startup via `_ensure_tables()` in backend/admin_backend/app.py.

What this script DOES do is the one thing the app can't do for itself:
create the MySQL *database* and *application user* the app needs to log in
with, using your MySQL root credentials. Run this once, then just run
`./run-local.sh` (or `python backend/server/main.py`) as usual.

Usage:
    python setup_local_db.py

It reads MYSQL_HOST / MYSQL_PORT / MYSQL_DATABASE / MYSQL_USER / MYSQL_PASSWORD
from your .env file (falling back to backend/server/.env), and will prompt
you for your MySQL root username/password to perform the setup.
"""
import os
import sys
import getpass

try:
    import pymysql
except ImportError:
    print("ERROR: pymysql is not installed. Run:")
    print("  pip install pymysql")
    sys.exit(1)


def load_env_file(path):
    if not os.path.isfile(path):
        return {}
    values = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            values[key] = value
    return values


def find_env():
    here = os.path.dirname(os.path.abspath(__file__))
    root_env = os.path.join(here, ".env")
    server_env = os.path.join(here, "backend", "server", ".env")
    if os.path.isfile(root_env):
        return root_env
    if os.path.isfile(server_env):
        return server_env
    return None


def main():
    env_path = find_env()
    if not env_path:
        print("ERROR: No .env file found.")
        print("Copy .env.example to .env first, then re-run this script.")
        sys.exit(1)

    env = load_env_file(env_path)
    print(f"Loaded config from {env_path}\n")

    db_host = os.environ.get("MYSQL_HOST") or env.get("MYSQL_HOST", "127.0.0.1")
    db_port = int(os.environ.get("MYSQL_PORT") or env.get("MYSQL_PORT", "3306"))
    db_name = os.environ.get("MYSQL_DATABASE") or env.get("MYSQL_DATABASE", "rkmvc_mealflow_db")
    db_user = os.environ.get("MYSQL_USER") or env.get("MYSQL_USER", "meal_app")
    db_pass = os.environ.get("MYSQL_PASSWORD") or env.get("MYSQL_PASSWORD", "")

    if not db_pass:
        print("ERROR: MYSQL_PASSWORD is not set in your .env file.")
        sys.exit(1)

    print("Will provision the following for the app to use:")
    print(f"   Host      = {db_host}")
    print(f"   Port      = {db_port}")
    print(f"   Database  = {db_name}")
    print(f"   App user  = {db_user}")
    print()

    root_user = input("MySQL ADMIN username to run setup with [root]: ").strip() or "root"
    root_pass = getpass.getpass(f"MySQL password for '{root_user}' (blank if none): ")

    try:
        conn = pymysql.connect(
            host=db_host,
            port=db_port,
            user=root_user,
            password=root_pass,
            connect_timeout=5,
        )
    except pymysql.err.OperationalError as e:
        print(f"\nERROR: Could not connect as '{root_user}': {e}")
        print("Make sure your local MySQL server is running and the admin")
        print("username/password you entered are correct.")
        sys.exit(1)

    try:
        with conn.cursor() as cur:
            print(f"\nCreating database `{db_name}` (if not exists)...")
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )

            for host_scope in ("localhost", "127.0.0.1", "%"):
                print(f"Creating user '{db_user}'@'{host_scope}' (if not exists)...")
                cur.execute(
                    f"CREATE USER IF NOT EXISTS %s@%s IDENTIFIED BY %s",
                    (db_user, host_scope, db_pass),
                )
                # Make sure the password matches even if the user already existed
                cur.execute(
                    f"ALTER USER %s@%s IDENTIFIED BY %s",
                    (db_user, host_scope, db_pass),
                )
                cur.execute(
                    f"GRANT ALL PRIVILEGES ON `{db_name}`.* TO %s@%s",
                    (db_user, host_scope),
                )

            cur.execute("FLUSH PRIVILEGES")
        conn.commit()
    finally:
        conn.close()

    print("\nDatabase and user are ready.")

    # Sanity check: confirm the app user can actually log in
    try:
        test_conn = pymysql.connect(
            host=db_host, port=db_port, user=db_user, password=db_pass,
            database=db_name, connect_timeout=5,
        )
        test_conn.close()
        print(f"Verified: '{db_user}' can connect to '{db_name}'.\n")
        print("You're all set. Now run:")
        print("   ./run-local.sh")
        print("(or on Windows: bash run-local.sh, via Git Bash / WSL)")
        print("\nThe app will create all its tables and seed default logins")
        print("automatically the first time it starts.")
    except pymysql.err.OperationalError as e:
        print(f"\nWARNING: Setup finished but a test login still failed: {e}")
        print("Double-check MYSQL_HOST/MYSQL_PORT in your .env match this server.")
        sys.exit(1)


if __name__ == "__main__":
    main()
