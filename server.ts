import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createServer as createViteServer } from "vite";

// Force load env from .env.example or system env
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Load Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL || "https://zakajrrmzzybyptypjdt.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const useSupabase = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = useSupabase ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Clean in-memory DB for fallback/demo mode
const LOCAL_EMPLOYEES = [
  // BHANGAKUTHI (11)
  { id: 1, company_name: "BHANGAKUTHI", employee_name: "Ramkrishna Pal" },
  { id: 2, company_name: "BHANGAKUTHI", employee_name: "Shyamal Roy" },
  { id: 3, company_name: "BHANGAKUTHI", employee_name: "Tarun Ghosh" },
  { id: 4, company_name: "BHANGAKUTHI", employee_name: "Uttam Majhi" },
  { id: 5, company_name: "BHANGAKUTHI", employee_name: "Biswajit Dey" },
  { id: 6, company_name: "BHANGAKUTHI", employee_name: "Prasun Baidya" },
  { id: 7, company_name: "BHANGAKUTHI", employee_name: "Kartick Sen" },
  { id: 8, company_name: "BHANGAKUTHI", employee_name: "Sanjoy Dutta" },
  { id: 9, company_name: "BHANGAKUTHI", employee_name: "Gopal Kundu" },
  { id: 10, company_name: "BHANGAKUTHI", employee_name: "Hari Das" },
  { id: 11, company_name: "BHANGAKUTHI", employee_name: "Madhab Das" },

  // HB (25)
  { id: 12, company_name: "HB", employee_name: "Sneha Mojumder" },
  { id: 13, company_name: "HB", employee_name: "Meghna Kuri" },
  { id: 14, company_name: "HB", employee_name: "Pabitra Mondal" },
  { id: 15, company_name: "HB", employee_name: "Soumyajit Barman" },
  { id: 16, company_name: "HB", employee_name: "Rupa Roy" },
  { id: 17, company_name: "HB", employee_name: "Sanjoy Sen" },
  { id: 18, company_name: "HB", employee_name: "Tapan Das" },
  { id: 19, company_name: "HB", employee_name: "Bikram Ghosh" },
  { id: 20, company_name: "HB", employee_name: "Sourav Dey" },
  { id: 21, company_name: "HB", employee_name: "Puja Saha" },
  { id: 22, company_name: "HB", employee_name: "Rahul Dutta" },
  { id: 23, company_name: "HB", employee_name: "Mithun Sarkar" },
  { id: 24, company_name: "HB", employee_name: "Suman Paul" },
  { id: 25, company_name: "HB", employee_name: "Priya Kundu" },
  { id: 26, company_name: "HB", employee_name: "Debasish Pal" },
  { id: 27, company_name: "HB", employee_name: "Tanmoy Sil" },
  { id: 28, company_name: "HB", employee_name: "Avishek Sen" },
  { id: 29, company_name: "HB", employee_name: "Sayan Mitra" },
  { id: 30, company_name: "HB", employee_name: "Rupak Das" },
  { id: 31, company_name: "HB", employee_name: "Subhendu Das" },
  { id: 32, company_name: "HB", employee_name: "Kunal Paul" },
  { id: 33, company_name: "HB", employee_name: "Biplab Dey" },
  { id: 34, company_name: "HB", employee_name: "Manish Shaw" },
  { id: 35, company_name: "HB", employee_name: "Animesh Roy" },
  { id: 36, company_name: "HB", employee_name: "Sumit Guha" },

  // HB-TP (9)
  { id: 37, company_name: "HB-TP", employee_name: "Abhijit Guha" },
  { id: 38, company_name: "HB-TP", employee_name: "Barnali Shaw" },
  { id: 39, company_name: "HB-TP", employee_name: "Chandan Bera" },
  { id: 40, company_name: "HB-TP", employee_name: "Deepa Haldar" },
  { id: 41, company_name: "HB-TP", employee_name: "Eshita Paul" },
  { id: 42, company_name: "HB-TP", employee_name: "Faruk Sheikh" },
  { id: 43, company_name: "HB-TP", employee_name: "Ganesh Pal" },
  { id: 44, company_name: "HB-TP", employee_name: "Haimanti Das" },
  { id: 45, company_name: "HB-TP", employee_name: "Indranil Roy" },

  // HBPL (20)
  { id: 46, company_name: "HBPL", employee_name: "Rahul Verma" },
  { id: 47, company_name: "HBPL", employee_name: "Debasish Roy" },
  { id: 48, company_name: "HBPL", employee_name: "Arjun Banerjee" },
  { id: 49, company_name: "HBPL", employee_name: "Pratik Sen" },
  { id: 50, company_name: "HBPL", employee_name: "Shubham Dey" },
  { id: 51, company_name: "HBPL", employee_name: "Avijit Dutta" },
  { id: 52, company_name: "HBPL", employee_name: "Suman Mitra" },
  { id: 53, company_name: "HBPL", employee_name: "Arup Das" },
  { id: 54, company_name: "HBPL", employee_name: "Koushik Ghosh" },
  { id: 55, company_name: "HBPL", employee_name: "Niladri Sekhar" },
  { id: 56, company_name: "HBPL", employee_name: "Subrata Pal" },
  { id: 57, company_name: "HBPL", employee_name: "Ujjwal Das" },
  { id: 58, company_name: "HBPL", employee_name: "Sujit Shaw" },
  { id: 59, company_name: "HBPL", employee_name: "Dipankar Roy" },
  { id: 60, company_name: "HBPL", employee_name: "Bapi Halder" },
  { id: 61, company_name: "HBPL", employee_name: "Sajal Sen" },
  { id: 62, company_name: "HBPL", employee_name: "Prosenjit Roy" },
  { id: 63, company_name: "HBPL", employee_name: "Bablu Patra" },
  { id: 64, company_name: "HBPL", employee_name: "Ranjit Das" },
  { id: 65, company_name: "HBPL", employee_name: "Uttam Shaw" },

  // SEFALI (34)
  { id: 66, company_name: "SEFALI", employee_name: "Sujay Kumar" },
  { id: 67, company_name: "SEFALI", employee_name: "Amit Patra" },
  { id: 68, company_name: "SEFALI", employee_name: "Boby Biswas" },
  { id: 69, company_name: "SEFALI", employee_name: "Dilip Mandal" },
  { id: 70, company_name: "SEFALI", employee_name: "Gita Rani" },
  { id: 71, company_name: "SEFALI", employee_name: "Haren Bag" },
  { id: 72, company_name: "SEFALI", employee_name: "Indrajit Ray" },
  { id: 73, company_name: "SEFALI", employee_name: "Joydev Pal" },
  { id: 74, company_name: "SEFALI", employee_name: "Karuna Bag" },
  { id: 75, company_name: "SEFALI", employee_name: "Laxmi Garai" },
  { id: 76, company_name: "SEFALI", employee_name: "Naba Maiti" },
  { id: 77, company_name: "SEFALI", employee_name: "Osman Goni" },
  { id: 78, company_name: "SEFALI", employee_name: "Pradip Roy" },
  { id: 79, company_name: "SEFALI", employee_name: "Ratan Sen" },
  { id: 80, company_name: "SEFALI", employee_name: "Swapan Shaw" },
  { id: 81, company_name: "SEFALI", employee_name: "Tarapada Das" },
  { id: 82, company_name: "SEFALI", employee_name: "Amalesh Pal" },
  { id: 83, company_name: "SEFALI", employee_name: "Bimal Ghosh" },
  { id: 84, company_name: "SEFALI", employee_name: "Chandi Patra" },
  { id: 85, company_name: "SEFALI", employee_name: "Dhananjay Roy" },
  { id: 86, company_name: "SEFALI", employee_name: "Ganesh Garai" },
  { id: 87, company_name: "SEFALI", employee_name: "Haradhan Bag" },
  { id: 88, company_name: "SEFALI", employee_name: "Kartick Maiti" },
  { id: 89, company_name: "SEFALI", employee_name: "Madan Mohan" },
  { id: 90, company_name: "SEFALI", employee_name: "Nimai Das" },
  { id: 91, company_name: "SEFALI", employee_name: "Panchanan Garai" },
  { id: 92, company_name: "SEFALI", employee_name: "Ramesh Sen" },
  { id: 93, company_name: "SEFALI", employee_name: "Santi Ram" },
  { id: 94, company_name: "SEFALI", employee_name: "Tarak Shaw" },
  { id: 95, company_name: "SEFALI", employee_name: "Upendra Nath" },
  { id: 96, company_name: "SEFALI", employee_name: "Yusuf Ali" },
  { id: 97, company_name: "SEFALI", employee_name: "Zakir Hussain" },
  { id: 98, company_name: "SEFALI", employee_name: "Anowar Hossein" },
  { id: 99, company_name: "SEFALI", employee_name: "Babu Sona" }
];

