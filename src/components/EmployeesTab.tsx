import { useState, FormEvent, Dispatch, SetStateAction } from "react";
import { UserPlus, Edit2, Trash2, Search, Building2, User } from "lucide-react";
import { Employee } from "../types";

interface EmployeesTabProps {
  employees: Employee[];
  setEmployees: (emps: Employee[]) => void;
  showToast: (text: string, type: "success" | "error" | "info") => void;
  setRefreshTrigger: Dispatch<SetStateAction<number>>;
}

export default function EmployeesTab({
  employees,
  setEmployees,
  showToast,
  setRefreshTrigger,
}: EmployeesTabProps) {
  // Local Form state
  const [empName, setEmpName] = useState("");
  const [empCompany, setEmpCompany] = useState("BHANGAKUTHI");
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const COMPANIES = ["BHANGAKUTHI", "HB", "HB-TP", "HBPL", "SEFALI"];
  const COMPANY_COLORS: Record<string, string> = {
    "BHANGAKUTHI": "#10b981", // Emerald green
    "HB": "#2563eb",          // Brilliant blue
    "HB-TP": "#f59e0b",       // Honey amber
    "HBPL": "#db2777",        // Vivid rose
    "SEFALI": "#8b5cf6",      // Rich violet
    "ALL": "#475569"          // Slate
  };

  // Submit profile creation
  const handleAddEmployee = async (e: FormEvent) => {
    e.preventDefault();
    if (!empName.trim()) {
      showToast("Employee name is required.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: empCompany,
          employee_name: empName.trim()
        })
      });

      if (response.ok) {
        showToast(`Registered ${empName.trim()} under ${empCompany} successfully!`, "success");
        setEmpName("");
        setRefreshTrigger(p => p + 1);
      } else {
        const err = await response.json();
        showToast(err.error || "Roster submission error.", "error");
      }
    } catch (err) {
      showToast("Employee endpoint down.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit profile update modifications
  const handleUpdateEmployee = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingEmp || !editingEmp.employee_name.trim()) {
      showToast("Employee name is required.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/employees/${editingEmp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: editingEmp.company_name,
          employee_name: editingEmp.employee_name.trim()
        })
      });

      if (response.ok) {
        showToast(`Updated profile for ${editingEmp.employee_name.trim()} successfully!`, "success");
        setEditingEmp(null);
        setRefreshTrigger(p => p + 1);
      } else {
        const err = await response.json();
        showToast(err.error || "Roster modification update failed.", "error");
      }
    } catch (err) {
      showToast("Update database server transmission failing.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove Employee Profile
  const handleDeleteEmployee = async (id: number, name: string) => {
    if (!window.confirm(`Are you completely sure you want to delete ${name} from the master database? This action is permanent and deleting may impact related logs.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: "DELETE"
      });

      if (response.ok) {
        showToast(`Successfully deleted ${name} from corporate rosters!`, "success");
        if (editingEmp?.id === id) {
          setEditingEmp(null); // Clear editing if active deleted
        }
        setRefreshTrigger(p => p + 1);
      } else {
        const err = await response.json();
        showToast(err.error || "Delete employee failure.", "error");
      }
    } catch (err) {
      showToast("Database server communication failure during delete.", "error");
    }
  };

  // Trigger editing context
  const startEditing = (emp: Employee) => {
    setEditingEmp({ ...emp });
    showToast(`Loaded ${emp.employee_name} into editor.`, "info");
  };

  // Filter master entries list - supporting both Name and ID code matching
  const filteredEmployees = employees
    .filter(emp => companyFilter === "ALL" || emp.company_name === companyFilter)
    .filter(emp => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        emp.employee_name.toLowerCase().includes(q) ||
        emp.id.toString().includes(q) ||
        `#${emp.id}`.includes(q)
      );
    });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 text-left" id="employees-tab-view">
      
      {/* Sidebar: Add / Update Employee profile form */}
      <div className="lg:col-span-1 bg-white border border-slate-100 p-6 rounded-2xl shadow-xs">
        {editingEmp ? (
          <form onSubmit={handleUpdateEmployee} className="flex flex-col gap-5">
            <div>
              <h3 className="font-extrabold text-blue-600 text-sm flex items-center gap-1.5 font-display">
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 font-semibold leading-relaxed">
                Update credentials of <strong>#{editingEmp.id}</strong> in the master tables.
              </p>
            </div>

            {/* Editing field Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Employee Full Name</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                <User className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={editingEmp.employee_name}
                  onChange={(e) => setEditingEmp({ ...editingEmp, employee_name: e.target.value })}
                  className="bg-transparent text-xs font-semibold text-slate-800 w-full focus:outline-none"
                />
              </div>
            </div>

            {/* Editing field Company */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Corporate Entity</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                <select
                  value={editingEmp.company_name}
                  onChange={(e) => setEditingEmp({ ...editingEmp, company_name: e.target.value })}
                  className="bg-transparent text-xs font-semibold text-slate-850 w-full focus:outline-none cursor-pointer"
                >
                  {COMPANIES.map(co => (
                    <option key={co} value={co}>{co}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 mt-2">
              <button
                type="submit"
                disabled={isSubmitting || !editingEmp.employee_name.trim()}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-blue-105 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Saving changes..." : "Save Modifications"}
              </button>
              <button
                type="button"
                onClick={() => setEditingEmp(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                Cancel Edit
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAddEmployee} className="flex flex-col gap-5">
            <div>
              <h3 className="font-extrabold text-slate-850 text-sm flex items-center gap-1.5 font-display">
                <UserPlus className="w-4 h-4 text-slate-500" />
                Add Employee to Roster
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 font-semibold leading-relaxed">
                Register a new corporate workforce member onto database tables.
              </p>
            </div>

            {/* Add profile Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Employee Full Name</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                <User className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. SNEHA MOJUMDER"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 w-full focus:outline-none"
                />
              </div>
            </div>

            {/* Add profile Company */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Corporate Entity</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                <select
                  value={empCompany}
                  onChange={(e) => setEmpCompany(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-850 w-full focus:outline-none cursor-pointer"
                >
                  {COMPANIES.map(co => (
                    <option key={co} value={co}>{co}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !empName.trim()}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-blue-105 disabled:opacity-50 cursor-pointer mt-2"
            >
              {isSubmitting ? "Writing record..." : "Register Employee"}
            </button>
          </form>
        )}
      </div>

      {/* Main Panel: Master corporate roster list with editing handles */}
      <div className="lg:col-span-3 bg-white border border-slate-100 p-6 sm:p-8 rounded-2xl shadow-xs flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm font-display"> Roster Master Directory</h3>
            <p className="text-xs text-slate-400 mt-1">
              Showing {filteredEmployees.length} registered system employees profile.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white transition cursor-pointer"
            >
              <option value="ALL">All Companies</option>
              {COMPANIES.map(co => (
                <option key={co} value={co}>{co}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Directory Search controls with Real-time Predictive Matching */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search roster directory by employee ID or name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              // Slight delay onBlur so that onClick/onMouseDown on suggestions registers beforehand
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />

          {/* Predictive Suggestions Dropdown */}
          {showSuggestions && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto p-1.5 flex flex-col gap-1 text-xs">
              <div className="px-2 py-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-lg select-none">
                <span>Predicted Matches</span>
                <span>Type name or ID</span>
              </div>
              {filteredEmployees.slice(0, 5).map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onMouseDown={() => {
                    setSearchQuery(emp.employee_name);
                    setShowSuggestions(false);
                  }}
                  className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg text-left transition duration-150 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[9px] rounded-full border border-blue-100">
                      {emp.employee_name.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-xs block leading-tight">
                        {emp.employee_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ID: #{emp.id}
                      </span>
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider text-white"
                    style={{ backgroundColor: COMPANY_COLORS[emp.company_name] || "#475569" }}
                  >
                    {emp.company_name}
                  </span>
                </button>
              ))}
              {filteredEmployees.length === 0 && (
                <div className="p-3 text-center text-slate-400 font-semibold select-none text-[11px]">
                  No matching predictions found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Master directories table list */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full border-collapse text-left text-xs leading-none">
            <thead>
              <tr className="bg-slate-50 text-slate-450 font-bold uppercase tracking-wider border-b border-slate-100 text-[10px]">
                <th className="p-4 pl-6">ID Code</th>
                <th className="p-4">Corporate Company</th>
                <th className="p-4">Employee Full Name</th>
                <th className="p-4 text-right pr-6">Database Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600 font-semibold leading-relaxed">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 pl-6 whitespace-nowrap font-mono text-slate-450 text-[11px]">#{emp.id}</td>
                    <td className="p-4 whitespace-nowrap">
                      <span
                        className="px-2.5 py-1 rounded-md text-[9px] font-extrabold tracking-widest uppercase text-white shadow-sm"
                        style={{ backgroundColor: COMPANY_COLORS[emp.company_name] }}
                      >
                        {emp.company_name}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap font-bold text-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center font-bold text-xs font-mono rounded-full leading-none">
                          {emp.employee_name.charAt(0)}
                        </div>
                        {emp.employee_name}
                      </div>
                    </td>
                    <td className="p-4 text-right pr-6 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => startEditing(emp)}
                          className="p-2 hover:bg-blue-50/80 rounded-xl text-blue-600 transition border border-transparent hover:border-blue-100 hover:shadow-xs cursor-pointer"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.id, emp.employee_name)}
                          className="p-2 hover:bg-rose-50 rounded-xl text-rose-500 transition border border-transparent hover:border-rose-100 hover:shadow-xs cursor-pointer"
                          title="Delete Employee"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400 font-bold">
                    No workforce members find in index roster.
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
