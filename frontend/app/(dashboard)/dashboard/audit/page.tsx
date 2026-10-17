"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function AuditPage() {
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    api.get("/api/audit/reports").then((r) => setReports(r.data));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Audit Reports</h1>

      <div className="grid grid-cols-3 gap-6">
        {reports.map((r) => (
          <div key={r.file} className="bg-[#1a1a2e] border border-[#2d3748] rounded-xl p-5">
            <div className="font-mono text-sm truncate mb-2">{r.file}</div>
          </div>
        ))}
        {reports.length === 0 && (
          <div className="col-span-3 text-center text-gray-500 py-12">
            No audit reports yet. Run <code className="font-mono bg-[#0a0a1a] px-2 py-1 rounded">audit_suite.py</code>
          </div>
        )}
      </div>
    </div>
  );
}
