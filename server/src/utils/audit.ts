import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const logAudit = async (
    userId: number,
    action: string,
    entity: string,
    entityId?: number,
    details?: any
) => {
    try {
        await prisma.auditLog.create({
            data: {
                userId,
                action,
                entity,
                entityId,
                details: details ? JSON.stringify(details) : null
            }
        });
    } catch (error) {
        console.error("Failed to log audit:", error);
    }
};