const LOCAL_ATTENDANCE_LOGS = [
  // HB checks (16 present -> 17 IN lines, plus 4 OUT lines = 21 HB logs)
  { id: 1, company: "HB", employee: "Sneha Mojumder", timestamp: "2026-06-01 08:47:39", status: "IN", location: "Nazrul Pally, Bardhaman, West Bengal" },
  { id: 2, company: "HB", employee: "Sneha Mojumder", timestamp: "2026-06-01 19:53:23", status: "OUT", location: "B B Ghosh Road, Raniganj" },
  { id: 3, company: "HB", employee: "Sneha Mojumder", timestamp: "2026-06-01 08:48:42", status: "IN", location: "Nazrul Pally, Bardhaman, West Bengal" },
  { id: 4, company: "HB", employee: "Sneha Mojumder", timestamp: "2026-06-01 19:53:23", status: "OUT", location: "B B Ghosh Road, Raniganj" },
  { id: 5, company: "HB", employee: "Meghna Kuri", timestamp: "2026-06-01 09:01:36", status: "IN", location: "B B Ghosh Road, Raniganj Bazar" },
  { id: 6, company: "HB", employee: "Meghna Kuri", timestamp: "2026-06-01 19:53:06", status: "OUT", location: "B B Ghosh Road, Raniganj" },
  { id: 7, company: "HB", employee: "Pabitra Mondal", timestamp: "2026-06-01 08:30:15", status: "IN", location: "B B Ghosh Road, Raniganj" },
  { id: 8, company: "HB", employee: "Soumyajit Barman", timestamp: "2026-06-01 08:55:00", status: "IN", location: "B C Road, Burdwan" },
  { id: 9, company: "HB", employee: "Rupa Roy", timestamp: "2026-06-01 09:10:44", status: "IN", location: "B C Road, Burdwan" },
  { id: 10, company: "HB", employee: "Sanjoy Sen", timestamp: "2026-06-01 09:15:22", status: "IN", location: "Raniganj Bazar" },
  { id: 11, company: "HB", employee: "Tapan Das", timestamp: "2026-06-01 09:22:10", status: "IN", location: "Grand Trunk Rd, Burdwan" },
  { id: 12, company: "HB", employee: "Bikram Ghosh", timestamp: "2026-06-01 09:45:11", status: "IN", location: "B C Road, Burdwan" }, // LATE
  { id: 13, company: "HB", employee: "Sourav Dey", timestamp: "2026-06-01 09:55:40", status: "IN", location: "Raniganj Bazar" }, // LATE
  { id: 14, company: "HB", employee: "Puja Saha", timestamp: "2026-06-01 10:12:05", status: "IN", location: "Grand Trunk Rd, Burdwan" }, // LATE
  { id: 15, company: "HB", employee: "Rahul Dutta", timestamp: "2026-06-01 10:30:55", status: "IN", location: "Court Compound, Burdwan" }, // LATE
  { id: 16, company: "HB", employee: "Mithun Sarkar", timestamp: "2026-06-01 09:35:10", status: "IN", location: "B Block, Salt Lake" }, // LATE
  { id: 17, company: "HB", employee: "Suman Paul", timestamp: "2026-06-01 09:42:00", status: "IN", location: "Salt Lake Sector 5" }, // LATE
  { id: 18, company: "HB", employee: "Priya Kundu", timestamp: "2026-06-01 08:40:00", status: "IN", location: "B C Road, Burdwan" },
  { id: 19, company: "HB", employee: "Debasish Pal", timestamp: "2026-06-01 09:18:00", status: "IN", location: "Raniganj Bazar" },
  { id: 20, company: "HB", employee: "Tanmoy Sil", timestamp: "2026-06-01 08:52:00", status: "IN", location: "Court Compound, Burdwan" },

  // HB-TP checks (5 present -> 5 logs)
  { id: 21, company: "HB-TP", employee: "Abhijit Guha", timestamp: "2026-06-01 08:12:00", status: "IN", location: "HB-TP Salt Lake Site" },
  { id: 22, company: "HB-TP", employee: "Barnali Shaw", timestamp: "2026-06-01 08:45:50", status: "IN", location: "HB-TP Salt Lake Site" },
  { id: 23, company: "HB-TP", employee: "Chandan Bera", timestamp: "2026-06-01 09:05:14", status: "IN", location: "HB-TP Newtown Gate" },
  { id: 24, company: "HB-TP", employee: "Deepa Haldar", timestamp: "2026-06-01 08:50:23", status: "IN", location: "HB-TP Salt Lake Site" },
  { id: 25, company: "HB-TP", employee: "Eshita Paul", timestamp: "2026-06-01 09:15:00", status: "IN", location: "HB-TP Newtown Gate" },

  // SEFALI checks (12 present -> 13 logs)
  { id: 26, company: "SEFALI", employee: "Sujay Kumar", timestamp: "2026-06-01 08:10:25", status: "IN", location: "Sefali Main Desk" },
  { id: 27, company: "SEFALI", employee: "Boby Biswas", timestamp: "2026-06-01 08:58:19", status: "IN", location: "Sefali Main Desk" },
  { id: 28, company: "SEFALI", employee: "Dilip Mandal", timestamp: "2026-06-01 09:15:30", status: "IN", location: "Sefali Yard Gate" },
  { id: 29, company: "SEFALI", employee: "Gita Rani", timestamp: "2026-06-01 09:22:11", status: "IN", location: "Sefali Main Desk" },
  { id: 30, company: "SEFALI", employee: "Haren Bag", timestamp: "2026-06-01 09:28:45", status: "IN", location: "Sefali Yard Gate" },
  { id: 31, company: "SEFALI", employee: "Indrajit Ray", timestamp: "2026-06-01 08:45:12", status: "IN", location: "Sefali Main Desk" },
  { id: 32, company: "SEFALI", employee: "Pradip Roy", timestamp: "2026-06-01 09:12:34", status: "IN", location: "Sefali Workshop B" },
  { id: 33, company: "SEFALI", employee: "Pradip Roy", timestamp: "2026-06-01 18:45:00", status: "OUT", location: "Sefali Main Desk" },
  { id: 34, company: "SEFALI", employee: "Joydev Pal", timestamp: "2026-06-01 09:38:22", status: "IN", location: "Sefali Main Desk" }, // LATE
  { id: 35, company: "SEFALI", employee: "Karuna Bag", timestamp: "2026-06-01 09:55:00", status: "IN", location: "Sefali Workshop A" }, // LATE
  { id: 36, company: "SEFALI", employee: "Laxmi Garai", timestamp: "2026-06-01 10:10:15", status: "IN", location: "Sefali Yard Gate" }, // LATE
  { id: 37, company: "SEFALI", employee: "Naba Maiti", timestamp: "2026-06-01 10:45:30", status: "IN", location: "Sefali workshop B" }, // LATE
  { id: 38, company: "SEFALI", employee: "Osman Goni", timestamp: "2026-06-01 11:15:02", status: "IN", location: "Sefali Main Desk" }, // LATE

  // BHANGAKUTHI checks (5 present -> 5 logs)
  { id: 39, company: "BHANGAKUTHI", employee: "Ramkrishna Pal", timestamp: "2026-06-01 08:15:00", status: "IN", location: "Bhangakuthi Main Gate" },
  { id: 40, company: "BHANGAKUTHI", employee: "Shyamal Roy", timestamp: "2026-06-01 08:40:00", status: "IN", location: "Bhangakuthi Main Gate" },
  { id: 41, company: "BHANGAKUTHI", employee: "Tarun Ghosh", timestamp: "2026-06-01 09:10:00", status: "IN", location: "Bhangakuthi Office" },
  { id: 42, company: "BHANGAKUTHI", employee: "Uttam Majhi", timestamp: "2026-06-01 08:55:00", status: "IN", location: "Bhangakuthi Office" },
  { id: 43, company: "BHANGAKUTHI", employee: "Biswajit Dey", timestamp: "2026-06-01 09:20:00", status: "IN", location: "Bhangakuthi Main Gate" }
];

