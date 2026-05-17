# FlashPoll

FlashPoll is a full-stack real-time polling app for internal team decisions.

- Frontend: React + Vite + Tailwind + MUI
- Backend: Go HTTP server
- Database: PostgreSQL with automatic schema creation
- Live updates: Server-Sent Events
- Optional AI helpers: Anthropic API

## Project Structure

```text
backend/
  ai.go
  broker.go
  config.go
  handlers.go
  main.go
  store.go
  types.go
  go.mod
frontend/
  src/
  index.html
  package.json
```

## Requirements

- Go 1.22 or newer
- PostgreSQL
- Node.js + npm

If `go` or `psql` is not recognized in PowerShell, reopen the terminal after installing them or add these paths to `PATH`:

```text
C:\Program Files\Go\bin
C:\Program Files\PostgreSQL\18\bin
```

## Database Setup

Create a PostgreSQL database:

```bash
psql -U postgres -c "CREATE DATABASE flashpoll;"
```

Create `backend/.env` from `backend/.env.example` and adjust credentials if needed:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgres://postgres:postgres@localhost:5432/flashpoll?sslmode=disable
ANTHROPIC_API_KEY=
```

The Go backend automatically creates these tables on startup:

- `polls`
- `options`
- `comments`

Poll deletion uses PostgreSQL foreign keys with `ON DELETE CASCADE`, so associated options, vote counts, and comments are purged with the poll.

## Install

```bash
npm run install:all
```

Or manually:

```bash
cd backend
go mod download

cd ../frontend
npm install
```

## Development

Start the backend:

```bash
npm run dev:backend
```

Start the frontend in another terminal:

```bash
npm run dev:frontend
```

The frontend runs on `http://localhost:5173` and proxies `/api` to the Go backend on `http://localhost:5000`.

## API

- `GET /api/polls` retrieves the active poll feed.
- `POST /api/polls` validates and persists a poll with distinct options.
- `PATCH /api/polls/:id/vote` atomically increments a PostgreSQL vote count.
- `DELETE /api/polls/:id` deletes the poll and cascades associated data.
- `GET /api/polls/stream` streams live updates with SSE.

## Production Build

```bash
npm run build
```

This builds the React frontend and the Go backend binary.

To serve the built frontend from Go, copy or keep the frontend build at `frontend/dist`, then run:

```bash
npm start
```
