# Backend Issues — Agent Action Plan

> **Agent instructions:**
> - Work through issues **one at a time**, in the order listed.
> - After completing each issue, **stop and commit** your changes.
> - Do **not** proceed to the next issue until the user explicitly gives permission.
> - Where an issue is marked `⚠️ Cross-system`, read the note — a corresponding frontend change is required. Check `FRONTEND_ISSUES.md` for the matching issue number before committing.

---

## Issue B-1 — Admin UIDs are hardcoded in `.env` with no management path

### What's wrong
Admin access is determined by checking `config.adminUids` — a list parsed from the `ADMIN_UIDS` environment variable:

```bash
ADMIN_UIDS=uid1,uid2
```

This has two concrete problems:
1. **Adding or revoking admin access during a hackathon requires a server restart** (or redeployment). If a teammate needs to be promoted mid-demo, you're blocked.
2. **The list is not validated.** If `ADMIN_UIDS` is empty or malformed, `config.adminUids` is an empty array and no admin operations can succeed — silently.

### How to fix

**Step 1 — Validate the admin UIDs at startup.**

In `src/config.ts`, add a startup warning when no admin UIDs are configured:

```ts
export const config = {
  // ... existing fields
  adminUids: process.env.ADMIN_UIDS
    ? process.env.ADMIN_UIDS.split(",").map((uid) => uid.trim()).filter(Boolean)
    : [],
};

// Warn loudly at startup if no admins are configured
if (config.adminUids.length === 0) {
  console.warn(
    "[config] WARNING: No ADMIN_UIDS configured. All admin endpoints will return 403. " +
    "Set ADMIN_UIDS=<your-firebase-uid> in .env"
  );
}
```

**Step 2 — Add a runtime admin management endpoint.**

Add `src/routes/admin.ts` endpoint for promoting/demoting users without a restart. Store admin UIDs in a dedicated Firestore collection (`_admin/config`) rather than only in the environment variable. The environment variable becomes the bootstrap list (the first admin), and the Firestore document is the live source of truth.

```ts
// GET /api/admin/admins — list current admin UIDs
// POST /api/admin/admins/:uid — promote a user to admin
// DELETE /api/admin/admins/:uid — revoke admin

// src/services/admin.ts — add:
export async function getAdminUids(): Promise<string[]> {
  const doc = await getFirestore().collection("_admin").doc("config").get();
  const stored = (doc.data()?.adminUids as string[]) ?? [];
  // Merge env-bootstrapped UIDs with stored ones; env always wins
  return Array.from(new Set([...config.adminUids, ...stored]));
}

export async function addAdminUid(uid: string): Promise<void> {
  const current = await getAdminUids();
  if (current.includes(uid)) return;
  await getFirestore()
    .collection("_admin")
    .doc("config")
    .set({ adminUids: [...current, uid] }, { merge: true });
}

export async function removeAdminUid(uid: string): Promise<void> {
  if (config.adminUids.includes(uid)) {
    throw new ForbiddenError("Cannot remove a bootstrap admin via API. Edit ADMIN_UIDS in .env.");
  }
  const current = await getAdminUids();
  await getFirestore()
    .collection("_admin")
    .doc("config")
    .set({ adminUids: current.filter((u) => u !== uid) }, { merge: true });
}
```

Update `src/middleware/admin.ts` to check `getAdminUids()` instead of `config.adminUids` directly:

```ts
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return next(new ForbiddenError("Authentication required"));
  const adminUids = await getAdminUids();
  if (!adminUids.includes(req.user.uid)) {
    return next(new ForbiddenError("Admin access required"));
  }
  next();
};
```

Add a small cache (in-memory, 60-second TTL) on `getAdminUids()` to avoid a Firestore read on every admin request.

### Acceptance criteria
- Startup logs a warning if `ADMIN_UIDS` is empty.
- `GET /api/admin/admins` returns the current admin UIDs list (requires admin auth).
- `POST /api/admin/admins/:uid` and `DELETE /api/admin/admins/:uid` work without restart.
- Bootstrap UIDs from `.env` cannot be removed via the API.
- No TypeScript errors.

---

> 🛑 **STOP. Commit this change and wait for user permission before continuing.**

---

## Issue B-2 — Rate limiter is IP-based, causing problems with shared IPs and no per-user limiting

### What's wrong
The current rate limiter:

```ts
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
```

Two problems:
1. **Multiple users behind the same NAT (office, university, hotel Wi-Fi) share a quota.** One user's 100 requests blocks everyone else at the same IP.
2. **A single authenticated user can bypass the limit** by rotating IP addresses (VPN, proxies). Since the token verifies identity, a per-user limit would be more meaningful.