let employeesList = [...LOCAL_EMPLOYEES];
let attendanceLogs = [...LOCAL_ATTENDANCE_LOGS];

// API: System Connection Info
app.get("/api/status", async (req, res) => {
  if (!supabase) {
    return res.json({
      connected: false,
      message: "Supabase keys are missing in env variables.",
      mode: "Demo/Fallback Memory Mode",
      url: SUPABASE_URL
    });
  }
  
  try {
    // Try doing a quick ping to employee_master
    const { error } = await supabase.from("employee_master").select("id").limit(1);
    if (error) {
      return res.json({
        connected: false,
        error: error.message,
        message: "Supabase keys present, but employee_master table test failed. Make sure to run SQL setup script.",
        mode: "Demo/Fallback Memory Mode",
        url: SUPABASE_URL
      });
    }
    return res.json({
      connected: true,
      message: "Fully connected to Supabase Database!",
      mode: "Live Supabase Mode",
      url: SUPABASE_URL
    });
  } catch (err: any) {
    return res.json({
      connected: false,
      error: err.message,
      message: "Failed connecting to Supabase database server.",
      mode: "Demo/Fallback Memory Mode",
      url: SUPABASE_URL
    });
  }
});

// API: Get all employees
app.get("/api/employees", async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("employee_master")
        .select("*")
        .order("company_name", { ascending: true })
        .order("employee_name", { ascending: true });
        
      if (!error && data && data.length > 0) {
        return res.json({ source: "supabase", data });
      }
    } catch (e) {
      console.warn("Supabase employees fetch error, falling back:", e);
    }
  }
  
  return res.json({ source: "memory", data: employeesList });
});

