import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

// Get all inventory audits
router.get("/", authenticate, async (req, res) => {
    try {
        const audits = await prisma.inventoryAudit.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                auditor: { select: { id: true, name: true } },
                items: {
                    include: {
                        product: { select: { name: true, barcode: true } }
                    }
                }
            }
        });
        res.json(audits);
    } catch (error) {
        console.error("Failed to fetch inventory audits:", error);
        res.status(500).json({ error: "Failed to fetch inventory audits" });
    }
});

// Create a new inventory audit session
router.post("/", authenticate, async (req: any, res) => {
    try {
        const { notes, items } = req.body;
        // items is array of { productId, actualQty, notes }

        const newAudit = await prisma.$transaction(async (tx) => {
            // Fetch current stock for all products in audit
            const productIds = items.map((i: any) => i.productId);
            const products = await tx.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, stockQty: true }
            });

            const productMap = new Map(products.map(p => [p.id, p.stockQty]));

            const auditItems = items.map((i: any) => {
                const expectedQty = productMap.get(i.productId) || 0;
                return {
                    productId: i.productId,
                    expectedQty,
                    actualQty: i.actualQty,
                    variance: i.actualQty - expectedQty,
                    notes: i.notes || ""
                };
            });

            // Create audit
            const audit = await tx.inventoryAudit.create({
                data: {
                    auditorId: req.user.id,
                    notes: notes || "",
                    items: {
                        create: auditItems
                    }
                },
                include: { items: true }
            });

            return audit;
        });

        // Also add to audit logs
        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: "CREATE",
                entity: "InventoryAudit",
                entityId: newAudit.id,
                details: JSON.stringify({ itemsCount: newAudit.items.length })
            }
        });

        res.status(201).json(newAudit);
    } catch (error) {
        console.error("Failed to create inventory audit:", error);
        res.status(500).json({ error: "Failed to create inventory audit" });
    }
});

// Complete an audit and apply variances to stock
router.post("/:id/complete", authenticate, async (req: any, res) => {
    try {
        const auditId = parseInt(req.params.id);
        const audit = await prisma.inventoryAudit.findUnique({
            where: { id: auditId },
            include: { items: true }
        });

        if (!audit) return res.status(404).json({ error: "Audit not found" });
        if (audit.status === "COMPLETED") return res.status(400).json({ error: "Audit already completed" });

        await prisma.$transaction(async (tx) => {
            // Update stock for each item based on actualQty
            for (const item of audit.items) {
                if (item.variance !== 0) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stockQty: item.actualQty }
                    });
                }
            }

            // Mark audit as complete
            await tx.inventoryAudit.update({
                where: { id: auditId },
                data: { status: "COMPLETED", completedAt: new Date() }
            });
        });
        
        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: "UPDATE",
                entity: "InventoryAudit",
                entityId: auditId,
                details: JSON.stringify({ action: "COMPLETED" })
            }
        });

        res.json({ message: "Audit completed successfully" });
    } catch (error) {
        console.error("Failed to complete inventory audit:", error);
        res.status(500).json({ error: "Failed to complete inventory audit" });
    }
});

export default router;
