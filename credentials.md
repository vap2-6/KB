# RKMVC MealFlow — Credential & Authentication Policy

## System Access & Operator Accounts

Access to the Administrative Dashboard (`/admin/`), Approval Staff Terminal (`/staff/`), and Canteen Counter Terminal is strictly managed using role-based authentication (`admin`, `approval_staff`, `canteen_staff`).

- Operator credentials are provisioned during initial setup or created via the Admin Portal user management module.
- System configurations (JWT secrets, DB credentials, API keys) must be set via the root `.env` configuration file.

> **Security Note:** Default passwords should be changed immediately after system deployment.