// API: Add an employee
app.post("/api/employees", async (req, res) => {
  const { company_name, employee_name } = req.body;
  if (!company_name || !employee_name) {
    return res.status(400).json({ error: "company_name and employee_name are required." });
  }

  const cleanCompany = company_name.trim();
  const cleanEmployee = employee_name.trim();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("employee_master")
        .insert([{ company_name: cleanCompany, employee_name: cleanEmployee }])
        .select();

      if (!error) {
        return res.status(201).json({ source: "supabase", data: data?.[0] });
      } else {
        // Handle unique constraint error or other errors
        console.warn("Supabase employee insert error:", error);
        return res.status(500).json({ error: error.message });
      }
    } catch (e: any) {
      console.warn("Exception during employee insert:", e);
      return res.status(500).json({ error: e.message });
    }
  }

  // Backup In-Memory Addition
  const newEmp = {
    id: employeesList.length ? Math.max(...employeesList.map(e => e.id)) + 1 : 1,
    company_name: cleanCompany,
    employee_name: cleanEmployee,
    created_at: new Date().toISOString()
  };
  employeesList.push(newEmp);
  return res.status(201).json({ source: "memory", data: newEmp });
});

// API: Update an employee
app.put("/api/employees/:id", async (req, res) => {
  const { id } = req.params;
  const { company_name, employee_name } = req.body;
  if (!company_name || !employee_name) {
    return res.status(400).json({ error: "company_name and employee_name are required." });
  }

  const cleanCompany = company_name.trim();
  const cleanEmployee = employee_name.trim();
  const numericId = parseInt(id, 10);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("employee_master")
        .update({ company_name: cleanCompany, employee_name: cleanEmployee })
        .eq("id", numericId)
        .select();

      if (!error) {
        return res.json({ source: "supabase", data: data?.[0] });
      } else {
        console.warn("Supabase employee update error:", error);
        return res.status(500).json({ error: error.message });
      }
    } catch (e: any) {
      console.warn("Exception during employee update:", e);
      return res.status(500).json({ error: e.message });
    }
  }

  // Backup In-Memory Update
  const index = employeesList.findIndex(e => e.id === numericId);
  if (index !== -1) {
    employeesList[index] = {
      ...employeesList[index],
      company_name: cleanCompany,
      employee_name: cleanEmployee
    };
    return res.json({ source: "memory", data: employeesList[index] });
  }

  return res.status(404).json({ error: "Employee not found." });
});

