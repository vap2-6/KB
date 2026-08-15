import pymysql

for port in [3306, 3307]:
    try:
        conn = pymysql.connect(host='127.0.0.1', port=port, user='rkmvc_app', password='rkmvc_app_password', database='rkmvc_mealflow_db')
        print(f"\n--- PORT {port} TABLES ---")
        with conn.cursor() as cur:
            cur.execute("SHOW TABLES;")
            tables = [row[0] for row in cur.fetchall()]
            print("Tables:", tables)
            for t in tables:
                cur.execute(f"SELECT COUNT(*) FROM `{t}`")
                cnt = cur.fetchone()[0]
                print(f"  - {t}: {cnt} rows")
        conn.close()
    except Exception as e:
        print(f"PORT {port}: {e}")
