const { prisma } = require("../utils/prisma");

async function logAudit({ client, actorId, entityType, entityId, action, field, oldValue, newValue }) {
  const db = client || prisma;
  return db.auditLog.create({
    data: {
      actorId,
      entityType,
      entityId,
      action,
      field,
      oldValue: oldValue == null ? null : String(oldValue),
      newValue: newValue == null ? null : String(newValue),
    },
  });
}

module.exports = { logAudit };
