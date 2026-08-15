import os
import pymysql
from dotenv import load_dotenv

load_dotenv()

host = os.environ.get('MYSQL_HOST', '127.0.0.1')
port = int(os.environ.get('MYSQL_PORT', '3306'))
user = os.environ.get('MYSQL_USER', 'root')
password = os.environ.get('MYSQL_PASSWORD', '')
db_name = os.environ.get('MYSQL_DATABASE', 'rkmvc_mealflow_db')

print(f"Connecting to MySQL at {host}:{port} with user '{user}'...")

try:
    conn = pymysql.connect(host=host, port=port, user=user, password=password)
    with conn.cursor() as cur:
        cur.execute("SHOW DATABASES;")
        dbs = [r[0] for r in cur.fetchall()]
        print("Databases found:", dbs)
        if db_name in dbs:
            print(f"SUCCESS: Database '{db_name}' exists!")
        else:
            print(f"NOTICE: Database '{db_name}' not listed yet. Creating...")
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}`;")
            print(f"SUCCESS: Database '{db_name}' created!")
    conn.close()
except Exception as e:
    print("Connection error:", e)
