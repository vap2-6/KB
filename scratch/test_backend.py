import sys
import os

sys.path.append('/app/server')
sys.path.append('/app')

from server.main import app

client = app.test_client()

print("--- TESTING LOGIN ---")
r_login = client.post('/api/admin/api/auth/login', json={'username': 'admin', 'password': 'adminpassword'})
print("LOGIN STATUS:", r_login.status_code, r_login.get_data(as_text=True))

if r_login.status_code == 200:
    token = r_login.get_json().get('token')
    headers = {'Authorization': f'Bearer {token}'}
    
    print("\n--- TESTING /api/admin/auth/me ---")
    r_me1 = client.get('/api/admin/auth/me', headers=headers)
    print("STATUS:", r_me1.status_code)
    print("DATA:", r_me1.get_data(as_text=True))

    print("\n--- TESTING /api/admin/api/auth/me ---")
    r_me2 = client.get('/api/admin/api/auth/me', headers=headers)
    print("STATUS:", r_me2.status_code)
    print("DATA:", r_me2.get_data(as_text=True))
