# Pockitt — Product & Engineering Backlog

> **Version:** 1.0.0
> **Last Updated:** 2026-02-21
> **Team Size:** 6 engineers (scalable to 8)
> **Sprint Cadence:** 2-week sprints
> **Sprint Velocity:** ~40 story points per sprint

---

## Team Roles

| Role | ID | Responsibilities |
|------|----|-----------------|
| Tech Lead | TL | Architecture, code review, unblocking the team |
| Backend Engineer 1 | BE1 | SignalR hub, RoomEngine, session service |
| Backend Engineer 2 | BE2 | Message buffer, rate limiting, security middleware |
| Frontend Engineer 1 | FE1 | Chat UI, SignalR client, session identity |
| Frontend Engineer 2 | FE2 | Canvas drawing tool, geolocation/geohash client |
| QA Engineer | QA | Test planning, integration & E2E tests, bug triage |
| *(optional)* DevOps | DO | Docker, CI/CD pipeline, environment management |

---

## Folder Structure Analysis

Current state of `/Pockitt` as of Sprint 0:

| Path | Status | Notes |
|------|--------|-------|
| `Models/Message.cs` | ✅ Scaffolded | `MessageType` enum (Text/Drawing) — aligns with spec |
| `Models/Room.cs` | ⚠️ Needs refactor | Stores raw `Latitude`/`Longitude` — spec requires geohash-only room ID; raw coords must never reach the server |
| `Models/User.cs` | ⚠️ Needs refactor | Stores raw `Latitude`/`Longitude` — same privacy concern |
| `Program.cs` | ❌ Stub only | No SignalR, no `UseStaticFiles`, no `IMemoryCache` — bare `Hello World` |
| `Pockitt.csproj` | ⚠️ Review | Targets `.NET 10.0`; spec references `.NET 8.0` — align spec or csproj |
| `Hubs/` | ❌ Not created | `PockittHub.cs` needed |
| `Services/` | ❌ Not created | `RoomEngine.cs`, `SessionService.cs`, `MessageBuffer.cs` needed |
| `wwwroot/` | ❌ Not created | `index.html`, `css/site.css`, `js/` needed |

**Key gaps to close before feature work begins:**
1. Refactor `Room` + `User` — remove raw coordinates; key rooms by geohash string
2. Bootstrap `Program.cs` — register SignalR, `IMemoryCache`, static files middleware
3. Create `Hubs/`, `Services/`, `wwwroot/` with placeholder files

---

## Epics

| ID | Epic | Description |
|----|------|-------------|
| EP-1 | Foundation & Infrastructure | Single-container ASP.NET Core project fully bootstrapped and deployable |
| EP-2 | Anonymous Identity & Session | Every user gets an ephemeral, accountless identity on page load |
| EP-3 | Real-Time Communication | SignalR hub with full message broadcast lifecycle |
| EP-4 | Geospatial Room System | Chat rooms derived and managed purely from coarse GPS coordinates |
| EP-5 | Chat UI | Messages and room state rendered in a clean, responsive interface |
| EP-6 | Drawing Tool | Freehand canvas drawing sent as an image to the room |
| EP-7 | Security & Hardening | Abuse protection, privacy guarantees, production resilience |

---

## User Stories

### EP-1 — Foundation & Infrastructure

---

**US-101 | Bootstrap Program.cs**
> As a developer, I want `Program.cs` to register all required services, so that SignalR, caching, and static files work from day one.

**Acceptance Criteria:**
- [ ] `AddSignalR()` registered
- [ ] `AddMemoryCache()` registered
- [ ] `AddSingleton<RoomEngine>()` and `AddSingleton<SessionService>()` registered
- [ ] `UseStaticFiles()` middleware added before hub mapping
- [ ] `MapHub<PockittHub>("/hub")` mapped
- [ ] `dotnet run` starts without errors

**Assignee:** BE1 | **Points:** 2

---

**US-102 | Refactor Room & User Models**
> As a developer, I want the data models to match the geohash-based room design, so that raw GPS coordinates are never stored server-side.

