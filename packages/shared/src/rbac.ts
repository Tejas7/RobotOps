export const PERMISSIONS = [
  "robots.read",
  "robots.control",
  "missions.read",
  "missions.write",
  "incidents.read",
  "incidents.write",
  "incidents.ack",
  "teleop.start",
  "teleop.stop",
  "analytics.read",
  "audit.read",
  "integrations.read",
  "integrations.manage",
  "config.read",
  "config.write"
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES: Record<string, Permission[] | "all"> = {
  Owner: "all",
  OpsManager: [
    "robots.read",
    "missions.read",
    "missions.write",
    "incidents.read",
    "incidents.write",
    "teleop.start",
    "teleop.stop",
    "analytics.read"
  ],
  Engineer: [
    "robots.read",
    "robots.control",
    "missions.read",
    "incidents.read",
    "audit.read",
    "integrations.read",
    "config.read",
    "config.write"
  ],
  Operator: [
    "robots.read",
    "missions.read",
    "incidents.read",
    "incidents.ack",
    "teleop.start",
    "teleop.stop"
  ],
  Viewer: ["robots.read", "missions.read", "analytics.read"]
};

export type Role = keyof typeof ROLES;

export function permissionsForRole(role: Role): Permission[] {
  const perms = ROLES[role];
  if (perms === "all") {
    return [...PERMISSIONS];
  }
  return perms;
}

export function hasPermission(role: Role, permission: Permission): boolean {
  const perms = ROLES[role];
  return perms === "all" || perms.includes(permission);
}
