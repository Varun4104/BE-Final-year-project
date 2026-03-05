# Collaboration (Real-time)

The collaboration feature lets multiple users work on a paper simultaneously. It combines a **REST API** for persistence (notes and comments are saved to PostgreSQL) with **WebSockets** for real-time presence and live updates.

## Architecture

```
User A (browser)                    User B (browser)
     │                                    │
     │  WS connect /ws/collaborate/{id}  │
     ├──────────────────────────────────►│
     │                                    │
     │  { type: "join", name: "Alice" }  │
     ├──────────────────────────────────►│
     │                                    │
     │◄──────────────────────────────────┤
     │  { type: "user_joined",           │
     │    online_users: ["Alice","Bob"] } │
     │                                    │
     │  POST /papers/{id}/notes          │
     │  (saves to DB + broadcasts)       │
     ├──────────────────────────────────►│
     │◄──────────────────────────────────┤
     │  { type: "note_added", note: {…} }│
```

## Presence Store

User presence is kept in-memory in a module-level dictionary on the backend:

```python
# backend/main.py
# paper_id → { websocket_object → user_name }
paper_connections: Dict[str, Dict[WebSocket, str]] = {}
```

This is fast and sufficient for a single-worker development server. For production with multiple worker processes, replace with a shared store like **Redis Pub/Sub**.

## WebSocket Endpoint

```python
@app.websocket("/ws/collaborate/{paper_id}")
async def collaborate_ws(paper_id: str, websocket: WebSocket):
    await websocket.accept()
    if paper_id not in paper_connections:
        paper_connections[paper_id] = {}
    paper_connections[paper_id][websocket] = ""

    async def broadcast(msg: dict):
        for ws in list(paper_connections.get(paper_id, {}).keys()):
            try:
                await ws.send_text(json.dumps(msg))
            except Exception:
                pass   # silently drop disconnected clients

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "join":
                name = msg.get("name", "Anonymous")
                paper_connections[paper_id][websocket] = name
                online = list(paper_connections[paper_id].values())
                await broadcast({
                    "type": "user_joined",
                    "name": name,
                    "online_users": online
                })

    except WebSocketDisconnect:
        name = paper_connections[paper_id].pop(websocket, "")
        if not paper_connections[paper_id]:
            del paper_connections[paper_id]   # clean up empty room
        else:
            online = list(paper_connections[paper_id].values())
            await broadcast({
                "type": "user_left",
                "name": name,
                "online_users": online
            })
```

## Message Protocol

| Direction | Message | Description |
|-----------|---------|-------------|
| Client → Server | `{ type: "join", name: "Alice" }` | User announces their name |
| Server → All | `{ type: "user_joined", name: "Alice", online_users: ["Alice","Bob"] }` | Presence update |
| Server → All | `{ type: "user_left", name: "Alice", online_users: ["Bob"] }` | Presence update on disconnect |
| Server → All | `{ type: "note_added", note: { id, paper_id, author_name, content, created_at, updated_at } }` | Broadcast after REST POST |
| Server → All | `{ type: "comment_added", comment: { id, paper_id, author_name, content, created_at } }` | Broadcast after REST POST |

## Notes & Comments Persistence

Notes and comments are saved to PostgreSQL via REST, then **broadcast to all WebSocket clients** for that paper:

```python
@app.post("/papers/{paper_id}/notes")
async def create_note(paper_id: str, body: schemas.NoteCreate, db: AsyncSession = Depends(get_db)):
    note = await crud.create_note(db, paper_id, body.author_name, body.content)

    # Broadcast to all collaborators currently connected
    if paper_id in paper_connections:
        for ws in list(paper_connections[paper_id].keys()):
            try:
                await ws.send_text(json.dumps({
                    "type": "note_added",
                    "note": { ...note fields... }
                }))
            except Exception:
                pass

    return note
```

Because notes/comments go through REST (not WebSocket), they are:
- **Persisted** even if no WebSocket clients are connected
- **Loaded on join** via `GET /papers/{id}/notes` and `GET /papers/{id}/comments`

## Frontend WebSocket Lifecycle

```typescript
// 1. Connect after entering name
const ws = new WebSocket(`ws://localhost:8000/ws/collaborate/${paper.file_id}`)

ws.onopen = () => {
  ws.send(JSON.stringify({ type: "join", name: userName }))
}

// 2. Handle incoming messages
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.type === "user_joined" || msg.type === "user_left") {
    setOnlineUsers(msg.online_users)
  } else if (msg.type === "note_added") {
    setNotes(prev => [...prev, msg.note])
  } else if (msg.type === "comment_added") {
    setComments(prev => [...prev, msg.comment])
  }
}

// 3. Disconnect on leave or unmount
ws.close()
```

## UI Layout

```
┌──────────────────────────────────────────────────────────┐
│ ← Back   Paper Title             🟢 Alice  🔵 Bob        │
├──────────┬───────────────────────┬───────────────────────┤
│          │                       │                       │
│  Paper   │    Shared Notes       │     Comments          │
│  Info    │                       │                       │
│          │  [textarea]           │  Alice: Great paper!  │
│  Title   │  [Save Note]          │  Bob: Agreed          │
│  Author  │                       │                       │
│  Year    │  📝 Alice - 2:03pm    │  ─────────────────    │
│  Tags    │  "Key insight here…"  │  [type comment…] ▶    │
│  Abstract│                       │                       │
└──────────┴───────────────────────┴───────────────────────┘
```

## No Login Required

Users enter just their display name each session. Names are ephemeral — they are stored only in the in-memory `paper_connections` dict for presence, and written as plain strings (`author_name`) in the `paper_notes` and `paper_comments` tables.
