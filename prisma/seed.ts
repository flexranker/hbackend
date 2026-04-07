import { PrismaClient, OrderSource, OrderStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Reset & Seed using EXACT schema...");

  // Clean everything
  await prisma.auditLog.deleteMany().catch(() => {});
  await prisma.correctionLedger.deleteMany().catch(() => {});
  await prisma.dietaryNote.deleteMany().catch(() => {});
  await prisma.wastageReport.deleteMany().catch(() => {});
  await prisma.revenueLeakage.deleteMany().catch(() => {});
  await prisma.orderItem.deleteMany().catch(() => {});
  await prisma.order.deleteMany().catch(() => {});
  await prisma.recipe.deleteMany().catch(() => {});
  await prisma.contractPrice.deleteMany().catch(() => {});
  await prisma.product.deleteMany().catch(() => {});
  await prisma.customer.deleteMany().catch(() => {});

  console.log("🌱 Creating SPEC data...");

  // 1. CUSTOMERS - EXACT spec
  const techCorp = await prisma.customer.create({
    data: {
      name: "TechCorp Solutions",
      email: "orders@techcorp.com",
      phone: "+1-555-0123",
      companyName: "TechCorp Solutions", // Required field
    },
  });

  const grandPlaza = await prisma.customer.create({
    data: {
      name: "Grand Plaza Hotel",
      email: "fnb@grandplaza.com",
      phone: "+1-555-9876",
      companyName: "Grand Plaza Hotel",
    },
  });

  const sarah = await prisma.customer.create({
    data: {
      name: "Sarah Williams",
      email: "sarah.w@gmail.com",
      phone: "+1-555-4433",
      companyName: "Sarah Williams",
    },
  });

  // 2. PRODUCTS - EXACT spec  
  const chickenBiryani = await prisma.product.create({
    data: {
      name: "Chicken Biryani (Large)",
      sku: "CATER-CB-L",
      category: "Main Course",
      description: "Large Chicken Biryani for catering",
      price: 85.00,
      stock: 500,
      status: "Active",
      supplier: "Central Kitchen",
    },
  });

  const paneerMasala = await prisma.product.create({
    data: {
      name: "Paneer Butter Masala",
      sku: "CATER-PBM",
      category: "Vegetarian",
      description: "Rich paneer in butter masala gravy",
      price: 65.00,
      stock: 300,
      status: "Active", 
      supplier: "Central Kitchen",
    },
  });

  const garlicNaan = await prisma.product.create({
    data: {
      name: "Assorted Garlic Naan",
      sku: "CATER-NAAN-G",
      category: "Sides",
      description: "Fresh garlic naan bread",
      price: 12.00,
      stock: 1000,
      status: "Active",
      supplier: "Bakery Unit",
    },
  });

  // 3. ORDERS - Scenario A: Low Confidence (x3)
  for (let i = 1; i <= 3; i++) {
    await prisma.order.create({
      data: {
        customerId: techCorp.id,
        providerId: `demo-provider-low-${i}`,
        chefId: "demo-chef",
        source: "IMAGE",
        status: "PENDING_REVIEW",
        confidenceScore: 0.58,
        notes: "Extracted from WhatsApp Photo. Handwriting was blurry. Batch " + i,
        requiresManualIntervention: true,
        totalAmount: 1700 + i * 425, // 20 biryani * $85
        items: {
          create: [
            {
              productId: chickenBiryani.id,
              quantity: 20 + i * 5,
              price: 85.00,
            },
            {
              productId: null, // Unmatched handwritten item
              quantity: 10,
              price: 0,
            },
          ],
        },
        dietaryNotes: {
          create: [{
            label: "ALLERGY: Nut Free Required",
            details: "Handwritten note found",
            isCritical: true,
          }],
        },
      },
    });
  }

  // Scenario B: High Confidence (x3)
  for (let i = 1; i <= 3; i++) {
    await prisma.order.create({
      data: {
        customerId: grandPlaza.id,
        providerId: `demo-provider-high-${i}`,
        chefId: "demo-chef",
        source: "EMAIL",
        status: "PENDING_REVIEW",
        confidenceScore: 0.97,
        notes: "SmartOrderManager: Matched 'Same as last Tuesday' request. Batch " + i,
        totalAmount: 3250 + i * 650,
        items: {
          create: [{
            productId: paneerMasala.id,
            quantity: 50 + i * 10,
            price: 65.00,
          }],
        },
      },
    });
  }

  // Scenario C: Active Kitchen (x5)
  for (let i = 1; i <= 5; i++) {
    await prisma.order.create({
      data: {
        customerId: sarah.id,
        providerId: `demo-provider-active-${i}`,
        chefId: "demo-chef",
        source: "WEB",
        status: "PREPARING",
        totalAmount: 1200 + i * 240,
        items: {
          create: [{
            productId: garlicNaan.id,
            quantity: 100 + i * 20,
            price: 12.00,
          }],
        },
      },
    });
  }

  // 4. Revenue Leakage - EXACT spec table
  await prisma.revenueLeakage.createMany({
    data: [
      {
        productId: chickenBiryani.id,
        productName: "Chicken Biryani",
        expectedQty: 100,
        actualQty: 115,
        discrepancy: 15,
      },
      {
        productId: garlicNaan.id,
        productName: "Garlic Naan",
        expectedQty: 200,
        actualQty: 240,
        discrepancy: 40,
      },
      {
        productId: paneerMasala.id,
        productName: "Paneer Masala",
        expectedQty: 50,
        actualQty: 52,
        discrepancy: 2,
      },
    ],
  });

  console.log("✅ PERFECT! 3 Customers + 3 Products + 11 Orders + 3 Leakages 🚀");
  console.log("📊 Your charts will now work perfectly!");
}

main()
.catch(e => console.error(e))
.finally(async () => await prisma.$disconnect());