### How to fix
Add a second limiter that applies per authenticated user UID, running after the `authenticate` middleware on protected routes. Keep the IP-based limiter as a first-pass DDoS guard with a higher ceiling, and the UID-based limiter as the per-user enforcement.

```ts
// src/middleware/rateLimit.ts

import rateLimit from "express-rate-limit";

// Broad IP-based guard — higher ceiling, protects unauthenticated endpoints
export const ipRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,              // raise ceiling since multiple users may share an IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this network, please try again later" },
});

// Per-user guard — applied only to authenticated routes
export const userRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid ?? req.ip ?? "anonymous",
  message: { error: "Too many requests, please try again later" },
  skip: (req) => !req.user,   // only apply when user is authenticated
});
```

Update `src/app.ts`:

```ts
// Apply IP limiter globally (unauthenticated endpoints included)
app.use(ipRateLimiter);

// Apply user limiter to all /api routes AFTER the authenticate middleware
// In each authenticated route file, the order is: authenticate → userRateLimiter → handler
// Or apply it globally after authenticate in app.ts if authenticate is global
```

In each route that uses `authenticate`, the middleware stack should be:
```ts
router.get("/", authenticate, userRateLimiter, handler);
```

Update `.env.example` with optional overrides:
```bash
RATE_LIMIT_IP_MAX=300      # requests per minute per IP
RATE_LIMIT_USER_MAX=100    # requests per minute per authenticated user
```

Read these from `config.ts` so they can be tuned per environment.

### Acceptance criteria
- `ipRateLimiter` applies globally with a limit of 300 (or `RATE_LIMIT_IP_MAX`).
- `userRateLimiter` applies to authenticated routes with a limit of 100 (or `RATE_LIMIT_USER_MAX`).
- The rate limit key for authenticated routes is the user UID, not the IP.
- No TypeScript errors.

---

> 🛑 **STOP. Commit this change and wait for user permission before continuing.**

---

## Issue B-3 — Global error handler swallows unknown errors without enough context

### What's wrong
The current global error handler in `src/app.ts`:

```ts
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
  } else {
    logger.error({ err, path: req.path });
    res.status(500).json({ error: "Internal server error" });
  }
});
```

For non-`AppError` exceptions, the client receives only `"Internal server error"` with no code or identifier. This makes debugging nearly impossible during a hackathon: the server log has the error, the client has nothing, and correlating the two requires knowing the exact timestamp and endpoint. In development mode this is especially frustrating.

### How to fix
In development mode, return structured error details to the client. In production, return a correlation ID that can be looked up in the server log:

```ts
// src/app.ts

import { randomUUID } from "crypto";

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  const errorId = randomUUID();

  logger.error({
    errorId,
    err,
    path: req.path,
    method: req.method,
    userId: req.user?.uid ?? null,
  });

  if (config.nodeEnv === "development") {
    return res.status(500).json({
      error: "Internal server error",
      errorId,
      detail: err.message,
      stack: err.stack,
    });
  }

  return res.status(500).json({
    error: "Internal server error",
    errorId, // client can report this ID; it maps to the server log entry
  });
});
```

Also wrap the `AppError` case to log a warning for 4xx errors (useful for detecting bad client integrations):

```ts
if (err instanceof AppError) {
  if (err.statusCode >= 500) {
    logger.error({ err, path: req.path });
  } else {
    logger.warn({ err, path: req.path, statusCode: err.statusCode });
  }
  return res.status(err.statusCode).json({ error: err.message, code: err.code });
}
```

### Acceptance criteria
- In development, a 500 response includes `errorId`, `detail`, and `stack`.
- In production, a 500 response includes only `errorId`.
- The server log entry for every 500 includes the same `errorId`, `path`, `method`, and `userId`.
- 4xx `AppError`s are logged at `warn` level, 5xx at `error`.
- No TypeScript errors.

---

> 🛑 **STOP. Commit this change and wait for user permission before continuing.**

---

## Issue B-4 — No file upload endpoint despite frontend needing one

> ⚠️ **Cross-system:** This issue is the backend half of **Issue F-7** in `FRONTEND_ISSUES.md`. The frontend adds `useUpload` and a `<FileUpload>` component. Both must be completed before either is committed.

### What's wrong
Firebase Storage is available via the Admin SDK, but there is no backend upload endpoint. The current setup relies on the client uploading directly to Firebase Storage — which is fine for the Firebase adapter path, but when the API adapter is active there is no server-side upload path. There is also no server-side validation of file type or size, meaning malicious clients could upload arbitrary content.

Additionally, presigned URLs are not implemented, meaning any user who gets a Storage download URL can share it indefinitely with no access control.

### How to fix

**Step 1 — Add a Zod schema for upload requests in `src/types/api.ts`:**

```ts
export const uploadSchema = z.object({
  fileType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  fileName: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().positive().max(5 * 1024 * 1024), // 5 MB max
});
```

