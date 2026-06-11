export const initials = (name = "") => name.slice(0, 2).toUpperCase();

export const timeStr = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });