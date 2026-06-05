import { useState, useEffect, FormEvent, useMemo } from "react";
import { 
  Building2, 
  Users, 
  LogIn, 
  LogOut, 
  RefreshCw, 
  Search, 
  AlertCircle, 
  MapPin, 
  Clock, 
  Calendar, 
  CheckCircle2,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from "lucide-react";
import { Employee, AttendanceLog } from "./types";
import { FALLBACK_EMPLOYEES, FALLBACK_ATTENDANCE_LOGS } from "./data/fallbackData";
import { supabase, fetchAllAttendanceLogs, insertAttendanceLog } from "./lib/supabaseClient";

// Import modular pages and elements
import StatsDonutChart from "./components/StatsDonutChart";
import DailyAttendanceTrend from "./components/DailyAttendanceTrend";
import MetricsDetailModal from "./components/MetricsDetailModal";
import RosterTab from "./components/RosterTab";
import ReportsTab from "./components/ReportsTab";
import EmployeesTab from "./components/EmployeesTab";

// Fixed list of supported companies
const COMPANIES = ["BHANGAKUTHI", "HB", "HB-TP", "HBPL", "SEFALI"];

// Vibrant brand colors for companies
const COMPANY_COLORS: Record<string, string> = {
  "BHANGAKUTHI": "#10b981", // Emerald green
  "HB": "#2563eb",          // Brilliant blue
  "HB-TP": "#f59e0b",       // Honey amber
  "HBPL": "#db2777",        // Vivid rose
  "SEFALI": "#8b5cf6",      // Rich violet
  "ALL": "#475569"          // Slate
};

// Interface for paired attendance logs displayed in the details grid
interface PairedRecord {
  id: string;
  employee: string;
  company: string;
  status: "In" | "Late" | "Out" | "Completed";
  date: string; // reformatted to DD/MM/YYYY
  inTime: string;
  inLocation: string;
  outTime: string;
  outLocation: string;
}

// Robust helper to parse and clean timestamps
function parseTimestamp(ts: string) {
  if (!ts) return { date: "", time: "—" };
  const normalized = ts.replace("T", " ");
  const parts = normalized.split(" ");
  const date = parts[0] || "";
  let time = parts[1] || "";
  if (time) {
    time = time.split(".")[0].split("+")[0].split("Z")[0];
  }
  return { date, time };
}

// Indian Standard Time (Kolkata) date string helper
const getTodayISOString = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const kolkata = new Date(utc + (3600000 * 5.5)); // UTC + 5.5
  const y = kolkata.getFullYear();
  const mo = String(kolkata.getMonth() + 1).padStart(2, '0');
  const day = String(kolkata.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
};

// Year-Month string helper for monthly filter default
const getTodayMonthString = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const kolkata = new Date(utc + (3600000 * 5.5)); // UTC + 5.5
  const y = kolkata.getFullYear();
  const mo = String(kolkata.getMonth() + 1).padStart(2, '0');
  return `${y}-${mo}`;
};

// Helper to compute previous day string (YYYY-MM-DD)
const getPreviousDayDateString = (dateStr: string) => {
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      return `${y}-${mo}-${dy}`;
    }
  } catch (err) {
    console.error("Error computing previous day:", err);
  }
  return "";
};

