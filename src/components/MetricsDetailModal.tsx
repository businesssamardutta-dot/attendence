import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Download, 
  Search, 
  Users, 
  LogIn, 
  AlertCircle, 
  Clock, 
  FileSpreadsheet, 
  Calendar,
  Building,
  ArrowUpDown
} from "lucide-react";
import { Employee, AttendanceLog } from "../types";

// Dynamic company styling
const COMPANY_COLORS: Record<string, string> = {
  "TechVanguard Corp": "#2563eb", // Blue
  "LexisNexis Legal": "#7c3aed",   // Purple
  "AIG Insurance": "#059669",      // Emerald
  "Invesco Holdings": "#db2777",   // Pink
  "HDFC Bank Operations": "#ea580c" // Orange
};

interface MetricsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "capacity" | "present" | "absent" | "lates" | null;
  logs: AttendanceLog[];
  employees: Employee[];
  selectedDate: string;
  selectedMonth: string;
  filterMode: "daily" | "monthly";
}

// Helper to parse and clean timestamps (matching App.tsx)
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

export default function MetricsDetailModal({
  isOpen,
  onClose,
  type,
  logs,
  employees,
  selectedDate,
  selectedMonth,
  filterMode,
}: MetricsDetailModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Get unique companies from employees list
  const companies = useMemo(() => {
    return Array.from(new Set(employees.map(e => e.company_name))).sort();
  }, [employees]);

  // Compute active tracking days list
  const uniqueDays = useMemo(() => {
    if (filterMode === "daily") {
      return [selectedDate];
    }
    // Get all unique dates in the active month
    return Array.from(new Set(
      logs
        .filter(log => parseTimestamp(log.timestamp).date.startsWith(selectedMonth))
        .map(log => parseTimestamp(log.timestamp).date)
    )).sort();
  }, [logs, selectedMonth, selectedDate, filterMode]);

  // ==========================================
  // CORE DATA CONSTRUCTORS FOR METRICS POPUPS
  // ==========================================
  const rawData = useMemo(() => {
    if (!type || !isOpen) return [];

    // Helper: Compute paired shifts for a specific date
    const getPairedShiftsForDate = (dateStr: string) => {
      const dayLogs = logs.filter(log => parseTimestamp(log.timestamp).date === dateStr);
      const grouped: Record<string, { ins: AttendanceLog[]; outs: AttendanceLog[] }> = {};
      
      dayLogs.forEach(log => {
        const key = `${log.company}-${log.employee}`;
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

      const shifts: Array<{
        employee: string;
        company: string;
        date: string;
        inTime: string;
        inLocation: string;
        outTime: string;
        outLocation: string;
        status: "In" | "Late" | "Out" | "Completed";
      }> = [];

      Object.entries(grouped).forEach(([key, value]) => {
        const dashIndex = key.indexOf("-");
        const company = key.substring(0, dashIndex);
        const employee = key.substring(dashIndex + 1);

        const sortedIns = [...value.ins].sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
        const sortedOuts = [...value.outs].sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));

        const inLog = sortedIns.length > 0 ? sortedIns[0] : null;
        const outLog = sortedOuts.length > 0 ? sortedOuts[sortedOuts.length - 1] : null;

        if (inLog || outLog) {
          const inTime = inLog ? parseTimestamp(inLog.timestamp).time : "—";
          const inLocation = inLog ? inLog.location : "—";
          const outTime = outLog ? parseTimestamp(outLog.timestamp).time : "—";
          const outLocation = outLog ? outLog.location : "—";

          let status: "In" | "Late" | "Out" | "Completed" = "In";
          if (inLog && outLog) {
            status = "Completed";
          } else if (!inLog && outLog) {
            status = "Out";
          } else if (inLog) {
            const timeString = parseTimestamp(inLog.timestamp).time;
            status = timeString > "09:30:00" ? "Late" : "In";
          }

          const parts = dateStr.split("-");
          const formattedDateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;

          shifts.push({
            employee,
            company,
            date: formattedDateStr,
            inTime,
            inLocation,
            outTime,
            outLocation,
            status,
          });
        }
      });

      return shifts;
    };

    // ----------------------
    // 1. ROSTER CAPACITY POPUP
    // ----------------------
    if (type === "capacity") {
      if (filterMode === "daily") {
        // Daily: list all employees and whether they clocked IN today
        const activeShifts = getPairedShiftsForDate(selectedDate);
        return employees.map(emp => {
          const shift = activeShifts.find(s => s.employee === emp.employee_name && s.company === emp.company_name);
          const presentStatus = shift 
            ? (shift.status === "Late" ? "Late" : "Present") 
            : "Absent";
          return {
            id: emp.id,
            employee: emp.employee_name,
            company: emp.company_name,
            date: selectedDate.split("-").reverse().join("/"),
            status: presentStatus,
            inTime: shift ? shift.inTime : "—",
            outTime: shift ? shift.outTime : "—"
          };
        });
      } else {
        // Monthly: list all employees with summary statistics
        return employees.map(emp => {
          let presentDays = 0;
          let lateDays = 0;
          let absentDays = 0;

          uniqueDays.forEach(dStr => {
            const dayLogs = logs.filter(log => {
              const parsed = parseTimestamp(log.timestamp);
              return parsed.date === dStr && log.employee === emp.employee_name && log.company === emp.company_name;
            });
            const inLog = dayLogs.find(l => (l.status || "").trim().toUpperCase() === "IN");
            if (inLog) {
              presentDays++;
              if (parseTimestamp(inLog.timestamp).time > "09:30:00") {
                lateDays++;
              }
            } else {
              absentDays++;
            }
          });

          const totalDays = Math.max(1, uniqueDays.length);
          const attendanceRate = Math.min(100, Math.round((presentDays / totalDays) * 100));

          return {
            id: emp.id,
            employee: emp.employee_name,
            company: emp.company_name,
            presentDays,
            absentDays,
            lateDays,
            rate: attendanceRate,
          };
        });
      }
    }

    // ----------------------
    // 2. TOTAL PRESENT POPUP
    // ----------------------
    if (type === "present") {
      if (filterMode === "daily") {
        // Present shifts today
        const activeShifts = getPairedShiftsForDate(selectedDate);
        return activeShifts.filter(s => s.inTime !== "—");
      } else {
        // All present events in month
        const monthlyPresentEvents: any[] = [];
        uniqueDays.forEach(dStr => {
          const dayShifts = getPairedShiftsForDate(dStr);
          dayShifts.forEach(s => {
            if (s.inTime !== "—") {
              monthlyPresentEvents.push(s);
            }
          });
        });
        return monthlyPresentEvents;
      }
    }

    // ----------------------
    // 3. TOTAL ABSENCES POPUP
    // ----------------------
    if (type === "absent") {
      if (filterMode === "daily") {
        // Absent employees today
        const activeShifts = getPairedShiftsForDate(selectedDate);
        const presentNames = new Set(activeShifts.filter(s => s.inTime !== "—").map(s => `${s.company}-${s.employee}`));
        
        return employees
          .filter(emp => !presentNames.has(`${emp.company_name}-${emp.employee_name}`))
          .map(emp => ({
            id: emp.id,
            employee: emp.employee_name,
            company: emp.company_name,
            date: selectedDate.split("-").reverse().join("/"),
            status: "Absent",
            notes: "No clock-in detected"
          }));
      } else {
        // Individual absent events across all unique logged days
        const monthlyAbsenceEvents: any[] = [];
        uniqueDays.forEach(dStr => {
          const dayShifts = getPairedShiftsForDate(dStr);
          const presentNames = new Set(dayShifts.filter(s => s.inTime !== "—").map(s => `${s.company}-${s.employee}`));
          const dispDate = dStr.split("-").reverse().join("/");

          employees.forEach(emp => {
            if (!presentNames.has(`${emp.company_name}-${emp.employee_name}`)) {
              monthlyAbsenceEvents.push({
                id: `${emp.id}-${dStr}`,
                employee: emp.employee_name,
                company: emp.company_name,
                date: dispDate,
                status: "Absent",
                notes: "No clock-in logged"
              });
            }
          });
        });
        return monthlyAbsenceEvents;
      }
    }

    // ----------------------
    // 4. TARDY / LATES POPUP
    // ----------------------
    if (type === "lates") {
      if (filterMode === "daily") {
        const activeShifts = getPairedShiftsForDate(selectedDate);
        return activeShifts.filter(s => s.status === "Late");
      } else {
        const monthlyLateEvents: any[] = [];
        uniqueDays.forEach(dStr => {
          const dayShifts = getPairedShiftsForDate(dStr);
          dayShifts.forEach(s => {
            if (s.status === "Late") {
              monthlyLateEvents.push(s);
            }
          });
        });
        return monthlyLateEvents;
      }
    }

    return [];
  }, [type, isOpen, logs, employees, selectedDate, selectedMonth, filterMode, uniqueDays]);

  // Handle Sort Toggle
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter and Sort Data
  const processedData = useMemo(() => {
    let result = [...rawData];

    // Search query matches
    if (searchTerm.trim() !== "") {
      const query = searchTerm.toLowerCase();
      result = result.filter(item => {
        const matchesEmployee = item.employee?.toLowerCase().includes(query);
        const matchesCompany = item.company?.toLowerCase().includes(query);
        const matchesLocation = item.inLocation?.toLowerCase().includes(query) || item.outLocation?.toLowerCase().includes(query);
        const matchesDate = item.date?.toLowerCase().includes(query);
        return matchesEmployee || matchesCompany || matchesLocation || matchesDate;
      });
    }

    // Company filter dropdown
    if (companyFilter !== "ALL") {
      result = result.filter(item => item.company === companyFilter);
    }

    // Sorting columns
    if (sortField) {
      result.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rawData, searchTerm, companyFilter, sortField, sortDirection]);

  // CSV Exporter handler
  const handleCSVDownload = () => {
    if (processedData.length === 0) return;

    let headers: string[] = [];
    let rows: string[][] = [];

    if (type === "capacity") {
      if (filterMode === "daily") {
        headers = ["Employee ID", "Employee Name", "Company Name", "Date", "Status Today", "Clock-In", "Clock-Out"];
        rows = processedData.map(item => [
          item.id?.toString() || "—",
          item.employee || "—",
          item.company || "—",
          item.date || "—",
          item.status || "—",
          item.inTime || "—",
          item.outTime || "—"
        ]);
      } else {
        headers = ["Employee ID", "Employee Name", "Company Name", "Total Days", "Present Days", "Absent Days", "Late Days", "Attendance Rate (%)"];
        rows = processedData.map(item => [
          item.id?.toString() || "—",
          item.employee || "—",
          item.company || "—",
          uniqueDays.length.toString(),
          item.presentDays?.toString() || "0",
          item.absentDays?.toString() || "0",
          item.lateDays?.toString() || "0",
          `${item.rate}%`
        ]);
      }
    } else if (type === "present") {
      headers = ["Employee Name", "Company Name", "Date", "Clock-In Time", "Clock-In Location", "Clock-Out Time", "Clock-Out Location", "Status"];
      rows = processedData.map(item => [
        item.employee || "—",
        item.company || "—",
        item.date || "—",
        item.inTime || "—",
        item.inLocation || "—",
        item.outTime || "—",
        item.outLocation || "—",
        item.status || "—"
      ]);
    } else if (type === "absent") {
      headers = ["Employee Name", "Company Name", "Date", "Status", "Notes"];
      rows = processedData.map(item => [
        item.employee || "—",
        item.company || "—",
        item.date || "—",
        item.status || "—",
        item.notes || "—"
      ]);
    } else if (type === "lates") {
      headers = ["Employee Name", "Company Name", "Date", "Clock-In Time", "Clock-In Location", "Clock-Out Time", "Status"];
      rows = processedData.map(item => [
        item.employee || "—",
        item.company || "—",
        item.date || "—",
        item.inTime || "—",
        item.inLocation || "—",
        item.outTime || "—",
        item.status || "—"
      ]);
    }

    // Generate CSV contents
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(value => {
        // Escape quotes and wrap commas in quotes
        const escapedValue = (value || "").replace(/"/g, '""');
        return escapedValue.includes(",") || escapedValue.includes("\n") || escapedValue.includes('"') 
          ? `"${escapedValue}"` 
          : escapedValue;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const formattedMeta = filterMode === "daily" ? selectedDate : selectedMonth;
    link.setAttribute("href", url);
    link.setAttribute("download", `Corporate_${type}_Ledger_${formattedMeta}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Popup configuration variables
  const config = useMemo(() => {
    switch (type) {
      case "capacity":
        return {
          title: "Employees Capacity Ledger",
          subtitle: "Complete registered roster listing and status records",
          accentColor: "bg-blue-600",
          iconBg: "bg-blue-50 text-blue-600",
          icon: <Users className="w-5 h-5" />,
          countSuffix: "Registered Staff"
        };
      case "present":
        return {
          title: "Clocked-In Staff Registry",
          subtitle: "Detailed presence registry tracking verified entry timestamps",
          accentColor: "bg-emerald-500",
          iconBg: "bg-emerald-50 text-emerald-600",
          icon: <LogIn className="w-5 h-5" />,
          countSuffix: "Staff Clocked-In"
        };
      case "absent":
        return {
          title: "Absences Exception Ledger",
          subtitle: "Absence logs indicating lack of mandatory logging inputs today",
          accentColor: "bg-rose-500",
          iconBg: "bg-rose-50 text-rose-500",
          icon: <AlertCircle className="w-5 h-5" />,
          countSuffix: "Absent Counts"
        };
      case "lates":
        return {
          title: "Late Arrivals Tracker",
          subtitle: "Staff clock-ins completed past the 09:30 AM core threshold",
          accentColor: "bg-amber-500",
          iconBg: "bg-amber-50 text-amber-500",
          icon: <Clock className="w-5 h-5" />,
          countSuffix: "Tardy Enforcements"
        };
      default:
        return {
          title: "Metrics Ledger",
          subtitle: "Attendance records and statistics metrics detailed drill-down",
          accentColor: "bg-slate-700",
          iconBg: "bg-slate-100 text-slate-700",
          icon: <FileSpreadsheet className="w-5 h-5" />,
          countSuffix: "Records"
        };
    }
  }, [type]);

  if (!isOpen || !type) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-left">
        {/* Backdrop scale container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl p-6 md:p-8 max-w-4xl w-full border border-slate-100 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
          id="metrics-drilldown-popup"
        >
          {/* Top Line accent colored */}
          <div className={`absolute top-0 left-0 right-0 h-1.5 ${config.accentColor}`} />

          {/* Modal Header */}
          <div className="flex justify-between items-start pb-4 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${config.iconBg} hidden sm:block`}>
                {config.icon}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base font-display">
                  {config.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-semibold">
                  {config.subtitle} • {filterMode === "daily" ? `Date: ${selectedDate.split("-").reverse().join("/")}` : `Month scope: ${selectedMonth}`}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filters & Actions Subbar */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between mt-5 pb-4 border-b border-slate-50">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              
              {/* Search input field */}
              <div className="relative flex-1 sm:w-64 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, location, date..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-150 rounded-xl pl-9.5 pr-4 py-2 text-xs font-semibold focus:bg-white focus:outline-none focus:border-slate-350 text-slate-800"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Company selection filter button dropdown */}
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-150 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700">
                <Building className="w-3.5 h-3.5 text-slate-400 mr-1" />
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="bg-transparent focus:outline-none font-bold text-slate-750 cursor-pointer text-xs"
                >
                  <option value="ALL">All Entities</option>
                  {companies.map(co => (
                    <option key={co} value={co}>{co}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Total matched count metadata & CSV export file save trigger */}
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
                MATCHED: {processedData.length} of {rawData.length} {config.countSuffix}
              </span>

              <button
                onClick={handleCSVDownload}
                disabled={processedData.length === 0}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed justify-center text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Table Container Scrollable */}
          <div className="flex-1 overflow-y-auto mt-4 border border-slate-100 rounded-2xl bg-slate-50/20 shadow-2xs">
            {processedData.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-white shadow-3xs border-b border-slate-100 z-10 text-[10px] uppercase font-extrabold text-slate-450 tracking-wider">
                  <tr>
                    {type === "capacity" && filterMode === "monthly" ? (
                      <>
                        <th className="p-4 pl-6">
                          <button onClick={() => handleSort("employee")} className="flex items-center gap-1 cursor-pointer">
                            Employee <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </button>
                        </th>
                        <th className="p-4">
                          <button onClick={() => handleSort("company")} className="flex items-center gap-1 cursor-pointer">
                            Company <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </button>
                        </th>
                        <th className="p-4 text-center">
                          <button onClick={() => handleSort("presentDays")} className="flex items-center gap-1 cursor-pointer mx-auto">
                            Present Days <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </button>
                        </th>
                        <th className="p-4 text-center">
                          <button onClick={() => handleSort("absentDays")} className="flex items-center gap-1 cursor-pointer mx-auto">
                            Absent Days <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </button>
                        </th>
                        <th className="p-4 text-center">
                          <button onClick={() => handleSort("lateDays")} className="flex items-center gap-1 cursor-pointer mx-auto">
                            Late Arrivals <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </button>
                        </th>
                        <th className="p-4 text-right pr-6">
                          <button onClick={() => handleSort("rate")} className="flex items-center gap-1 cursor-pointer ml-auto">
                            Attendance Rate <ArrowUpDown className="w-3 h-3 text-slate-400" />
                          </button>
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="p-4 pl-6">
                          <button onClick={() => handleSort("company")} className="flex items-center gap-1 cursor-pointer">
                            Company <ArrowUpDown className="w-3 h-3 text-slate-200" />
                          </button>
                        </th>
                        <th className="p-4">
                          <button onClick={() => handleSort("employee")} className="flex items-center gap-1 cursor-pointer">
                            Employee <ArrowUpDown className="w-3 h-3 text-slate-200" />
                          </button>
                        </th>
                        <th className="p-4 text-center">Date</th>
                        {type !== "absent" && <th className="p-4 text-center">In Time</th>}
                        {type !== "absent" && type !== "lates" && <th className="p-4 text-center">Out Time</th>}
                        <th className="p-4 select-none pr-6 text-right">
                          {type === "absent" ? "Status" : "In Location"}
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-semibold bg-white">
                  {processedData.map((item, idx) => {
                    if (type === "capacity" && filterMode === "monthly") {
                      // Monthly Capacity Summaries layout
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition">
                          <td className="p-4 pl-6 font-bold text-slate-800 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6.5 h-6.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full flex items-center justify-center font-bold text-[11px] font-mono leading-none">
                                {item.employee?.charAt(0)}
                              </div>
                              <span>{item.employee}</span>
                            </div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span 
                              className="px-2 py-0.5 rounded text-[8px] font-extrabold tracking-widest text-white shadow-xs"
                              style={{ backgroundColor: COMPANY_COLORS[item.company] || "#94a3b8" }}
                            >
                              {item.company}
                            </span>
                          </td>
                          <td className="p-4 text-center font-mono text-slate-600 font-bold">{item.presentDays} days</td>
                          <td className="p-4 text-center font-mono text-rose-500 font-bold">{item.absentDays} days</td>
                          <td className="p-4 text-center font-mono text-amber-500 font-bold">{item.lateDays} days</td>
                          <td className="p-4 pr-6 text-right font-bold whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              item.rate >= 90 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                              item.rate >= 75 ? "bg-blue-50 text-blue-600 border border-blue-100" :
                              "bg-rose-50 text-rose-600 border border-rose-100"
                            }`}>
                              {item.rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    } else {
                      // Event list items layout (Present / Tardy / Absent / Capacity Daily)
                      const isLate = item.status === "Late";
                      const isAbsent = item.status === "Absent";
                      const isCompleted = item.status === "Completed";
                      const isOut = item.status === "Out";

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition">
                          <td className="p-4 pl-6 whitespace-nowrap">
                            <span 
                              className="px-2 py-0.5 rounded text-[8px] font-extrabold tracking-widest text-white shadow-xs"
                              style={{ backgroundColor: COMPANY_COLORS[item.company] || "#94a3b8" }}
                            >
                              {item.company}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-slate-800 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6.5 h-6.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full flex items-center justify-center font-bold text-[11px] font-mono leading-none">
                                {item.employee?.charAt(0)}
                              </div>
                              <span>{item.employee}</span>
                            </div>
                          </td>
                          <td className="p-4 text-center font-mono text-slate-400 whitespace-nowrap">
                            {item.date || selectedDate.split("-").reverse().join("/")}
                          </td>
                          
                          {/* Daily logs specific columns */}
                          {type !== "absent" && (
                            <td className="p-4 text-center font-mono text-slate-800 font-bold whitespace-nowrap">
                              {item.inTime || item.inTime === "" ? item.inTime : "—"}
                            </td>
                          )}

                          {type !== "absent" && type !== "lates" && (
                            <td className="p-4 text-center font-mono text-slate-800 font-bold whitespace-nowrap">
                              {item.outTime || "—"}
                            </td>
                          )}

                          <td className="p-4 pr-6 text-right text-slate-450 font-mono max-w-44 truncate text-[11px]" title={item.location || item.inLocation || item.notes}>
                            {isAbsent ? (
                              <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded text-[9px] uppercase font-extrabold tracking-wide">
                                Absent
                              </span>
                            ) : (
                              item.inLocation || item.location || "—"
                            )}
                          </td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-slate-400 font-semibold flex flex-col items-center justify-center gap-2.5">
                <Search className="w-7 h-7 text-slate-300" />
                <div>
                  <p className="text-slate-500 font-extrabold text-sm">No ledger results match search.</p>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Try searching for other attributes or adjusting company filters.</p>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer / Summary Row */}
          <div className="flex justify-between items-center mt-5 pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-semibold">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-300" />
              <span>Full compliance verified timestamped ledger systems.</span>
            </span>
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-5 py-2.5 rounded-xl transition cursor-pointer text-xs"
            >
              Close Summary
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
