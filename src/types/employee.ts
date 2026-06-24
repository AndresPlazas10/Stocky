export type EmployeeRole = 'owner' | 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'employee';

export interface Employee {
  id: string;
  business_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: EmployeeRole;
  is_active: boolean;
  pin: string | null;
  created_at: string;
  updated_at: string;
}
