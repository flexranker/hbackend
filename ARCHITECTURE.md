# Backend Architecture Report

## Project Location
`/workspace/hackathons/hackathon-backend`

## Tech Stack
- **Runtime:** Node.js 20+
- **Framework:** Express 4.19+
- **Language:** TypeScript 5.x (strict mode)
- **Database:** Firebase Firestore
- **Auth:** Firebase Admin SDK
- **Validation:** Zod 3.x
- **Security:** Helmet, CORS, express-rate-limit
- **Logging:** Pino

---

## Architecture Overview

```
┌─────────────────┐                    ┌─────────────────┐
│   Frontend      │                    │   Backend       │
├─────────────────┤                    ├─────────────────┤
│ Firebase Auth   │── Login/Token ────→│                │
│                 │                    │                │
│ dataClient      │── Bearer Token ───→│ Verify Token   │
│ (setBackend)    │←── Response ────────│ Read/Write     │
│                 │                    │ Firestore      │
└─────────────────┘                    └─────────────────┘
```

### Flow:
1. **Frontend:** User logs in via Firebase Auth → gets ID token
2. **Frontend:** API calls include `Authorization: Bearer <token>`
3. **Backend:** Verifies token via Firebase Admin SDK
4. **Backend:** Reads/writes Firestore using Admin SDK (bypasses client security rules)
5. **Response:** JSON sent back to frontend

---

## Project Structure

```
hackathon-backend/
├── src/
│   ├── app.ts                 # Express app setup
│   ├── server.ts              # Entry point
│   ├── config.ts              # Environment configuration
│   ├── middleware/
│   │   ├── auth.ts           # Firebase token verification
│   │   ├── admin.ts          # Admin authorization
│   │   └── rateLimit.ts      # Rate limiting (100 req/min)
│   ├── routes/
│   │   ├── users.ts          # User CRUD endpoints
│   │   ├── posts.ts          # Post CRUD endpoints
│   │   ├── admin.ts          # Admin utilities
│   │   └── notifications.ts  # Bulk notifications
│   ├── services/
│   │   ├── firebase.ts       # Firebase Admin SDK init
│   │   ├── admin.ts          # Admin operations
│   │   ├── users.ts          # User Firestore operations
│   │   └── posts.ts          # Post Firestore operations
│   ├── types/
│   │   ├── api.ts            # Zod schemas
│   │   └── db.ts             # TypeScript interfaces
│   └── utils/
│       ├── errors.ts         # Custom error classes
│       ├── logger.ts         # Pino logger
│       ├── paginate.ts       # Pagination utilities
│       └── validator.ts      # Zod middleware
├── firestore.rules            # Security rules (block direct access)
├── fireconfig.example.json    # Firebase credentials template
├── .env.example               # Environment variables template
├── package.json
├── tsconfig.json
└── biome.json
```

---

## API Endpoints

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |

### Users (Requires Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:id` | Get user profile |
| POST | `/api/users` | Create user (onboarding) |
| PATCH | `/api/users/:id` | Update profile |
| DELETE | `/api/users/:id` | Delete account |

### Posts (Requires Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts` | List posts (paginated) |
| GET | `/api/posts/:id` | Get single post |
| POST | `/api/posts` | Create post |
| PATCH | `/api/posts/:id` | Update post |
| DELETE | `/api/posts/:id` | Delete post |

### Admin (Requires Auth + Admin UID)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/users/:id/ban` | Ban a user |
| POST | `/api/admin/users/:id/unban` | Unban a user |
| POST | `/api/admin/posts/:id/feature` | Feature/unfeature post |
| GET | `/api/admin/stats` | Platform statistics |
| POST | `/api/notifications/send-all` | Send to all users |

---

## Middleware

