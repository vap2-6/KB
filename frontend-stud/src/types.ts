export interface Student {
  id: string;
  password?: string;
  name: string;
  roll: string;
  dept: string;
  year: string;
  email?: string;
  mobile?: string;
  forenoon_meal?: boolean;
  afternoon_meal?: boolean;
  photo: string;
  avatarColor?: string;
}

export type MealType = 'Breakfast' | 'Lunch' | null;

export interface TokenHistoryItem {
  id: string;
  token_id: string;
  meal: string;
  date: string;
  time: string;
  status: string;
}

