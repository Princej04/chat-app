import { useState, useEffect, useRef } from "react";
import { apiFetch } from "./lib/api";
import { useSocket } from "./hooks/useSocket";
import { useRooms }  from "./hooks/useRooms";

import AuthScreen  from "./screens/AuthScreen";
import Sidebar     from "./components/Sidebar";
import ChatWindow  from "./components/ChatWindow";
import EmptyState  from "./components/EmptyState";

import "./styles/index.css";

export default function App() {
  const [user,       setUser]       = useState(null);
  const [token,      setToken]      = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const activeRoomRef    = useRef(null);
  const onRoomDeletedRef = useRef(null);

  // always keep ref in sync with state
  const setActiveRoomWithRef = (room) => {
    activeRoomRef.current = room;
    setActiveRoom(room);
  };

  const {
    rooms, searchResults,
    loadRooms, searchRooms,
    createRoom, requestJoin, respondToRequest,
    deleteRoom, leaveRoom, removeRoomLocally,
  } = useRooms(token);

  // assign deletion handler AFTER removeRoomLocally is available
  onRoomDeletedRef.current = (roomId) => {
    removeRoomLocally(roomId);
    if (activeRoomRef.current?.id === roomId) setActiveRoomWithRef(null);
  };

  const {
    socketReady,
    messages, setMessages, typing,
    joinRequests, clearJoinRequest,
    joinRoom, sendMessage, emitTyping,
    notifyAdmin, notifyUser, notifyRoomDeleted, disconnect,
  } = useSocket(
    token,
    loadRooms,                               // onRoomAccepted
    (roomId) => onRoomDeletedRef.current?.(roomId)  // onRoomDeleted — always current via ref
  );

  useEffect(() => { if (token) loadRooms(); }, [token]);

  useEffect(() => {
    if (activeRoom && socketReady) joinRoom(activeRoom.id);
  }, [activeRoom, socketReady]);

  const handleLogin = (u, t) => { setUser(u); setToken(t); };

  const handleSelectRoom = async (room) => {
    setActiveRoomWithRef(room);
    setMessages([]);
    try {
      const data = await apiFetch(`/api/messages/${room.id}`, "GET", null, token);
      setMessages(data.messages);
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleCreateRoom = async (name) => {
    const room = await createRoom(name);
    if (room) handleSelectRoom(room);
    return room;
  };

  const handleSearch = (q) => searchRooms(q);

  const handleRequestJoin = async (roomId) => {
    const result = await requestJoin(roomId);
    if (result) {
      notifyAdmin(roomId, result.meta?.room_name || "");
    }
  };

  const handleRespond = async (requestId, action, targetUserId, roomId, roomName) => {
    const result = await respondToRequest(requestId, action);
    if (result) {
      notifyUser(targetUserId, roomId, roomName, action);
      clearJoinRequest(roomId);
      loadRooms();
    }
  };

  const handleDeleteRoom = async (roomId) => {
    notifyRoomDeleted(roomId);   // broadcast to all members BEFORE deleting from DB
    const ok = await deleteRoom(roomId);
    if (ok && activeRoomRef.current?.id === roomId) setActiveRoomWithRef(null);
  };

  const handleLeaveRoom = async (roomId) => {
    const ok = await leaveRoom(roomId);
    if (ok && activeRoomRef.current?.id === roomId) setActiveRoomWithRef(null);
  };

  const handleLogout = () => {
    disconnect();
    setUser(null); setToken(null);
    setActiveRoomWithRef(null); setMessages([]);
  };

  if (!user) return <AuthScreen onLogin={handleLogin} />;

  return (
    <div className="app-layout">
      <Sidebar
        user={user}
        token={token}
        rooms={rooms}
        activeRoom={activeRoom}
        joinRequests={joinRequests}
        onClearRequest={clearJoinRequest}
        onSelectRoom={handleSelectRoom}
        onCreateRoom={handleCreateRoom}
        onSearch={handleSearch}
        onRequestJoin={handleRequestJoin}
        onRespond={handleRespond}
        onDeleteRoom={handleDeleteRoom}
        onLeaveRoom={handleLeaveRoom}
        onLogout={handleLogout}
      />
      <div className="chat-area">
        {activeRoom ? (
          <ChatWindow
            room={activeRoom}
            messages={messages}
            typing={typing}
            userId={user.id}
            onSend={(content) => sendMessage(activeRoom.id, content)}
            onTyping={() => emitTyping(activeRoom.id)}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}