# hackathon-backend

Express + TypeScript backend for hackathons, designed to complement Firebase direct access.

## Architecture Overview

This backend provides **admin utilities** that the frontend cannot perform directly via Firestore security rules, while allowing seamless migration to full backend-driven data in Phase 2.

### Phase 1: Firestore Direct (Current)
Frontend writes directly to Firestore with these security rules:
- Users manage their own profiles
- Anyone can create/read posts
- Admin operations handled server-side

### Phase 2: Backend API
Set `setBackend('api')` in frontend to route all data through this API:
- GET/POST/PATCH/DELETE /api/users/:id
- GET/POST/PATCH/DELETE /api/posts/:id

## API Endpoints

### Public
- `GET /api/health` - Health check (no auth required)

### Admin (Requires Firebase Auth)
- `POST /api/admin/users/:id/ban` - Ban a user
- `POST /api/admin/users/:id/unban` - Unban a user  
- `POST /api/admin/posts/:id/feature` - Feature/unfeature a post
- `GET /api/admin/stats` - Get platform statistics
- `POST /api/notifications/send-all` - Send notification to all users

## Quick Start

```bash
yarn install
cp .env.example .env
# Add Firebase service account JSON to FIREBASE_ADMIN_CREDENTIALS
yarn dev
```

## Environment Variables

```bash
# Firebase Admin (secret)
FIREBASE_ADMIN_CREDENTIALS={"type":"service_account",...}

# Frontend origin (CORS)
FRONTEND_URL=http://localhost:3000

# Dev mode
NODE_ENV=development
PORT=3001
```

## Scripts

```json
{
  "dev": "tsx watch src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js",
  "lint": "biome check src/",
  "type-check": "tsc --noEmit"
}
```