**Acceptance Criteria:**
- [ ] `Room.Latitude` / `Room.Longitude` removed; room keyed by 5-character geohash string ID
- [ ] `User.Latitude` / `User.Longitude` removed; user stores only `RoomId` (geohash) and `ConnectionId`
- [ ] `RoomState.cs` created with `ParticipantCount` and a reference to `MessageBuffer`
- [ ] Models reviewed against `architecture-spec.md` Section 10

**Assignee:** BE1 | **Points:** 3

---

**US-103 | Create Folder Scaffold**
> As a developer, I want all project directories created with placeholder files, so that the team can work in parallel without merge conflicts on missing paths.

**Acceptance Criteria:**
- [ ] `Hubs/PockittHub.cs` — stub class compiles
- [ ] `Services/RoomEngine.cs` — stub class compiles
- [ ] `Services/SessionService.cs` — stub class compiles
- [ ] `Services/MessageBuffer.cs` — stub class compiles
- [ ] `wwwroot/index.html` — bare HTML5 shell
- [ ] `wwwroot/css/site.css` — empty file
- [ ] `wwwroot/js/main.js` — empty entry point

**Assignee:** TL | **Points:** 2

---

**US-104 | Docker Single-Container Build**
> As a developer, I want a Dockerfile that builds and serves the full app, so that anyone on the team can run the project with one command.

**Acceptance Criteria:**
- [ ] Multi-stage Dockerfile: `.NET SDK` build → `aspnet` runtime
- [ ] `wwwroot/` files included in publish output
- [ ] `docker build -t pockitt . && docker run -p 5000:8080 pockitt` succeeds
- [ ] App reachable at `http://localhost:5000`
- [ ] SignalR hub reachable at `ws://localhost:5000/hub`

**Assignee:** TL | **Points:** 3

---

**US-105 | NuGet & .csproj Dependencies**
> As a developer, I want the `.csproj` to reference all required packages, so that SignalR and memory caching resolve at build time.

**Acceptance Criteria:**
- [ ] SignalR available (built-in with `Microsoft.NET.Sdk.Web`)
- [ ] `Microsoft.Extensions.Caching.Memory` confirmed in the SDK or added explicitly
- [ ] Geohash library or vendored JS implementation decision made and documented
- [ ] `dotnet build` passes with zero errors

**Assignee:** BE2 | **Points:** 1

---

### EP-2 — Anonymous Identity & Session

---

**US-201 | Client Session Identity**
> As a user, I want to be assigned an anonymous identity the moment I open the app, so that I can participate in chat without creating an account.

**Acceptance Criteria:**
- [ ] `session.js` generates `crypto.randomUUID()` on first load
- [ ] Display name generated as `Anon#XXXX` (range 1000–9999)
- [ ] Session stored in `sessionStorage` — clears on tab close
- [ ] Subsequent loads within the same tab reuse the existing session
- [ ] No PII sent to the server

**Assignee:** FE1 | **Points:** 3

---

**US-202 | Server Session Mapping**
> As a developer, I want the server to map `ConnectionId` to a session on connect, so that the hub can associate messages with the correct anonymous user.

**Acceptance Criteria:**
- [ ] `OnConnectedAsync()` in `PockittHub` records `ConnectionId → displayName` in `SessionService`
- [ ] `OnDisconnectedAsync()` removes the entry and decrements room participant count
- [ ] No PII written to logs or cache beyond display name

**Assignee:** BE1 | **Points:** 3

---

### EP-3 — Real-Time Communication

---

**US-301 | JoinRoom Hub Method**
> As a user, I want to join a room when I open the app, so that I can immediately receive messages from nearby people.

**Acceptance Criteria:**
- [ ] `JoinRoom(string geohash)` method on `PockittHub`
- [ ] Geohash validated as exactly 5 characters — `HubException` thrown otherwise
- [ ] Client added to SignalR group keyed by geohash
- [ ] `RoomEngine.GetOrCreateRoom(geohash)` called
- [ ] `RoomInfo` event sent to joiner: `{ roomId, participantCount }`
- [ ] Last 50 messages backfilled to joiner via `ReceiveMessage`

**Assignee:** BE1 | **Points:** 5

---

**US-302 | SendMessage Hub Method**
> As a user, I want to send a text message to the room, so that nearby people can read it in real time.

