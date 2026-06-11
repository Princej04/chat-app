import { useState, useEffect, useRef } from "react";
import { initials } from "../lib/utils";
import JoinRequests from "./JoinRequests";

export default function Sidebar({
  user, rooms, activeRoom, token,
  joinRequests, onClearRequest,
  onSelectRoom, onCreateRoom,
  onSearch, onRequestJoin,
  onRespond, onDeleteRoom, onLeaveRoom,
  onLogout,
}) {
  const [showCreate,  setShowCreate]  = useState(false);
  const [newRoom,     setNewRoom]     = useState("");
  const [showSearch,  setShowSearch]  = useState(false);
  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [copied,      setCopied]      = useState(null);
  const [expanded,    setExpanded]    = useState(null);
  const prevRoomIds   = useRef(new Set(rooms.map((r) => r.id)));

  // When a new room appears in the rooms list (user got accepted),
  // remove it from search results so "Pending…" disappears
  useEffect(() => {
    const currentIds = new Set(rooms.map((r) => r.id));
    const added = rooms.filter((r) => !prevRoomIds.current.has(r.id));
    if (added.length > 0) {
      setResults((prev) =>
        prev.map((r) =>
          added.find((a) => a.id === r.id)
            ? { ...r, is_member: true, has_pending: false }
            : r
        )
      );
    }
    prevRoomIds.current = currentIds;
  }, [rooms]);

  // ── create room ──
  const handleCreate = async () => {
    if (!newRoom.trim()) return;
    const room = await onCreateRoom(newRoom);
    if (room) { setNewRoom(""); setShowCreate(false); }
  };

  // ── search ──
  const handleSearch = async (e) => {
    const q = e.target.value;
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    const data = await onSearch(q);
    setResults(data || []);
    setSearching(false);
  };

  // ── request to join — update local results immediately ──
  const handleRequest = async (roomId) => {
    await onRequestJoin(roomId);
    setResults((prev) =>
      prev.map((r) => r.id === roomId ? { ...r, has_pending: true } : r)
    );
  };

  // ── copy room id ──
  const handleCopy = (id) => {
    navigator.clipboard.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── delete (admin) ──
  const handleDelete = async (e, roomId) => {
    e.stopPropagation();
    if (!window.confirm("Delete this room? This cannot be undone.")) return;
    await onDeleteRoom(roomId);
    if (expanded === roomId) setExpanded(null);
  };

  // ── leave (member) ──
  const handleLeave = async (e, roomId) => {
    e.stopPropagation();
    if (!window.confirm("Leave this room?")) return;
    await onLeaveRoom(roomId);
    if (expanded === roomId) setExpanded(null);
  };

  return (
    <div className="sidebar">

      {/* ── Header ── */}
      <div className="sidebar-header">
        <div className="sidebar-logo">chat<span>.</span>app</div>
        <div className="user-pill">
          <div className="avatar">{initials(user.username)}</div>
          <span>{user.username}</span>
        </div>
      </div>

      {/* ── Join request notifications (admin only) ── */}
      <JoinRequests
        token={token}
        joinRequests={joinRequests}
        onRespond={onRespond}
        onClear={onClearRequest}
      />

      {/* ── Search / Find a room ── */}
      <div className="rooms-section">
        <div className="rooms-label">
          Find a Room
          <button className="icon-btn" onClick={() => {
            setShowSearch((v) => !v);
            setResults([]); setQuery("");
          }}>
            {showSearch ? "−" : "🔍"}
          </button>
        </div>

        {showSearch && (
          <div style={{ paddingBottom: 8 }}>
            <input
              style={{
                width: "100%", padding: "8px 12px", marginBottom: 6,
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 8, color: "var(--text)",
                fontFamily: "var(--font)", fontSize: 13, outline: "none",
              }}
              placeholder="Name or full room ID…"
              value={query}
              onChange={handleSearch}
              autoFocus
            />

            {searching && (
              <div style={{ fontSize: 12, color: "var(--muted)", padding: "4px" }}>
                Searching…
              </div>
            )}

            {!searching && query.trim() && results.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--muted)", padding: "4px" }}>
                No rooms found
              </div>
            )}

            {results.map((room) => (
              <div key={room.id} style={{
                padding: "8px 4px", borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 8,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>#{room.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {room.member_count} member{room.member_count !== "1" ? "s" : ""}
                  </div>
                </div>

                {room.is_member ? (
                  <span style={{ fontSize: 11, color: "var(--green)", flexShrink: 0 }}>
                    Joined ✓
                  </span>
                ) : room.has_pending ? (
                  <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>
                    Pending…
                  </span>
                ) : (
                  <button
                    className="btn-sm"
                    style={{ padding: "4px 10px", fontSize: 12, flexShrink: 0 }}
                    onClick={() => handleRequest(room.id)}
                  >
                    Request
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── My rooms ── */}
      <div className="rooms-section" style={{ borderTop: "1px solid var(--border)", paddingTop: 16, flex: 1, overflowY: "auto" }}>
        <div className="rooms-label">
          My Rooms
          <button className="icon-btn" onClick={() => setShowCreate((v) => !v)}>+</button>
        </div>

        {showCreate && (
          <div className="new-room-form">
            <input
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="room-name"
              autoFocus
            />
            <button className="btn-sm" onClick={handleCreate}>Create</button>
          </div>
        )}

        {rooms.length === 0 && (
          <div style={{ padding: "12px 10px", fontSize: 13, color: "var(--muted)" }}>
            No rooms yet — create one!
          </div>
        )}

        {rooms.map((room) => (
          <div key={room.id}>
            {/* Room row */}
            <div
              className={`room-item ${activeRoom?.id === room.id ? "active" : ""}`}
              onClick={() => onSelectRoom(room)}
            >
              <span className="room-hash">#</span>
              <span style={{ flex: 1 }}>{room.name}</span>

              {room.role === "admin" && (
                <span style={{
                  fontSize: 10, color: "var(--accent)",
                  background: "rgba(79,142,247,0.12)",
                  padding: "2px 6px", borderRadius: 4, flexShrink: 0,
                }}>
                  admin
                </span>
              )}

              <button
                className="icon-btn"
                style={{ marginLeft: 4, fontSize: 10 }}
                onClick={(e) => { e.stopPropagation(); setExpanded((p) => p === room.id ? null : room.id); }}
                title="Room options"
              >
                {expanded === room.id ? "▲" : "▼"}
              </button>
            </div>

            {/* Expanded panel: ID + actions */}
            {expanded === room.id && (
              <div style={{
                margin: "0 6px 6px",
                padding: "10px 12px",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8, fontSize: 11,
              }}>
                <div style={{ color: "var(--muted)", marginBottom: 4 }}>Room ID</div>
                <div style={{
                  fontFamily: "var(--mono)", fontSize: 10,
                  color: "var(--text)", wordBreak: "break-all", marginBottom: 8,
                }}>
                  {room.id}
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  {/* Copy ID */}
                  <button
                    className="btn-sm"
                    style={{ flex: 1, padding: "5px", fontSize: 11 }}
                    onClick={() => handleCopy(room.id)}
                  >
                    {copied === room.id ? "Copied ✓" : "Copy ID"}
                  </button>

                  {/* Admin: delete */}
                  {room.role === "admin" && (
                    <button
                      style={{
                        flex: 1, padding: "5px", fontSize: 11, cursor: "pointer",
                        background: "rgba(247,111,111,0.1)", fontWeight: 500,
                        border: "1px solid rgba(247,111,111,0.3)",
                        color: "var(--red)", borderRadius: 6,
                      }}
                      onClick={(e) => handleDelete(e, room.id)}
                    >
                      Delete
                    </button>
                  )}

                  {/* Member: leave */}
                  {room.role !== "admin" && (
                    <button
                      style={{
                        flex: 1, padding: "5px", fontSize: 11, cursor: "pointer",
                        background: "rgba(247,162,79,0.1)", fontWeight: 500,
                        border: "1px solid rgba(247,162,79,0.3)",
                        color: "#f7a24f", borderRadius: 6,
                      }}
                      onClick={(e) => handleLeave(e, room.id)}
                    >
                      Leave
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={onLogout}>Sign out</button>
      </div>
    </div>
  );
}