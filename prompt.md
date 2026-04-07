You are an expert Express + TypeScript backend developer. Create a production-ready Express API backend that **perfectly matches** this frontend contract for hackathon speed and scalability.

## REQUIRED FRONTEND CONTRACT (Implement EXACTLY)

### Authentication Flow
Frontend sends Firebase ID tokens in `Authorization: Bearer <token>`. You **MUST**:
1. Extract token from header
2. Verify with Firebase Admin SDK  
3. Attach decoded user to `req.user`
4. Protect all `/api/*` routes

### API Endpoints (Exact Match Required)

USERS:
GET /api/users/:id # Get user profile
POST /api/users # Create user (onboarding)
PATCH /api/users/:id # Update profile
DELETE /api/users/:id # Delete account
POSTS:
GET /api/posts # List posts (paginated)
GET /api/posts/:id # Single post
POST /api/posts # Create post
PATCH /api/posts/:id # Update post
DELETE /api/posts/:id # Delete post
HEALTH:
GET /api/health # {"status": "ok"}
text

### Response Format (Zod Validated by Frontend)
```json
// User
{ "id": "uid", "email": "user@ex.com", "name": "Mike", "avatar": "...", "createdAt": "2026-..." }

// Post  
{ "id": "post1", "title": "Hackathon", "content": "...", "authorId": "uid", "createdAt": "2026-..." }

TECHNOLOGY STACK (Use Exactly)
text
Runtime: Node.js 20+ (ES Modules)
Framework: Express 4.19+
Language: TypeScript 5.x (strict)
Database: Firebase Firestore (emulators in dev)
Validation: Zod 3.x
Security: Helmet, CORS, rate-limiter
Dev: tsx (hot reload), BiomeJS
Deploy: Vercel serverless

PROJECT STRUCTURE
text
src/
├── middleware/           # auth.ts, rateLimit.ts, validate.ts
├── routes/              # users.ts, posts.ts
├── services/            # firestore.ts, auth.ts
├── types/               # api.ts, db.ts
├── utils/               # logger.ts, paginate.ts, errors.ts
├── app.ts               # Express app setup
└── server.ts            # Entry point

COMPLETE IMPLEMENTATION REQUIREMENTS
1. Firebase Admin Setup (Dev/Prod)
typescript
// Auto-detect emulators in dev mode
if (NODE_ENV === 'development') {
  connectFirestoreEmulator(admin.firestore(), '127.0.0.1', 8080);
}

.env support for both local emulators and prod Firebase.
2. Authentication Middleware (src/middleware/auth.ts)
typescript
export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    const user = await admin.auth().verifyIdToken(token);
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

3. Data Service Layer (src/services/firestore.ts)
Collections: users, posts
CRUD operations with Firestore
Pagination (limit, page params)
Real-time capable (batch writes)
4. Input Validation (Zod Everywhere)
typescript
const createUserSchema = z.object({
  name: z.string().min(2),
  avatar: z.string().url().optional(),
});

5. Error Handling (Global)
text
400: ValidationError
401: AuthError  
403: ForbiddenError
404: NotFoundError
500: InternalError

Standardized JSON responses.
6. HACKATHON UTILITIES (src/utils/)
text
- logger.ts (pino with request IDs)
- paginate.ts (offset-based + cursor)
- errors.ts (custom error classes)
- validator.ts (Zod composables)
- rateLimit.ts (sliding window)
- health.ts (status checks)

7. ROUTE EXAMPLES (Express Router)
typescript
// src/routes/users.ts
router.get('/:id', authenticate, validate(getUserSchema), getUserHandler);
router.post('/', authenticate, validate(createUserSchema), createUserHandler);

ENVIRONMENT VARIABLES
bash
# Firebase Admin (secret)
FIREBASE_ADMIN_CREDENTIALS={"type":"service_account",...}

# Frontend origin (CORS)
FRONTEND_URL=http://localhost:3000

# Dev mode
NODE_ENV=development
PORT=3001

PACKAGE.JSON SCRIPTS
json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js", 
    "lint": "biome check src/",
    "format": "biome format --write src/",
    "type-check": "tsc --noEmit"
  }
}

PRODUCTION FEATURES
text
✅ Vercel serverless ready (api/index.ts)
✅ CORS configurable 
✅ Rate limiting (100 req/min per IP)
✅ Helmet security headers
✅ JSON body parsing (50mb limit)
✅ Graceful shutdown
✅ Health endpoint
✅ Structured logging
✅ Input sanitization

FLEXIBILITY FOR HACKATHONS
Database Swap: Easy Firestore → Postgres/Mongo migration
Auth Swap: Firebase → JWT/custom later
Add Endpoints: New routes/notifications.ts pattern
Scale: Cluster mode ready
Extend: Service layer injectable
DELIVERABLES
Complete Express API matching frontend contract
README.md with:
bash
yarn install
cp .env.example .env
# Add Firebase service account JSON
yarn dev

Postman collection (postman.json) for all endpoints
TypeScript definitions (types/api.ts) for frontend sync
Dockerfile for Railway/Render deployment
DEPLOYMENT
text
Vercel: Push to GitHub → auto-deploy
Railway: git push → auto-deploy  
Render: Docker build

SUCCESS CRITERIA
✅ curl -H "Authorization: Bearer <token>" https://api/users/123 → 200 OK
✅ Frontend setBackend("api") → instant integration
✅ yarn dev → hot reload + emulators
✅ Zero frontend changes required

Make it hackathon-fast: 60 seconds from clone to working API. Match the frontend's extensibility with clean service boundaries and TypeScript everywhere. Generate all expected JSON responses exactly as frontend expects.

Questions? Ask before coding.