// API: Delete (Remove) an employee
app.delete("/api/employees/:id", async (req, res) => {
  const { id } = req.params;
  const numericId = parseInt(id, 10);

  if (supabase) {
    try {
      const { error } = await supabase
        .from("employee_master")
        .delete()
        .eq("id", numericId);

      if (!error) {
        return res.json({ source: "supabase", success: true });
      } else {
        console.warn("Supabase employee delete error:", error);
        return res.status(500).json({ error: error.message });
      }
    } catch (e: any) {
      console.warn("Exception during employee delete:", e);
      return res.status(500).json({ error: e.message });
    }
  }

  // Backup In-Memory Delete
  const index = employeesList.findIndex(e => e.id === numericId);
  if (index !== -1) {
    const deleted = employeesList.splice(index, 1);
    return res.json({ source: "memory", success: true, deleted: deleted[0] });
  }

  return res.status(404).json({ error: "Employee not found." });
});

// API: Get all attendance logs
app.get("/api/attendance", async (req, res) => {
  if (supabase) {
    try {
      // First try to fetch from the view created by the user script
      const { data, error } = await supabase
        .from("all_attendance_logs")
        .select("*")
        .order("timestamp", { ascending: false });

      if (!error && data && data.length > 0) {
        return res.json({ source: "supabase", data });
      }
      
      // If view failed or empty, try fetching from individual company tables in parallel
      const companies = ["BHANGAKUTHI", "HB", "HB-TP", "HBPL", "SEFALI"];
      const promises = companies.map(async (co) => {
        const { data: coData, error: coErr } = await supabase
          .from(co)
          .select("*")
          .limit(100);
        return { data: coData || [], error: coErr };
      });
      
      const results = await Promise.all(promises);
      const combined: any[] = [];
      results.forEach(res => {
        combined.push(...res.data);
      });
      
      if (combined.length > 0) {
        // Sort by timestamp descending
        combined.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
        return res.json({ source: "supabase_individual_tables", data: combined });
      }
    } catch (e) {
      console.warn("Attendance log fetch failed from Supabase, returning memory fallback:", e);
    }
  }

  return res.json({ source: "memory", data: attendanceLogs });
});

