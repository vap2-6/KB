export type UserRole = 'admin' | 'approval_staff' | 'canteen_staff' | 'student';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  createdAt: string;
  display_name?: string;
  student_id?: string;
  name?: string;
}

export interface Student {
  reg_no?: string;
  name: string;
  grade?: string;
  department?: string;
  year?: string;
  image_url?: string;
  id?: string;
  student_id?: string;
  grade_section?: string;
}

export interface MealWindow {
  id: number | string;
  name?: string;
  meal_type?: string;
  type?: string;
  start_time: string;
  end_time: string;
  is_active?: boolean;
}

export interface Token {
  id?: number;
  uid?: string;
  token_uid?: string;
  student_id?: string | number;
  student_name?: string;
  student_reg?: string;
  student_grade?: string;
  student_department?: string;
  meal_type: string;
  type?: string;
  status: string;
  created_at?: string;
  generated_at?: string;
  claimed_at?: string | null;
  redeemed_at?: string;
  expiry_time?: string;
  qr_data?: string;
  token_qr_data?: string;
  scanned_by?: string;
  approved_by?: string;
  reason?: string;
  student?: Student;
  active_window?: MealWindow;
}

export interface ImportLog {
  id: string;
  filename: string;
  records_imported: number;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  created_at: string;
}

export interface ExportLog {
  id: string;
  filename: string;
  records_exported: number;
  format: 'csv' | 'excel' | 'json';
  created_at: string;
}

export interface AuditLog {
  id: string;
  username: string;
  action: string;
  tableName: string;
  details: string;
  createdAt: string;
}

export type DataType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE';

export interface ColumnSchema {
  name: string;
  type: DataType;
  primaryKey?: boolean;
  nullable: boolean;
}

export interface TableMeta {
  name: string;
  columns: ColumnSchema[];
  recordCount: number;
  createdAt: string;
}

export interface SystemStatus {
  status: 'CONNECTED' | 'DISCONNECTED';
  totalTables: number;
  totalRecords: number;
  totalImports: number;
  totalExports: number;
  diskUsage: string;
  databaseEngine: string;
}
