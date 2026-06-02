import { useState } from "react";
import { Building2, Search, Filter, ShieldAlert, BadgeCheck, Clock } from "lucide-react";
import { Employee, AttendanceLog } from "../types";

interface RosterTabProps {
  employees: Employee[];
  logs: AttendanceLog[];
  selectedMonth: string;
}

export default function RosterTab({ employees, logs, selectedMonth }: RosterTabProps) {
  const [selectedCompany, setSelectedCompany] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const COMPANIES = ["BHANGAKUTHI", "HB", "HB-TP", "HBPL", "SEFALI"];
  const COMPANY_COLORS: Record<string, string> = {
    "BHANGAKUTHI": "#10b981", // Emerald green
    "HB": "#2563eb",          // Brilliant blue
    "HB-TP": "#f59e0b",       // Honey amber
    "HBPL": "#db2777",        // Vivid rose
    "SEFALI": "#8b5cf6",      // Rich violet
    "ALL": "#475569"          // Slate
  };

  // Extract helper for timestamp parsing without pulling all App imports
  const parseTimestampDate = (ts: string) => {
    if (!ts) return "";
    return ts.replace("T", " ").split(" ")[0];
  };

  const parseTimestampTime = (ts: string) => {
    if (!ts) return "—";
    const parts = ts.replace("T", " ").split(" ");
    let time = parts[1] || "";
    if (time) {
      time = time.split(".")[0].split("+")[0].split("Z")[0];
    }
    return time;
  };

  const checkIfCompanyOnline = (companyName: string) => {
    const compLogs = logs.filter(l => l.company === companyName);
    if (compLogs.length === 0) return false;

    const logTimes = compLogs.map(l => {
      try {
        const cleaned = l.timestamp.replace(" ", "T");
        const t = new Date(cleaned).getTime();
        return isNaN(t) ? 0 : t;
      } catch {
        return 0;
      }
    }).filter(t => t > 0);

    if (logTimes.length === 0) return false;

    const maxLogTime = Math.max(...logTimes);
    const nowMs = Date.now();

    // Last 5 minutes
    const isOnlineRealtime = Math.abs(nowMs - maxLogTime) <= 5 * 60 * 1000;

    const allLogsTimes = logs.map(l => {
      try {
        const cleaned = l.timestamp.replace(" ", "T");
        const t = new Date(cleaned).getTime();
        return isNaN(t) ? 0 : t;
      } catch {
        return 0;
      }
    }).filter(t => t > 0);

    const absoluteMaxLogTime = allLogsTimes.length > 0 ? Math.max(...allLogsTimes) : 0;
    const isOnlineSimulated = absoluteMaxLogTime > 0 && (absoluteMaxLogTime - maxLogTime) <= 5 * 60 * 1000;

    return isOnlineRealtime || isOnlineSimulated;
  };

  // Find all active logging dates in the selected month
  const uniqueDates = Array.from(new Set(
    logs
      .filter(l => parseTimestampDate(l.timestamp).startsWith(selectedMonth))
      .map(l => parseTimestampDate(l.timestamp))
  )).sort();

  // If no logs yet for this month, assume 1 day scope helper
  const scopeDaysCount = Math.max(1, uniqueDates.length);

  // Compute individual performance statistics
  const processedRoster = employees
    .filter(emp => selectedCompany === "ALL" || emp.company_name === selectedCompany)
    .filter(emp => emp.employee_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .map(emp => {
      const empINLogs = logs.filter(
        l => l.employee === emp.employee_name &&
             l.company === emp.company_name &&
             (l.status || "").trim().toUpperCase() === "IN" &&
             parseTimestampDate(l.timestamp).startsWith(selectedMonth)
      );

      // Find distinct days of attendance
      const attendedDays = new Set(empINLogs.map(l => parseTimestampDate(l.timestamp))).size;
      const parsedLates = empINLogs.filter(l => parseTimestampTime(l.timestamp) > "09:30:00");
      const latesCount = new Set(parsedLates.map(l => parseTimestampDate(l.timestamp))).size;

      const rate = uniqueDates.length > 0 ? Math.round((attendedDays / uniqueDates.length) * 100) : 0;
      const statusText = rate >= 80 ? "Excellent" : rate >= 50 ? "Standard" : rate > 0 ? "Under Review" : "In-Active";

      return {
        ...emp,
        attendedDays,
        latesCount,
        rate,
        statusText,
        lastActive: empINLogs.length > 0 ? parseTimestampDate(empINLogs[0].timestamp).split("-").reverse().join("/") : "Never"
      };
    });

  // Aggregated analytics of selected group
  const groupSize = processedRoster.length;
  const avgGroupRate = groupSize > 0 ? Math.round(processedRoster.reduce((sum, e) => sum + e.rate, 0) / groupSize) : 0;
  const totalGroupLates = processedRoster.reduce((sum, e) => sum + e.latesCount, 0);

  return (
    <div className="flex flex-col gap-6" id="roster-tab-view">
      
      {/* Analytics recap bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">Roster Size</span>
            <span className="text-2xl font-black text-slate-800 block mt-2">{groupSize} Employees</span>
            <span className="text-xs text-slate-400 font-semibold mt-1 block">Active on Corporate Entity</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">Group Att. Rate</span>
            <span className="text-2xl font-black text-emerald-600 block mt-2">{avgGroupRate}% Avg</span>
            <span className="text-xs text-slate-400 font-semibold mt-1 block">Scope: {scopeDaysCount} logged days</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <BadgeCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between text-left">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">Total Late Marks</span>
            <span className="text-2xl font-black text-amber-500 block mt-2">{totalGroupLates} Counts</span>
            <span className="text-xs text-slate-400 font-semibold mt-1 block">Late past 09:30 AM marks</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Roster list controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] text-left flex flex-col gap-6">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-extrabold text-slate-800 text-sm font-display">Company-Wise Workforce Dashboard</h3>
            <p className="text-xs text-slate-400 mt-1">
              Select a company to narrow down staff roster profiling for the month of <strong>{selectedMonth}</strong>.
            </p>

            {/* Quick-Glance Live Company Status Bar */}
            <div className="flex flex-wrap items-center gap-2 mt-3 bg-slate-50 border border-slate-100/70 p-2.5 rounded-xl">
              <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest leading-none mr-1">
                Feed Status:
              </span>
              {COMPANIES.map(company => {
                const isOnline = checkIfCompanyOnline(company);
                return (
                  <div key={company} className="flex items-center gap-1.5 bg-white border border-slate-150/70 rounded-lg px-2.5 py-1 text-[10px] font-bold shadow-2xs">
                    <span 
                      className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-350"}`}
                      style={isOnline ? {} : { backgroundColor: "#94a3b8" }}
                    />
                    <span className="text-slate-700 font-extrabold">{company}</span>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                      isOnline ? "text-emerald-600 bg-emerald-50 border border-emerald-100/50" : "text-slate-405 bg-slate-50 border border-slate-100"
                    }`}>
                      {isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start xl:self-center">
            <button
              onClick={() => setSelectedCompany("ALL")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                selectedCompany === "ALL"
                  ? "bg-slate-900 border border-slate-900 text-white"
                  : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"
              }`}
            >
              All Entities
            </button>
            {COMPANIES.map(company => {
              const isOnline = checkIfCompanyOnline(company);
              return (
                <button
                  key={company}
                  onClick={() => setSelectedCompany(company)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    selectedCompany === company
                      ? "bg-slate-900 border border-slate-900 text-white"
                      : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COMPANY_COLORS[company] }} />
                  <span>{company}</span>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider leading-none ${
                    isOnline 
                      ? selectedCompany === company ? "bg-emerald-500 text-white border border-emerald-400" : "bg-emerald-500/10 text-emerald-600 border border-emerald-250/20"
                      : "bg-slate-150/40 text-slate-400 border border-slate-200/20"
                  }`}>
                    {isOnline ? "Online" : "Offline"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Input Filter */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search employee by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
        </div>

        {/* Workers roster table/grid */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50/70 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                <th className="p-4 pl-6">Company</th>
                <th className="p-4">Employee Name</th>
                <th className="p-4 text-center">Days Attended</th>
                <th className="p-4 text-center">Lates</th>
                <th className="p-4 text-center">Attendance %</th>
                <th className="p-4">Roster Health</th>
                <th className="p-4">Last Logged Day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {processedRoster.length > 0 ? (
                processedRoster.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 pl-6 whitespace-nowrap">
                      <span
                        className="px-2.5 py-1 rounded-md text-[9px] font-extrabold tracking-widest uppercase text-white shadow-sm"
                        style={{ backgroundColor: COMPANY_COLORS[emp.company_name] }}
                      >
                        {emp.company_name}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap font-bold text-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold font-mono border border-slate-200">
                          {emp.employee_name.charAt(0)}
                        </div>
                        <span>{emp.employee_name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center text-slate-600 font-bold font-mono">
                      {emp.attendedDays} / {scopeDaysCount} days
                    </td>
                    <td className="p-4 text-center font-bold font-mono">
                      <span className={emp.latesCount > 2 ? "text-rose-500" : emp.latesCount > 0 ? "text-amber-500" : "text-emerald-500"}>
                        {emp.latesCount}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="font-extrabold font-mono text-slate-850">{emp.rate}%</span>
                        <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${emp.rate}%`,
                              backgroundColor: emp.rate >= 80 ? "#10b981" : emp.rate >= 50 ? "#f59e0b" : "#ef4444"
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        emp.statusText === "Excellent"
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          : emp.statusText === "Standard"
                          ? "bg-blue-50 text-blue-600 border border-blue-100"
                          : emp.statusText === "Under Review"
                          ? "bg-amber-50 text-amber-600 border border-amber-100"
                          : "bg-rose-50 text-rose-500 border border-rose-100"
                      }`}>
                        {emp.statusText}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap text-slate-450 font-semibold font-mono">
                      {emp.lastActive}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-bold">
                    No workforce members match your search filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
