import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE } from "../lib/api";

export function useSocket(token, onRoomAccepted, onRoomDeleted) {
  const socketRef         = useRef(null);
  const [socketReady,     setSocketReady]  = useState(false);
  const [messages,        setMessages]     = useState([]);
  const [typing,          setTyping]       = useState("");
  const [joinRequests,    setJoinRequests] = useState([]);
  const typingTimer       = useRef(null);
  const pendingRoom       = useRef(null);
  const onRoomAcceptedRef = useRef(onRoomAccepted);
  const onRoomDeletedRef  = useRef(onRoomDeleted);
  useEffect(() => { onRoomAcceptedRef.current = onRoomAccepted; }, [onRoomAccepted]);
  useEffect(() => { onRoomDeletedRef.current  = onRoomDeleted;  }, [onRoomDeleted]);

  useEffect(() => {
    if (!token) return;
    console.log("[socket] connecting to", API_BASE);

    const s = io(API_BASE, { auth: { token } });

    s.on("connect", () => {
      console.log("[socket] connected:", s.id);
      socketRef.current = s;
      setSocketReady(true);
      if (pendingRoom.current) {
        s.emit("join_room", { roomId: pendingRoom.current });
        pendingRoom.current = null;
      }
    });

    s.on("connect_error", (err) => console.error("[socket] connect_error:", err.message));
    s.on("disconnect",    (r)   => { console.log("[socket] disconnected:", r); setSocketReady(false); });

    s.on("new_message", (msg) => {
      console.log("[socket] new_message:", msg);
      setMessages((prev) => [...prev, msg]);
    });

    s.on("user_typing", ({ username }) => {
      setTyping(`${username} is typing…`);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(""), 2000);
    });
    s.on("user_stop_typing", () => setTyping(""));

    s.on("new_join_request", (data) => {
      console.log("[socket] new_join_request received:", data);
      setJoinRequests((prev) => [...prev, data]);
    });

    s.on("join_request_response", ({ roomName, action }) => {
      console.log("[socket] join_request_response:", action, roomName);
      if (action === "accept") {
        onRoomAcceptedRef.current?.();
      } else {
        alert(`✗ Your request to join #${roomName} was rejected.`);
      }
    });

    // admin deleted a room — remove it from everyone's UI in real time
    s.on("room_removed", ({ roomId }) => {
      console.log("[socket] room_removed:", roomId);
      onRoomDeletedRef.current?.(roomId);
    });

    s.on("socket_error", ({ message }) => console.error("[socket] server error:", message));

    socketRef.current = s;
    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocketReady(false);
    };
  }, [token]);

  const joinRoom = (roomId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("join_room", { roomId });
    } else {
      pendingRoom.current = roomId;
    }
  };

  const sendMessage = (roomId, content) => {
    if (!content.trim() || !socketRef.current?.connected) return;
    socketRef.current.emit("send_message", { roomId, content: content.trim() });
    socketRef.current.emit("stop_typing", { roomId });
  };

  const emitTyping = (roomId) => {
    socketRef.current?.emit("typing", { roomId });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit("stop_typing", { roomId });
    }, 1500);
  };

  const notifyAdmin = (roomId, roomName) =>
    socketRef.current?.emit("join_request_notify", { roomId, roomName });

  const notifyUser = (userId, roomId, roomName, action) =>
    socketRef.current?.emit("request_responded", { userId, roomId, roomName, action });

  const clearJoinRequest = (roomId) =>
    setJoinRequests((prev) => prev.filter((r) => r.roomId !== roomId));

  const disconnect = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
  };

  const notifyRoomDeleted = (roomId) =>
    socketRef.current?.emit("room_deleted", { roomId });

  return {
    socketReady,
    messages, setMessages, typing,
    joinRequests, clearJoinRequest,
    joinRoom, sendMessage, emitTyping,
    notifyAdmin, notifyUser, notifyRoomDeleted, disconnect,
  };
}