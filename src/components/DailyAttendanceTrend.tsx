import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { TrendingUp, Calendar, Info } from "lucide-react";
import { Employee, AttendanceLog } from "../types";

interface DailyAttendanceTrendProps {
  logs: AttendanceLog[];
  employees: Employee[];
  selectedDate: string;
}

export default function DailyAttendanceTrend({
  logs,
  employees,
  selectedDate,
}: DailyAttendanceTrendProps) {
  const totalEmployeesCount = employees.length;

  // Helper: Format YYYY-MM-DD to readable DD/MM/YY
  const formatDateLabel = (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
  };

  // Generate the last 7 days up to and including selectedDate
  const getTrendData = () => {
    if (!selectedDate) return [];

    const baseDate = new Date(selectedDate);
    const trendDaysStr: string[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      trendDaysStr.push(`${yyyy}-${mm}-${dd}`);
    }

    return trendDaysStr.map((dStr) => {
      // Filter logs for this specific date
      const dayLogs = logs.filter((log) => {
        if (!log.timestamp) return false;
        const norm = log.timestamp.replace("T", " ");
        const datePart = norm.split(" ")[0];
        return datePart === dStr;
      });

      // Present employees: Unique set of company-employee matches with an "IN" stamp
      const presentEmployees = new Set(
        dayLogs
          .filter((log) => (log.status || "").trim().toUpperCase() === "IN")
          .map((log) => `${log.company}-${log.employee}`)
      );
      const totalPresent = presentEmployees.size;

      // Late employees: IN stamp after 09:30:00
      const lateEmployees = new Set(
        dayLogs
          .filter((log) => {
            const isIN = (log.status || "").trim().toUpperCase() === "IN";
            if (!isIN) return false;

            const norm = log.timestamp.replace("T", " ");
            const parts = norm.split(" ");
            let timeStr = parts[1] || "";
            if (timeStr) {
              timeStr = timeStr.split(".")[0].split("+")[0].split("Z")[0];
            }
            return timeStr > "09:30:00";
          })
          .map((log) => `${log.company}-${log.employee}`)
      );
      const totalLate = lateEmployees.size;

      // Attendance rate
      const rate = totalEmployeesCount > 0 ? Math.round((totalPresent / totalEmployeesCount) * 100) : 0;

      return {
        date: formatDateLabel(dStr),
        fullDate: dStr.split("-").reverse().join("/"),
        "Present Staff": totalPresent,
        "Late Arrival": totalLate,
        "Capacity": totalEmployeesCount,
        "Attendance Rate (%)": rate,
      };
    });
  };

  const trendData = getTrendData();

  // Find if there is an upward or downward overall trend for display headers
  const latestCount = trendData[trendData.length - 1]?.["Present Staff"] || 0;
  const previousCount = trendData[trendData.length - 2]?.["Present Staff"] || 0;
  const trendDiff = latestCount - previousCount;

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)] flex flex-col gap-6" id="daily-attendance-trend-chart">
      {/* Header and meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left border-b border-slate-50 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h3 className="font-extrabold text-slate-800 text-sm font-display uppercase tracking-wide">
              Daily Attendance Trend
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-semibold">
            Comparing the last 7 calendar days to detect weekly attendance, late patterns & rosters health.
          </p>
        </div>

        {/* Dynamic mini tag for shift matching */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-[10px] font-extrabold text-slate-500 leading-none">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>7-Day Window up to {selectedDate.split("-").reverse().join("/")}</span>
        </div>
      </div>

      {/* Main Grid: Chart and Quick Facts panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Recharts Line Chart */}
        <div className="lg:col-span-3 h-[250px] w-full min-w-0" id="attendance-line-chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={trendData}
              margin={{ top: 10, right: 15, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                stroke="#94a3b8"
                style={{ fontSize: "10px", fontWeight: 700 }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                stroke="#94a3b8"
                style={{ fontSize: "10px", fontWeight: 700 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #f1f5f9",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
                  padding: "12px",
                }}
                labelStyle={{ fontSize: "11px", fontWeight: 800, color: "#1e293b", marginBottom: "4px" }}
                itemStyle={{ fontSize: "11px", fontWeight: 600, padding: "2px 0" }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "10px", fontWeight: 700 }}
              />
              <Line
                name="Present Count"
                type="monotone"
                dataKey="Present Staff"
                stroke="#10b981"
                strokeWidth={3}
                activeDot={{ r: 6 }}
                dot={{ r: 3, strokeWidth: 1 }}
              />
              <Line
                name="Late Arrivals"
                type="monotone"
                dataKey="Late Arrival"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                name="Capacity Limit"
                type="monotone"
                strokeDasharray="5 5"
                dataKey="Capacity"
                stroke="#cbd5e1"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Side summary details columns */}
        <div className="lg:col-span-1 bg-slate-50 border border-slate-100 p-4.5 rounded-2xl flex flex-col justify-between text-left">
          <div className="flex flex-col gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Trend Metrics
            </span>

            <div>
              <span className="text-[10px] text-slate-450 font-bold block">Latest Attendance</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-xl font-black text-slate-800">{latestCount} Present</span>
                {trendDiff !== 0 && (
                  <span className={`text-[10px] font-black ${trendDiff > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    ({trendDiff > 0 ? `+${trendDiff}` : trendDiff} vs yesterday)
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-450 font-bold block">Avg Late Arrivals</span>
              <span className="text-lg font-extrabold text-slate-800 block mt-0.5">
                {(trendData.reduce((acc, curr) => acc + curr["Late Arrival"], 0) / 7).toFixed(1)} / day
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/50 flex gap-2 items-start text-[10px] text-slate-400 font-semibold leading-relaxed">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Line peaks highlight high weekday volume, while troughs generally represent weekends or offline sync intervals.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
