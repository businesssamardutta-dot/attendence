import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zakajrrmzzybyptypjdt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha2FqcnJtenp5YnlwdHlwamR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODk4NzMsImV4cCI6MjA5NTg2NTg3M30.IrWQsa1s6kzgNzhoa-NXOtz9OUeKZcY2MF6e8Zp4LXU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Dynamically routes an attendance log to the correct company database table in Supabase
export async function insertAttendanceLog(log: {
  company: string;
  employee: string;
  timestamp: string;
  status: "IN" | "OUT";
  location: string;
}) {
  const company = log.company.trim();
  const validTables = ["BHANGAKUTHI", "HB", "HB-TP", "HBPL", "SEFALI"];
  let matchedTable = validTables.find(t => t.toUpperCase() === company.toUpperCase());
  
  if (!matchedTable) {
    if (company.replace("-", "").toUpperCase() === "HBTP") matchedTable = "HB-TP";
    else if (company.toUpperCase() === "HB-PL") matchedTable = "HBPL";
    else matchedTable = company;
  }

  const { data, error } = await supabase
    .from(matchedTable)
    .insert([{
      company: log.company,
      employee: log.employee,
      timestamp: log.timestamp,
      status: log.status,
      location: log.location
    }])
    .select();

  if (error) {
    throw error;
  }
  return data?.[0];
}

// Fetch all attendance logs by combining tables, or querying a combined view if available
export async function fetchAllAttendanceLogs() {
  try {
    // Try querying a combined view first
    const { data: viewData, error: viewError } = await supabase
      .from("all_attendance_logs")
      .select("*")
      .order("timestamp", { ascending: false });

    if (!viewError && viewData && viewData.length > 0) {
      return viewData;
    }
  } catch (e) {
    console.warn("View 'all_attendance_logs' read failed, falling back to parallel table fetch:", e);
  }

  // Parallel fetch fallback across individual company tables
  const companies = ["BHANGAKUTHI", "HB", "HB-TP", "HBPL", "SEFALI"];
  const promises = companies.map(async (co) => {
    const { data, error } = await supabase
      .from(co)
      .select("*")
      .limit(150);
    if (error) {
      console.error(`Error querying table ${co}:`, error);
      return [];
    }
    return data || [];
  });

  const results = await Promise.all(promises);
  const combined: any[] = [];
  results.forEach(res => {
    combined.push(...res);
  });

  // Sort combine results by timestamp descending
  combined.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return combined;
}

// Admin Utility: Deletes logs in company tables before 2026-04-01
export async function deleteLogsBeforeApril2026() {
  const companies = ["BHANGAKUTHI", "HB", "HB-TP", "HBPL", "SEFALI"];
  const purgePromises = companies.map(async (companyTable) => {
    const { data, error } = await supabase
      .from(companyTable)
      .delete()
      .lt("timestamp", "2026-04-01 00:00:00")
      .select(); // Fetch deleted rows to get exact count
    
    if (error) {
      console.error(`Error deleting from table ${companyTable}:`, error);
      throw error;
    }
    return { company: companyTable, deletedCount: data ? data.length : 0 };
  });

  return await Promise.all(purgePromises);
}

