import { z } from "zod";

export const robotActionSchema = z.object({
  action: z.enum(["dock", "pause", "resume", "speed_limit"]),
  params: z.record(z.string(), z.unknown()).default({})
});

export const missionWaypointSchema = z.object({
  name: z.string().min(1),
  x: z.number(),
  y: z.number(),
  zone_id: z.string().min(1).optional()
});

export const missionCreateSchema = z.object({
  name: z.string().min(3),
  type: z.enum(["pickup_dropoff", "patrol", "inventory", "cleaning", "custom"]),
  priority: z.enum(["low", "normal", "high", "critical"]),
  site_id: z.string().min(1),
  assigned_robot_id: z.string().nullable(),
  route: z.object({
    waypoints: z.array(missionWaypointSchema).min(2),
    planned_path_polyline: z.array(z.object({ x: z.number(), y: z.number() })).min(2)
  }),
  operator_acknowledged_restricted_zones: z.boolean().optional().default(false)
});

export const incidentResolveSchema = z.object({
  note: z.string().min(3)
});

export const copilotMessageSchema = z.object({
  thread_id: z.string().min(1),
  content: z.string().min(1)
});

export type RobotActionInput = z.infer<typeof robotActionSchema>;
export type MissionCreateInput = z.infer<typeof missionCreateSchema>;
export type IncidentResolveInput = z.infer<typeof incidentResolveSchema>;
export type CopilotMessageInput = z.infer<typeof copilotMessageSchema>;
