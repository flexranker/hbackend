# Professional Integration Specification: Catering OMS Backend

This document provides a comprehensive technical blueprint for integrating the frontend dashboard and kitchen applications with the backend ecosystem.

---

## 1. Architectural Standards
- **Endpoint Versioning:** Currently using `/api/...` for core CRUD and `/api/v1/...` for advanced AI/Analytics modules.
- **Authentication:** All protected routes require a Firebase ID Token.
  - **Header:** `Authorization: Bearer <ID_TOKEN>`
- **Real-Time Layer:** Powered by Socket.io. You **must** emit a join event immediately after connecting.
- **Data Precision:** Currency is handled as `Decimal` (mapped to Strings/Numbers in JSON). Quantities are `Int` or `Decimal(10,3)`.

---

## 2. Order Management System (OMS)

### 2.1 The State Machine
Orders must transition in this order. Jumping states may bypass critical logic (like Zoho triggers).
1. `DRAFT`: Initial state.
2. `PENDING_REVIEW`: Automated state for AI-ingested orders. **Frontend must prioritize these.**
3. `PENDING_APPROVAL`: Ready for admin/customer "green light".
4. `CONFIRMED`: Triggers Zoho Estimate. Kitchen sees the order now.
5. `PREPARING`: Kitchen has started prep.
6. `DELIVERED`: Triggers Zoho Invoice conversion.

### 2.2 Core Order Routes
- **GET** `/api/orders`: List all orders. (Includes `customer` relation).
- **GET** `/api/orders/:id`: Detailed order view (Includes `items`, `product` details, `customer`, `dietaryNotes`).
- **POST** `/api/orders`: Manual order creation.
  - **Payload:** 
    ```json
    {
      "customerId": "uuid",
      "providerId": "uuid",
      "source": "WEB" | "PHONE" | "EMAIL",
      "items": [{ "productId": "uuid", "quantity": 10 }],
      "notes": "Optional string"
    }
    ```
- **PATCH** `/api/orders/:id/status`: Transition the order.
  - **Payload:** `{ "status": "PREPARING" }`

---

## 3. Multi-Modal AI Ingestion (v1)

### 3.1 AI Intake
- **POST** `/api/v1/orders/ingest-ai`
- **Use Case:** Converting WhatsApp text, voice notes, or menu photos into structured orders.
- **Payload:**
  ```json
  {
    "customerId": "uuid",
    "providerId": "uuid",
    "inputType": "text" | "image" | "audio",
    "inputData": "The raw text OR public URL to file OR base64"
  }
  ```
- **Logic:** This route runs the `SmartOrderManager` (for "Same as last time") AND the `AIExtractorService`.

### 3.2 AI Correction & Review
When an order is in `PENDING_REVIEW`, the frontend **must** provide a correction UI.
- **PATCH** `/api/orders/:id/review`
- **Payload:** The updated order object.
- **Critical:** This route logs the diff into the `CorrectionLedger` which powers our AI learning loop.

---

## 4. Kitchen & Predictive Prep

### 4.1 Ingredient Prediction
- **GET** `/api/kitchen/:orderId/prediction`
- **Response:**
  ```json
  [
    { "ingredientId": "uuid", "ingredientName": "Basmati Rice", "expectedQty": 4.5, "unit": "kg" }
  ]
  ```

### 4.2 Production Logging (Wastage)
When marking an order as finished, the kitchen app should prompt for actual ingredient usage.
- **POST** `/api/kitchen/:orderId/wastage`
- **Payload:**
  ```json
  {
    "chefId": "string",
    "usages": [{ "ingredientId": "uuid", "actualQty": 5.0 }]
  }
  ```

---

## 5. Admin Analytics & AI Self-Improvement

### 5.1 AI Accuracy Metrics
- **GET** `/api/v1/admin/analytics/ai-accuracy`
- **Returns:** Accuracy %, total corrections, and volume. Use this for a "System Health" chart.

### 5.2 Manual Learning Trigger
- **POST** `/api/v1/admin/analytics/optimize-prompt`
- **Action:** Forces the AI to read the `CorrectionLedger` and update its own internal rules immediately.

---

## 6. Real-Time Socket.io Events
**Namespace:** Root `/`
**Room Strategy:** `socket.emit("join-provider", providerId)`

| Event | Payload | Description |
| :--- | :--- | :--- |
| `NEW_ORDER_RECEIVED` | `Order` object | New order created via any channel. |
| `STATUS_UPDATED` | `{ orderId, status }` | Live status tracking for dashboard. |
| `ALERT_DIETARY` | `{ orderId, findings: [...] }` | **URGENT:** Flashing red alert for allergies. |
| `LEAKAGE_ALERT` | `{ productName, discrepancy, date }` | Discrepancy between cooked vs invoiced. |

---

## 7. Strategic Frontend Implementation Ideas

### 🚀 **UI/UX Pro-Tips for the Developer:**
1.  **The "AI confidence Gauge":** Every order has a `confidenceScore` (0-1). Display a small circular gauge. If < 0.7, add a "Low Confidence" badge.
2.  **Product Resolver Highlights:**
    - Items marked `MATCH`: Green check.
    - Items marked `NEEDS_CONFIRMATION`: Yellow highlight + "Did you mean [MatchedName]?" button.
    - Items marked `UNRECOGNIZED`: Red text + searchable dropdown to manual select.
3.  **Real-Time Kitchen Feed:** Use the `ALERT_DIETARY` event to play an audio chime in the kitchen app. Don't rely on visual-only for safety.
4.  **Smart Repeat Buttons:** If the `SmartOrderManager` auto-fills an order, show a tooltip: *"Auto-filled based on customer's last order of 20 Chicken Biryanis."*
5.  **Reconciliation Dashboard:** Create a "Revenue Leakage" view. Compare `actualQty` vs `expectedQty` using a bar chart to show which products are being "wasted" or stolen.
6.  **Media Preview:** For `inputType: image`, show the photo of the handwritten menu side-by-side with the AI-extracted fields for easy comparison.

---

## 8. CRUD Reference
- **Customers:** `GET/POST /api/customers`
- **Products:** `GET/POST /api/products` (Includes `recipes` and `contractPrices`)
- **Uploads:** `POST /api/uploads` (Returns `{ uploadUrl, key }` for direct S3/Firebase Storage uploads).
