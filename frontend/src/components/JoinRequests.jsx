// JoinRequests renders directly from the socket `joinRequests` array.
// No DB re-fetch needed — the socket payload has everything we need.
// Shape of each item: { roomId, roomName, username }
// We need req.id and req.user_id only when responding — so we fetch those
// from the DB only at the moment the admin clicks accept/reject.

import { apiFetch } from "../lib/api";

export default function JoinRequests({ joinRequests, token, onRespond, onClear }) {
  if (!joinRequests || joinRequests.length === 0) return null;

  const handleRespond = async (req, action) => {
    try {
      // Fetch the actual request ID and user_id from DB right now
      const data = await apiFetch(`/api/rooms/${req.roomId}/requests`, "GET", null, token);
      const match = data.requests.find((r) => r.username === req.username);
      if (!match) {
        console.warn("Could not find request in DB for", req.username);
        onClear(req.roomId);
        return;
      }
      await onRespond(match.id, action, match.user_id, req.roomId, req.roomName);
      onClear(req.roomId);
    } catch (err) {
      console.error("handleRespond error:", err.message);
    }
  };

  return (
    <div style={{
      margin: "8px 12px",
      background: "rgba(79,142,247,0.07)",
      border: "1px solid rgba(79,142,247,0.2)",
      borderRadius: 10, overflow: "hidden",
    }}>
      <div style={{
        padding: "8px 12px", fontSize: 11, fontWeight: 600,
        color: "var(--accent)", textTransform: "uppercase",
        letterSpacing: "0.6px",
        borderBottom: "1px solid rgba(79,142,247,0.15)",
      }}>
        🔔 Join Requests ({joinRequests.length})
      </div>

      {joinRequests.map((req, i) => (
        <div key={`${req.roomId}-${req.username}-${i}`} style={{
          padding: "10px 12px",
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 8,
          borderBottom: "1px solid rgba(79,142,247,0.08)",
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{req.username}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              wants to join #{req.roomName}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => handleRespond(req, "accept")}
              style={{
                padding: "4px 10px", fontSize: 12, border: "none",
                borderRadius: 6, background: "var(--green)",
                color: "#fff", cursor: "pointer", fontWeight: 500,
              }}
            >✓</button>
            <button
              onClick={() => handleRespond(req, "reject")}
              style={{
                padding: "4px 10px", fontSize: 12, border: "none",
                borderRadius: 6, background: "rgba(247,111,111,0.15)",
                color: "var(--red)", cursor: "pointer", fontWeight: 500,
              }}
            >✗</button>
          </div>
        </div>
      ))}
    </div>
  );
}