**Acceptance Criteria:**
- [ ] `SendMessage(string text)` method on `PockittHub`
- [ ] Sender must have joined a room — `HubException` thrown otherwise
- [ ] Empty or whitespace-only messages rejected
- [ ] Message appended to room's `MessageBuffer` (ring buffer, max 50)
- [ ] `ReceiveMessage` broadcast to all connections in the room group
- [ ] `ChatMessage` payload: `SenderName`, `Text`, `SentAt`

**Assignee:** BE1 | **Points:** 5

---

**US-303 | SignalR Client Connection**
> As a developer, I want `signalr.js` to establish and maintain a WebSocket connection, so that the frontend can send and receive hub events reliably.

**Acceptance Criteria:**
- [ ] `HubConnectionBuilder` configured to connect to `/hub`
- [ ] Connection started on page load
- [ ] Auto-reconnect enabled (handled in US-703)
- [ ] `ReceiveMessage` handler registered and dispatches to chat feed
- [ ] `ReceiveDrawing` handler registered and dispatches to chat feed
- [ ] Connection state (connected / reconnecting / disconnected) exposed for UI binding

**Assignee:** FE1 | **Points:** 5

---

**US-304 | Room Engine**
> As a developer, I want `RoomEngine` to manage room state lifecycle, so that rooms form dynamically and dissolve after 30 minutes of inactivity.

**Acceptance Criteria:**
- [ ] `GetOrCreateRoom(geohash)` returns room ID; creates `RoomState` in `IMemoryCache`
- [ ] `SlidingExpiration` set to 30 minutes
- [ ] `TouchRoom(roomId)` called on every message to reset TTL
- [ ] Unit tests cover: create, touch, and eviction paths

**Assignee:** BE2 | **Points:** 5

---

**US-305 | Message Buffer**
> As a developer, I want `MessageBuffer` to cap room history at 50 messages, so that new joiners get context without a database.

**Acceptance Criteria:**
- [ ] Ring buffer using `ConcurrentQueue<object>`
- [ ] Enqueue drops oldest message when count exceeds 50
- [ ] `GetAll()` returns messages in chronological order
- [ ] Thread-safe under concurrent writes
- [ ] Unit tests cover overflow and ordering

**Assignee:** BE2 | **Points:** 3

---

### EP-4 — Geospatial Room System

---

**US-401 | Client Geolocation Acquisition**
> As a user, I want the app to request my location on load, so that I'm automatically placed in the correct local chat room.

**Acceptance Criteria:**
- [ ] `geo.js` calls `navigator.geolocation.getCurrentPosition()`
- [ ] On permission denied: clear message displayed — "Location access is required to join a local room"
- [ ] On error: error state shown without crashing the app
- [ ] On success: coordinates passed to geohash encoder

**Assignee:** FE2 | **Points:** 3

---

**US-402 | Geohash Encoding (Client)**
> As a developer, I want the client to encode GPS coordinates as a precision-5 geohash, so that the server never receives raw coordinates.

**Acceptance Criteria:**
- [ ] `geo.js` encodes `{ lat, lng }` → 5-character geohash string
- [ ] Geohash library or implementation vendored into `wwwroot/js/`
- [ ] Known coordinates produce the expected geohash (unit tested)
- [ ] Encoded geohash passed to `JoinRoom(geohash)` hub call

**Assignee:** FE2 | **Points:** 3

---

**US-403 | Room Participant Count**
> As a user, I want to see how many people are in my room, so that I know if anyone nearby is active.

**Acceptance Criteria:**
- [ ] `RoomState.ParticipantCount` incremented on `JoinRoom`, decremented on `OnDisconnectedAsync`
- [ ] `RoomInfo` event broadcast to all room members when count changes
- [ ] Count displayed in chat header
- [ ] Updates in real time without a page refresh

**Assignee:** BE2 + FE1 | **Points:** 3

---

### EP-5 — Chat UI

---

**US-501 | Chat Feed**
> As a user, I want to see incoming messages in a scrollable feed, so that I can follow the conversation.

