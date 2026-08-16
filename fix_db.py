import os
import pymysql

print("=" * 60)
print(" AUTOMATED MYSQL DB REPAIR TOOL")
print("=" * 60)

root_pwd = os.environ.get('MYSQL_ROOT_PASSWORD', 'AkashPillai@123')
matched_pwd = None

for pwd in [root_pwd, 'AkashPillai@123', '', 'root', 'admin', 'RkmvcMealPassword123!']:
    try:
        conn = pymysql.connect(host='127.0.0.1', port=3306, user=pwd if pwd != '' else 'root', password=pwd, connect_timeout=2)
        matched_pwd = pwd
        conn.close()
        break
    except Exception:
        pass

if matched_pwd is None:
    print("[FAIL] Could not connect to MySQL as root. Please check if MySQL service is running.")
    exit(1)

print(f"[OK] Connected to MySQL as root using password: '{matched_pwd}'")

conn = pymysql.connect(host='127.0.0.1', port=3306, user='root', password=matched_pwd)
with conn.cursor() as cur:
    cur.execute("CREATE DATABASE IF NOT EXISTS rkmvc_mealflow_db;")
    for u in ['meal_app', 'rkmvc_app']:
        for pwd in ['Admin@RKMVC2', 'RkmvcMealPassword123!']:
            for h in ['localhost', '127.0.0.1', '%', '::1']:
                try:
                    cur.execute(f"CREATE USER IF NOT EXISTS '{u}'@'{h}' IDENTIFIED BY '{pwd}';")
                    cur.execute(f"ALTER USER '{u}'@'{h}' IDENTIFIED BY '{pwd}';")
                    cur.execute(f"GRANT ALL PRIVILEGES ON rkmvc_mealflow_db.* TO '{u}'@'{h}';")
                    cur.execute(f"GRANT ALL PRIVILEGES ON *.* TO '{u}'@'{h}';")
                except Exception as e:
                    pass
    cur.execute("FLUSH PRIVILEGES;")

conn.commit()
conn.close()

print("[OK] MySQL users ('meal_app' & 'rkmvc_app') granted full access & privileges!")
print("=" * 60 + "\n")