// Helper to compute previous month string (YYYY-MM)
const getPreviousMonthString = (monthStr: string) => {
  try {
    const parts = monthStr.split("-");
    if (parts.length === 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-based
      const d = new Date(year, month - 1, 15);
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${mo}`;
    }
  } catch (err) {
    console.error("Error computing previous month:", err);
  }
  return "";
};

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"dashboard" | "roster" | "reports" | "employees">("dashboard");

  // Databases state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [dbStatus, setDbStatus] = useState({
    connected: false,
    message: "Locating backend feeds...",
    mode: "Local simulation background",
    url: ""
  });

  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [filterMode, setFilterMode] = useState<"daily" | "monthly">("daily");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISOString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getTodayMonthString());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterCompany, setFilterCompany] = useState<string>("ALL");
  const [systemMessage, setSystemMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Expanded status checklist for each company card
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});

  // Administrative overlays toggle
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedMetricType, setSelectedMetricType] = useState<"capacity" | "present" | "absent" | "lates" | null>(null);

  // Form states - Attendance Logger
  const [logCompany, setLogCompany] = useState("BHANGAKUTHI");
  const [logEmployee, setLogEmployee] = useState("");
  const [logStatus, setLogStatus] = useState<"IN" | "OUT">("IN");
  const [logLocation, setLogLocation] = useState("");
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Trigger system notification toasts
  const showToast = (text: string, type: "success" | "error" | "info" = "info") => {
    setSystemMessage({ text, type });
    setTimeout(() => {
      setSystemMessage(null);
    }, 4500);
  };

  // Helper: Format current timestamp for live inputs
  const getKolkataTimestamp = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const kolkata = new Date(utc + (3600000 * 5.5));
    const hr = String(kolkata.getHours()).padStart(2, '0');
    const min = String(kolkata.getMinutes()).padStart(2, '0');
    const sec = String(kolkata.getSeconds()).padStart(2, '0');
    return `${selectedDate} ${hr}:${min}:${sec}`;
  };

  // Fetch Database Status, Employees, and Logs
  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      try {
        let connected = false;
        try {
          const { error: pingError } = await supabase.from("employee_master").select("id").limit(1);
          if (!pingError) {
            connected = true;
          }
        } catch (e) {
          console.warn("Supabase ping failed:", e);
        }

        if (connected) {
          const { data: empData, error: empError } = await supabase
            .from("employee_master")
            .select("*")
            .order("company_name", { ascending: true })
            .order("employee_name", { ascending: true });

          if (!empError && empData) {
            setEmployees(empData);
          } else {
            setEmployees(FALLBACK_EMPLOYEES);
          }

          try {
            const logsData = await fetchAllAttendanceLogs();
            if (logsData && logsData.length > 0) {
              setLogs(logsData);
            } else {
              setLogs(FALLBACK_ATTENDANCE_LOGS);
            }
          } catch (e) {
            console.error("Error fetching logs:", e);
            setLogs(FALLBACK_ATTENDANCE_LOGS);
          }

          setDbStatus({
            connected: true,
            message: "Connected directly to Supabase Database",
            mode: "Live Supabase Mode",
            url: "https://zakajrrmzzybyptypjdt.supabase.co"
          });
        } else {
          setEmployees(FALLBACK_EMPLOYEES);
          setLogs(FALLBACK_ATTENDANCE_LOGS);
          setDbStatus({
            connected: false,
            message: "Operating in Offline/Demo fallback mode",
            mode: "Local Client Fallback Mode",
            url: ""
          });
        }
      } catch (err) {
        console.error("Networking fetch error:", err);
        setEmployees(FALLBACK_EMPLOYEES);
        setLogs(FALLBACK_ATTENDANCE_LOGS);
        setDbStatus({
          connected: false,
          message: "Operating in Offline/Demo mode on GitHub Pages",
          mode: "Local Client Fallback Mode",
          url: ""
        });
        showToast("Operating in Local Fallback mode.", "info");
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [refreshTrigger]);

  // Hidden real-time log polling interval (60 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      // Trigger a silent database refresh
      setRefreshTrigger(prev => prev + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Set default employee when logging company changes
  useEffect(() => {
    const filteredEmps = employees.filter(e => e.company_name === logCompany);
    if (filteredEmps.length > 0) {
      setLogEmployee(filteredEmps[0].employee_name);
    } else {
      setLogEmployee("");
    }
  }, [logCompany, employees]);

  // Handle: Submit Attendance Log Check-in/out
  const handleLogAttendance = async (e: FormEvent) => {
    e.preventDefault();
    if (!logEmployee) {
      showToast("Please register or select an employee.", "error");
      return;
    }

    setIsSubmittingLog(true);
    const timestampStr = getKolkataTimestamp();

    try {
      if (dbStatus.connected) {
        await insertAttendanceLog({
          company: logCompany,
          employee: logEmployee,
          timestamp: timestampStr,
          status: logStatus,
          location: logLocation.trim() || "Main Workspace Office"
        });
        showToast(`Registered ${logStatus} stamp for ${logEmployee}!`, "success");
        setLogLocation("");
        setShowLogModal(false);
        setRefreshTrigger(prev => prev + 1);
      } else {
        // Fallback for static host / offline block
        const fallbackLog: AttendanceLog = {
          id: logs.length ? Math.max(...logs.map(l => l.id || 0)) + 1 : 1,
          company: logCompany,
          employee: logEmployee,
          timestamp: timestampStr,
          status: logStatus,
          location: logLocation.trim() || "Main Workspace Office"
        };
        setLogs([fallbackLog, ...logs]);
        showToast(`Registered ${logStatus} stamp for ${logEmployee} (Local Mode)!`, "success");
        setLogLocation("");
        setShowLogModal(false);
      }
    } catch (err) {
      console.error("Local log recording fallback:", err);
      // Offline fallback
      const fallbackLog: AttendanceLog = {
        id: logs.length ? Math.max(...logs.map(l => l.id || 0)) + 1 : 1,
        company: logCompany,
        employee: logEmployee,
        timestamp: timestampStr,
        status: logStatus,
        location: logLocation.trim() || "Main Workspace Office"
      };
      setLogs([fallbackLog, ...logs]);
      showToast(`Registered ${logStatus} stamp for ${logEmployee} (Local Mode)!`, "success");
      setLogLocation("");
      setShowLogModal(false);
    } finally {
      setIsSubmittingLog(false);
    }
  };

  // Geolocation triggering
  const handleAutoGeolocation = () => {
    if (!navigator.geolocation) {
      showToast("Your browser does not support geolocation.", "error");
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `Lat: ${pos.coords.latitude.toFixed(4)}, Lon: ${pos.coords.longitude.toFixed(4)}`;
        setLogLocation(coords);
        showToast("Acquired precise GPS coordinate map!", "success");
        setDetectingLocation(false);
      },
      (err) => {
        console.warn("Geolocation blocked:", err);
        showToast("GPS coordinates unavailable. Type site/city manually.", "info");
        setDetectingLocation(false);
      },
      { timeout: 5000 }
    );
  };

  // Toggle company cards expanded log drawer
  const toggleExpandCompany = (company: string) => {
    setExpandedCompanies(p => ({
      ...p,
      [company]: !p[company]
    }));
  };

  // =========================================================================
  // CORE CALCULATIONS AND DATA MANIPULATIONS (DAILY & MONTHLY)
  // =========================================================================

  // Find unique log dates in active month
  const getUniqueDaysInMonth = () => {
    const prefix = selectedMonth; 
    return Array.from(new Set(
      logs
        .filter(log => parseTimestamp(log.timestamp).date.startsWith(prefix))
        .map(log => parseTimestamp(log.timestamp).date)
    )).sort();
  };

  // Active time periods array (1 item in daily, multiple unique checkin days in monthly)
  const uniqueDays = filterMode === "daily" ? [selectedDate] : getUniqueDaysInMonth();

  // Dynamic status/rates calculation
  const getCompanyStats = () => {
    return COMPANIES.map(company => {
      const companyEmployees = employees.filter(e => e.company_name === company);
      const total = companyEmployees.length;

      let sumPresent = 0;
      let sumAbsent = 0;
      let sumLate = 0;

      if (uniqueDays.length === 0) {
        return {
          company,
          total,
          present: 0,
          absent: total,
          late: 0,
          rate: 0
        };
      }

      uniqueDays.forEach(d => {
        const dayLogs = logs.filter(log => parseTimestamp(log.timestamp).date === d);
        const coLogs = dayLogs.filter(log => log.company === company);

        const presentEmployees = new Set(
          coLogs.filter(log => (log.status || "").trim().toUpperCase() === "IN").map(l => l.employee)
        );
        const present = presentEmployees.size;
        const absent = Math.max(0, total - present);

        const lateEmployees = new Set(
          coLogs
            .filter(log => (log.status || "").trim().toUpperCase() === "IN" && parseTimestamp(log.timestamp).time > "09:30:00")
            .map(l => l.employee)
        );
        const late = lateEmployees.size;

        sumPresent += present;
        sumAbsent += absent;
        sumLate += late;
      });

      const rate = total > 0 
        ? Math.round((sumPresent / (total * uniqueDays.length)) * 100) 
        : 0;

      return {
        company,
        total, 
        present: sumPresent,
        absent: sumAbsent,
        late: sumLate,
        rate: Math.min(100, rate)
      };
    });
  };

  const companyStats = getCompanyStats();

  // Dashboard Aggregations
  const totalEmployeesCount = employees.length;
  const totalPresentCount = companyStats.reduce((sum, item) => sum + item.present, 0);
  const totalAbsentCount = companyStats.reduce((sum, item) => sum + item.absent, 0);
  const totalLateCount = companyStats.reduce((sum, item) => sum + item.late, 0);

  const overallAttendanceRate = totalEmployeesCount > 0 
    ? Math.round((totalPresentCount / (totalEmployeesCount * Math.max(1, uniqueDays.length))) * 100) 
    : 0;
  
  const cappedOverallAttendanceRate = Math.min(100, overallAttendanceRate);

  // Helper to compute stats for arbitrary list of days
  const getStatsForDays = (daysArray: string[]) => {
    let sumPresent = 0;
    let sumAbsent = 0;
    let sumLate = 0;

    COMPANIES.forEach(company => {
      const companyEmployees = employees.filter(e => e.company_name === company);
      const total = companyEmployees.length;

      daysArray.forEach(d => {
        const dayLogs = logs.filter(log => parseTimestamp(log.timestamp).date === d);
        const coLogs = dayLogs.filter(log => log.company === company);

        const presentEmployees = new Set(
          coLogs.filter(log => (log.status || "").trim().toUpperCase() === "IN").map(l => l.employee)
        );
        const present = presentEmployees.size;
        const absent = Math.max(0, total - present);

        const lateEmployees = new Set(
          coLogs
            .filter(log => (log.status || "").trim().toUpperCase() === "IN" && parseTimestamp(log.timestamp).time > "09:30:00")
            .map(l => l.employee)
        );
        const late = lateEmployees.size;

        sumPresent += present;
        sumAbsent += absent;
        sumLate += late;
      });
    });

    return {
      present: sumPresent,
      absent: sumAbsent,
      late: sumLate,
    };
  };

  const previousDayStr = useMemo(() => {
    return getPreviousDayDateString(selectedDate);
  }, [selectedDate]);

  const getUniqueDaysInMonthForMonth = (monthVal: string): string[] => {
    return Array.from(new Set(
      logs
        .filter(log => parseTimestamp(log.timestamp).date.startsWith(monthVal))
        .map(log => parseTimestamp(log.timestamp).date)
    )).sort() as string[];
  };

  const previousCapacity = useMemo(() => {
    if (filterMode === "daily") {
      return employees.filter(emp => {
        if (!emp.created_at) return true;
        const createdDate = parseTimestamp(emp.created_at).date;
        return createdDate <= previousDayStr;
      }).length;
    } else {
      const prevMonthStr = getPreviousMonthString(selectedMonth);
      return employees.filter(emp => {
        if (!emp.created_at) return true;
        const createdDate = parseTimestamp(emp.created_at).date;
        return createdDate.substring(0, 7) <= prevMonthStr;
      }).length;
    }
  }, [employees, filterMode, previousDayStr, selectedMonth]);

  const previousPeriodStats = useMemo(() => {
    if (filterMode === "daily") {
      return getStatsForDays([previousDayStr]);
    } else {
      const prevMonthStr = getPreviousMonthString(selectedMonth);
      const prevDays = getUniqueDaysInMonthForMonth(prevMonthStr);
      return getStatsForDays(prevDays);
    }
  }, [logs, employees, filterMode, previousDayStr, selectedMonth]);

  const capacityDiff = totalEmployeesCount - previousCapacity;
  const presentDiff = totalPresentCount - previousPeriodStats.present;
  const absentDiff = totalAbsentCount - previousPeriodStats.absent;
  const lateDiff = totalLateCount - previousPeriodStats.late;

  const renderTrendIndicator = (diff: number, isLowerBetter: boolean = false) => {
    const isZero = diff === 0;
    const isUp = diff > 0;
    
    let badgeClass = "";
    let Icon = null;
    let text = "";

    if (isZero) {
      badgeClass = "bg-slate-50 border border-slate-100 text-slate-400 group-hover:bg-slate-100/50 transition";
      Icon = Minus;
      text = "0 (No change)";
    } else if (isUp) {
      const isGood = !isLowerBetter;
      badgeClass = isGood 
        ? "bg-emerald-50 border border-emerald-100 text-emerald-600 group-hover:bg-emerald-100/50 transition" 
        : "bg-rose-50 border border-rose-100 text-rose-600 group-hover:bg-rose-100/50 transition";
      Icon = TrendingUp;
      text = `+${diff}`;
    } else {
      const isGood = isLowerBetter;
      badgeClass = isGood 
        ? "bg-emerald-50 border border-emerald-100 text-emerald-600 group-hover:bg-emerald-100/50 transition" 
        : "bg-rose-50 border border-rose-100 text-rose-600 group-hover:bg-rose-100/50 transition";
      Icon = TrendingDown;
      text = `${diff}`; 
    }

    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black ${badgeClass} select-none transition`} 
        title={filterMode === "daily" ? "Compared to previous day's metrics" : "Compared to previous month's metrics"}
      >
        {Icon && <Icon className="w-3 h-3" />}
        <span>{text}</span>
        <span className="text-[8px] opacity-75 font-normal">({filterMode === "daily" ? "vs yesterday" : "vs prev mo"})</span>
      </div>
    );
  };

  // Pairing logs chronologically into Shifts
  const getPairedShifts = () => {
    const dayLogs = logs.filter(log => parseTimestamp(log.timestamp).date === selectedDate);
    const grouped: Record<string, { ins: AttendanceLog[]; outs: AttendanceLog[] }> = {};
    
    dayLogs.forEach(log => {
      const key = `${log.company}|${log.employee}`;
      if (!grouped[key]) {
        grouped[key] = { ins: [], outs: [] };
      }
      const normStatus = (log.status || "").trim().toUpperCase();
      if (normStatus === "IN") {
        grouped[key].ins.push(log);
      } else if (normStatus === "OUT") {
        grouped[key].outs.push(log);
      }
    });

    const shiftRows: PairedRecord[] = [];

    Object.entries(grouped).forEach(([key, value]) => {
      const parts = key.split("|");
      const company = parts[0];
      const employee = parts.slice(1).join("|");

      const sortedIns = [...value.ins].sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
      const sortedOuts = [...value.outs].sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));

      const inLog = sortedIns.length > 0 ? sortedIns[0] : null;
      const outLog = sortedOuts.length > 0 ? sortedOuts[sortedOuts.length - 1] : null;

      if (inLog || outLog) {
        const inTime = inLog ? parseTimestamp(inLog.timestamp).time : "—";
        const inLocation = inLog ? inLog.location : "—";
        const outTime = outLog ? parseTimestamp(outLog.timestamp).time : "—";
        const outLocation = outLog ? outLog.location : "—";

        const [y, m, d] = selectedDate.split("-");
        const displayDate = `${d}/${m}/${y}`;

        let status: "In" | "Late" | "Out" | "Completed" = "In";
        if (inLog && outLog) {
          status = "Completed";
        } else if (!inLog && outLog) {
          status = "Out";
        } else if (inLog) {
          const timeString = parseTimestamp(inLog.timestamp).time;
          if (timeString > "09:30:00") {
            status = "Late";
          } else {
            status = "In";
          }
        }

        shiftRows.push({
          id: `${company}-${employee}-${selectedDate}`,
          employee,
          company,
          status,
          date: displayDate,
          inTime,
          inLocation,
          outTime,
          outLocation
        });
      }
    });

    return shiftRows.sort((a, b) => {
      if (a.inTime === "—") return 1;
      if (b.inTime === "—") return -1;
      return b.inTime.localeCompare(a.inTime);
    });
  };

  const pairedShifts = getPairedShifts();

  // Table lists with search
  const filteredShifts = pairedShifts.filter(shift => {
    const matchesCompany = filterCompany === "ALL" || shift.company === filterCompany;
    const matchesSearch = shift.employee.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          shift.inLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          shift.outLocation.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCompany && matchesSearch;
  });

  const rawRecordCount = logs.filter(log => parseTimestamp(log.timestamp).date === selectedDate).length;

  return (
    <div className="min-h-screen bg-[#f4f7fc] text-slate-850 flex flex-col antialiased font-sans">
      
      {/* Toast banner popup alert notifications */}
      {systemMessage && (
        <div id="toast-notify" className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border text-xs max-w-sm transition-all duration-300 animate-slide-in ${
          systemMessage.type === "success" 
            ? "bg-slate-900 border-slate-850 text-white" 
            : systemMessage.type === "error"
            ? "bg-rose-600 border-rose-500 text-white"
            : "bg-white border-slate-200 text-slate-800"
        }`}>
          {systemMessage.type === "error" ? (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-200" />
          ) : (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          )}
          <span className="font-bold">{systemMessage.text}</span>
        </div>
      )}

      {/* Corporate Page Header Banner */}
      <header id="main-header" className="bg-white border-b border-slate-100 shadow-[0_2px_15px_rgb(0,0,0,0.015)] sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-4 md:h-20 gap-4">
            
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-md flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h1 className="text-lg font-black font-display text-slate-850 tracking-tight leading-none">
                  HR Analytics Management System
                </h1>
                <p className="text-xs text-slate-400 font-semibold mt-1">
                  Secure real-time attendance verification portal
                </p>
              </div>
            </div>

            {/* Quick action button inside header */}
            <div className="flex items-center gap-3 ml-auto md:ml-0">
              <button
                onClick={() => {
                  setRefreshTrigger(p => p + 1);
                  showToast("Attendance registers refreshed.", "success");
                }}
                className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 transition shadow-sm cursor-pointer"
                title="Force refresh database logs"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* HIGH-END NAVIGATION BAR */}
      <nav className="bg-white border-b border-slate-100 py-3 sticky top-[80px] md:top-[80px] z-30 shadow-[0_4px_20px_rgb(0,0,0,0.01)] text-left">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center p-0.5 bg-slate-50 border border-slate-200 rounded-2xl w-full sm:w-auto overflow-x-auto gap-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                activeTab === "dashboard"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Attendance Dashboard
            </button>

            <button
              onClick={() => setActiveTab("roster")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                activeTab === "roster"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Company-Wise Dashboard
            </button>

            <button
              onClick={() => setActiveTab("reports")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                activeTab === "reports"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Reports Section
            </button>

            <button
              onClick={() => setActiveTab("employees")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                activeTab === "employees"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Add Remove Edit Employee
            </button>
          </div>

          {/* Sync indicator check */}
          <div className="flex items-center gap-2.5 shrink-0 text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-150 rounded-xl px-3.5 py-1.5 leading-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse animate-duration-1000" />
            {dbStatus.mode}
          </div>
        </div>
      </nav>

      {/* Main Container Layout */}
      <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 flex flex-col gap-8">
        
        {/* Dynamic Warning of Sandbox Connection if any */}
        {!dbStatus.connected && (
          <div className="bg-amber-50/70 border border-amber-200/65 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left animate-fade-in shadow-xs">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-800 tracking-wide uppercase">Sandbox Memory active</h4>
                <p className="text-xs text-amber-700 font-semibold mt-1 leading-normal">
                  You are utilizing local simulation arrays. Connect a live <code className="font-mono font-bold bg-amber-100 rounded px-1 py-0.5 text-amber-900">SUPABASE_URL</code> database in Secrets to persist changes.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setRefreshTrigger(p => p + 1);
                showToast("Verifying database integrations...", "info");
              }}
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-extrabold px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0"
            >
              Verify DB Integrations
            </button>
          </div>
        )}

        {/* ---------------------------------------------------------------------
            TAB 1: SYSTEM VISUAL ATTENDANCE DASHBOARD
            --------------------------------------------------------------------- */}
        {activeTab === "dashboard" && (
          <div className="flex flex-col gap-8 animate-fade-in text-left">
            
            {/* Dashboard configuration and date picking */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-100 rounded-3xl p-5 shadow-xs">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm font-display">Dashboard Time Scope</h3>
                <p className="text-xs text-slate-400 mt-1 font-semibold">Toggle between spot and monthly aggregate analyses.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Daily vs Monthly toggle panel */}
                <div className="flex p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    onClick={() => {
                      setFilterMode("daily");
                      showToast("Set view to Daily Review Spot", "info");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      filterMode === "daily" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Daily Review
                  </button>
                  <button
                    onClick={() => {
                      setFilterMode("monthly");
                      showToast("Set view to Monthly rolls analysis", "info");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      filterMode === "monthly" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    Monthly Aggregates
                  </button>
                </div>

                {/* Scope Time pickers */}
                {filterMode === "daily" ? (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3-5 py-2 hover:border-slate-350 transition shadow-xs">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedDate(e.target.value);
                          showToast(`View switched to ${e.target.value}`, "info");
                        }
                      }}
                      className="bg-transparent text-xs font-extrabold text-slate-750 font-mono focus:outline-none appearance-none cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3-5 py-2 hover:border-slate-350 transition shadow-xs">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedMonth(e.target.value);
                          showToast(`Aggregate switched to month: ${e.target.value}`, "info");
                        }
                      }}
                      className="bg-transparent text-xs font-extrabold text-slate-750 font-mono focus:outline-none appearance-none cursor-pointer"
                    />
                  </div>
                )}


              </div>
            </div>

            {/* Metrics cards rows */}
            <div id="metric-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div 
                onClick={() => setSelectedMetricType("capacity")}
                className="relative bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between cursor-pointer hover:border-blue-350/70 hover:shadow-[0_15px_30px_rgba(37,99,235,0.08),0_4px_12px_rgba(37,99,235,0.03)] transition duration-200 hover:-translate-y-0.5 active:translate-y-0 select-none group"
                title="Click to view complete employee capacity ledger"
              >
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-slate-900 border border-slate-800 text-slate-100 p-3 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 pointer-events-none z-35 font-sans">
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-800" />
                  <div className="flex items-center gap-1.5 mb-1">
                    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-white text-xs font-extrabold tracking-tight">Calculation Method</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed font-sans">
                    {filterMode === "daily" 
                      ? "The total count of active registered employees on the roster for today." 
                      : "The total count of active registered employees on the roster for this month."}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block group-hover:text-blue-600 transition">Roster Capacity</span>
                  <span className="text-3xl font-extrabold text-slate-800 block mt-2 font-display">{totalEmployeesCount}</span>
                  <div className="flex flex-col gap-1.5 items-start">
                    <span className="text-[10px] text-slate-450 font-semibold bg-slate-50 px-2.5 py-1 rounded-full block w-max mt-1 border border-slate-100 group-hover:bg-blue-50/40 transition">
                      5 Active Entities
                    </span>
                    {renderTrendIndicator(capacityDiff)}
                  </div>
                </div>
                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition duration-200">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div 
                onClick={() => setSelectedMetricType("present")}
                className="relative bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between cursor-pointer hover:border-emerald-350/70 hover:shadow-[0_15px_30px_rgba(16,185,129,0.08),0_4px_12px_rgba(16,185,129,0.03)] transition duration-200 hover:-translate-y-0.5 active:translate-y-0 select-none group"
                title="Click to view detailed presence registry logs"
              >
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-slate-900 border border-slate-800 text-slate-100 p-3 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 pointer-events-none z-35 font-sans">
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-800" />
                  <div className="flex items-center gap-1.5 mb-1">
                    <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-white text-xs font-extrabold tracking-tight">Calculation Method</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed font-sans">
                    {filterMode === "daily" 
                      ? "The number of registered unique employees who have completed a Clock-In entry for today." 
                      : "Cumulative sum of unique daily clock-ins tracked across this month."}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block group-hover:text-emerald-600 transition">Total Present</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-extrabold text-emerald-600 font-display">{totalPresentCount}</span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {cappedOverallAttendanceRate}% Rate
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 items-start">
                    <span className="text-[10px] text-slate-400 mt-1 block font-semibold leading-none group-hover:text-emerald-500/80 transition">
                      Active registers tracked
                    </span>
                    {renderTrendIndicator(presentDiff)}
                  </div>
                </div>
                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition duration-200">
                  <LogIn className="w-5 h-5" />
                </div>
              </div>

              <div 
                onClick={() => setSelectedMetricType("absent")}
                className="relative bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between cursor-pointer hover:border-rose-350/70 hover:shadow-[0_15px_30px_rgba(244,63,94,0.08),0_4px_12px_rgba(244,63,94,0.03)] transition duration-200 hover:-translate-y-0.5 active:translate-y-0 select-none group"
                title="Click to view absenteeism record list"
              >
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-slate-900 border border-slate-800 text-slate-100 p-3 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 pointer-events-none z-35 font-sans">
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-800" />
                  <div className="flex items-center gap-1.5 mb-1">
                    <Info className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="text-white text-xs font-extrabold tracking-tight">Calculation Method</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed font-sans">
                    {filterMode === "daily" 
                      ? "The calculated count of registered employees who have not clocked in today." 
                      : "The total count of individual daily absence exceptions registered this month."}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block group-hover:text-rose-500 transition">Total Absences</span>
                  <span className="text-3xl font-extrabold text-rose-500 block mt-2 font-display">{totalAbsentCount}</span>
                  <div className="flex flex-col gap-1.5 items-start">
                    <span className="text-[10px] text-rose-500 font-semibold bg-rose-50 px-2.5 py-1 rounded-full block w-max mt-1 border border-rose-100 group-hover:bg-rose-100/55 transition">
                      Follow-Up Flagged
                    </span>
                    {renderTrendIndicator(absentDiff, true)}
                  </div>
                </div>
                <div className="p-4 bg-rose-50 text-rose-500 rounded-2xl group-hover:bg-rose-500 group-hover:text-white transition duration-200">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>

              <div 
                onClick={() => setSelectedMetricType("lates")}
                className="relative bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between cursor-pointer hover:border-amber-300/70 hover:shadow-[0_15px_30px_rgba(245,158,11,0.08),0_4px_12px_rgba(245,158,11,0.03)] transition duration-200 hover:-translate-y-0.5 active:translate-y-0 select-none group"
                title="Click to view tardiness detail tracker"
              >
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-slate-900 border border-slate-800 text-slate-100 p-3 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 pointer-events-none z-35 font-sans">
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-800" />
                  <div className="flex items-center gap-1.5 mb-1">
                    <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-white text-xs font-extrabold tracking-tight">Calculation Method</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-medium leading-relaxed font-sans">
                    {filterMode === "daily" 
                      ? "The count of unique employees whose first Clock-In occurred after the 09:30 AM threshold today." 
                      : "The sum of late arrival exceptions (clocked in after 09:30 AM) recorded during this month."}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block group-hover:text-amber-600 transition">Tardy / Lates</span>
                  <span className="text-3xl font-extrabold text-amber-500 block mt-2 font-display">{totalLateCount}</span>
                  <div className="flex flex-col gap-1.5 items-start">
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full block w-max mt-1 border border-amber-150 group-hover:bg-amber-100/55 transition">
                      Clocked post-09:30 AM
                    </span>
                    {renderTrendIndicator(lateDiff, true)}
                  </div>
                </div>
                <div className="p-4 bg-amber-50 text-amber-550 rounded-2xl group-hover:bg-amber-500 group-hover:text-white transition duration-200">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

            </div>

            {/* Recharts Visual Status distribution donut chart card */}
            <StatsDonutChart
              totalPresentCount={totalPresentCount}
              totalLateCount={totalLateCount}
              totalAbsentCount={totalAbsentCount}
              overallAttendanceRate={cappedOverallAttendanceRate}
              filterMode={filterMode}
              selectedDate={selectedDate}
              selectedMonth={selectedMonth}
              uniqueDaysCount={Math.max(1, uniqueDays.length)}
              totalEmployeesCount={totalEmployeesCount}
            />

            {/* Daily Attendance Trend Line Chart */}
            <DailyAttendanceTrend
              logs={logs}
              employees={employees}
              selectedDate={selectedDate}
            />

            {/* Companies Overview grid cards with details toggle option */}
            <section className="flex flex-col gap-4">
              <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-500" />
                Companies Overview
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {companyStats.map(stat => {
                  const companyEmployees = employees.filter(e => e.company_name === stat.company);
                  const isExpanded = expandedCompanies[stat.company] || false;

                  return (
                    <div 
                      key={stat.company} 
                      className="bg-white rounded-2xl p-5 border border-slate-100 hover:border-slate-200 transition shadow-xs overflow-hidden flex flex-col gap-4 relative"
                    >
                      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: COMPANY_COLORS[stat.company] }} />
                      
                      <div className="flex flex-col text-left">
                        <h4 className="font-extrabold text-slate-800 text-xs tracking-tight">{stat.company}</h4>
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{stat.total} Employees</span>
                      </div>

                      <div className="flex flex-col gap-1.5 mt-1 text-left">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-slate-400">Attendance</span>
                          <span style={{ color: COMPANY_COLORS[stat.company] }}>{stat.rate}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${stat.rate}%`,
                              backgroundColor: COMPANY_COLORS[stat.company]
                            }}
                          />
                        </div>
                      </div>

                      {/* Stats grids */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <div className="bg-[#eefcf4] rounded-lg p-1.5 text-center">
                          <span className="text-xs font-bold text-[#10b981] block">{stat.present}</span>
                          <span className="text-[8px] text-[#059669] font-bold block uppercase mt-0.5">In</span>
                        </div>
                        <div className="bg-[#fff2f2] rounded-lg p-1.5 text-center">
                          <span className="text-xs font-bold text-[#ef4444] block">{stat.absent}</span>
                          <span className="text-[8px] text-[#dc2626] font-bold block uppercase mt-0.5">Abs</span>
                        </div>
                        <div className="bg-[#fffbeb] rounded-lg p-1.5 text-center">
                          <span className="text-xs font-bold text-[#f59e0b] block">{stat.late}</span>
                          <span className="text-[8px] text-[#d97706] font-bold block uppercase mt-0.5">Lt</span>
                        </div>
                      </div>

                      {/* Expand / Collapse button */}
                      <button
                        onClick={() => toggleExpandCompany(stat.company)}
                        className="w-full py-1.5 border border-slate-100 hover:border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 font-bold text-[10px] rounded-xl flex items-center justify-center gap-1 transition active:scale-98 cursor-pointer mt-1"
                      >
                        {isExpanded ? (
                          <>
                            <span>Hide Details</span>
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <span>View Details</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>

                      {/* Collapsible logs details drawers directly within company box */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-slate-100/80 flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 text-left scrollbar-thin">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none block mb-1">
                            {filterMode === "daily" ? "Shift Logs Today" : "Cumulative Monthly"}
                          </span>
                          
                          {companyEmployees.map((emp, empIdx) => {
                            if (filterMode === "daily") {
                              const shift = pairedShifts.find(s => s.employee === emp.employee_name && s.company === stat.company);
                              const hasLog = !!shift;

                              return (
                                <div key={empIdx} className="flex flex-col gap-0.5 pb-1.5 border-b border-slate-100 last:border-0 border-dashed">
                                  <span className="font-bold text-slate-700 text-[11px] truncate block" title={emp.employee_name}>
                                    {emp.employee_name}
                                  </span>
                                  <div className="flex justify-between items-center text-[9px] font-bold">
                                    {hasLog ? (
                                      <>
                                        <span className={
                                          shift.status === "Late"
                                            ? "text-amber-600"
                                            : shift.status === "Out"
                                            ? "text-rose-500"
                                            : shift.status === "Completed"
                                            ? "text-blue-500"
                                            : "text-emerald-600"
                                        }>
                                          {shift.status === "Late"
                                            ? "Late"
                                            : shift.status === "Out"
                                            ? "Out Only"
                                            : shift.status === "Completed"
                                            ? "Completed"
                                            : "On-Time"}
                                        </span>
                                        <span className="text-slate-400 font-mono">{shift.inTime}</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-rose-500">Absent</span>
                                        <span className="text-slate-400">—</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            } else {
                              // monthly
                              const empINLogs = logs.filter(
                                l => l.employee === emp.employee_name &&
                                     l.company === stat.company &&
                                     (l.status || "").trim().toUpperCase() === "IN" &&
                                     parseTimestamp(l.timestamp).date.startsWith(selectedMonth)
                              );
                              
                              const presentDaysCount = new Set(empINLogs.map(l => parseTimestamp(l.timestamp).date)).size;
                              const empLateLogs = empINLogs.filter(l => parseTimestamp(l.timestamp).time > "09:30:00");
                              const lateDaysCount = new Set(empLateLogs.map(l => parseTimestamp(l.timestamp).date)).size;
                              const rate = uniqueDays.length > 0 ? Math.round((presentDaysCount / uniqueDays.length) * 100) : 0;

                              return (
                                <div key={empIdx} className="flex flex-col gap-0.5 pb-1.5 border-b border-slate-100 last:border-0 border-dashed">
                                  <span className="font-bold text-slate-700 text-[11px] truncate block" title={emp.employee_name}>
                                    {emp.employee_name}
                                  </span>
                                  <div className="flex justify-between text-[9px] font-bold text-slate-450 mt-0.5">
                                    <span>{presentDaysCount} / {uniqueDays.length} days</span>
                                    <span className={rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-500" : "text-rose-500"}>
                                      {rate}%
                                    </span>
                                  </div>
                                  {lateDaysCount > 0 && (
                                    <span className="text-[8px] text-amber-500 font-semibold block">({lateDaysCount} late arrivals)</span>
                                  )}
                                </div>
                              );
                            }
                          })}
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            </section>

            {/* Attendance Details Table section */}
            <section id="table-details-section" className="bg-white border border-slate-100 p-6 rounded-2xl shadow-xs flex flex-col gap-6 text-left">
              <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                <div>
                  <h3 className="font-extrabold text-slate-850 text-sm font-display">Log Stream Registry</h3>
                  <p className="text-xs text-slate-400 font-semibold mt-1">
                    Showing paired shift records for {selectedDate.split("-").reverse().join("/")} (Total: {rawRecordCount} raw checkins).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setFilterCompany("ALL")}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                      filterCompany === "ALL" 
                        ? "bg-slate-900 text-white" 
                        : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500"
                    }`}
                  >
                    All Companies
                  </button>
                  {COMPANIES.map(co => (
                    <button
                      key={co}
                      onClick={() => setFilterCompany(co)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        filterCompany === co 
                          ? "bg-slate-900 text-white" 
                          : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500"
                      }`}
                    >
                      <span className="w-1 px-1 h-1 bg-red-400 rounded-full" style={{ backgroundColor: COMPANY_COLORS[co] }} />
                      {co}
                    </button>
                  ))}
                </div>

                <div className="relative w-full lg:w-64">
                  <input
                    type="text"
                    placeholder="Search employee or GPS..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-8 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Attendance pairings table representation */}
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/70 text-slate-450 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                      <th className="p-4 pl-6">Company</th>
                      <th className="p-4">Employee</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">In Time</th>
                      <th className="p-4 select-none pr-10">In Location</th>
                      <th className="p-4">Out Time</th>
                      <th className="p-4 pr-6 select-none">Out Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600 font-semibold">
                    {filteredShifts.length > 0 ? (
                      filteredShifts.map(shift => (
                        <tr key={shift.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-4 pl-6 whitespace-nowrap">
                            <span 
                              className="px-2 py-0.5 rounded text-[8px] font-extrabold tracking-widest text-white shadow-xs"
                              style={{ backgroundColor: COMPANY_COLORS[shift.company] }}
                            >
                              {shift.company}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-slate-850 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6.5 h-6.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full flex items-center justify-center font-bold text-[11px] font-mono leading-none">
                                {shift.employee.charAt(0)}
                              </div>
                              <span>{shift.employee}</span>
                            </div>
                          </td>
                           <td className="p-4 text-center whitespace-nowrap">
                             <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                               shift.status === "Late"
                                 ? "bg-amber-50 text-amber-600 border border-amber-100"
                                 : shift.status === "Out"
                                 ? "bg-rose-50 text-rose-600 border border-rose-100"
                                 : shift.status === "Completed"
                                 ? "bg-blue-50 text-blue-600 border border-blue-100"
                                 : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                             }`}>
                               {shift.status}
                             </span>
                           </td>
                          <td className="p-4 font-mono select-none text-slate-400 whitespace-nowrap">{shift.date}</td>
                          <td className="p-4 font-mono font-bold text-slate-850 whitespace-nowrap">{shift.inTime}</td>
                          <td className="p-4 text-[11px] max-w-44 truncate text-slate-400" title={shift.inLocation}>
                            {shift.inLocation}
                          </td>
                          <td className="p-4 font-mono font-bold text-slate-850 whitespace-nowrap">{shift.outTime}</td>
                          <td className="p-4 text-[11px] max-w-44 truncate text-slate-400 pr-6" title={shift.outLocation}>
                            {shift.outLocation}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="p-16 text-center text-slate-400 text-xs font-semibold leading-relaxed">
                          No attendance tracking logs found for selected filters in context.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

          </div>
        )}

        {/* ---------------------------------------------------------------------
            TAB 2: COMPANY-WISE EMPLOYEE DASHBOARD (ROSTER VIEW)
            --------------------------------------------------------------------- */}
        {activeTab === "roster" && (
          <RosterTab 
            employees={employees} 
            logs={logs} 
            selectedMonth={selectedMonth} 
          />
        )}

        {/* ---------------------------------------------------------------------
            TAB 3: REPORTS SECTION (DETAILED VIEWS & EXPORTING)
            --------------------------------------------------------------------- */}
        {activeTab === "reports" && (
          <ReportsTab 
            employees={employees} 
            logs={logs} 
            selectedDate={selectedDate} 
            selectedMonth={selectedMonth} 
            showToast={showToast}
          />
        )}

        {/* ---------------------------------------------------------------------
            TAB 4: ADD, EDIT AND REMOVE EMPLOYEES
            --------------------------------------------------------------------- */}
        {activeTab === "employees" && (
          <EmployeesTab 
            employees={employees} 
            setEmployees={setEmployees}
            showToast={showToast}
            setRefreshTrigger={setRefreshTrigger}
          />
        )}

      </main>

      {/* Modern footer details */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-16 text-center text-[10px] text-slate-400 font-semibold tracking-wide select-none">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 Corporate HR Analytics Dashboard. Fully Synchronized Ledger Systems.</p>
          <div className="flex gap-4">
            <span>Kolkata Standard Time (GMT+5:30)</span>
            <span>•</span>
            <span>Real-time Polling Interval: 60s active</span>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          Overlay Modals: Log Attendance Form Modal
          ========================================================================= */}
      {showLogModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-100 shadow-2xl relative overflow-hidden flex flex-col gap-5 animate-scale-up">
            
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />

            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-850 text-sm font-display">Record Shift Stamp Entry</h3>
                <p className="text-xs text-slate-400 mt-1">Submit high-accuracy location tracking checkin.</p>
              </div>
              <button 
                onClick={() => setShowLogModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogAttendance} className="flex flex-col gap-4 mt-2">
              
              {/* Field 1: Corporate Entity */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Target Corporate Entity</label>
                <select
                  value={logCompany}
                  onChange={(e) => setLogCompany(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-xl px-4 py-2.5 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none transition cursor-pointer"
                >
                  {COMPANIES.map(co => (
                    <option key={co} value={co}>{co}</option>
                  ))}
                </select>
              </div>

              {/* Field 2: Employee Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Employee Profile</label>
                {employees.filter(e => e.company_name === logCompany).length > 0 ? (
                  <select
                    value={logEmployee}
                    onChange={(e) => setLogEmployee(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-xl px-4 py-2.5 text-xs text-slate-850 font-semibold focus:bg-white focus:outline-none transition cursor-pointer"
                  >
                    {employees
                      .filter(e => e.company_name === logCompany)
                      .map(emp => (
                        <option key={emp.id} value={emp.employee_name}>{emp.employee_name}</option>
                      ))
                    }
                  </select>
                ) : (
                  <div className="p-3 text-xs bg-rose-50 border border-rose-100 rounded-xl text-rose-600 flex flex-col gap-1">
                    <span className="font-bold">No active employees registered under {logCompany}.</span>
                    <button 
                      type="button"
                      onClick={() => {
                        setActiveTab("employees");
                        setShowLogModal(false);
                      }}
                      className="text-left font-bold underline hover:text-rose-800 mt-1 cursor-pointer"
                    >
                      Go Register Staff first →
                    </button>
                  </div>
                )}
              </div>

              {/* Field 3: Status Toggle Button Group */}
              <div className="flex flex-col gap-1.5 font-bold">
                <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Stamp Action</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLogStatus("IN")}
                    className={`py-3 rounded-xl border text-xs font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      logStatus === "IN" 
                        ? "bg-slate-900 border-slate-900 text-white shadow-xs" 
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    Check In (IN)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogStatus("OUT")}
                    className={`py-3 rounded-xl border text-xs font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      logStatus === "OUT" 
                        ? "bg-slate-900 border-slate-900 text-white shadow-xs" 
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    Check Out (OUT)
                  </button>
                </div>
              </div>

              {/* Field 4: Site Location / Geo Coordinate mapping */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-bold text-slate-400">
                  <label>Site Location / Checkpoint Name</label>
                  <button
                    type="button"
                    onClick={handleAutoGeolocation}
                    disabled={detectingLocation}
                    className="text-blue-600 hover:text-blue-700 tracking-normal font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <MapPin className={`w-3.5 h-3.5 text-blue-500 ${detectingLocation ? "animate-pulse" : ""}`} />
                    {detectingLocation ? "GPS tracking..." : "Detect GPS"}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. B B Ghosh Road, Burdwan"
                  value={logLocation}
                  onChange={(e) => setLogLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 font-semibold focus:bg-white focus:border-blue-600 focus:outline-none transition"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmittingLog || !logEmployee}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-blue-105 disabled:opacity-40"
              >
                {isSubmittingLog ? "Submitting Log..." : `Record Shift Log`}
              </button>

            </form>
          </div>
        </div>
      )}

      {/* Metrics Detail Modal Drilldown with CSV Export */}
      <MetricsDetailModal
        isOpen={selectedMetricType !== null}
        onClose={() => setSelectedMetricType(null)}
        type={selectedMetricType}
        logs={logs}
        employees={employees}
        selectedDate={selectedDate}
        selectedMonth={selectedMonth}
        filterMode={filterMode}
      />

    </div>
  );
}
