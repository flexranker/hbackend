# 📊 Catering OMS: Dummy Data Seeding Specification

This document provides the structured JSON payloads for seeding the backend database. These records are designed to exercise the **AI Confidence Gauges**, **State Machine**, and **Revenue Leakage** visualizations in the frontend.

## 1. Customers (`/api/customers`)
*Seed these first to obtain UUIDs for order creation.*

| Name | Email | Phone | Notes |
| :--- | :--- | :--- | :--- |
| **TechCorp Solutions** | orders@techcorp.com | +1-555-0123 | VIP Corporate Account |
| **Grand Plaza Hotel** | fnb@grandplaza.com | +1-555-9876 | High volume daily |
| **Sarah Williams** | sarah.w@gmail.com | +1-555-4433 | Regular individual |

---

## 2. Products (`/api/products`)
*Used for the inventory and order line items.*

```json
[
  {
    "id": "prod-uuid-1",
    "name": "Chicken Biryani (Large)",
    "sku": "CATER-CB-L",
    "category": "Main Course",
    "price": 85.00,
    "stock": 500,
    "status": "Active",
    "supplier": "Central Kitchen"
  },
  {
    "id": "prod-uuid-2",
    "name": "Paneer Butter Masala",
    "sku": "CATER-PBM",
    "category": "Vegetarian",
    "price": 65.00,
    "stock": 300,
    "status": "Active",
    "supplier": "Central Kitchen"
  },
  {
    "id": "prod-uuid-3",
    "name": "Assorted Garlic Naan",
    "sku": "CATER-NAAN-G",
    "category": "Sides",
    "price": 12.00,
    "stock": 1000,
    "status": "Active",
    "supplier": "Bakery Unit"
  }
]
```

---

## 3. Orders State Machine Scenarios (`/api/orders`)

### Scenario A: Low Confidence AI Ingestion
**Status:** `PENDING_REVIEW`
**Goal:** Verify the **"Low Confidence"** red gauge and extraction review UI.
```json
{
  "id": "ord-low-conf",
  "customerId": "techcorp-uuid",
  "source": "IMAGE",
  "status": "PENDING_REVIEW",
  "confidenceScore": 0.58,
  "dietaryNotes": "ALLERGY: Nut Free Required",
  "items": [
    { "productId": "prod-uuid-1", "quantity": 20 },
    { "productId": null, "quantity": 10, "notes": "Handwritten item: 'Chic Tikka?'" }
  ],
  "notes": "Extracted from WhatsApp Photo. Handwriting was blurry."
}
```

### Scenario B: High Confidence AI Ingestion
**Status:** `PENDING_REVIEW`
**Goal:** Verify the **Green Gauge** (95%+).
```json
{
  "id": "ord-high-conf",
  "customerId": "grandplaza-uuid",
  "source": "EMAIL",
  "status": "PENDING_REVIEW",
  "confidenceScore": 0.97,
  "items": [
    { "productId": "prod-uuid-2", "quantity": 50 }
  ],
  "notes": "SmartOrderManager: Matched 'Same as last Tuesday' request."
}
```

### Scenario C: Active Kitchen Order
**Status:** `PREPARING`
**Goal:** Show in the active dashboard feed.
```json
{
  "id": "ord-active-1",
  "customerId": "sarah-uuid",
  "source": "WEB",
  "status": "PREPARING",
  "items": [{ "productId": "prod-uuid-3", "quantity": 100 }]
}
```

---

## 4. Revenue Leakage Data (`/api/kitchen/:id/wastage`)
*To populate the "Revenue Leakage" bar charts in Analytics.*

| Product Name | Invoiced Qty (Expected) | Cooked Qty (Actual) | Discrepancy (Leakage) |
| :--- | :--- | :--- | :--- |
| **Chicken Biryani** | 100 units | 115 units | **+15% (Wasted)** |
| **Garlic Naan** | 200 units | 240 units | **+20% (Unaccounted)** |
| **Paneer Masala** | 50 units | 52 units | **+4% (Acceptable)** |

---

## 5. AI Accuracy Metrics (`/api/v1/admin/analytics/ai-accuracy`)
*Returned by the analytics endpoint.*

```json
{
  "accuracy": 94.2,
  "totalCorrections": 124,
  "volume": 1284,
  "topFailurePoints": ["Handwritten menus", "Voice notes with background noise"]
}
```

## 6. Real-Time Socket.io Events
*Trigger these events manually to test live UI updates.*

1.  **New Order**: `emit("NEW_ORDER_RECEIVED", <OrderObject>)`
2.  **Dietary Warning**: `emit("ALERT_DIETARY", { "orderId": "uuid", "findings": ["Peanuts detected in Recipe #4", "Customer has Nut Allergy"] })`
3.  **Leakage Alert**: `emit("LEAKAGE_ALERT", { "productName": "Garlic Naan", "discrepancy": "20%", "date": "2024-03-20" })`