// API: Record attendance log
app.post("/api/attendance", async (req, res) => {
  const { company, employee, timestamp, status, location } = req.body;
  if (!company || !employee || !timestamp || !status) {
    return res.status(400).json({ error: "company, employee, timestamp, and status are required." });
  }

  // Normalize status value
  const finalStatus = status.trim().toUpperCase() === "IN" ? "IN" : "OUT";
  const finalLocation = location ? location.trim() : "Main Office";

  if (supabase) {
    try {
      // Choose table dynamically: BHANGAKUTHI, HB, HB-TP, HBPL, SEFALI
      // Standardize company name mapping to exact SQL table names
      const validTables = ["BHANGAKUTHI", "HB", "HB-TP", "HBPL", "SEFALI"];
      let matchedTable = validTables.find(t => t.toUpperCase() === company.trim().toUpperCase());
      
      if (!matchedTable) {
        // Handle minor naming mismatch for HB-TP or HBPL
        if (company.trim().replace("-", "").toUpperCase() === "HBTP") matchedTable = "HB-TP";
        else if (company.trim().toUpperCase() === "HB-PL") matchedTable = "HBPL"; // Map secondary naming HB-PL to HBPL
        else matchedTable = company.trim();
      }

      console.log(`Routing attendance to Supabase table: "${matchedTable}"`);

      // Save exact India date format (Y-M-D H:M:S) or standard timestamp format
      const dbTimestamp = timestamp;

      const { data, error } = await supabase
        .from(matchedTable)
        .insert([{
          company: company.trim(),
          employee: employee.trim(),
          timestamp: dbTimestamp,
          status: finalStatus,
          location: finalLocation
        }])
        .select();

      if (!error) {
        return res.status(201).json({ source: "supabase", data: data?.[0] });
      } else {
        console.error(`Supabase table insert error for ${matchedTable}:`, error);
        return res.status(500).json({ error: `Supabase database error: ${error.message}` });
      }
    } catch (e: any) {
      console.error("Exception during attendance insert:", e);
      return res.status(500).json({ error: e.message });
    }
  }

  // Backup In-Memory Log Capture
  const newLog = {
    id: attendanceLogs.length ? Math.max(...attendanceLogs.map(l => l.id || 0)) + 1 : 1,
    company: company.trim(),
    employee: employee.trim(),
    timestamp,
    status: finalStatus,
    location: finalLocation
  };
  attendanceLogs.unshift(newLog);
  return res.status(201).json({ source: "memory", data: newLog });
});

