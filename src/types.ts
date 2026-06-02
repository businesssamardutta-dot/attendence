export interface Employee {
  id: number;
  company_name: string;
  employee_name: string;
  created_at?: string;
}

export interface AttendanceLog {
  id?: number;
  company: string;
  employee: string;
  timestamp: string; // ISO standard or Asia/Kolkata date-time format
  status: 'IN' | 'OUT';
  location: string;
}

export interface CompanyStats {
  companyName: string;
  totalEmployees: number;
  activeToday: number;
  checkedInToday: number;
  checkedOutToday: number;
  attendanceRate: number; // percentage
}

export interface DashboardStats {
  totalEmployees: number;
  totalCheckInsToday: number;
  totalCheckOutsToday: number;
  activePresentCount: number; // currently clocked-in (duty active)
  companyStats: CompanyStats[];
}