**Step 2 — Add `src/routes/uploads.ts`:**

```ts
import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { userRateLimiter } from "../middleware/rateLimit";
import { validate } from "../utils/validator";
import { uploadSchema } from "../types/api";
import { generateUploadUrl } from "../services/uploads";

const router = Router();

/**
 * POST /api/uploads/presigned
 * Body: { fileType, fileName, fileSizeBytes }
 * Returns: { uploadUrl, storagePath }
 *
 * The client uses the uploadUrl to PUT the file directly to Firebase Storage.
 * No file bytes pass through the backend server.
 */
router.post(
  "/presigned",
  authenticate,
  userRateLimiter,
  validate(uploadSchema),
  async (req, res, next) => {
    try {
      const { fileType, fileName, fileSizeBytes } = req.body;
      const uid = req.user!.uid;
      const result = await generateUploadUrl(uid, fileName, fileType, fileSizeBytes);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
```

**Step 3 — Create `src/services/uploads.ts`:**

```ts
import { getFirebaseAdmin } from "./firebase";
import { randomUUID } from "crypto";

export async function generateUploadUrl(
  uid: string,
  fileName: string,
  fileType: string,
  fileSizeBytes: number
): Promise<{ uploadUrl: string; storagePath: string }> {
  const bucket = getFirebaseAdmin().storage().bucket();
  const ext = fileName.split(".").pop() ?? "bin";
  const storagePath = `uploads/${uid}/${randomUUID()}.${ext}`;

  const [uploadUrl] = await bucket.file(storagePath).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + 15 * 60 * 1000, // 15-minute window
    contentType: fileType,
    extensionHeaders: {
      "x-goog-content-length-range": `0,${fileSizeBytes}`,
    },
  });

  return { uploadUrl, storagePath };
}
```

**Step 4 — Register the route in `src/app.ts`:**

```ts
import uploadsRouter from "./routes/uploads";
app.use("/api/uploads", uploadsRouter);
```

**Step 5 — Update `firestore.rules`** (or Firebase Storage rules) to block direct unauthenticated writes but allow reads for the upload paths:

```
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if false; // All writes go through presigned URLs from the backend
    }
  }
}
```

### Acceptance criteria
- `POST /api/uploads/presigned` returns a `{ uploadUrl, storagePath }` for valid requests.
- Requests with unsupported file types or files over 5 MB are rejected with a 400.
- Unauthenticated requests return 401.
- No file bytes pass through the Express server.
- No TypeScript errors.

---

> 🛑 **STOP. Commit this change (and the matching frontend change from F-7) and wait for user permission before continuing.**

---

## Issue B-5 — Pagination response shape is inconsistent and undocumented

### What's wrong
`src/utils/paginate.ts` contains pagination helpers, and `GET /api/posts` supports pagination. However:

1. The response shape for paginated endpoints is not defined in `src/types/api.ts` — it is ad hoc per route.
2. There is no consistent `nextCursor`/`hasMore` field — different routes may return different shapes.
3. The frontend `usePosts` hook (before fix F-8) ignores pagination entirely, but even after F-8 it depends on a specific response contract that isn't enforced by a shared type.

### How to fix

**Step 1 — Define a shared paginated response type in `src/types/api.ts`:**

```ts
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;          // optional, only if cheap to compute
}
```

**Step 2 — Add a Zod schema for pagination query params:**

```ts
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  after: z.string().optional(),   // cursor — the ID of the last item on the previous page
});
```

**Step 3 — Update `src/utils/paginate.ts`** to return `PaginatedResponse<T>` and accept the cursor from the query schema:

```ts
export async function paginateCollection<T>(
  query: FirebaseFirestore.Query,
  limit: number,
  afterCursor?: string
): Promise<PaginatedResponse<T>> {
  let q = query.limit(limit + 1); // fetch one extra to determine hasMore

  if (afterCursor) {
    const cursorDoc = await getFirestore().doc(afterCursor).get();
    q = q.startAfter(cursorDoc);
  }

  const snapshot = await q.get();
  const docs = snapshot.docs;
  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit).map((d) => ({ id: d.id, ...d.data() } as T));
  const nextCursor = hasMore ? docs[limit - 1].id : null;

  return { items, nextCursor, hasMore };
}
```

**Step 4 — Update `src/routes/posts.ts`** to use `paginationQuerySchema` and return `PaginatedResponse<Post>`:

```ts
router.get("/", authenticate, async (req, res, next) => {
  try {
    const { limit, after } = paginationQuerySchema.parse(req.query);
    const result = await getPostsPage(limit, after);
    res.json(result); // shape: { items, nextCursor, hasMore }
  } catch (err) {
    next(err);
  }
});
```

Apply the same shape to any other paginated endpoints (e.g. a future `/api/users` list endpoint).

