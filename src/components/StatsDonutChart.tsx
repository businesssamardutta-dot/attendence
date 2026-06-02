import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface StatsDonutChartProps {
  totalPresentCount: number;
  totalLateCount: number;
  totalAbsentCount: number;
  overallAttendanceRate: number;
  filterMode: "daily" | "monthly";
  selectedDate: string;
  selectedMonth: string;
  uniqueDaysCount: number;
  totalEmployeesCount: number;
}

export default function StatsDonutChart({
  totalPresentCount,
  totalLateCount,
  totalAbsentCount,
  overallAttendanceRate,
  filterMode,
  selectedDate,
  selectedMonth,
  uniqueDaysCount,
  totalEmployeesCount,
}: StatsDonutChartProps) {
  const chartData = [
    { name: "Present (On-Time)", value: Math.max(0, totalPresentCount - totalLateCount), color: "#10b981" },
    { name: "Late Arrivals", value: totalLateCount, color: "#f59e0b" },
    { name: "Absent", value: totalAbsentCount, color: "#ef4444" },
  ];

  const totalLogsCount = totalPresentCount + totalAbsentCount;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="stats-donut-chart-container">
      {/* Donut Pie Chart on Left */}
      <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative flex flex-col justify-center min-h-[300px]">
        <div className="text-left mb-2">
          <h3 className="font-extrabold text-slate-800 text-sm font-display">Overall Status Distribution</h3>
          <p className="text-xs text-slate-400 mt-1">
            Breakdown for {filterMode === "daily" ? selectedDate.split("-").reverse().join("/") : selectedMonth}
          </p>
        </div>

        <div className="relative flex-1 flex items-center justify-center">
          {/* Absolute text centered in the Donut hole */}
          <div className="absolute flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black text-slate-800">{overallAttendanceRate}%</span>
            <span className="text-[10px] text-slate-450 uppercase tracking-widest font-extrabold">Rate</span>
          </div>

          {totalLogsCount > 0 ? (
            <div style={{ width: "100%", height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${value} shift logs`, "Count"]}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #f1f5f9", boxShadow: "0 4px 12px rbg(0,0,0,0.03)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-slate-400 text-xs py-10">No status logs recorded for this period</div>
          )}
        </div>
      </div>

      {/* Numerical Recap Panel on Right */}
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center pb-4 border-b border-slate-50 text-left">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm font-display">Workforce Metrics Recap</h3>
              <p className="text-xs text-slate-400 mt-1">Detailed statistical evaluation</p>
            </div>
            <span className="text-[10px] bg-blue-55 border border-blue-100 text-blue-600 px-3 py-1 rounded-full font-bold uppercase">
              {filterMode === "daily" ? "Daily metrics" : "Monthly averages"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <div className="text-left">
                <span className="text-xs text-slate-400 font-bold block">On-Time Present</span>
                <span className="text-lg font-black text-slate-800 leading-none">
                  {Math.max(0, totalPresentCount - totalLateCount)}{" "}
                  <span className="text-xs font-semibold text-slate-450">person-days</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-amber-500 flex-shrink-0" />
              <div className="text-left">
                <span className="text-xs text-slate-400 font-bold block">Late Clock-Ins</span>
                <span className="text-lg font-black text-slate-800 leading-none">
                  {totalLateCount}{" "}
                  <span className="text-xs font-semibold text-slate-450">person-days</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-rose-500 flex-shrink-0" />
              <div className="text-left">
                <span className="text-xs text-slate-400 font-bold block">Total Absences</span>
                <span className="text-lg font-black text-slate-800 leading-none">
                  {totalAbsentCount}{" "}
                  <span className="text-xs font-semibold text-slate-450">person-days</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Context Statement */}
        <div className="mt-4 p-4 bg-slate-50 border border-slate-100/80 rounded-xl text-left">
          <span className="font-bold text-slate-700 text-xs block">Period Summary</span>
          <span className="text-[11px] text-slate-450 mt-1 block leading-relaxed">
            {filterMode === "daily"
              ? `On ${selectedDate.split("-").reverse().join("/")}, there were ${totalPresentCount} employees present with ${totalLateCount} tardy arrivals. Overall attendance stood at ${overallAttendanceRate}%.`
              : `Throughout the month of ${selectedMonth}, across ${uniqueDaysCount} active tracking shifts, we recorded ${totalPresentCount} total daily presence allocations and ${totalLateCount} late arrivals. Out of ${
                  totalEmployeesCount * uniqueDaysCount
                } potential shifts, overall attendance rate reached ${overallAttendanceRate}%.`}
          </span>
        </div>
      </div>
    </div>
  );
}
