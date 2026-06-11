import { initials, timeStr } from "../lib/utils";

export default function MessageBubble({ message, isOwn }) {
  return (
    <div className={`msg-group ${isOwn ? "own" : ""}`}>
      <div className="avatar">{initials(message.sender_name)}</div>
      <div className="msg-body">
        <div className="msg-sender">{message.sender_name}</div>
        <div className="msg-bubble">{message.content}</div>
        <div className="msg-time">{timeStr(message.sent_at)}</div>
      </div>
    </div>
  );
}