### Acceptance criteria
- `PaginatedResponse<T>` is exported from `src/types/api.ts`.
- `GET /api/posts?limit=10` returns `{ items: [...], nextCursor: "...", hasMore: true/false }`.
- `GET /api/posts?limit=10&after=<cursor>` returns the next page.
- Invalid `limit` values return 400.
- No TypeScript errors.

---

> 🛑 **STOP. Commit this change and wait for user permission before continuing.**

---

## Issue B-6 — No Docker / local bootstrap — setup takes too long for a hackathon

### What's wrong
Getting both services running requires:
- Installing Node.js dependencies in two repos
- Configuring Firebase credentials (`fireconfig.json`)
- Setting up two separate `.env` files
- Starting the Firebase emulator suite separately
- Starting the backend dev server
- Starting the frontend dev server

For a hackathon where time is critical, this is 15–30 minutes of setup before writing a single line of feature code. There is no `docker-compose.yml` and no one-command bootstrap.

### How to fix

**Step 1 — Create `docker-compose.yml` at the monorepo root (or in the backend repo if they are separate):**

```yaml
version: "3.9"

services:
  firebase-emulators:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./:/app
    command: >
      sh -c "npm install -g firebase-tools &&
             firebase emulators:start --only auth,firestore,storage
             --project demo-hackathon"
    ports:
      - "9099:9099"   # Auth emulator
      - "8080:8080"   # Firestore emulator
      - "9199:9199"   # Storage emulator
      - "4000:4000"   # Emulator UI
    environment:
      - FIREBASE_TOKEN=${FIREBASE_TOKEN}

  backend:
    image: node:20-alpine
    working_dir: /app/hackathon-backend
    volumes:
      - ./hackathon-backend:/app/hackathon-backend
    command: sh -c "yarn install && yarn dev"
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - FIRESTORE_EMULATOR_HOST=firebase-emulators:8080
      - FIREBASE_AUTH_EMULATOR_HOST=firebase-emulators:9099
      - FIREBASE_STORAGE_EMULATOR_HOST=firebase-emulators:9199
      - ADMIN_UIDS=${ADMIN_UIDS}
      - PORT=3001
    depends_on:
      - firebase-emulators
    env_file:
      - ./hackathon-backend/.env

  frontend:
    image: node:20-alpine
    working_dir: /app/hackathon-frontend
    volumes:
      - ./hackathon-frontend:/app/hackathon-frontend
    command: sh -c "yarn install && yarn dev"
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
      - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost
    depends_on:
      - backend
    env_file:
      - ./hackathon-frontend/.env.local
```

**Step 2 — Create a `bootstrap.sh` script at the root:**

```bash
#!/bin/bash
set -e

echo "🚀 Hackathon starter bootstrap"

# Copy env templates if not already present
[ ! -f hackathon-backend/.env ] && cp hackathon-backend/.env.example hackathon-backend/.env && echo "✅ Created backend .env"
[ ! -f hackathon-frontend/.env.local ] && cp hackathon-frontend/.env.example hackathon-frontend/.env.local && echo "✅ Created frontend .env.local"
[ ! -f hackathon-backend/fireconfig.json ] && cp hackathon-backend/fireconfig.example.json hackathon-backend/fireconfig.json && echo "✅ Created fireconfig.json (fill in credentials)"

echo ""
echo "⚠️  Next steps:"
echo "  1. Add your Firebase credentials to hackathon-backend/fireconfig.json"
echo "  2. Set ADMIN_UIDS in hackathon-backend/.env"
echo "  3. Run: docker-compose up"
echo ""
echo "📺 Emulator UI: http://localhost:4000"
echo "🖥️  Frontend:    http://localhost:3000"
echo "⚙️  Backend:     http://localhost:3001"
```

Make it executable: `chmod +x bootstrap.sh`

**Step 3 — Update the root `README.md`** (create one if it doesn't exist) with a "Quick Start in 3 steps" section:

```md
## Quick start

1. `./bootstrap.sh`       — copies env templates
2. Fill in Firebase credentials in `hackathon-backend/fireconfig.json`
3. `docker-compose up`    — starts everything

That's it. Frontend on :3000, backend on :3001, emulator UI on :4000.
```

### Acceptance criteria
- `docker-compose up` from the repo root starts all three services without manual steps beyond filling in Firebase credentials.
- `bootstrap.sh` creates all env files from templates and prints next steps.
- The frontend can talk to the backend and the Firebase emulators when running via Docker.
- No TypeScript errors (this is infrastructure, so TypeScript is not applicable — ensure the YAML and shell script are valid).

---

> 🛑 **STOP. Commit this change and wait for user permission before continuing.**

---

*End of backend issues. After B-6 is approved, the backend is considered stable for hackathon use.*