### Authentication (`src/middleware/auth.ts`)
```typescript
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return next(new AuthError('No token provided'));
  }

  try {
    const user = await getFirebaseAuth().verifyIdToken(token);
    req.user = {
      uid: user.uid,
      email: user.email,
      emailVerified: user.email_verified ?? false,
      displayName: user.name,
      photoURL: user.picture,
    };
    next();
  } catch {
    next(new AuthError('Invalid token'));
  }
};
```

### Admin Authorization (`src/middleware/admin.ts`)
```typescript
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new ForbiddenError('Authentication required'));
  }

  if (!config.adminUids.includes(req.user.uid)) {
    return next(new ForbiddenError('Admin access required'));
  }

  next();
};
```

### Rate Limiting (`src/middleware/rateLimit.ts`)
```typescript
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,              // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
```

---

## Error Handling

### Custom Error Classes (`src/utils/errors.ts`)
```typescript
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code?: string
  ) { ... }
}

export class ValidationError extends AppError { ... }  // 400
export class AuthError extends AppError { ... }       // 401
export class ForbiddenError extends AppError { ... }  // 403
export class NotFoundError extends AppError { ... }  // 404
export class InternalError extends AppError { ... }  // 500
```

### Global Error Handler (`src/app.ts`)
```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
  } else {
    logger.error({ err, path: req.path });
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

## Input Validation

### Zod Schemas (`src/types/api.ts`)
```typescript
export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  avatar: z.string().url().optional(),
});

export const createPostSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});
```

### Validation Middleware (`src/utils/validator.ts`)
```typescript
export function validate<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError(error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')));
      } else {
        next(error);
      }
    }
  };
}
```

---

## Firebase Configuration

### Credentials (`fireconfig.json`)
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com"
}
```

### Initialization (`src/services/firebase.ts`)
```typescript
export function initFirebase() {
  if (config.nodeEnv === 'development') {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  }

  if (getApps().length === 0) {
    const { projectId, privateKey, clientEmail } = config.firebase;

    if (projectId && privateKey && clientEmail) {
      app = initializeApp({
        credential: cert({ projectId, privateKey, clientEmail }),
        projectId,
      });
    }
  }
  // ...
}
```

---

## Firestore Security Rules

### `firestore.rules`
```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Block ALL direct client writes
    // All data operations go through backend API
    match /{document=**} {
      allow read: if false;
      allow write: if false;
    }
  }
}
```

---

## Environment Variables

### `.env.example`
```bash
# Firebase config is loaded from fireconfig.json
ADMIN_UIDS=uid1,uid2
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
PORT=3001
LOG_LEVEL=info
```

---

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

---

## Quick Start

```bash
yarn install
cp .env.example .env
cp fireconfig.example.json fireconfig.json
# Add Firebase credentials to fireconfig.json
# Add admin UIDs to ADMIN_UIDS in .env
yarn dev
```

---

## Key Files

| Purpose | Path |
|---------|------|
| Entry Point | `src/server.ts` |
| App Setup | `src/app.ts` |
| Config | `src/config.ts` |
| Auth Middleware | `src/middleware/auth.ts` |
| Admin Middleware | `src/middleware/admin.ts` |
| Rate Limiter | `src/middleware/rateLimit.ts` |
| User Routes | `src/routes/users.ts` |
| Post Routes | `src/routes/posts.ts` |
| Admin Routes | `src/routes/admin.ts` |
| Firebase Service | `src/services/firebase.ts` |
| User Service | `src/services/users.ts` |
| Post Service | `src/services/posts.ts` |
| Admin Service | `src/services/admin.ts` |
| Error Classes | `src/utils/errors.ts` |
| Logger | `src/utils/logger.ts` |
| Validator | `src/utils/validator.ts` |

---

## Summary

- **Auth:** Frontend handles Firebase Auth only
- **Data:** Backend handles ALL data operations via REST API
- **Security:** Direct client access blocked via Firestore rules
- **Validation:** Zod schemas on all endpoints
- **Rate Limiting:** 100 req/min per IP
- **Admin:** Separate admin UIDs for elevated operations
