# TeamConnect

TeamConnect is a real-time collaboration workspace for small teams. It combines team chat, tasks, presence, notifications, image sharing, and two optional AI helpers in a focused EJS + vanilla JavaScript interface.

## Features

- JWT registration, login, logout, profile editing, and bcrypt password hashing
- Backend-enforced team roles: owner, admin, and member
- Team creation, invite codes, direct member invitations, and leave controls
- Persistent Socket.IO team chat, private messages, image messages, typing indicators, and online presence
- Team task board with assignments, status, priority, due dates, and live task updates
- Stored and real-time notifications for invitations, assignments, messages, mentions, and private messages
- Cloudinary profile/chat image uploads streamed from memory (no local upload storage)
- Optional AI task breakdown and bounded recent-chat summaries, called only from the backend

## Tech Stack

- Frontend: EJS, Bootstrap 5, CSS, vanilla JavaScript
- Backend: Node.js, Express, Socket.IO
- Data: MongoDB Atlas with Mongoose
- Authentication: JWT and bcryptjs
- Infrastructure: Upstash Redis (rate limits, online presence, Socket.IO adapter)
- Storage: Cloudinary
- AI: OpenAI-compatible chat-completions endpoint, configurable with environment variables

## Architecture

Browser requests use `Authorization: Bearer <JWT>`. Express verifies the token and attaches the user before protected controllers run. Team controllers load membership and roles from MongoDB on the server; UI controls are only a convenience layer.

Socket.IO repeats JWT authentication during the handshake. A user must be a member before joining `team:<teamId>` or sending team events. Messages, tasks, and important notifications persist in MongoDB; Redis holds temporary online presence and API rate-limit counters.

## Project Structure

```text
src/
  config/         MongoDB, Redis, and Cloudinary setup
  controllers/    HTTP request handlers
  middleware/     Auth, role checks, uploads, rate limiting, errors
  models/         User, Team, Message, Task, Notification
  routes/         REST and EJS page routes
  services/       AI and notification services
  sockets/        Authenticated Socket.IO handlers
views/            EJS pages and shared partials
public/           Bootstrap-enhanced CSS and vanilla JavaScript
```

## Environment Variables

Copy `.env.example` to `.env`, then set the values below. No real `.env` file or credentials belong in Git.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port; Render supplies this automatically |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long, random secret for signing tokens |
| `JWT_EXPIRES_IN` | Token life, for example `1d` |
| `REDIS_URL` | Upstash Redis TLS URL |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `AI_API_KEY` | Optional provider API key |
| `AI_API_BASE_URL` | Optional OpenAI-compatible chat-completions endpoint |
| `AI_MODEL` | Optional provider model name |
| `CLIENT_ORIGIN` | Comma-separated browser origins in production, if needed |

`MONGODB_URI` and `JWT_SECRET` are required to start. When `REDIS_URL` is unavailable, the server keeps working with conservative process-memory fallbacks for presence and rate limiting; configure Upstash in production for shared, durable infrastructure behavior. Cloudinary and AI endpoints return a clear `503` until their credentials are configured, without affecting chat or tasks.

## Installation

1. Clone the repository.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Add MongoDB Atlas, Upstash Redis, Cloudinary, and JWT values. Add AI values only if you want the optional AI features.

## Running Locally

```bash
npm run dev
```

For production-style startup:

```bash
npm start
```

Open `http://localhost:5000` unless `PORT` has been changed. MongoDB and Redis remain cloud-hosted; there is no local database or Redis service to install.

## API Overview

All protected endpoints require `Authorization: Bearer <JWT>`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Teams | `GET/POST /api/teams`, `GET/PUT/DELETE /api/teams/:id`, `POST /api/teams/join` |
| Members | `POST /api/teams/:id/members`, `PATCH/DELETE /api/teams/:id/members/:userId`, `POST /api/teams/:id/leave` |
| Tasks | `GET/POST /api/tasks`, `GET/PUT/DELETE /api/tasks/:id` |
| Messages | `GET/POST /api/messages/:teamId`, `GET /api/messages/private/:userId` |
| Notifications | `GET /api/notifications`, `PATCH /api/notifications/:id/read` |
| AI | `POST /api/ai/task-breakdown`, `POST /api/ai/chat-summary` |
| Uploads | `POST /api/uploads/profile-image`, `POST /api/uploads/chat-image` |

## Socket.IO Events

The browser supplies the JWT as `auth.token` in the connection handshake.

| Client event | Payload | Server behavior |
| --- | --- | --- |
| `joinTeam` / `leaveTeam` | `{ teamId }` | Authorizes membership and manages `team:<id>` rooms |
| `sendMessage` | `{ teamId, content, imageUrl }` | Persists and emits `receiveMessage` to the team |
| `privateMessage` | `{ recipientId, content, imageUrl }` | Persists and emits to the recipient’s user room |
| `typing` / `stopTyping` | `{ teamId }` | Relays ephemeral typing status to the team |
| `receiveMessage`, `notification`, `taskUpdated` | Server events | Update the interface in real time |

## Cloud Services

Use MongoDB Atlas for persistent application data, Upstash Redis for shared ephemeral state and Socket.IO scaling, and Cloudinary for images. The app uses Multer memory storage and streams files to Cloudinary, so uploads are never retained on the server filesystem.

## AI Features

The task assistant turns a short work description into 3–8 actionable subtasks. The chat summary uses only the 40 newest team messages. Both routes call the provider from Node.js; browser code never receives `AI_API_KEY`. AI failure is handled as an optional-feature error.

## Deployment

Create a Render Web Service with build command `npm install` and start command `npm start`. Add every required environment variable in Render’s dashboard, add the Render URL to `CLIENT_ORIGIN` if it differs from the served origin, and allow the Render deployment’s IP/network access in MongoDB Atlas. Keep MongoDB Atlas, Upstash Redis, and Cloudinary cloud-hosted.

## Security

Passwords are hashed with bcryptjs. JWT verification protects REST and Socket.IO access. All team authorization checks run on the backend. Helmet, CORS, input limits, image-type/size validation, centralized production-safe errors, and Redis-backed login/API rate limits provide practical baseline protection. Secrets are read only from environment variables.
