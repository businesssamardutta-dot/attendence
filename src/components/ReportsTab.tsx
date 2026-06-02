import { useState } from "react";
import { Download, FileText, Filter, Calendar, Building, HelpCircle, Loader2 } from "lucide-react";
import { Employee, AttendanceLog } from "../types";

interface ReportsTabProps {
  employees: Employee[];
  logs: AttendanceLog[];
  selectedDate: string;
  selectedMonth: string;
  showToast: (text: string, type: "success" | "error" | "info") => void;
}

export default function ReportsTab({ employees, logs, selectedDate, selectedMonth, showToast }: ReportsTabProps) {
  const [reportType, setReportType] = useState<"daily_paired" | "monthly_summary" | "lates" | "absents" | "raw_stream">("daily_paired");
  const [selectedRepCompany, setSelectedRepCompany] = useState<string>("ALL");
  const [filterPeriod, setFilterPeriod] = useState<"daily" | "monthly">("daily");
  const [reportDate, setReportDate] = useState<string>(selectedDate);
  const [reportMonth, setReportMonth] = useState<string>(selectedMonth);
  const [isDownloading, setIsDownloading] = useState(false);

  const COMPANIES = ["BHANGAKUTHI", "HB", "HB-TP", "HBPL", "SEFALI"];
  const REPORT_TEMPLATES = [
    { id: "daily_paired", title: "Daily Paired In/Out Shifts", desc: "Detailed paired shift logs with locations." },
    { id: "monthly_summary", title: "Monthly Attendance Summary", desc: "Employee cumulative attendance percentages." },
    { id: "lates", title: "Punctuality & Late Arrivals Log", desc: "List of entries clocked past standard 09:30 AM." },
    { id: "absents", title: "Absenteeism Follow-Up Report", desc: "Staff members with no active IN marks in period." },
    { id: "raw_stream", title: "Raw Log Audit Ledger", desc: "Full database raw records including IDs and GPS." }
  ];

  // Helper date/time parsers
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

  // Compile Report Records based on selected criteria
  const getCompiledReport = () => {
    const activeDateStr = filterPeriod === "daily" ? reportDate : "";
    const activeMonthStr = filterPeriod === "monthly" ? reportMonth : "";

    const filteredLogs = logs.filter(log => {
      const matchCo = selectedRepCompany === "ALL" || log.company === selectedRepCompany;
      const logDate = parseTimestampDate(log.timestamp);
      const matchPeriod = filterPeriod === "daily" ? logDate === reportDate : logDate.startsWith(reportMonth);
      return matchCo && matchPeriod;
    });

    if (reportType === "daily_paired") {
      // Pair IN & OUT logs for the chosen target day
      const targetDate = filterPeriod === "daily" ? reportDate : uniqueDatesInPeriod[0] || reportDate;
      const baseLogs = logs.filter(l => parseTimestampDate(l.timestamp) === targetDate);

      const grouped: Record<string, { ins: AttendanceLog[]; outs: AttendanceLog[] }> = {};
      baseLogs.forEach(log => {
        const key = `${log.company}-${log.employee}`;
        if (!grouped[key]) grouped[key] = { ins: [], outs: [] };
        const norm = (log.status || "").trim().toUpperCase();
        if (norm === "IN") grouped[key].ins.push(log);
        else if (norm === "OUT") grouped[key].outs.push(log);
      });

      const rows: any[] = [];
      Object.entries(grouped).forEach(([key, val]) => {
        const dashIn = key.indexOf("-");
        const coName = key.substring(0, dashIn);
        const empName = key.substring(dashIn + 1);

        if (selectedRepCompany !== "ALL" && coName !== selectedRepCompany) return;

        const earliestIn = [...val.ins].sort((a,b) => (a.timestamp || "").localeCompare(b.timestamp || ""))[0];
        const latestOut = [...val.outs].sort((a,b) => (a.timestamp || "").localeCompare(b.timestamp || ""))[0];

        if (earliestIn || latestOut) {
          const inT = earliestIn ? parseTimestampTime(earliestIn.timestamp) : "—";
          const outT = latestOut ? parseTimestampTime(latestOut.timestamp) : "—";
          const inLoc = earliestIn ? earliestIn.location : "—";
          const outLoc = latestOut ? latestOut.location : "—";
          const status = inT === "—" ? "Absent" : inT > "09:30:00" ? "Late" : "On-Time";

          rows.push({
            Company: coName,
            Employee: empName,
            Date: targetDate.split("-").reverse().join("/"),
            Status: status,
            "In Time": inT,
            "In Location": inLoc,
            "Out Time": outT,
            "Out Location": outLoc
          });
        }
      });

      return rows;
    }

    if (reportType === "monthly_summary") {
      const activeMonth = filterPeriod === "monthly" ? reportMonth : reportDate.substring(0, 7);
      const uniqueDates = Array.from(new Set(
        logs
          .filter(l => parseTimestampDate(l.timestamp).startsWith(activeMonth))
          .map(l => parseTimestampDate(l.timestamp))
      )).sort();

      const scopeDays = Math.max(1, uniqueDates.length);

      return employees
        .filter(emp => selectedRepCompany === "ALL" || emp.company_name === selectedRepCompany)
        .map(emp => {
          const empINLogs = logs.filter(
            l => l.employee === emp.employee_name &&
                 l.company === emp.company_name &&
                 (l.status || "").trim().toUpperCase() === "IN" &&
                 parseTimestampDate(l.timestamp).startsWith(activeMonth)
          );

          const attendedDays = new Set(empINLogs.map(l => parseTimestampDate(l.timestamp))).size;
          const parsedLates = empINLogs.filter(l => parseTimestampTime(l.timestamp) > "09:30:00");
          const latesCount = new Set(parsedLates.map(l => parseTimestampDate(l.timestamp))).size;
          const absentsCount = Math.max(0, scopeDays - attendedDays);
          const rate = Math.round((attendedDays / scopeDays) * 100);

          return {
            Company: emp.company_name,
            Employee: emp.employee_name,
            "Active Logging Days": scopeDays,
            "Days Present": attendedDays,
            "Days Absent": absentsCount,
            "Days Late": latesCount,
            "Attendance rate": `${rate}%`
          };
        });
    }

    if (reportType === "lates") {
      const activeText = filterPeriod === "daily" ? reportDate : reportMonth;
      const lateLogs = logs.filter(log => {
        const isIN = (log.status || "").trim().toUpperCase() === "IN";
        const dateStr = parseTimestampDate(log.timestamp);
        const matchTime = parseTimestampTime(log.timestamp) > "09:30:00";
        const matchPeriod = filterPeriod === "daily" ? dateStr === reportDate : dateStr.startsWith(reportMonth);
        const matchCo = selectedRepCompany === "ALL" || log.company === selectedRepCompany;
        return isIN && matchPeriod && matchTime && matchCo;
      });

      return lateLogs.map(l => ({
        Company: l.company,
        Employee: l.employee,
        Date: parseTimestampDate(l.timestamp).split("-").reverse().join("/"),
        "Time Logged": parseTimestampTime(l.timestamp),
        Location: l.location,
        Status: "Late"
      })).sort((a,b) => b.Date.localeCompare(a.Date));
    }

    if (reportType === "absents") {
      const activeMonth = filterPeriod === "monthly" ? reportMonth : reportDate.substring(0, 7);
      
      if (filterPeriod === "daily") {
        const presentsToday = new Set(
          logs
            .filter(l => parseTimestampDate(l.timestamp) === reportDate && (l.status || "").trim().toUpperCase() === "IN")
            .map(l => l.employee)
        );

        return employees
          .filter(emp => selectedRepCompany === "ALL" || emp.company_name === selectedRepCompany)
          .filter(emp => !presentsToday.has(emp.employee_name))
          .map(emp => ({
            Company: emp.company_name,
            Employee: emp.employee_name,
            Date: reportDate.split("-").reverse().join("/"),
            Status: "Absent",
            Notes: "No attendance stamps detected."
          }));
      } else {
        const uniqueDates = Array.from(new Set(
          logs
            .filter(l => parseTimestampDate(l.timestamp).startsWith(activeMonth))
            .map(l => parseTimestampDate(l.timestamp))
        )).sort();

        return employees
          .filter(emp => selectedRepCompany === "ALL" || emp.company_name === selectedRepCompany)
          .map(emp => {
            const empINLogs = logs.filter(
              l => l.employee === emp.employee_name &&
                   l.company === emp.company_name &&
                   (l.status || "").trim().toUpperCase() === "IN" &&
                   parseTimestampDate(l.timestamp).startsWith(activeMonth)
            );
            const attendedDays = new Set(empINLogs.map(l => parseTimestampDate(l.timestamp))).size;
            const absentsCount = Math.max(0, uniqueDates.length - attendedDays);
            const ratio = uniqueDates.length > 0 ? Math.round((absentsCount / uniqueDates.length) * 100) : 0;

            return {
              Company: emp.company_name,
              Employee: emp.employee_name,
              Month: activeMonth,
              "Total Tracker Days": uniqueDates.length,
              "Days Absent": absentsCount,
              "Absent Ratio": `${ratio}%`
            };
          })
          .filter(item => item["Days Absent"] > 0)
          .sort((a,b) => b["Days Absent"] - a["Days Absent"]);
      }
    }

    // fallback: raw DB records line stream audit
    return filteredLogs.map(l => ({
      "Record ID": l.id || "—",
      Company: l.company,
      Employee: l.employee,
      Date: parseTimestampDate(l.timestamp).split("-").reverse().join("/"),
      Time: parseTimestampTime(l.timestamp),
      Status: l.status,
      Location: l.location
    })).sort((a,b) => (b["Record ID"] as number) - (a["Record ID"] as number));
  };

  // Find unique dates list to prompt dates in reports
  const uniqueDatesInPeriod = Array.from(new Set(
    logs
      .filter(l => parseTimestampDate(l.timestamp).startsWith(reportMonth))
      .map(l => parseTimestampDate(l.timestamp))
  )).sort();

  const reportRows = getCompiledReport();

  // Export to CSV Function
  const handleCSVDownloader = () => {
    if (reportRows.length === 0) {
      showToast("No data compiled in report preview to export. Switch filter selectors.", "error");
      return;
    }

    setIsDownloading(true);

    setTimeout(() => {
      try {
        const headers = Object.keys(reportRows[0]);
        const lines = reportRows.map(row => 
          headers.map(head => `"${String(row[head] || "").replace(/"/g, '""')}"`).join(",")
        );

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
          + [headers.join(","), ...lines].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        
        const activeLabel = filterPeriod === "daily" ? reportDate : reportMonth;
        link.setAttribute("download", `hr_report_${reportType}_${activeLabel}_${selectedRepCompany}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast("Attendance CSV log spreadsheet downloaded successfully!", "success");
      } catch (err) {
        showToast("Failed to compile CSV spreadsheet.", "error");
      } finally {
        setIsDownloading(false);
      }
    }, 800);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 text-left" id="reports-tab-view">
      
      {/* Configuration Sidebar */}
      <div className="lg:col-span-1 bg-white border border-slate-100 p-6 rounded-2xl shadow-xs flex flex-col gap-6">
        <div>
          <h3 className="font-extrabold text-slate-850 text-sm flex items-center gap-1.5 font-display">
            <FileText className="w-4 h-4 text-slate-500" />
            Report Parameters
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 font-semibold leading-relaxed">
            Configure report presets and context limits before exporting compiled spreadsheets.
          </p>
        </div>

        {/* Report templates selecting cards list */}
        <div className="flex flex-col gap-2.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">
            Report Template Type
          </label>
          <div className="flex flex-col gap-1.5">
            {REPORT_TEMPLATES.map(tmp => (
              <button
                key={tmp.id}
                onClick={() => setReportType(tmp.id as any)}
                className={`p-3 rounded-xl border text-left text-xs transition cursor-pointer flex flex-col gap-1 ${
                  reportType === tmp.id
                    ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                    : "bg-slate-50 hover:bg-slate-100 border-slate-150 text-slate-600"
                }`}
              >
                <span className="font-bold block leading-snug">{tmp.title}</span>
                <span className={`text-[10px] ${reportType === tmp.id ? "text-slate-300" : "text-slate-400"}`}>
                  {tmp.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Filters Group */}
        <div className="flex flex-col gap-4 pt-4 border-t border-slate-100">
          
          {/* Daily vs Monthly context scope */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">
              Timing Scope Filter
            </label>
            <div className="flex p-0.5 bg-slate-100 border border-slate-200 rounded-xl">
              <button
                onClick={() => setFilterPeriod("daily")}
                className={`flex-1 py-1 px-2 text-center rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  filterPeriod === "daily" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500"
                }`}
              >
                Daily Spot
              </button>
              <button
                onClick={() => setFilterPeriod("monthly")}
                className={`flex-1 py-1 px-2 text-center rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  filterPeriod === "monthly" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500"
                }`}
              >
                Monthly Rollup
              </button>
            </div>
          </div>

          {/* Time Picker widget */}
          {filterPeriod === "daily" ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">
                Target Log Spot Date
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => e.target.value && setReportDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 font-mono focus:outline-none appearance-none cursor-pointer w-full"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">
                Target Rollup Calendar Month
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => e.target.value && setReportMonth(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 font-mono focus:outline-none appearance-none cursor-pointer w-full"
                />
              </div>
            </div>
          )}

          {/* Enterprise level filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">
              Assign Corporate Entity
            </label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Building className="w-4 h-4 text-slate-400" />
              <select
                value={selectedRepCompany}
                onChange={(e) => setSelectedRepCompany(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer w-full"
              >
                <option value="ALL">All Companies</option>
                {COMPANIES.map(co => (
                  <option key={co} value={co}>{co}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Premium Export CSV Action with Feedback Loader */}
        <button
          onClick={handleCSVDownloader}
          disabled={isDownloading}
          className={`w-full font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2 focus:outline-none ${
            isDownloading
              ? "bg-slate-200 text-slate-450 cursor-not-allowed shadow-none border border-slate-300"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-105"
          }`}
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              Compiling CSV Spreadsheet...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download CSV Spreadsheet
            </>
          )}
        </button>
      </div>

      {/* Reports Compiled Renders Block */}
      <div className="lg:col-span-3 bg-white border border-slate-100 p-6 sm:p-8 rounded-2xl shadow-xs flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm font-display">
              {REPORT_TEMPLATES.find(t => t.id === reportType)?.title}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Currently generating {reportRows.length} report rows matching parameters.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-150 px-3.5 py-1.5 rounded-xl text-[10px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live DB Snapshot
          </div>
        </div>

        {/* Live generated preview table */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          {reportRows.length > 0 ? (
            <table className="w-full border-collapse text-left text-xs leading-none">
              <thead>
                <tr className="bg-slate-50 text-slate-450 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                  {Object.keys(reportRows[0]).map(head => (
                    <th key={head} className="p-4 whitespace-nowrap first:pl-6">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 font-semibold leading-relaxed">
                {reportRows.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition">
                    {Object.keys(row).map((head, cellIdx) => {
                      const val = row[head];
                      
                      // Beautiful customized styling checks for specific cells
                      return (
                        <td key={cellIdx} className="p-4 whitespace-nowrap first:pl-6">
                          {head === "Company" ? (
                            <span className="px-2 py-0.5 rounded text-[8px] tracking-widest font-extrabold text-white bg-slate-600">
                              {val}
                            </span>
                          ) : head === "Status" ? (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold ${
                              val === "Late"
                                ? "bg-amber-50 text-amber-600 border border-amber-100"
                                : val === "Absent"
                                ? "bg-rose-50 text-rose-500 border border-rose-100"
                                : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            }`}>
                              {val}
                            </span>
                          ) : (
                            <span className="text-slate-800 text-xs font-semibold">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center p-16 text-slate-400 font-semibold flex flex-col items-center justify-center gap-2">
              <HelpCircle className="w-8 h-8 text-slate-300" />
              <span>Empty Report Preview</span>
              <span className="text-xs text-slate-400 font-medium">Please verify period selection matches logs records.</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
