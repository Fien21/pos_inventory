import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";
import { logAudit } from "../utils/audit";

const router = express.Router();
const prisma = new PrismaClient();

// Get all audit logs
router.get("/", authenticate, async (req, res) => {
    try {
        const logs = await prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true }
                }
            },
            take: 500 // Limit to last 500 for performance
        });
        res.json(logs);
    } catch (error) {
        console.error("Failed to fetch audit logs:", error);
        res.status(500).json({ error: "Failed to fetch audit logs" });
    }
});

// Post a user activity
router.post("/activity", authenticate, async (req: AuthRequest, res) => {
    try {
        const { action, details } = req.body;
        const validActions = ['LOGOUT', 'BREAK_IN', 'BREAK_OUT'];
        if (!validActions.includes(action)) {
            return res.status(400).json({ error: "Invalid action" });
        }
        await logAudit(req.user!.id, action, 'User', req.user!.id, details ? { note: details } : undefined);
        res.json({ success: true });
    } catch (error) {
        console.error("Failed to log activity:", error);
        res.status(500).json({ error: "Failed to log activity" });
    }
});

export default router;
