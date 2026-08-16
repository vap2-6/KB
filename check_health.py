import os
import sys
import pymysql
import requests

print("=" * 60)
print(" MEALFLOW SYSTEM SELF-DIAGNOSTIC TOOL")
print("=" * 60)

# 1. Test MySQL Connection
db_user = os.environ.get('MYSQL_USER', 'meal_app')
db_pass = os.environ.get('MYSQL_PASSWORD', 'Admin@RKMVC2')
db_host = os.environ.get('MYSQL_HOST', '127.0.0.1')
db_name = os.environ.get('MYSQL_DATABASE', 'rkmvc_mealflow_db')

print("\n[1/2] Checking MySQL Database Connection...")
db_ok = False
try:
    conn = pymysql.connect(host=db_host, user=db_user, password=db_pass, database=db_name, connect_timeout=3)
    print(f"  [OK] MySQL Connected cleanly as '{db_user}'@'{db_host}' to database '{db_name}'!")
    conn.close()
    db_ok = True
except Exception as e:
    print(f"  [FAIL] MySQL Connection FAILED: {e}")
    print("     -> FIX: Run 'python fix_db.py' to restore MySQL privileges automatically.")

# 2. Test Backend Server Port 5050
print("\n[2/2] Checking Backend Server (Port 5050)...")
server_ok = False
try:
    r = requests.get("http://localhost:5050/register/", timeout=3)
    if r.status_code == 200:
        print("  [OK] Backend server on http://localhost:5050 is UP & RUNNING!")
        server_ok = True
    else:
        print(f"  [WARN] Server responded with HTTP status: {r.status_code}")
except Exception as e:
    print(f"  [FAIL] Backend Server on Port 5050 IS OFFLINE or UNREACHABLE: {e}")
    print("     -> FIX: Run 'python backend/server/main.py' to start the server.")

print("\n" + "=" * 60)
if db_ok and server_ok:
    print(" ALL SYSTEMS GO! Everything is connected and working smoothly.")
else:
    print(" Action needed above to restore full system operations.")
print("=" * 60 + "\n")