// API: Clear Logs/Database helper
app.post("/api/reset", (req, res) => {
  employeesList = [...LOCAL_EMPLOYEES];
  attendanceLogs = [...LOCAL_ATTENDANCE_LOGS];
  return res.json({ message: "In-memory fallback database resets successfully." });
});

// API: Seeding Supabase database helper
app.post("/api/seed", async (req, res) => {
  if (!supabase) {
    return res.status(400).json({ error: "Cannot seed: Supabase is not configured." });
  }

  const results: any = { employees: [], logs: [] };

  try {
    // 1. Seed employee_master
    console.log("Seeding employee_master...");
    const { error: empErr } = await supabase
      .from("employee_master")
      .upsert(LOCAL_EMPLOYEES.map(e => ({
        company_name: e.company_name,
        employee_name: e.employee_name
      })), { onConflict: "company_name,employee_name" });

    if (empErr) {
      results.empError = empErr.message;
    } else {
      results.employees = "Roster created inside employee_master table successfully.";
    }

    // 2. Clear out log tables or push fresh entries. We insert sample logs directly to tables.
    console.log("Seeding logs to specific tables...");
    const groupedLogsByCompany: Record<string, typeof LOCAL_ATTENDANCE_LOGS> = {};
    LOCAL_ATTENDANCE_LOGS.forEach(log => {
      const co = log.company;
      if (!groupedLogsByCompany[co]) groupedLogsByCompany[co] = [];
      groupedLogsByCompany[co].push(log);
    });

    for (const [coName, logs] of Object.entries(groupedLogsByCompany)) {
      // Find the right table name
      let tableName = coName;
      if (coName === "HB-TP") tableName = "HB-TP";
      const { error: logErr } = await supabase
        .from(tableName)
        .upsert(logs.map(l => ({
          company: l.company,
          employee: l.employee,
          timestamp: l.timestamp,
          status: l.status,
          location: l.location
        })));
      
      if (logErr) {
        if (!results.logErrors) results.logErrors = [];
        results.logErrors.push({ company: coName, error: logErr.message });
      } else {
        results.logs.push(`Successfully seeded ${logs.length} logs for ${coName} table.`);
      }
    }

    return res.json({ success: true, results });
  } catch (err: any) {
    console.error("Seeding error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Start developer server or bind assets
async function init() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server launched and ready on http://localhost:${PORT}`);
  });
}

init();
