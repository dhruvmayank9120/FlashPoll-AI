import { useState, useEffect, useCallback } from "react";
import {
  getPolls,
  createPoll,
  updatePoll,
  votePoll,
  deletePoll,
  saveInsight,
  addComment,
  deleteComment,
} from "../api/polls";

export function usePolls() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    category: "",
    search: "",
    sort: "newest",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filters.category) params.category = filters.category;
      if (filters.search) params.search = filters.search;
      if (filters.sort) params.sort = filters.sort;
      setPolls(await getPolls(params));
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Failed to load polls");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  // SSE: live updates from server
  useEffect(() => {
    const es = new EventSource(
      import.meta.env.VITE_API_URL + "/api/polls/stream",
    );
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "POLL_UPDATED" && msg.poll) {
          setPolls((prev) => {
            const exists = prev.find((p) => p._id === msg.poll._id);
            if (exists)
              return prev.map((p) => (p._id === msg.poll._id ? msg.poll : p));
            return [msg.poll, ...prev];
          });
        }
        if (msg.type === "POLL_DELETED" && msg.pollId) {
          setPolls((prev) => prev.filter((p) => p._id !== msg.pollId));
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  const addPoll = async (data) => {
    const poll = await createPoll(data);
    setPolls((prev) => [poll, ...prev]);
    return poll;
  };

  const editPoll = async (id, data) => {
    const poll = await updatePoll(id, data);
    setPolls((prev) => prev.map((p) => (p._id === id ? poll : p)));
    return poll;
  };

  const vote = async (pollId, optionId) => {
    setPolls((prev) =>
      prev.map((p) =>
        p._id !== pollId
          ? p
          : {
              ...p,
              options: p.options.map((o) =>
                o._id === optionId ? { ...o, votes: o.votes + 1 } : o,
              ),
              totalVotes: p.totalVotes + 1,
            },
      ),
    );
    try {
      const updated = await votePoll(pollId, optionId);
      setPolls((prev) => prev.map((p) => (p._id !== pollId ? p : updated)));
      return updated;
    } catch (e) {
      setPolls((prev) =>
        prev.map((p) =>
          p._id !== pollId
            ? p
            : {
                ...p,
                options: p.options.map((o) =>
                  o._id === optionId ? { ...o, votes: o.votes - 1 } : o,
                ),
                totalVotes: p.totalVotes - 1,
              },
        ),
      );
      throw e;
    }
  };

  const removePoll = async (id) => {
    await deletePoll(id);
    setPolls((prev) => prev.filter((p) => p._id !== id));
  };

  const updateInsight = async (id, insight) => {
    const updated = await saveInsight(id, insight);
    setPolls((prev) => prev.map((p) => (p._id !== id ? p : updated)));
  };

  const postComment = async (pollId, text, author) => {
    const comment = await addComment(pollId, text, author);
    setPolls((prev) =>
      prev.map((p) =>
        p._id !== pollId
          ? p
          : { ...p, comments: [...(p.comments || []), comment] },
      ),
    );
    return comment;
  };

  const removeComment = async (pollId, commentId) => {
    await deleteComment(pollId, commentId);
    setPolls((prev) =>
      prev.map((p) =>
        p._id !== pollId
          ? p
          : {
              ...p,
              comments: (p.comments || []).filter((c) => c._id !== commentId),
            },
      ),
    );
  };

  return {
    polls,
    loading,
    error,
    filters,
    setFilters,
    addPoll,
    editPoll,
    vote,
    removePoll,
    updateInsight,
    postComment,
    removeComment,
    reload: load,
  };
}

export function useVoted() {
  const [voted, setVoted] = useState({});
  const markVoted = (pollId, optionId) => {
    const next = { ...voted, [pollId]: optionId };
    setVoted(next);
  };
  return [voted, markVoted];
}

// Countdown timer hook
export function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const ms = new Date(expiresAt) - Date.now();
      setRemaining(ms > 0 ? ms : 0);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (remaining === null) return null;
  if (remaining === 0) return "Expired";
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}
