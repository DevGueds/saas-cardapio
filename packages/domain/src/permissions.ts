export const roles = [
  "OWNER",
  "MANAGER",
  "STAFF",
  "CASHIER",
  "KITCHEN",
  "COURIER",
  "VIEWER",
] as const
export type Role = (typeof roles)[number]
export type Permission =
  | "catalog:read"
  | "catalog:write"
  | "orders:read"
  | "orders:write"
  | "orders:dispatch"
  | "members:write"
  | "security:write"
  | "payments:read"
  | "payments:write"
  | "payments:reverse"
  | "reports:read"
  | "printing:configure"
export const roleLabels: Record<Role, string> = {
  OWNER: "Proprietário",
  MANAGER: "Gerente",
  STAFF: "Atendente (legado)",
  CASHIER: "Caixa / atendimento",
  KITCHEN: "Cozinha",
  COURIER: "Entregador",
  VIEWER: "Consulta",
}
const permissions: Record<Role, readonly Permission[]> = {
  OWNER: [
    "printing:configure",
    "catalog:read",
    "catalog:write",
    "orders:read",
    "orders:write",
    "orders:dispatch",
    "members:write",
    "security:write",
    "payments:read",
    "payments:write",
    "payments:reverse",
    "reports:read",
  ],
  MANAGER: [
    "printing:configure",
    "security:write",
    "payments:read",
    "payments:write",
    "payments:reverse",
    "reports:read",
    "catalog:read",
    "catalog:write",
    "orders:read",
    "orders:write",
    "orders:dispatch",
  ],
  STAFF: ["catalog:read", "orders:read", "orders:write", "orders:dispatch"],
  CASHIER: [
    "catalog:read",
    "orders:read",
    "orders:write",
    "orders:dispatch",
    "payments:read",
    "payments:write",
  ],
  KITCHEN: ["catalog:read", "orders:read", "orders:write"],
  COURIER: ["catalog:read", "orders:read", "orders:write"],
  VIEWER: ["catalog:read", "orders:read"],
}
export function can(role: Role | undefined, permission: Permission) {
  return !!role && !!permissions[role]?.includes(permission)
}
export function canAdvance(role: Role, next: string) {
  if (!can(role, "orders:write")) return false
  if (role === "KITCHEN") return next === "PREPARING" || next === "READY"
  if (role === "COURIER") return next === "OUT_FOR_DELIVERY" || next === "COMPLETED"
  return true
}
