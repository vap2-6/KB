export interface Student {
  reg_no: string;
  name: string;
  year: string;
  department: string;
  student_category?: string;
  image_url: string;
  forenoon_meal?: boolean;
  afternoon_meal?: boolean;
}

export interface Token {
  student_reg: string;
  student_name?: string;
  name?: string;
  token_id: string;
  meal_type: string;
  status: "active" | "approved" | "rejected";
  created_at: string;
  issued_by?: string | null;
  processed_by?: string | null;
}

export interface TerminalSession {
  staffId: string;
  terminalName: string;
  role?: "office" | "canteen";
}

export type ScanMode = "issue" | "verify";