**Acceptance Criteria:**
- [ ] `chat.js` renders `ChatMessage` objects into the feed
- [ ] Each message shows `SenderName`, `Text`, and relative timestamp
- [ ] Feed auto-scrolls to the newest message
- [ ] Text rendered via `textContent` — never `innerHTML` (XSS prevention)
- [ ] Drawing messages rendered as `<img src="data:image/png;base64,...">`
- [ ] Backfilled messages rendered on room join

**Assignee:** FE1 | **Points:** 5

---

**US-502 | Message Input**
> As a user, I want a text input bar at the bottom of the screen, so that I can type and send messages easily.

**Acceptance Criteria:**
- [ ] Input bar fixed to the bottom of the viewport
- [ ] Enter key or send button submits the message
- [ ] Input cleared after send
- [ ] Input disabled while SignalR is disconnected

**Assignee:** FE1 | **Points:** 3

---

**US-503 | App Header & Room Label**
> As a user, I want to see my current room and participant count in a header, so that I know I'm connected and where I am.

**Acceptance Criteria:**
- [ ] Header shows "Pockitt" brand name
- [ ] Header shows geohash-derived room label (e.g., `9q8yy`)
- [ ] Participant count badge shown in header
- [ ] Header updates reactively when `RoomInfo` event received

**Assignee:** FE2 | **Points:** 2

---

**US-504 | Tailwind CSS Layout**
> As a developer, I want Tailwind CSS compiled and linked in `index.html`, so that all UI components use consistent, utility-driven styles.

**Acceptance Criteria:**
- [ ] Tailwind CSS compiled to `wwwroot/css/site.css`
- [ ] `index.html` links `site.css`
- [ ] Layout is responsive and mobile-first
- [ ] Chat feed, input bar, header, and canvas overlay are all styled

**Assignee:** FE2 | **Points:** 3

---

### EP-6 — Drawing Tool

---

**US-601 | Canvas Drawing Surface**
> As a user, I want to draw freehand on a canvas, so that I can express myself visually and send it to the chat.

**Acceptance Criteria:**
- [ ] `canvas.js` creates a 600×400px `<canvas>` element
- [ ] Mousedown / mousemove / mouseup draws strokes
- [ ] Touch events (touchstart, touchmove, touchend) also supported
- [ ] Stroke: color `#1a1a1a`, width 3px, background `#ffffff`
- [ ] Drawing is smooth and renders in real time

**Assignee:** FE2 | **Points:** 5

---

**US-602 | Canvas Clear**
> As a user, I want to clear the canvas with one tap, so that I can start over without closing the drawing panel.

**Acceptance Criteria:**
- [ ] "Clear" button resets the canvas to white
- [ ] No data sent to the server on clear

**Assignee:** FE2 | **Points:** 1

---

**US-603 | Send Drawing to Chat**
> As a user, I want to send my drawing to the chat, so that other people in my room can see it.

**Acceptance Criteria:**
- [ ] "Send" button calls `canvas.toDataURL("image/png")`
- [ ] Base64 PNG string sent via `SendDrawing(imageData)` hub method
- [ ] Canvas cleared after send
- [ ] Drawing panel closes and chat feed restored after send

**Assignee:** FE2 + BE1 | **Points:** 5

---

**US-604 | SendDrawing Hub Method & Validation**
> As a developer, I want the hub to validate and broadcast drawings, so that oversized or malformed payloads are rejected before reaching the room.

**Acceptance Criteria:**
- [ ] `SendDrawing(string imageData)` method on `PockittHub`
- [ ] Reject if `imageData.Length > 200_000` (~150KB base64) — throw `HubException`
- [ ] Reject if payload does not start with `"data:image/png;base64,"`
- [ ] Valid drawings appended to `MessageBuffer` and broadcast as `ReceiveDrawing`
- [ ] `DrawingMessage` payload: `SenderName`, `ImageData`, `SentAt`

**Assignee:** BE1 | **Points:** 3

---

**US-605 | Drawing Panel UI**
> As a user, I want the drawing canvas to open as an overlay, so that the drawing experience is focused and clean.

**Acceptance Criteria:**
- [ ] Draw button in input bar opens canvas overlay
- [ ] "Cancel" button closes overlay without sending anything
- [ ] Overlay replaces the chat feed area (not a modal/dialog)

**Assignee:** FE2 | **Points:** 3

---

