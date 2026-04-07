# 🍱 Snap Order: AI-Powered Corporate Catering OMS

Snap Order is an intelligent, high-performance Order Management System (OMS) designed to unify fragmented catering inputs (WhatsApp, Voice, Images, Web) into a single, automated workflow. It features self-improving AI, real-time safety alerts, and deep financial integration.

---

## 🚀 Key Innovations

### 1. Multi-Modal AI Concierge
- **Vision Ingestion:** Snap a photo of a handwritten menu or order sheet; the AI extracts items, quantities, and locations automatically.
- **Voice Ingestion:** Process and transcribe WhatsApp voice notes into structured database orders.
- **Context-Aware Dialogue:** The AI recognizes returning customers, remembers their order history, and applies contract-specific pricing.

### 2. Self-Improving Feedback Loop
- **Correction Ledger:** Every manual edit by an admin is logged.
- **Prompt Optimizer:** A daily automated process that teaches the AI from its own mistakes, generating "Few-Shot" examples to improve future extraction accuracy.

### 3. Food Safety & Dietary Protection
- **Allergy Scanning:** Automatic AI scanning for 10+ allergens and dietary preferences (Halal, Vegan, Keto).
- **Kitchen Alerts:** Real-time Socket.io notifications ("ALERT_DIETARY") flashing critical safety info directly to the kitchen staff.

### 4. Financial Integrity Engine
- **Automated Accounting:** Full Zoho Books integration—Estimates are created on approval, and Invoices are generated on delivery.
- **Revenue Leakage Audit:** Daily automated reconciliation comparing items cooked in the kitchen vs. items actually billed.
- **Contract Pricing:** Automatic lookup for customer-specific rates with a global price fallback.

---

## 🛠️ Technical Stack
- **Runtime:** Node.js (TypeScript)
- **Framework:** Express.js
- **Database:** PostgreSQL (Supabase) + Prisma ORM
- **AI Engine:** Google Gemini 1.5 Flash
- **Real-Time:** Socket.io
- **Automation:** Node-Cron
- **Validation:** Zod + Fuse.js (Fuzzy Matching)

---

## 🔌 API Overview

### AI Ingestion
- `POST /api/v1/orders/ingest-ai`: Ingest text, image, or audio for AI extraction.
- `PATCH /api/orders/:id/review`: Admin review route that feeds the AI learning loop.

### Kitchen & Prep
- `GET /api/kitchen/:id/prediction`: Get AI-calculated ingredient prep lists.
- `POST /api/kitchen/:id/wastage`: Record actual ingredient usage for audit.

### Webhooks
- `POST /api/v1/webhooks/whatsapp`: Twilio integration for the AI Concierge.

### Admin & Analytics
- `GET /api/v1/admin/analytics/ai-accuracy`: View real-time AI performance metrics.
- `POST /api/v1/admin/analytics/optimize-prompt`: Manually trigger AI learning.

---

## 🚦 Getting Started

### 1. Environment Configuration
Create a `.env` file with the following:
```env
DATABASE_URL="your_pooled_postgres_url"
DIRECT_URL="your_direct_postgres_url"
GEMINI_API_KEY="your_google_ai_studio_key"
JWT_SECRET="your_secure_secret"
```

### 2. Installation & Setup
```bash
yarn install
npx prisma db push
npx prisma db seed # Populates demo data for AI and Revenue audits
```

### 3. Development
```bash
yarn dev
```

---

## 📊 Documentation
Detailed guides for specific team roles:
- **[HACKATHON_REPORT.md](./HACKATHON_REPORT.md)**: Executive summary of all implemented modules.
- **[FRONTEND_INTEGRATION_GUIDE.md](./FRONTEND_INTEGRATION_GUIDE.md)**: Technical spec for frontend-backend connection.
- **[GIT_TIMELINE_REPORT.md](./GIT_TIMELINE_REPORT.md)**: Technical audit of the project development timeline.

---

## 🛡️ Security & Fail-Safes
- **Trust Proxy:** Optimized for Leapcell/Vercel deployments.
- **Audit Logs:** Global middleware logging all system errors to a permanent `AuditLog` table.
- **Nudge System:** Automated watchdog that alerts on stuck orders sitting in `DRAFT` for >4 hours.
