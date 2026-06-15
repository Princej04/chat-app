# chat.app — Real-Time Chat Application

A full-stack real-time chat application built from scratch, featuring JWT authentication, private rooms with admin approval, and instant messaging via WebSockets.

🔗 **Live Demo:** [chat-app-iota-rouge.vercel.app](https://chat-app-iota-rouge.vercel.app)

---

## Features

- **Authentication** — Register and login with JWT-based auth. Passwords hashed with bcrypt. Tokens expire after 7 days.
- **Room Management** — Create rooms with unique IDs. Each room has an admin who controls membership.
- **Join Request Flow** — Users search for rooms by name or ID and send a join request. Admin receives a real-time notification and can accept or reject it.
- **Real-Time Messaging** — Messages appear instantly for all members via WebSockets. No page refresh needed.
- **Typing Indicators** — Users see when someone else is typing in real time.
- **Room Deletion** — Admin can delete a room. All members are notified and the room disappears from their sidebar instantly.
- **Leave Room** — Members can leave any room they've joined.
- **Message History** — Previous messages load when you open a room.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React Frontend                        │
│                    (Vercel — Static CDN)                     │
│                                                             │
│  AuthScreen  │  Sidebar  │  ChatWindow  │  JoinRequests     │
│                                                             │
│  useSocket.js ──── socket.io-client ────────────────────┐  │
│  useRooms.js  ──── REST fetch ──────────────────────┐   │  │
└──────────────────────────────────────────────────────│───│──┘
                                                       │   │
                                    HTTP/REST          │   │  WebSocket
                                                       ▼   ▼
┌─────────────────────────────────────────────────────────────┐
│                      Node.js Backend                         │
│                   (Render — Web Service)                     │
│                                                             │
│  Express REST API          Socket.io Server                 │
│  ┌─────────────────┐      ┌──────────────────────────────┐  │
│  │ POST /auth/reg  │      │ join_room                    │  │
│  │ POST /auth/login│      │ send_message → broadcast     │  │
│  │ GET  /rooms     │      │ join_request_notify          │  │
│  │ POST /rooms     │      │ request_responded            │  │
│  │ GET  /rooms/    │      │ room_deleted → all members   │  │
│  │      search     │      │ typing / stop_typing         │  │
│  │ POST /rooms/    │      │                              │  │
│  │   :id/request  │      │ Personal channels:           │  │
│  │ POST /rooms/    │      │   user:<userId> for          │  │
│  │   requests/     │      │   targeted notifications     │  │
│  │   :id/respond  │      └──────────────────────────────┘  │
│  │ DELETE /rooms/  │                                        │
│  │   :id           │      JWT Middleware                    │
│  │ POST /rooms/    │      All routes protected except       │
│  │   :id/leave     │      /auth/register and /auth/login    │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                      │
│                  (Supabase — Free Tier)                      │
│                                                             │
│  users          rooms           room_members                │
│  ────────       ──────────      ─────────────               │
│  id (uuid)      id (uuid)       id (uuid)                   │
│  username       name            room_id → rooms             │
│  email          type            user_id → users             │
│  password_hash  created_by      role (admin/member)         │
│  avatar_url     created_at      joined_at                   │
│  created_at                                                 │
│                                                             │
│  messages           join_requests                           │
│  ──────────         ─────────────                           │
│  id (uuid)          id (uuid)                               │
│  room_id → rooms    room_id → rooms                         │
│  sender_id → users  user_id → users                         │
│  content            status (pending/accepted/rejected)      │
│  sent_at            created_at                              │
│  is_deleted                                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React + Vite | UI framework |
| Styling | Pure CSS with CSS variables | Dark theme design system |
| Real-time | Socket.io client | WebSocket connection |
| Backend | Node.js + Express | REST API server |
| WebSockets | Socket.io | Real-time event handling |
| Auth | JWT + bcrypt | Secure authentication |
| Database | PostgreSQL | Persistent data storage |
| DB Client | node-postgres (pg) | Database queries |
| Frontend Host | Vercel | Static site CDN |
| Backend Host | Render | Node.js web service |
| Database Host | Supabase | Managed PostgreSQL |

---

## Key Design Decisions

**WebSockets over HTTP polling** — Chat requires sub-second latency. HTTP polling would hammer the server with requests every few seconds. WebSockets maintain a persistent connection so messages are pushed instantly.

**JWT middleware** — Authentication is stateless. The server doesn't store sessions — it verifies the token signature on every request. This makes the backend horizontally scalable.

**Personal socket channels** — Each user joins a `user:<userId>` socket room on connect. This allows targeted notifications (join requests, room deletions) to reach specific users regardless of which chat room they're viewing.

**UUID primary keys** — UUIDs instead of sequential integers prevent enumeration attacks (guessing IDs) and make the system easier to scale across multiple databases.

**ON DELETE CASCADE** — Deleting a room automatically removes all its messages, members, and join requests. No orphaned data, enforced at the database level.

**Soft delete on messages** — The `is_deleted` boolean lets admins remove message content while preserving the message record. The row stays, the content is replaced with "This message was deleted."

**Stale closure fix with refs** — React's `useEffect` closes over state values at the time of render. Socket event callbacks that need current state (like `activeRoom` when a room is deleted) use `useRef` to always access the latest value.

---

## Real-Time Event Flow

### Sending a message
```
User types → ChatWindow → onSend()
  → socket.emit('send_message', { roomId, content })
  → Backend: INSERT INTO messages
  → io.to(roomId).emit('new_message', message)
  → All members in that room receive it instantly
```

### Join request flow
```
User2 clicks Request → POST /api/rooms/:id/request
  → Backend saves join_request with status 'pending'
  → socket.emit('join_request_notify', { roomId })
  → Backend: SELECT admin FROM room_members WHERE role = 'admin'
  → io.to('user:<adminId>').emit('new_join_request')
  → Admin's JoinRequests panel appears in real time

Admin clicks ✓ → POST /api/rooms/requests/:id/respond
  → Backend: INSERT INTO room_members, UPDATE join_requests
  → socket.emit('request_responded', { userId, action: 'accept' })
  → io.to('user:<userId>').emit('join_request_response')
  → User2's loadRooms() fires → new room appears in sidebar
```

### Room deletion
```
Admin deletes room → notifyRoomDeleted(roomId)
  → socket.emit('room_deleted', { roomId })
  → Backend: SELECT all members FROM room_members
  → io.to('user:<each_member_id>').emit('room_removed')
  → Every member's sidebar updates instantly
  → DELETE FROM rooms (cascade removes everything)
```

---

## Project Structure

```
chat-app/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js              # PostgreSQL connection pool
│   │   ├── middleware/
│   │   │   └── auth.js            # JWT verification middleware
│   │   ├── routes/
│   │   │   ├── auth.js            # Register + login endpoints
│   │   │   ├── rooms.js           # Room CRUD + join request flow
│   │   │   └── messages.js        # Fetch message history
│   │   ├── socket.js              # All Socket.io event handlers
│   │   └── index.js               # Express app entry point
│   ├── database/
│   │   └── schema.sql             # PostgreSQL table definitions
│   └── railway.toml               # Railway deployment config
│
└── frontend/
    └── src/
        ├── lib/
        │   ├── api.js             # All fetch() calls centralised
        │   └── utils.js           # initials(), timeStr() helpers
        ├── hooks/
        │   ├── useSocket.js       # Socket.io connection + events
        │   └── useRooms.js        # Room state + API calls
        ├── screens/
        │   └── AuthScreen.jsx     # Login + Register UI
        ├── components/
        │   ├── Sidebar.jsx        # Room list + search + actions
        │   ├── ChatWindow.jsx     # Messages + input bar
        │   ├── MessageBubble.jsx  # Single message component
        │   ├── JoinRequests.jsx   # Admin notification panel
        │   └── EmptyState.jsx     # No room selected screen
        ├── styles/
        │   └── index.css          # Global dark theme styles
        └── App.jsx                # Root — wires hooks to components
```

---

## Run Locally

**Prerequisites:** Node.js 18+, PostgreSQL

```bash
# 1. Clone the repo
git clone https://github.com/Princej04/chat-app.git
cd chat-app

# 2. Set up the database
psql -U postgres
CREATE DATABASE chatapp;
\c chatapp
# paste contents of backend/database/schema.sql
\q

# 3. Configure backend environment
cd backend
cp .env.example .env
# edit .env and fill in:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/chatapp
# JWT_SECRET=your_secret_here
# PORT=3000

# 4. Start the backend
npm install
npm run dev

# 5. Start the frontend (new terminal)
cd ../frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deployment

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | [chat-app-iota-rouge.vercel.app](https://chat-app-iota-rouge.vercel.app) |
| Backend | Render | [chat-app-backend.onrender.com](https://chat-app-backend.onrender.com) |
| Database | Supabase | Managed PostgreSQL |

---

## What I Learned

- Designing a relational database schema with foreign keys, cascades, and unique constraints
- Building a JWT authentication system from scratch without any auth libraries
- The difference between REST and WebSockets, and when to use each
- How Socket.io rooms work for broadcasting to specific groups of users
- The stale closure problem in React hooks and how refs solve it
- How to structure a Node.js project with separation of concerns (routes, middleware, socket handlers)
- Debugging real-time systems using console logs across frontend and backend simultaneously