import { db } from "../config/db";
import { adminActions } from "../models";

type Executor = Pick<typeof db, "insert">;

/** Write one audit-log row for an admin change. Pass `tx` to make it part of a transaction. */
export async function logAdminAction(
  entry: {
    adminId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    details?: Record<string, unknown>;
  },
  tx: Executor = db
) {
  await tx.insert(adminActions).values({
    adminId: entry.adminId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    details: entry.details ?? null,
  });
}
