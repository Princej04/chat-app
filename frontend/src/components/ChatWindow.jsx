import { useRef, useEffect, useState } from "react";
import MessageBubble from "./MessageBubble";
import { initials } from "../lib/utils";

export default function ChatWindow({ room, messages, typing, userId, onSend, onTyping }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    setInput(e.target.value);
    onTyping();
  };

  return (
    <>
      {/* Header */}
      <div className="chat-header">
        <div className="avatar lg">{initials(room.name)}</div>
        <div>
          <div className="chat-header-name"># {room.name}</div>
          <div className="chat-header-sub">Real-time chat room</div>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-list">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.sender_id === userId}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      <div className="typing-indicator">{typing}</div>

      {/* Input bar */}
      <div className="chat-input-bar">
        <textarea
          className="chat-input"
          rows={1}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${room.name}`}
        />
        <button className="send-btn" onClick={handleSend} disabled={!input.trim()}>
          ↑
        </button>
      </div>
    </>
  );
}