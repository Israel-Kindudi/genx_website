"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function LivePage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    api.get("/api/live/sessions").then((r) => setSessions(r.data));
  }, []);

  useEffect(() => {
    if (selected) {
      api.get(`/api/live/sessions/${selected}`).then((r) => setDetails(r.data));
    }
  }, [selected]);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Live Sessions</h1>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 bg-[#1a1a2e] border border-[#2d3748] rounded-xl p-4 max-h-[600px] overflow-y-auto">
          <h2 className="font-semibold mb-4 text-gray-300">Sessions</h2>
          {sessions.map((s) => (
            <button
              key={s.session_id}
              onClick={() => setSelected(s.session_id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-2 transition-colors ${
                selected === s.session_id
                  ? "bg-[#00ff88]/10 text-[#00ff88]"
                  : "hover:bg-[#2d3748]/30 text-gray-400"
              }`}
            >
              <div className="font-mono text-xs truncate">{s.session_id}</div>
              <div className="text-xs">
                {s.trades} trades · ${s.pnl.toFixed(2)}
              </div>
            </button>
          ))}
        </div>

        <div className="col-span-2">
          {details ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <Metric label="Total Trades" value={details.trades.length.toString()} />
                <Metric
                  label="Closed"
                  value={details.trades.filter((t: any) => t.status === "closed").length.toString()}
                />
                <Metric
                  label="PnL"
                  value={`$${details.trades
                    .filter((t: any) => t.pnl)
                    .reduce((s: number, t: any) => s + t.pnl, 0)
                    .toFixed(2)}`}
                />
              </div>

              <div className="bg-[#1a1a2e] border border-[#2d3748] rounded-xl p-4 max-h-[400px] overflow-y-auto">
                <h2 className="font-semibold mb-4 text-gray-300">Trades</h2>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-[#2d3748]">
                      <th className="py-2">Strategy</th>
                      <th>Symbol</th>
                      <th>Action</th>
                      <th className="text-right">Entry</th>
                      <th className="text-right">PnL</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.trades.slice(0, 50).map((t: any, i: number) => (
                      <tr key={i} className="border-b border-[#2d3748]/50">
                        <td className="py-1.5 truncate max-w-[140px]">{t.strategy}</td>
                        <td>{t.symbol}</td>
                        <td className={t.action === "BUY" ? "text-[#00ff88]" : "text-red-400"}>
                          {t.action}
                        </td>
                        <td className="text-right">{t.entry_price?.toFixed(2)}</td>
                        <td className={`text-right ${(t.pnl || 0) >= 0 ? "text-[#00ff88]" : "text-red-400"}`}>
                          {t.pnl != null ? `$${t.pnl.toFixed(2)}` : "—"}
                        </td>
                        <td className="text-gray-400">{t.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a session to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1a1a2e] border border-[#2d3748] rounded-xl p-4">
      <div className="text-xl font-bold gradient-text">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}