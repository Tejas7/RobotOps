export const PERMISSIONS = [
  "robots.read",
  "robots.control",
  "robots.control.dock",
  "robots.control.pause",
  "robots.control.resume",
  "robots.control.speed_limit",
  "missions.read",
  "missions.write",
  "missions.create",
  "missions.update",
  "incidents.read",
  "incidents.write",
  "incidents.ack",
  "incidents.resolve",
  "teleop.start",
  "teleop.stop",
  "telemetry.read",
  "telemetry.ingest",
  "analytics.read",
  "analytics.read.site",
  "analytics.read.cross_site",
  "analytics.export",
  "audit.read",
  "integrations.read",
  "integrations.manage",
  "integrations.test",
  "config.read",
  "config.write",
  "alerts.read",
  "alerts.manage",
  "rbac.read",
  "rbac.write"
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const DEPRECATED_PERMISSIONS: Permission[] = ["robots.control", "missions.write", "incidents.write", "analytics.read"];

export const PERMISSION_ALIASES: Partial<Record<Permission, Permission[]>> = {
  "robots.control": ["robots.control.dock", "robots.control.pause", "robots.control.resume", "robots.control.speed_limit"],
  "missions.write": ["missions.create", "missions.update"],
  "incidents.write": ["incidents.resolve"],
  "analytics.read": ["analytics.read.site", "analytics.read.cross_site", "analytics.export"],
  "integrations.manage": ["integrations.test"]
};

export const ROLES: Record<string, Permission[] | "all"> = {
  Owner: "all",
  OpsManager: [
    "robots.read",
    "missions.read",
    "missions.create",
    "missions.update",
    "missions.write",
    "incidents.read",
    "incidents.resolve",
    "incidents.write",
    "incidents.ack",
    "teleop.start",
    "teleop.stop",
    "analytics.read",
    "analytics.read.site",
    "analytics.export",
    "telemetry.read",
    "alerts.read",
    "alerts.manage",
    "integrations.read"
  ],
  Engineer: [
    "robots.read",
    "robots.control",
    "robots.control.dock",
    "robots.control.pause",
    "robots.control.resume",
    "robots.control.speed_limit",
    "missions.read",
    "missions.create",
    "missions.update",
    "missions.write",
    "incidents.read",
    "incidents.resolve",
    "incidents.write",
    "telemetry.read",
    "telemetry.ingest",
    "audit.read",
    "analytics.read.site",
    "analytics.export",
    "integrations.read",
    "integrations.manage",
    "integrations.test",
    "alerts.read",
    "alerts.manage",
    "config.read",
    "config.write",
    "rbac.read",
    "rbac.write"
  ],
  Operator: [
    "robots.read",
    "missions.read",
    "incidents.read",
    "incidents.ack",
    "telemetry.read",
    "alerts.read",
    "teleop.start",
    "teleop.stop"
  ],
  Viewer: ["robots.read", "missions.read", "analytics.read", "analytics.read.site", "telemetry.read", "alerts.read"]
};

export type Role = keyof typeof ROLES;

export function permissionsForRole(role: Role): Permission[] {
  const perms = ROLES[role];
  if (perms === "all") {
    return [...PERMISSIONS];
  }
  return normalizePermissions(perms);
}

export function normalizePermissions(input: readonly string[]): Permission[] {
  const normalized = new Set<Permission>();

  for (const entry of input) {
    if (!PERMISSIONS.includes(entry as Permission)) {
      continue;
    }

    const permission = entry as Permission;
    normalized.add(permission);
    for (const expanded of PERMISSION_ALIASES[permission] ?? []) {
      normalized.add(expanded);
    }
  }

  return [...normalized];
}

export function permissionImplies(granted: string, required: Permission): boolean {
  if (granted === required) {
    return true;
  }
  if (!PERMISSIONS.includes(granted as Permission)) {
    return false;
  }
  return (PERMISSION_ALIASES[granted as Permission] ?? []).includes(required);
}

export function hasPermission(role: Role, permission: Permission, grantedPermissions?: readonly string[]): boolean {
  if (role === "Owner") {
    return true;
  }

  const normalized = grantedPermissions ? normalizePermissions(grantedPermissions) : permissionsForRole(role);
  return normalized.some((granted) => permissionImplies(granted, permission));
}
