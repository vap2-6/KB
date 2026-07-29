import pymysql

for port in [3306, 3307]:
    for user, pw in [('rkmvc_app', 'rkmvc_app_password'), ('root', 'root_password_secure'), ('root', 'adminpassword')]:
        try:
            conn = pymysql.connect(host='127.0.0.1', port=port, user=user, password=pw)
            print(f"PORT {port} (user={user}): SUCCESS!")
            with conn.cursor() as cur:
                cur.execute("SHOW DATABASES;")
                dbs = [row[0] for row in cur.fetchall()]
                print(f"  Databases: {dbs}")
            conn.close()
        except Exception as e:
            print(f"PORT {port} (user={user}): {e}")
