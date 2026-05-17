import { useState, useEffect } from "react";
import Tooltip from "@mui/material/Tooltip";
import { checkHealth, exportCsv } from "../api/polls";

const CATS = [
  "All",
  "General",
  "Strategy",
  "Product",
  "Engineering",
  "Design",
  "Operations",
  "HR",
  "Marketing",
  "Finance",
];
const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "votes", label: "Most Voted" },
  { value: "unanswered", label: "Unanswered" },
];

export default function Header({ filters, setFilters, onNew, stats }) {
  const [aiEnabled, setAiEnabled] = useState(null);
  const [sseOk, setSseOk] = useState(false);

  useEffect(() => {
    checkHealth()
      .then((h) => setAiEnabled(h.aiEnabled))
      .catch(() => setAiEnabled(false));
    const es = new EventSource("/api/polls/stream");
    es.onmessage = () => setSseOk(true);
    const timer = setTimeout(() => es.close(), 3000);
    return () => {
      clearTimeout(timer);
      es.close();
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 glass border-b border-surface-600">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="text-xl font-bold font-mono tracking-tight">
            <span className="text-white">Flash</span>
            <span className="text-brand-500">Poll</span>
          </div>
          {sseOk && (
            <Tooltip title="Live updates active via SSE">
              <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </div>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-2">
          {aiEnabled !== null && (
            <Tooltip
              title={
                aiEnabled
                  ? "AI features active (Claude)"
                  : "AI Feautures Enabled"
              }
            >
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border cursor-default
                ${aiEnabled ? "text-violet-400 border-violet-800 bg-violet-950/50" : "text-gray-600 border-surface-500 bg-surface-700"}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${aiEnabled ? "bg-violet-400 animate-pulse" : "bg-gray-600"}`}
                />
                AI {aiEnabled ? "ON" : "OFF"}
              </div>
            </Tooltip>
          )}
          {stats && (
            <div className="hidden md:flex items-center gap-2 text-[11px] text-gray-600">
              <span>
                <strong className="text-gray-300">{stats.polls}</strong> polls
              </span>
              <span>/</span>
              <span>
                <strong className="text-gray-300">{stats.votes}</strong> votes
              </span>
            </div>
          )}
          <Tooltip title="Export all results as CSV">
            <button
              onClick={exportCsv}
              className="btn-ghost text-xs px-3 py-2 hidden sm:flex items-center gap-1.5"
            >
              CSV
            </button>
          </Tooltip>
          <button className="btn-primary" onClick={onNew}>
            + New Poll
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 pb-3 overflow-x-auto">
        <div className="flex rounded-lg border border-surface-500 overflow-hidden flex-shrink-0">
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilters((f) => ({ ...f, sort: s.value }))}
              className={`px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap transition-colors
                ${filters.sort === s.value ? "bg-brand-500 text-white" : "text-gray-600 hover:text-gray-300"}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-surface-500 flex-shrink-0" />

        {CATS.map((cat) => (
          <button
            key={cat}
            onClick={() =>
              setFilters((f) => ({ ...f, category: cat === "All" ? "" : cat }))
            }
            className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all
              ${
                filters.category === cat || (cat === "All" && !filters.category)
                  ? "bg-brand-500 text-white"
                  : "text-gray-600 hover:text-gray-300 hover:bg-surface-600"
              }`}
          >
            {cat}
          </button>
        ))}

        <div className="ml-auto flex-shrink-0">
          <input
            type="text"
            placeholder="Search..."
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value }))
            }
            className="bg-surface-700 border border-surface-500 rounded-lg px-3 py-1
                       text-xs text-gray-300 placeholder-gray-600 w-32
                       focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>
      </div>
    </header>
  );
}
