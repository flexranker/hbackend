# hackathon-backend

Express + TypeScript backend for hackathons. **Frontend: Firebase Auth only. Backend: ALL data operations.**

## Architecture

```
Frontend (Firebase Auth) ──────► Backend API ──────► Firestore (Admin SDK)
                         Bearer <token>
```

- **Frontend**: Handles Firebase Auth (login/signup only)
- **Backend**: ALL data operations via REST API
- **Firestore**: Blocked for direct client writes via security rules

## Data Flow

1. Frontend: User logs in via Firebase Auth → gets ID token
2. Frontend: `data-client.ts` calls backend APIs with `Authorization: Bearer <token>`
3. Backend: Verifies token via Firebase Admin SDK
4. Backend: Reads/writes Firestore using Admin SDK (bypasses client security rules)
5. Response sent back to frontend

## API Endpoints

### Public
- `GET /api/health` - Health check (no auth required)

### Users (Requires Firebase Auth)
- `GET /api/users/:id` - Get user profile
- `POST /api/users` - Create user (onboarding)
- `PATCH /api/users/:id` - Update profile
- `DELETE /api/users/:id` - Delete account

### Posts (Requires Firebase Auth)
- `GET /api/posts` - List posts (paginated: `?limit=10&page=1`)
- `GET /api/posts/:id` - Get single post
- `POST /api/posts` - Create post
- `PATCH /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post

### Admin (Requires Firebase Auth + admin UID)
- `POST /api/admin/users/:id/ban` - Ban a user
- `POST /api/admin/users/:id/unban` - Unban a user
- `POST /api/admin/posts/:id/feature` - Feature/unfeature post
- `GET /api/admin/stats` - Platform statistics
- `POST /api/notifications/send-all` - Send to all users

## Security

- **Rate limiting**: 100 req/min per IP
- **Token verification**: Firebase Admin SDK validates Bearer tokens
- **Firestore rules**: Direct client writes blocked (`allow read, write: if false;`)
- **Admin access**: Controlled via `ADMIN_UIDS` env var
- **Input validation**: Zod schemas on all endpoints

## Quick Start

1. `./bootstrap.sh`       — copies env templates
2. Fill in Firebase credentials in `fireconfig.json`
3. `docker-compose up`    — starts everything

That's it. Frontend on :3000, backend on :3001, emulator UI on :4000.

## Firebase Setup

1. Go to Firebase Console → Project Settings → Service accounts
2. Click "Generate new private key"
3. Save the JSON as `fireconfig.json` in project root

## Environment Variables

```bash
# Admin UIDs (comma-separated)
ADMIN_UIDS=uid1,uid2

# Frontend origin (CORS)
FRONTEND_URL=http://localhost:3000

# Dev mode
NODE_ENV=development
PORT=3001
```
# Firebase Admin (secret)
FIREBASE_ADMIN_CREDENTIALS={"type":"service_account",...}

# Admin UIDs (comma-separated)
ADMIN_UIDS=uid1,uid2

# Frontend origin (CORS)
FRONTEND_URL=http://localhost:3000

# Dev mode
NODE_ENV=development
PORT=3001
```

## Firestore Security Rules

Deploy `firestore.rules` to block direct client access:

```bash
firebase deploy --only firestore:rules
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