### EP-7 — Security & Hardening

---

**US-701 | Rate Limiting**
> As a developer, I want to limit each connection to 10 messages per 10 seconds, so that the system is protected against flooding.

**Acceptance Criteria:**
- [ ] Rate limit enforced in `PockittHub.SendMessage()` per `ConnectionId`
- [ ] Excess messages throw `HubException` to the sender only
- [ ] Rate limit state stored in `IMemoryCache` (`key: ratelimit:{connectionId}`)
- [ ] Unit test confirms the 11th message in 10 seconds is blocked

**Assignee:** BE2 | **Points:** 5

---

**US-702 | Security Headers**
> As a developer, I want ASP.NET middleware to attach security headers to every response, so that the app is protected against common web attacks.

**Acceptance Criteria:**
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `Content-Security-Policy: default-src 'self'; img-src 'self' data:; connect-src 'self' wss:`
- [ ] Headers present on static file responses and hub handshake
- [ ] Integration test confirms all headers

**Assignee:** BE2 | **Points:** 3

---

**US-703 | SignalR Auto-Reconnect & Error States**
> As a user, I want the app to reconnect automatically if I lose signal, so that I don't have to refresh the page.

**Acceptance Criteria:**
- [ ] SignalR client configured with `withAutomaticReconnect()`
- [ ] UI shows "reconnecting…" state during disconnection
- [ ] On reconnect: re-calls `JoinRoom`, backfill re-received
- [ ] After 3 failed reconnect attempts: "Connection lost" shown with manual retry button

**Assignee:** FE1 | **Points:** 5

---

**US-704 | Health Check Endpoint**
> As a developer, I want a `/api/health` endpoint, so that container orchestration can verify the app is alive.

**Acceptance Criteria:**
- [ ] `GET /api/health` returns `200 OK` with `{ "status": "healthy" }`
- [ ] No authentication required
- [ ] Responds in < 50ms

**Assignee:** BE2 | **Points:** 1

---

**US-705 | Idle Room Eviction Verification**
> As a developer, I want to verify that rooms evict after 30 minutes of inactivity, so that memory doesn't grow unbounded.

**Acceptance Criteria:**
- [ ] `IMemoryCache` sliding expiration of 30 minutes confirmed via integration test
- [ ] Eviction removes room from cache
- [ ] No dangling SignalR group references after eviction

**Assignee:** BE2 | **Points:** 3

---

## Sprint Plan

> **Team:** TL, BE1, BE2, FE1, FE2, QA (6 engineers)
> **Cadence:** 2-week sprints | ~40 story points per sprint

---

### Sprint 1 — Scaffold, Identity & Real-Time Backbone

**Goal:** Project builds, Docker runs, and a SignalR message flows end-to-end.

| Story | Description | Assignee | Points |
|-------|-------------|----------|--------|
| US-101 | Bootstrap Program.cs | BE1 | 2 |
| US-102 | Refactor Room & User Models | BE1 | 3 |
| US-103 | Create Folder Scaffold | TL | 2 |
| US-104 | Docker Single-Container Build | TL | 3 |
| US-105 | NuGet & .csproj Dependencies | BE2 | 1 |
| US-201 | Client Session Identity | FE1 | 3 |
| US-202 | Server Session Mapping | BE1 | 3 |
| US-301 | JoinRoom Hub Method | BE1 | 5 |
| US-303 | SignalR Client Connection | FE1 | 5 |
| US-304 | Room Engine | BE2 | 5 |
| US-305 | Message Buffer | BE2 | 3 |
| — | QA: sprint test planning & smoke tests | QA | 3 |

**Sprint 1 Total: 38 points**

**Definition of Done:**
- [ ] Docker container builds and runs
- [ ] SignalR hub reachable at `/hub`
- [ ] Client connects, receives an anonymous identity, and joins a room
- [ ] A sent message is received by all clients in the same room in real time

---

### Sprint 2 — Geospatial System & Chat UI

**Goal:** Users are placed into location-derived rooms and can chat with a functional UI.

