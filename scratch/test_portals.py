import requests

base_url = 'http://localhost:5050/api/admin'

print("--- TESTING ADMIN LOGIN ---")
r_admin = requests.post(f'{base_url}/api/auth/login', json={'username': 'admin', 'password': 'adminpassword'})
print("ADMIN LOGIN STATUS:", r_admin.status_code, r_admin.json() if r_admin.status_code == 200 else r_admin.text)

print("\n--- TESTING STAFF LOGIN ---")
r_staff = requests.post(f'{base_url}/api/auth/login', json={'username': 'STAFF101', 'password': 'staffpassword'})
print("STAFF LOGIN STATUS:", r_staff.status_code, r_staff.json() if r_staff.status_code == 200 else r_staff.text)

if r_admin.status_code == 200:
    token = r_admin.json()['token']
    r_me = requests.get(f'{base_url}/auth/me', headers={'Authorization': f'Bearer {token}'})
    print("\nADMIN AUTH ME STATUS:", r_me.status_code, r_me.json())
