import { useState } from "react";
import { apiFetch } from "../lib/api";

export function useRooms(token) {
  const [rooms,         setRooms]         = useState([]);
  const [searchResults, setSearchResults] = useState([]);

  const loadRooms = async () => {
    try {
      const data = await apiFetch("/api/rooms", "GET", null, token);
      setRooms(data.rooms);
    } catch (err) {
      console.error("loadRooms:", err.message);
    }
  };

  // returns the array directly so callers don't race with state
  const searchRooms = async (q) => {
    if (!q.trim()) { setSearchResults([]); return []; }
    try {
      const data = await apiFetch(
        `/api/rooms/search?q=${encodeURIComponent(q.trim())}`, "GET", null, token
      );
      setSearchResults(data.rooms);
      return data.rooms;
    } catch (err) {
      console.error("searchRooms:", err.message);
      return [];
    }
  };

  const createRoom = async (name) => {
    if (!name.trim()) return null;
    try {
      const data = await apiFetch("/api/rooms", "POST", { name: name.trim() }, token);
      setRooms((prev) => [data.room, ...prev]);
      return data.room;
    } catch (err) {
      console.error("createRoom:", err.message);
      return null;
    }
  };

  // returns { request, meta } so caller can notify admin via socket
  const requestJoin = async (roomId) => {
    try {
      const data = await apiFetch(`/api/rooms/${roomId}/request`, "POST", null, token);
      setSearchResults((prev) =>
        prev.map((r) => r.id === roomId ? { ...r, has_pending: true } : r)
      );
      return data;
    } catch (err) {
      console.error("requestJoin:", err.message);
      return null;
    }
  };

  const respondToRequest = async (requestId, action) => {
    try {
      return await apiFetch(
        `/api/rooms/requests/${requestId}/respond`, "POST", { action }, token
      );
    } catch (err) {
      console.error("respondToRequest:", err.message);
      return null;
    }
  };

  const deleteRoom = async (roomId) => {
    try {
      await apiFetch(`/api/rooms/${roomId}`, "DELETE", null, token);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      return true;
    } catch (err) {
      console.error("deleteRoom:", err.message);
      return false;
    }
  };

  const leaveRoom = async (roomId) => {
    try {
      await apiFetch(`/api/rooms/${roomId}/leave`, "POST", null, token);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      return true;
    } catch (err) {
      console.error("leaveRoom:", err.message);
      return false;
    }
  };

  // remove from local state only — used when server pushes a deletion event
  const removeRoomLocally = (roomId) =>
    setRooms((prev) => prev.filter((r) => r.id !== roomId));

  return {
    rooms, searchResults,
    loadRooms, searchRooms,
    createRoom, requestJoin, respondToRequest,
    deleteRoom, leaveRoom, removeRoomLocally,
  };
}