| Story | Description | Assignee | Points |
|-------|-------------|----------|--------|
| US-302 | SendMessage Hub Method | BE1 | 5 |
| US-401 | Client Geolocation Acquisition | FE2 | 3 |
| US-402 | Geohash Encoding (Client) | FE2 | 3 |
| US-403 | Room Participant Count | BE2 + FE1 | 3 |
| US-501 | Chat Feed | FE1 | 5 |
| US-502 | Message Input | FE1 | 3 |
| US-503 | App Header & Room Label | FE2 | 2 |
| US-504 | Tailwind CSS Layout | FE2 | 3 |
| — | QA: integration tests (join, message, geo) | QA | 5 |

**Sprint 2 Total: 32 points** *(buffer for Sprint 1 carry-over & bug fixes)*

**Definition of Done:**
- [ ] User opens app, location requested, geohash computed
- [ ] User joins correct geohash-derived room
- [ ] User can send and receive text messages in real time
- [ ] Participant count updates correctly
- [ ] Chat feed renders messages with correct sender and timestamp

---

### Sprint 3 — Drawing Tool

**Goal:** Users can draw on a canvas and send it to the chat room.

| Story | Description | Assignee | Points |
|-------|-------------|----------|--------|
| US-601 | Canvas Drawing Surface | FE2 | 5 |
| US-602 | Canvas Clear | FE2 | 1 |
| US-603 | Send Drawing to Chat | FE2 + BE1 | 5 |
| US-604 | SendDrawing Hub Method & Validation | BE1 | 3 |
| US-605 | Drawing Panel UI | FE2 | 3 |
| — | QA: drawing E2E + payload validation tests | QA | 5 |
| — | Bug fixes & polish from Sprint 2 | All | 8 |

**Sprint 3 Total: 30 points** *(buffer for canvas complexity & cross-device testing)*

**Definition of Done:**
- [ ] User can open the drawing panel, draw freehand (mouse + touch)
- [ ] Drawing can be cleared and sent to the chat
- [ ] Sent drawing appears as an image in the chat feed for all room members
- [ ] Oversized or malformed payloads are rejected by the hub

---

### Sprint 4 — Security, Hardening & Production Readiness

**Goal:** App is secure, resilient, and ready for a real deployment.

| Story | Description | Assignee | Points |
|-------|-------------|----------|--------|
| US-701 | Rate Limiting | BE2 | 5 |
| US-702 | Security Headers | BE2 | 3 |
| US-703 | SignalR Auto-Reconnect & Error States | FE1 | 5 |
| US-704 | Health Check Endpoint | BE2 | 1 |
| US-705 | Idle Room Eviction Verification | BE2 | 3 |
| — | QA: full regression + security test suite | QA | 8 |
| — | Performance testing & tuning | TL + BE1 | 5 |
| — | Final polish, accessibility & mobile review | FE1 + FE2 | 5 |

**Sprint 4 Total: 35 points**

**Definition of Done:**
- [ ] Rate limiting enforced and verified
- [ ] All security headers present on every response
- [ ] App auto-reconnects gracefully after a network interruption
- [ ] `/api/health` returns `200 OK`
- [ ] Full regression suite passes across Chrome, Firefox, Safari, Edge
- [ ] App deployed to target environment

---

## Testing Backlog

### Unit Tests

| ID | Component | Test Case | Assignee |
|----|-----------|-----------|----------|
| UT-01 | `RoomEngine` | `GetOrCreateRoom` returns same ID for same geohash | BE2 |
| UT-02 | `RoomEngine` | Room TTL resets on `TouchRoom` call | BE2 |
| UT-03 | `MessageBuffer` | Buffer caps at 50, drops oldest entry | BE2 |
| UT-04 | `MessageBuffer` | `GetAll()` returns messages in insertion order | BE2 |
| UT-05 | `MessageBuffer` | Thread-safe under concurrent enqueue | BE2 |
| UT-06 | `SessionService` | Connection recorded on `OnConnectedAsync` | BE1 |
| UT-07 | `SessionService` | Connection removed on `OnDisconnectedAsync` | BE1 |
| UT-08 | Hub validation | `SendDrawing` rejects payload > 200KB | BE1 |
| UT-09 | Hub validation | `SendDrawing` rejects non-PNG base64 prefix | BE1 |
| UT-10 | Hub validation | `JoinRoom` rejects geohash length ≠ 5 | BE1 |
| UT-11 | `geo.js` | Known lat/lng encodes to expected geohash | FE2 |
| UT-12 | `session.js` | New session created on first load | FE1 |
| UT-13 | `session.js` | Existing session reused within same tab | FE1 |
| UT-14 | Rate limiter | 11th message within 10s window is blocked | BE2 |

