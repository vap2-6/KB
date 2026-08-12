export interface Student {
  reg_no: string;
  name: string;
  year: string;
  department: string;
  image_url: string;
  forenoon_meal?: boolean;
  afternoon_meal?: boolean;
}

export interface Token {
  token_id: string;            // Token UID (e.g. TOK-1786373350)
  student_reg: string;         // Student Register Number
  student_name?: string;       // Student Name
  name?: string;               // Legacy display name fallback
  meal_type: string;           // "Breakfast" | "Lunch"
  status: "active" | "redeemed" | "rejected" | "expired" | string;
  created_at: string;          // Token generation timestamp
  redeemed_at?: string | null;  // Canteen meal distribution timestamp
  issued_by?: string | null;   // Staff ID who generated token
  redeemed_by?: string | null; // Canteen Staff ID who distributed meal
}

export interface TerminalSession {
  staffId: string;
  terminalName: string;
  role?: "office" | "canteen";
}

export type ScanMode = "issue" | "verify";