---

### Integration Tests

| ID | Scenario | Expected Result | Assignee |
|----|----------|-----------------|----------|
| IT-01 | Client connects to `/hub` | Connection established, `ConnectionId` assigned | QA |
| IT-02 | Client calls `JoinRoom("9q8yy")` | Added to group, receives `RoomInfo` | QA |
| IT-03 | Client calls `JoinRoom("abc")` (invalid) | `HubException` thrown | QA |
| IT-04 | Client sends text message | All room members receive `ReceiveMessage` | QA |
| IT-05 | Client sends valid drawing | All room members receive `ReceiveDrawing` | QA |
| IT-06 | Client sends drawing > 150KB | Sender receives `HubException`, room unaffected | QA |
| IT-07 | Client disconnects | `ParticipantCount` decremented; empty room cleaned up | QA |
| IT-08 | New client joins existing room | Receives last 50 messages as backfill | QA |
| IT-09 | `GET /api/health` | Returns `200 OK` with `{ "status": "healthy" }` | QA |
| IT-10 | Security headers check | All required headers present on every response | QA |

---

### End-to-End Tests

| ID | Scenario | Expected Result | Assignee |
|----|----------|-----------------|----------|
| E2E-01 | User opens app → grants location → room joined | Chat feed visible, participant count = 1 | QA |
| E2E-02 | Two users in same geohash area exchange messages | Both see each other's messages in real time | QA |
| E2E-03 | User draws and sends → second user sees image | Drawing renders as `<img>` in chat feed | QA |
| E2E-04 | User loses network, reconnects | Auto-reconnects, rejoins room, backfill shown | QA |
| E2E-05 | User denies location permission | Clear error message shown, app does not crash | QA |
| E2E-06 | Two users in different geohash areas | Messages do not cross room boundaries | QA |

---

### Security Tests

| ID | Attack Vector | Test | Assignee |
|----|---------------|------|----------|
| SEC-01 | XSS via message content | Send `<script>alert(1)</script>` — must render as plain text | QA |
| SEC-02 | Oversized drawing payload | Send 500KB base64 string — must be rejected | QA |
| SEC-03 | Message flooding | 100 messages in 1 second — rate limit kicks in after 10 | QA |
| SEC-04 | Invalid image format | Send `data:image/gif;base64,...` — must be rejected | QA |
| SEC-05 | Room enumeration | No `/api/rooms` listing endpoint exists | QA |
| SEC-06 | Frame embedding | `X-Frame-Options: DENY` confirmed in response headers | QA |
| SEC-07 | Content sniffing | `X-Content-Type-Options: nosniff` confirmed | QA |
| SEC-08 | Location precision | Server logs contain no raw lat/lng values | QA |

---

### Performance Tests

| ID | Metric | Target | Tool |
|----|--------|--------|------|
| PERF-01 | Message end-to-end latency | < 100ms p99 | k6 / Artillery |
| PERF-02 | Concurrent SignalR connections | 1,000 simultaneous users | k6 |
| PERF-03 | Drawing payload broadcast time | < 300ms p95 | k6 |
| PERF-04 | Page load to first interaction | < 2 seconds | Lighthouse |

---

### Browser & Device Tests

| ID | Platform | Scope |
|----|----------|-------|
| BRW-01 | Chrome (latest) | Full smoke test |
| BRW-02 | Firefox (latest) | Full smoke test |
| BRW-03 | Safari (latest) | Full smoke test |
| BRW-04 | Edge (latest) | Full smoke test |
| BRW-05 | iOS Safari (mobile) | Touch drawing, chat, geolocation |
| BRW-06 | Android Chrome (mobile) | Touch drawing, chat, geolocation |

---

*This backlog is the authoritative source of planned work for Pockitt V1. All stories must reference `architecture-spec.md` for acceptance criteria alignment. Deviations require a backlog update and spec review.*
