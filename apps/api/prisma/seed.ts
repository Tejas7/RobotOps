import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const seedNow = Date.now();
const secondsAgo = (seconds: number) => new Date(seedNow - seconds * 1000);
const hoursAgo = (hours: number) => new Date(seedNow - hours * 60 * 60 * 1000);

async function main() {
  await prisma.alertDelivery.deleteMany();
  await prisma.alertEvent.deleteMany();
  await prisma.alertRule.deleteMany();
  await prisma.alertPolicyStep.deleteMany();
  await prisma.alertPolicy.deleteMany();
  await prisma.adapterReplayRunEvent.deleteMany();
  await prisma.adapterReplayRun.deleteMany();
  await prisma.adapterHealthState.deleteMany();
  await prisma.roleScopeOverride.deleteMany();
  await prisma.tenantAnalyticsRollupHourly.deleteMany();
  await prisma.siteAnalyticsRollupHourly.deleteMany();
  await prisma.telemetryDeadLetter.deleteMany();
  await prisma.messageDedupeWindow.deleteMany();
  await prisma.ingestionEvent.deleteMany();
  await prisma.canonicalMessage.deleteMany();
  await prisma.copilotMessage.deleteMany();
  await prisma.copilotThread.deleteMany();
  await prisma.roleDashboardDefault.deleteMany();
  await prisma.savedView.deleteMany();
  await prisma.dashboardConfig.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.integrationTestRun.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.proximityEvent.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.incidentEvent.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.taskLastStatus.deleteMany();
  await prisma.missionEvent.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.robotLastState.deleteMany();
  await prisma.vendorSiteMap.deleteMany();
  await prisma.robotPathPoint.deleteMany();
  await prisma.telemetryPoint.deleteMany();
  await prisma.robot.deleteMany();
  await prisma.robotVendor.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.floorplan.deleteMany();
  await prisma.siteSetting.deleteMany();
  await prisma.site.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  await prisma.tenant.create({
    data: {
      id: "t1",
      name: "Demo Robotics Co",
      plan: "enterprise",
      createdAt: new Date("2026-01-10T10:00:00Z")
    }
  });

  await prisma.user.createMany({
    data: [
      {
        id: "u1",
        tenantId: "t1",
        email: "owner@demo.com",
        name: "Alice Owner",
        password: "password123",
        role: "Owner",
        permissions: [],
        createdAt: new Date("2026-01-12T10:00:00Z")
      },
      {
        id: "u2",
        tenantId: "t1",
        email: "ops@demo.com",
        name: "Omar Ops",
        password: "password123",
        role: "OpsManager",
        permissions: [],
        createdAt: new Date("2026-01-12T10:05:00Z")
      },
      {
        id: "u3",
        tenantId: "t1",
        email: "engineer@demo.com",
        name: "Erin Engineer",
        password: "password123",
        role: "Engineer",
        permissions: [],
        createdAt: new Date("2026-01-12T10:10:00Z")
      }
    ]
  });

  await prisma.site.createMany({
    data: [
      {
        id: "s1",
        tenantId: "t1",
        name: "Toronto Warehouse 01",
        address: "Toronto, ON",
        timezone: "America/Toronto",
        createdAt: new Date("2026-01-12T10:00:00Z")
      },
      {
        id: "s2",
        tenantId: "t1",
        name: "Montreal Fulfillment Hub",
        address: "Montreal, QC",
        timezone: "America/Toronto",
        createdAt: new Date("2026-01-15T08:30:00Z")
      }
    ]
  });

  await prisma.siteSetting.createMany({
    data: [
      {
        tenantId: "t1",
        siteId: "s1",
        robotOfflineAfterSeconds: 7200,
        robotStatePublishPeriodSeconds: 2
      },
      {
        tenantId: "t1",
        siteId: "s2",
        robotOfflineAfterSeconds: 7200,
        robotStatePublishPeriodSeconds: 2
      }
    ]
  });

  await prisma.floorplan.createMany({
    data: [
      {
        id: "f1",
        tenantId: "t1",
        siteId: "s1",
        name: "Main Floor",
        imageUrl: "/static/floorplans/warehouse_demo.png",
        scaleMetersPerPixel: 0.05,
        originX: 0,
        originY: 0,
        rotationDegrees: 0
      },
      {
        id: "f1b",
        tenantId: "t1",
        siteId: "s1",
        name: "Mezzanine",
        imageUrl: "/static/floorplans/warehouse_demo.png",
        scaleMetersPerPixel: 0.05,
        originX: 0,
        originY: 0,
        rotationDegrees: 0
      },
      {
        id: "f2",
        tenantId: "t1",
        siteId: "s2",
        name: "Cross-Dock Floor",
        imageUrl: "/static/floorplans/warehouse_demo.png",
        scaleMetersPerPixel: 0.05,
        originX: 0,
        originY: 0,
        rotationDegrees: 0
      }
    ]
  });

  await prisma.vendorSiteMap.createMany({
    data: [
      {
        id: "vsm1",
        tenantId: "t1",
        siteId: "s1",
        vendor: "vendor_acme",
        vendorMapId: "acme-s1-main",
        vendorMapName: null,
        robotopsFloorplanId: "f1",
        scale: 1.12,
        rotationDegrees: 7.5,
        translateX: 14,
        translateY: -9,
        createdBy: "u1",
        updatedBy: "u1",
        createdAt: new Date("2026-02-01T12:00:00Z"),
        updatedAt: new Date("2026-02-01T12:00:00Z")
      },
      {
        id: "vsm2",
        tenantId: "t1",
        siteId: "s1",
        vendor: "vendor_acme",
        vendorMapId: null,
        vendorMapName: "mezzanine_map",
        robotopsFloorplanId: "f1b",
        scale: 0.94,
        rotationDegrees: -12,
        translateX: 6,
        translateY: 11,
        createdBy: "u1",
        updatedBy: "u1",
        createdAt: new Date("2026-02-01T12:05:00Z"),
        updatedAt: new Date("2026-02-01T12:05:00Z")
      },
      {
        id: "vsm3",
        tenantId: "t1",
        siteId: "s2",
        vendor: "vendor_beta",
        vendorMapId: "beta-crossdock",
        vendorMapName: "beta_crossdock_name",
        robotopsFloorplanId: "f2",
        scale: 1,
        rotationDegrees: 0,
        translateX: 0,
        translateY: 0,
        createdBy: "u1",
        updatedBy: "u1",
        createdAt: new Date("2026-02-01T12:10:00Z"),
        updatedAt: new Date("2026-02-01T12:10:00Z")
      }
    ]
  });

  await prisma.zone.createMany({
    data: [
      {
        id: "z1",
        tenantId: "t1",
        floorplanId: "f1",
        name: "Charging Bay",
        type: "charging",
        polygon: [
          { x: 50, y: 60 },
          { x: 80, y: 60 },
          { x: 80, y: 90 },
          { x: 50, y: 90 }
        ],
        maxSpeedMps: 0.5,
        requiresOperatorAck: false,
        allowedRobotTags: ["amr"]
      },
      {
        id: "z2",
        tenantId: "t1",
        floorplanId: "f1",
        name: "High Traffic Aisle",
        type: "pedestrian",
        polygon: [
          { x: 120, y: 40 },
          { x: 220, y: 40 },
          { x: 220, y: 70 },
          { x: 120, y: 70 }
        ],
        maxSpeedMps: 0.7,
        requiresOperatorAck: false,
        allowedRobotTags: ["amr", "agv"]
      },
      {
        id: "z3",
        tenantId: "t1",
        floorplanId: "f1",
        name: "Restricted Storage",
        type: "restricted",
        polygon: [
          { x: 240, y: 100 },
          { x: 310, y: 100 },
          { x: 310, y: 160 },
          { x: 240, y: 160 }
        ],
        maxSpeedMps: 0.4,
        requiresOperatorAck: true,
        allowedRobotTags: ["agv"]
      },
      {
        id: "z4",
        tenantId: "t1",
        floorplanId: "f1b",
        name: "Mezzanine Staging",
        type: "staging",
        polygon: [
          { x: 40, y: 30 },
          { x: 110, y: 30 },
          { x: 110, y: 70 },
          { x: 40, y: 70 }
        ],
        maxSpeedMps: 0.6,
        requiresOperatorAck: false,
        allowedRobotTags: ["amr", "agv"]
      },
      {
        id: "z5",
        tenantId: "t1",
        floorplanId: "f1b",
        name: "Mezzanine Pickup",
        type: "pickup",
        polygon: [
          { x: 130, y: 42 },
          { x: 180, y: 42 },
          { x: 180, y: 78 },
          { x: 130, y: 78 }
        ],
        maxSpeedMps: 0.6,
        requiresOperatorAck: false,
        allowedRobotTags: ["amr"]
      },
      {
        id: "z6",
        tenantId: "t1",
        floorplanId: "f1b",
        name: "Hazard Lift Section",
        type: "hazard",
        polygon: [
          { x: 220, y: 86 },
          { x: 290, y: 86 },
          { x: 290, y: 132 },
          { x: 220, y: 132 }
        ],
        maxSpeedMps: 0.3,
        requiresOperatorAck: true,
        allowedRobotTags: ["agv"]
      },
      {
        id: "z7",
        tenantId: "t1",
        floorplanId: "f2",
        name: "Inbound Dock",
        type: "dropoff",
        polygon: [
          { x: 40, y: 120 },
          { x: 120, y: 120 },
          { x: 120, y: 170 },
          { x: 40, y: 170 }
        ],
        maxSpeedMps: 0.8,
        requiresOperatorAck: false,
        allowedRobotTags: ["amr", "agv"]
      },
      {
        id: "z8",
        tenantId: "t1",
        floorplanId: "f2",
        name: "Outbound Queue",
        type: "staging",
        polygon: [
          { x: 150, y: 80 },
          { x: 250, y: 80 },
          { x: 250, y: 130 },
          { x: 150, y: 130 }
        ],
        maxSpeedMps: 0.7,
        requiresOperatorAck: false,
        allowedRobotTags: ["amr", "agv"]
      },
      {
        id: "z9",
        tenantId: "t1",
        floorplanId: "f2",
        name: "Human Crossing",
        type: "pedestrian",
        polygon: [
          { x: 185, y: 30 },
          { x: 310, y: 30 },
          { x: 310, y: 65 },
          { x: 185, y: 65 }
        ],
        maxSpeedMps: 0.5,
        requiresOperatorAck: false,
        allowedRobotTags: ["amr", "agv"]
      }
    ]
  });

  await prisma.robotVendor.createMany({
    data: [
      {
        id: "v1",
        tenantId: "t1",
        name: "RoboVendor Alpha",
        integrationType: "agent",
        supportedProtocols: ["custom_rest", "mqtt"]
      },
      {
        id: "v2",
        tenantId: "t1",
        name: "RoboVendor Beta",
        integrationType: "edge_gateway",
        supportedProtocols: ["ros2_bridge", "open_rmf_adapter"]
      },
      {
        id: "v3",
        tenantId: "t1",
        name: "RoboVendor Gamma",
        integrationType: "standard_adapter",
        supportedProtocols: ["vda_5050_adapter", "massrobotics_amr_adapter"]
      }
    ]
  });

  await prisma.robot.createMany({
    data: [
      {
        id: "r1",
        tenantId: "t1",
        siteId: "s1",
        vendorId: "v1",
        name: "AMR 17",
        model: "Alpha AMR",
        serial: "A17 0091",
        tags: ["amr", "picker"],
        status: "online",
        batteryPercent: 76,
        lastSeenAt: secondsAgo(30),
        floorplanId: "f1",
        x: 140,
        y: 58,
        headingDegrees: 95,
        confidence: 0.92,
        cpuPercent: 42,
        memoryPercent: 61,
        tempC: 57,
        networkRssi: -60,
        diskPercent: 48,
        capabilities: ["navigate", "dock", "carry", "teleop", "deliver"],
        connection: "wifi",
        ip: "10.0.1.17",
        firmware: "1.9.2",
        agentVersion: "0.14.0",
        edgeId: null,
        createdAt: new Date("2026-01-20T10:00:00Z")
      },
      {
        id: "r2",
        tenantId: "t1",
        siteId: "s1",
        vendorId: "v2",
        name: "AGV 03",
        model: "Beta AGV",
        serial: "B03 1022",
        tags: ["agv", "heavy"],
        status: "degraded",
        batteryPercent: 34,
        lastSeenAt: secondsAgo(75),
        floorplanId: "f1",
        x: 255,
        y: 120,
        headingDegrees: 180,
        confidence: 0.81,
        cpuPercent: 68,
        memoryPercent: 73,
        tempC: 71,
        networkRssi: -72,
        diskPercent: 82,
        capabilities: ["navigate", "dock", "lift", "carry", "teleop"],
        connection: "lte",
        ip: "100.64.0.3",
        firmware: "3.2.1",
        agentVersion: "0.9.8",
        edgeId: "e1",
        createdAt: new Date("2026-01-22T10:00:00Z")
      },
      {
        id: "r3",
        tenantId: "t1",
        siteId: "s1",
        vendorId: "v1",
        name: "AMR 05",
        model: "Alpha AMR",
        serial: "A05 4470",
        tags: ["amr", "inventory"],
        status: "offline",
        batteryPercent: 12,
        lastSeenAt: hoursAgo(5),
        floorplanId: "f1",
        x: 92,
        y: 52,
        headingDegrees: 35,
        confidence: 0.52,
        cpuPercent: 0,
        memoryPercent: 0,
        tempC: 0,
        networkRssi: -96,
        diskPercent: 67,
        capabilities: ["navigate", "scan", "inventory_count"],
        connection: "wifi",
        ip: "10.0.1.5",
        firmware: "1.8.7",
        agentVersion: "0.13.4",
        edgeId: null,
        createdAt: new Date("2026-01-18T09:00:00Z")
      },
      {
        id: "r4",
        tenantId: "t1",
        siteId: "s1",
        vendorId: "v2",
        name: "AGV 08",
        model: "Beta AGV",
        serial: "B08 1314",
        tags: ["agv", "maintenance"],
        status: "maintenance",
        batteryPercent: 88,
        lastSeenAt: secondsAgo(95),
        floorplanId: "f1b",
        x: 68,
        y: 84,
        headingDegrees: 90,
        confidence: 0.9,
        cpuPercent: 14,
        memoryPercent: 33,
        tempC: 39,
        networkRssi: -68,
        diskPercent: 29,
        capabilities: ["navigate", "dock", "lift", "carry"],
        connection: "ethernet",
        ip: "10.0.2.8",
        firmware: "3.2.4",
        agentVersion: "1.0.1",
        edgeId: "e1",
        createdAt: new Date("2026-01-24T12:00:00Z")
      },
      {
        id: "r5",
        tenantId: "t1",
        siteId: "s1",
        vendorId: "v2",
        name: "AGV 11",
        model: "Beta AGV",
        serial: "B11 1998",
        tags: ["agv", "safety_watch"],
        status: "emergency_stop",
        batteryPercent: 54,
        lastSeenAt: secondsAgo(20),
        floorplanId: "f1",
        x: 206,
        y: 64,
        headingDegrees: 270,
        confidence: 0.88,
        cpuPercent: 52,
        memoryPercent: 58,
        tempC: 62,
        networkRssi: -70,
        diskPercent: 63,
        capabilities: ["navigate", "dock", "carry", "teleop"],
        connection: "lte",
        ip: "100.64.0.11",
        firmware: "3.2.2",
        agentVersion: "0.9.9",
        edgeId: "e1",
        createdAt: new Date("2026-01-28T08:30:00Z")
      },
      {
        id: "r6",
        tenantId: "t1",
        siteId: "s1",
        vendorId: "v1",
        name: "AMR 21",
        model: "Alpha AMR",
        serial: "A21 0213",
        tags: ["amr", "picker", "rush_lane"],
        status: "online",
        batteryPercent: 64,
        lastSeenAt: secondsAgo(45),
        floorplanId: "f1",
        x: 176,
        y: 48,
        headingDegrees: 140,
        confidence: 0.95,
        cpuPercent: 39,
        memoryPercent: 57,
        tempC: 54,
        networkRssi: -58,
        diskPercent: 51,
        capabilities: ["navigate", "dock", "carry", "deliver", "scan"],
        connection: "wifi",
        ip: "10.0.1.21",
        firmware: "1.9.3",
        agentVersion: "0.14.1",
        edgeId: null,
        createdAt: new Date("2026-01-29T10:00:00Z")
      },
      {
        id: "r7",
        tenantId: "t1",
        siteId: "s1",
        vendorId: "v1",
        name: "AMR 09",
        model: "Alpha AMR",
        serial: "A09 0884",
        tags: ["amr", "scanner"],
        status: "degraded",
        batteryPercent: 27,
        lastSeenAt: secondsAgo(110),
        floorplanId: "f1",
        x: 232,
        y: 114,
        headingDegrees: 215,
        confidence: 0.79,
        cpuPercent: 74,
        memoryPercent: 77,
        tempC: 69,
        networkRssi: -79,
        diskPercent: 74,
        capabilities: ["navigate", "dock", "scan", "inventory_count"],
        connection: "wifi",
        ip: "10.0.1.9",
        firmware: "1.8.9",
        agentVersion: "0.13.9",
        edgeId: null,
        createdAt: new Date("2026-01-19T14:00:00Z")
      },
      {
        id: "r8",
        tenantId: "t1",
        siteId: "s1",
        vendorId: "v2",
        name: "AGV 14",
        model: "Beta AGV",
        serial: "B14 2401",
        tags: ["agv", "heavy", "tow"],
        status: "offline",
        batteryPercent: 5,
        lastSeenAt: hoursAgo(8),
        floorplanId: "f1b",
        x: 286,
        y: 146,
        headingDegrees: 10,
        confidence: 0.44,
        cpuPercent: 0,
        memoryPercent: 0,
        tempC: 0,
        networkRssi: -100,
        diskPercent: 81,
        capabilities: ["navigate", "dock", "lift", "carry"],
        connection: "lte",
        ip: "100.64.0.14",
        firmware: "3.1.8",
        agentVersion: "0.9.5",
        edgeId: "e1",
        createdAt: new Date("2026-01-30T11:00:00Z")
      },
      {
        id: "r9",
        tenantId: "t1",
        siteId: "s2",
        vendorId: "v3",
        name: "AMR 31",
        model: "Gamma Scout",
        serial: "G31 3012",
        tags: ["amr", "scanner", "montreal"],
        status: "online",
        batteryPercent: 72,
        lastSeenAt: secondsAgo(25),
        floorplanId: "f2",
        x: 96,
        y: 148,
        headingDegrees: 302,
        confidence: 0.93,
        cpuPercent: 36,
        memoryPercent: 49,
        tempC: 52,
        networkRssi: -62,
        diskPercent: 44,
        capabilities: ["navigate", "dock", "scan", "deliver"],
        connection: "wifi",
        ip: "10.10.1.31",
        firmware: "2.1.0",
        agentVersion: "1.2.0",
        edgeId: null,
        createdAt: new Date("2026-01-20T08:00:00Z")
      },
      {
        id: "r10",
        tenantId: "t1",
        siteId: "s2",
        vendorId: "v3",
        name: "AMR 33",
        model: "Gamma Scout",
        serial: "G33 3361",
        tags: ["amr", "picker", "montreal"],
        status: "maintenance",
        batteryPercent: 81,
        lastSeenAt: secondsAgo(130),
        floorplanId: "f2",
        x: 208,
        y: 96,
        headingDegrees: 180,
        confidence: 0.87,
        cpuPercent: 22,
        memoryPercent: 34,
        tempC: 43,
        networkRssi: -66,
        diskPercent: 38,
        capabilities: ["navigate", "dock", "carry"],
        connection: "ethernet",
        ip: "10.10.1.33",
        firmware: "2.0.7",
        agentVersion: "1.1.5",
        edgeId: null,
        createdAt: new Date("2026-01-21T08:00:00Z")
      },
      {
        id: "r11",
        tenantId: "t1",
        siteId: "s2",
        vendorId: "v2",
        name: "AGV 22",
        model: "Beta AGV",
        serial: "B22 9010",
        tags: ["agv", "heavy", "montreal"],
        status: "degraded",
        batteryPercent: 31,
        lastSeenAt: secondsAgo(80),
        floorplanId: "f2",
        x: 244,
        y: 118,
        headingDegrees: 250,
        confidence: 0.76,
        cpuPercent: 71,
        memoryPercent: 79,
        tempC: 70,
        networkRssi: -81,
        diskPercent: 77,
        capabilities: ["navigate", "dock", "lift", "carry", "teleop"],
        connection: "lte",
        ip: "100.65.0.22",
        firmware: "3.2.0",
        agentVersion: "1.0.0",
        edgeId: "e1",
        createdAt: new Date("2026-01-25T13:30:00Z")
      },
      {
        id: "r12",
        tenantId: "t1",
        siteId: "s2",
        vendorId: "v1",
        name: "AMR 36",
        model: "Alpha AMR",
        serial: "A36 6142",
        tags: ["amr", "inventory", "montreal"],
        status: "offline",
        batteryPercent: 9,
        lastSeenAt: hoursAgo(6),
        floorplanId: "f2",
        x: 166,
        y: 54,
        headingDegrees: 15,
        confidence: 0.41,
        cpuPercent: 0,
        memoryPercent: 0,
        tempC: 0,
        networkRssi: -99,
        diskPercent: 69,
        capabilities: ["navigate", "scan", "inventory_count"],
        connection: "wifi",
        ip: "10.10.1.36",
        firmware: "1.9.0",
        agentVersion: "0.14.0",
        edgeId: null,
        createdAt: new Date("2026-01-27T09:10:00Z")
      }
    ]
  });

  const seededRobots = await prisma.robot.findMany({ where: { tenantId: "t1" } });
  await prisma.robotLastState.createMany({
    data: seededRobots.map((robot) => ({
      tenantId: robot.tenantId,
      siteId: robot.siteId,
      robotId: robot.id,
      name: robot.name,
      vendor: robot.vendorId,
      model: robot.model,
      serial: robot.serial,
      tags: robot.tags,
      status: robot.status,
      batteryPercent: robot.batteryPercent,
      lastSeenAt: robot.lastSeenAt,
      floorplanId: robot.floorplanId,
      x: robot.x,
      y: robot.y,
      headingDegrees: robot.headingDegrees,
      confidence: robot.confidence,
      healthScore: Math.max(0, Math.min(100, 100 - Math.round((robot.cpuPercent + robot.memoryPercent + robot.diskPercent) / 3))),
      cpuPercent: robot.cpuPercent,
      memoryPercent: robot.memoryPercent,
      tempC: robot.tempC,
      diskPercent: robot.diskPercent,
      networkRssi: robot.networkRssi,
      currentTaskId: null,
      currentTaskState: null,
      currentTaskPercentComplete: null,
      lastStateTimestamp: robot.lastSeenAt,
      lastStateSequence: null,
      lastStateMessageId: null,
      updatedAt: robot.lastSeenAt
    }))
  });

  await prisma.mission.createMany({
    data: [
      {
        id: "m1",
        tenantId: "t1",
        siteId: "s1",
        name: "Pick A12 to Pack Station 2",
        type: "pickup_dropoff",
        priority: "high",
        createdByUserId: "u2",
        assignedRobotId: "r1",
        state: "running",
        startTime: new Date("2026-02-26T23:30:00Z"),
        endTime: null,
        durationS: 900,
        distanceM: 220,
        stopsCount: 3,
        interventionsCount: 1,
        energyUsedWh: 45,
        routeWaypoints: [
          { name: "Pickup A12", x: 120, y: 60, zone_id: "z2" },
          { name: "Pack Station 2", x: 70, y: 80, zone_id: "z1" }
        ],
        routePolyline: [
          { x: 140, y: 58 },
          { x: 120, y: 60 },
          { x: 90, y: 70 },
          { x: 70, y: 80 }
        ],
        failureCode: null,
        failureMessage: null,
        lastEventId: null,
        createdAt: new Date("2026-02-26T23:29:40Z")
      },
      {
        id: "m2",
        tenantId: "t1",
        siteId: "s1",
        name: "Heavy pallet transfer to Restricted Storage",
        type: "custom",
        priority: "critical",
        createdByUserId: "u1",
        assignedRobotId: "r2",
        state: "blocked",
        startTime: new Date("2026-02-26T23:10:00Z"),
        endTime: null,
        durationS: 1800,
        distanceM: 140,
        stopsCount: 5,
        interventionsCount: 2,
        energyUsedWh: 90,
        routeWaypoints: [
          { name: "Dock 4", x: 200, y: 55, zone_id: "z2" },
          { name: "Restricted Storage", x: 270, y: 130, zone_id: "z3" }
        ],
        routePolyline: [
          { x: 255, y: 120 },
          { x: 240, y: 110 },
          { x: 270, y: 130 }
        ],
        failureCode: "ZONE_REQUIRES_ACK",
        failureMessage: "Entry into Restricted Storage requires operator acknowledgment",
        lastEventId: "me8",
        createdAt: new Date("2026-02-26T23:09:30Z")
      },
      {
        id: "m3",
        tenantId: "t1",
        siteId: "s1",
        name: "Cycle count Zone B bins",
        type: "inventory",
        priority: "normal",
        createdByUserId: "u3",
        assignedRobotId: "r6",
        state: "queued",
        startTime: null,
        endTime: null,
        durationS: 0,
        distanceM: 0,
        stopsCount: 0,
        interventionsCount: 0,
        energyUsedWh: 0,
        routeWaypoints: [
          { name: "Aisle B1", x: 160, y: 52, zone_id: "z2" },
          { name: "Aisle B4", x: 210, y: 58, zone_id: "z2" }
        ],
        routePolyline: [
          { x: 176, y: 48 },
          { x: 165, y: 50 },
          { x: 210, y: 58 }
        ],
        failureCode: null,
        failureMessage: null,
        lastEventId: null,
        createdAt: new Date("2026-02-26T23:35:15Z")
      },
      {
        id: "m4",
        tenantId: "t1",
        siteId: "s1",
        name: "Scan restricted aisle perimeter",
        type: "patrol",
        priority: "high",
        createdByUserId: "u2",
        assignedRobotId: "r7",
        state: "running",
        startTime: new Date("2026-02-26T23:34:30Z"),
        endTime: null,
        durationS: 420,
        distanceM: 95,
        stopsCount: 2,
        interventionsCount: 0,
        energyUsedWh: 18,
        routeWaypoints: [
          { name: "Restricted edge north", x: 248, y: 104, zone_id: "z3" },
          { name: "Restricted edge south", x: 296, y: 154, zone_id: "z3" }
        ],
        routePolyline: [
          { x: 232, y: 114 },
          { x: 248, y: 104 },
          { x: 296, y: 154 }
        ],
        failureCode: null,
        failureMessage: null,
        lastEventId: null,
        createdAt: new Date("2026-02-26T23:33:50Z")
      },
      {
        id: "m5",
        tenantId: "t1",
        siteId: "s1",
        name: "Mezzanine tote replenishment",
        type: "pickup_dropoff",
        priority: "normal",
        createdByUserId: "u2",
        assignedRobotId: "r4",
        state: "succeeded",
        startTime: new Date("2026-02-26T21:50:00Z"),
        endTime: new Date("2026-02-26T22:05:00Z"),
        durationS: 900,
        distanceM: 180,
        stopsCount: 4,
        interventionsCount: 0,
        energyUsedWh: 29,
        routeWaypoints: [
          { name: "Mezzanine Staging", x: 75, y: 52, zone_id: "z4" },
          { name: "Mezzanine Pickup", x: 150, y: 60, zone_id: "z5" }
        ],
        routePolyline: [
          { x: 68, y: 84 },
          { x: 75, y: 52 },
          { x: 150, y: 60 }
        ],
        failureCode: null,
        failureMessage: null,
        lastEventId: "me13",
        createdAt: new Date("2026-02-26T21:48:00Z")
      },
      {
        id: "m6",
        tenantId: "t1",
        siteId: "s1",
        name: "Emergency recovery escort",
        type: "custom",
        priority: "critical",
        createdByUserId: "u1",
        assignedRobotId: "r5",
        state: "failed",
        startTime: new Date("2026-02-26T23:31:00Z"),
        endTime: new Date("2026-02-26T23:33:00Z"),
        durationS: 120,
        distanceM: 14,
        stopsCount: 1,
        interventionsCount: 1,
        energyUsedWh: 6,
        routeWaypoints: [
          { name: "High Traffic Aisle", x: 195, y: 58, zone_id: "z2" }
        ],
        routePolyline: [
          { x: 206, y: 64 },
          { x: 195, y: 58 }
        ],
        failureCode: "EMERGENCY_STOP",
        failureMessage: "Robot entered emergency stop",
        lastEventId: "me14",
        createdAt: new Date("2026-02-26T23:30:50Z")
      },
      {
        id: "m7",
        tenantId: "t1",
        siteId: "s2",
        name: "Inbound scan lane A",
        type: "inventory",
        priority: "normal",
        createdByUserId: "u3",
        assignedRobotId: "r9",
        state: "queued",
        startTime: null,
        endTime: null,
        durationS: 0,
        distanceM: 0,
        stopsCount: 0,
        interventionsCount: 0,
        energyUsedWh: 0,
        routeWaypoints: [
          { name: "Inbound Dock", x: 90, y: 145, zone_id: "z7" },
          { name: "Outbound Queue", x: 180, y: 110, zone_id: "z8" }
        ],
        routePolyline: [
          { x: 96, y: 148 },
          { x: 90, y: 145 },
          { x: 180, y: 110 }
        ],
        failureCode: null,
        failureMessage: null,
        lastEventId: null,
        createdAt: new Date("2026-02-26T23:32:00Z")
      },
      {
        id: "m8",
        tenantId: "t1",
        siteId: "s2",
        name: "Dock-to-staging pallet assist",
        type: "pickup_dropoff",
        priority: "high",
        createdByUserId: "u2",
        assignedRobotId: "r10",
        state: "running",
        startTime: new Date("2026-02-26T23:20:00Z"),
        endTime: null,
        durationS: 780,
        distanceM: 210,
        stopsCount: 3,
        interventionsCount: 0,
        energyUsedWh: 39,
        routeWaypoints: [
          { name: "Inbound Dock", x: 65, y: 150, zone_id: "z7" },
          { name: "Outbound Queue", x: 210, y: 96, zone_id: "z8" }
        ],
        routePolyline: [
          { x: 208, y: 96 },
          { x: 120, y: 130 },
          { x: 65, y: 150 }
        ],
        failureCode: null,
        failureMessage: null,
        lastEventId: "me16",
        createdAt: new Date("2026-02-26T23:19:20Z")
      },
      {
        id: "m9",
        tenantId: "t1",
        siteId: "s2",
        name: "Crossing safety patrol",
        type: "patrol",
        priority: "high",
        createdByUserId: "u2",
        assignedRobotId: "r11",
        state: "blocked",
        startTime: new Date("2026-02-26T23:18:00Z"),
        endTime: null,
        durationS: 900,
        distanceM: 130,
        stopsCount: 4,
        interventionsCount: 1,
        energyUsedWh: 32,
        routeWaypoints: [
          { name: "Human Crossing", x: 240, y: 45, zone_id: "z9" },
          { name: "Outbound Queue", x: 210, y: 112, zone_id: "z8" }
        ],
        routePolyline: [
          { x: 244, y: 118 },
          { x: 240, y: 45 },
          { x: 210, y: 112 }
        ],
        failureCode: "CONNECTIVITY_UNSTABLE",
        failureMessage: "Packet loss exceeded threshold in crossing corridor",
        lastEventId: "me17",
        createdAt: new Date("2026-02-26T23:17:30Z")
      },
      {
        id: "m10",
        tenantId: "t1",
        siteId: "s2",
        name: "Night shift inventory pass",
        type: "inventory",
        priority: "low",
        createdByUserId: "u3",
        assignedRobotId: "r12",
        state: "succeeded",
        startTime: new Date("2026-02-26T02:10:00Z"),
        endTime: new Date("2026-02-26T02:55:00Z"),
        durationS: 2700,
        distanceM: 380,
        stopsCount: 11,
        interventionsCount: 0,
        energyUsedWh: 58,
        routeWaypoints: [
          { name: "Outbound Queue", x: 205, y: 90, zone_id: "z8" },
          { name: "Inbound Dock", x: 70, y: 150, zone_id: "z7" }
        ],
        routePolyline: [
          { x: 166, y: 54 },
          { x: 205, y: 90 },
          { x: 70, y: 150 }
        ],
        failureCode: null,
        failureMessage: null,
        lastEventId: "me18",
        createdAt: new Date("2026-02-26T02:08:40Z")
      }
    ]
  });

  await prisma.missionEvent.createMany({
    data: [
      {
        id: "me1",
        missionId: "m1",
        robotId: "r1",
        timestamp: new Date("2026-02-26T23:30:00Z"),
        type: "state_change",
        payload: { from: "queued", to: "running" }
      },
      {
        id: "me8",
        missionId: "m2",
        robotId: "r2",
        timestamp: new Date("2026-02-26T23:12:00Z"),
        type: "warning",
        payload: { code: "ZONE_REQUIRES_ACK", zone: "z3" }
      },
      {
        id: "me9",
        missionId: "m3",
        robotId: "r6",
        timestamp: new Date("2026-02-26T23:35:15Z"),
        type: "state_change",
        payload: { from: "queued", to: "queued" }
      },
      {
        id: "me10",
        missionId: "m4",
        robotId: "r7",
        timestamp: new Date("2026-02-26T23:34:30Z"),
        type: "state_change",
        payload: { from: "queued", to: "running" }
      },
      {
        id: "me13",
        missionId: "m5",
        robotId: "r4",
        timestamp: new Date("2026-02-26T22:05:00Z"),
        type: "state_change",
        payload: { from: "running", to: "succeeded" }
      },
      {
        id: "me14",
        missionId: "m6",
        robotId: "r5",
        timestamp: new Date("2026-02-26T23:33:00Z"),
        type: "error",
        payload: { code: "EMERGENCY_STOP", severity: "critical" }
      },
      {
        id: "me16",
        missionId: "m8",
        robotId: "r10",
        timestamp: new Date("2026-02-26T23:20:00Z"),
        type: "state_change",
        payload: { from: "queued", to: "running" }
      },
      {
        id: "me17",
        missionId: "m9",
        robotId: "r11",
        timestamp: new Date("2026-02-26T23:24:00Z"),
        type: "warning",
        payload: { code: "CONNECTIVITY_UNSTABLE", loss_percent: 18 }
      },
      {
        id: "me18",
        missionId: "m10",
        robotId: "r12",
        timestamp: new Date("2026-02-26T02:55:00Z"),
        type: "state_change",
        payload: { from: "running", to: "succeeded" }
      }
    ]
  });

  const seededMissions = await prisma.mission.findMany({
    where: { tenantId: "t1" },
    include: {
      missionEvents: {
        where: { type: "state_change" },
        orderBy: [{ timestamp: "desc" }, { id: "desc" }],
        take: 1
      }
    }
  });
  await prisma.taskLastStatus.createMany({
    data: seededMissions.map((mission) => {
      const latestStateEvent = mission.missionEvents[0] ?? null;
      const payload = (latestStateEvent?.payload ?? {}) as { state?: string; to?: string; percent_complete?: number; message?: string };
      const state = typeof payload.state === "string" ? payload.state : typeof payload.to === "string" ? payload.to : mission.state;
      const percentComplete = typeof payload.percent_complete === "number" ? Math.round(payload.percent_complete) : null;
      const message = typeof payload.message === "string" ? payload.message : null;

      return {
        tenantId: mission.tenantId,
        siteId: mission.siteId,
        taskId: mission.id,
        state,
        percentComplete,
        updatedAtLogical: latestStateEvent?.timestamp ?? mission.startTime ?? mission.createdAt,
        lastSequence: null,
        lastMessageId: null,
        message
      };
    })
  });

  await prisma.incident.createMany({
    data: [
      {
        id: "i1",
        tenantId: "t1",
        siteId: "s1",
        robotId: "r2",
        missionId: "m2",
        severity: "major",
        category: "safety",
        status: "open",
        title: "Restricted zone entry blocked",
        description: "Robot requested entry to a restricted zone that requires operator acknowledgment.",
        createdAt: new Date("2026-02-26T23:12:00Z"),
        acknowledgedBy: null,
        resolvedAt: null
      },
      {
        id: "i2",
        tenantId: "t1",
        siteId: "s1",
        robotId: "r5",
        missionId: "m6",
        severity: "critical",
        category: "safety",
        status: "open",
        title: "Emergency stop engaged on AGV 11",
        description: "Robot entered emergency stop after obstacle fault and requires operator clearance.",
        createdAt: new Date("2026-02-26T23:33:10Z"),
        acknowledgedBy: null,
        resolvedAt: null
      },
      {
        id: "i3",
        tenantId: "t1",
        siteId: "s1",
        robotId: "r3",
        missionId: null,
        severity: "warning",
        category: "connectivity",
        status: "acknowledged",
        title: "AMR 05 offline for 4+ hours",
        description: "Robot has not reported in; likely AP roaming failure in west wing.",
        createdAt: new Date("2026-02-26T19:40:00Z"),
        acknowledgedBy: "u2",
        resolvedAt: null
      },
      {
        id: "i4",
        tenantId: "t1",
        siteId: "s1",
        robotId: "r7",
        missionId: "m4",
        severity: "major",
        category: "navigation",
        status: "mitigated",
        title: "Path planner oscillation near restricted edge",
        description: "Route repeatedly replanned near zone boundary due confidence drops.",
        createdAt: new Date("2026-02-26T23:36:30Z"),
        acknowledgedBy: "u3",
        resolvedAt: null
      },
      {
        id: "i5",
        tenantId: "t1",
        siteId: "s2",
        robotId: "r10",
        missionId: "m8",
        severity: "warning",
        category: "battery",
        status: "open",
        title: "Battery discharge trending above baseline",
        description: "Energy burn rate in dock-to-staging run is above normal profile.",
        createdAt: new Date("2026-02-26T23:26:00Z"),
        acknowledgedBy: null,
        resolvedAt: null
      },
      {
        id: "i6",
        tenantId: "t1",
        siteId: "s2",
        robotId: "r11",
        missionId: "m9",
        severity: "major",
        category: "connectivity",
        status: "open",
        title: "Packet loss in pedestrian crossing corridor",
        description: "LTE link dropped below safe threshold while mission was active.",
        createdAt: new Date("2026-02-26T23:24:10Z"),
        acknowledgedBy: null,
        resolvedAt: null
      },
      {
        id: "i7",
        tenantId: "t1",
        siteId: "s2",
        robotId: "r9",
        missionId: "m7",
        severity: "info",
        category: "integration",
        status: "resolved",
        title: "WMS handoff retry succeeded",
        description: "Temporary WMS timeout recovered after adapter retry.",
        createdAt: new Date("2026-02-26T22:50:00Z"),
        acknowledgedBy: "u2",
        resolvedAt: new Date("2026-02-26T22:58:00Z")
      },
      {
        id: "i8",
        tenantId: "t1",
        siteId: "s2",
        robotId: "r12",
        missionId: "m10",
        severity: "warning",
        category: "hardware",
        status: "resolved",
        title: "Wheel encoder jitter detected",
        description: "Encoder noise exceeded threshold during overnight inventory pass.",
        createdAt: new Date("2026-02-26T02:35:00Z"),
        acknowledgedBy: "u3",
        resolvedAt: new Date("2026-02-26T03:10:00Z")
      }
    ]
  });

  await prisma.incidentEvent.createMany({
    data: [
      {
        id: "ie1",
        incidentId: "i1",
        timestamp: new Date("2026-02-26T23:12:00Z"),
        type: "created",
        message: "Incident created from mission warning",
        meta: {}
      },
      {
        id: "ie2",
        incidentId: "i1",
        timestamp: new Date("2026-02-26T23:12:10Z"),
        type: "note",
        message: "Awaiting operator acknowledgment",
        meta: {}
      },
      {
        id: "ie3",
        incidentId: "i2",
        timestamp: new Date("2026-02-26T23:33:10Z"),
        type: "created",
        message: "Emergency stop triggered by robot safety controller",
        meta: { robotId: "r5" }
      },
      {
        id: "ie4",
        incidentId: "i2",
        timestamp: new Date("2026-02-26T23:33:35Z"),
        type: "automation",
        message: "Auto-notified remote operations team",
        meta: { channel: "slack" }
      },
      {
        id: "ie5",
        incidentId: "i3",
        timestamp: new Date("2026-02-26T19:40:00Z"),
        type: "created",
        message: "Connectivity watchdog marked robot offline",
        meta: { robotId: "r3" }
      },
      {
        id: "ie6",
        incidentId: "i3",
        timestamp: new Date("2026-02-26T19:52:00Z"),
        type: "acknowledged",
        message: "Ops manager acknowledged and dispatched site tech",
        meta: { actorId: "u2" }
      },
      {
        id: "ie7",
        incidentId: "i4",
        timestamp: new Date("2026-02-26T23:36:30Z"),
        type: "created",
        message: "Planner emitted repeated reroute warnings",
        meta: { missionId: "m4" }
      },
      {
        id: "ie8",
        incidentId: "i4",
        timestamp: new Date("2026-02-26T23:40:00Z"),
        type: "mitigated",
        message: "Applied temporary speed cap in corridor",
        meta: { action: "speed_limit" }
      },
      {
        id: "ie9",
        incidentId: "i5",
        timestamp: new Date("2026-02-26T23:26:00Z"),
        type: "created",
        message: "Battery trend monitor exceeded threshold",
        meta: { robotId: "r10" }
      },
      {
        id: "ie10",
        incidentId: "i6",
        timestamp: new Date("2026-02-26T23:24:10Z"),
        type: "created",
        message: "Connectivity degraded while crossing pedestrian lane",
        meta: { robotId: "r11" }
      },
      {
        id: "ie11",
        incidentId: "i7",
        timestamp: new Date("2026-02-26T22:50:00Z"),
        type: "created",
        message: "WMS callback timeout observed",
        meta: { integration: "wms" }
      },
      {
        id: "ie12",
        incidentId: "i7",
        timestamp: new Date("2026-02-26T22:58:00Z"),
        type: "resolved",
        message: "Retry policy restored adapter flow",
        meta: { retries: 2 }
      },
      {
        id: "ie13",
        incidentId: "i8",
        timestamp: new Date("2026-02-26T02:35:00Z"),
        type: "created",
        message: "Encoder jitter crossed warning threshold",
        meta: { robotId: "r12" }
      },
      {
        id: "ie14",
        incidentId: "i8",
        timestamp: new Date("2026-02-26T03:10:00Z"),
        type: "resolved",
        message: "Scheduled maintenance completed",
        meta: { actorId: "u3" }
      }
    ]
  });

  await prisma.asset.createMany({
    data: [
      {
        id: "a1",
        tenantId: "t1",
        siteId: "s1",
        type: "forklift",
        name: "Forklift 2",
        tags: ["manual_vehicle"],
        floorplanId: "f1",
        x: 150,
        y: 62,
        headingDegrees: 270,
        confidence: 0.75,
        lastSeenAt: new Date("2026-02-26T23:39:50Z")
      },
      {
        id: "a2",
        tenantId: "t1",
        siteId: "s1",
        type: "cart",
        name: "Cart 14",
        tags: ["movable", "staging"],
        floorplanId: "f1",
        x: 185,
        y: 66,
        headingDegrees: 180,
        confidence: 0.7,
        lastSeenAt: new Date("2026-02-26T23:38:30Z")
      },
      {
        id: "a3",
        tenantId: "t1",
        siteId: "s1",
        type: "door",
        name: "Door West 3",
        tags: ["access_point"],
        floorplanId: "f1b",
        x: 228,
        y: 98,
        headingDegrees: 0,
        confidence: 0.99,
        lastSeenAt: new Date("2026-02-26T23:00:00Z")
      },
      {
        id: "a4",
        tenantId: "t1",
        siteId: "s2",
        type: "forklift",
        name: "Forklift 7",
        tags: ["manual_vehicle", "montreal"],
        floorplanId: "f2",
        x: 140,
        y: 128,
        headingDegrees: 90,
        confidence: 0.79,
        lastSeenAt: new Date("2026-02-26T23:38:00Z")
      },
      {
        id: "a5",
        tenantId: "t1",
        siteId: "s2",
        type: "conveyor",
        name: "Conveyor A",
        tags: ["stationary"],
        floorplanId: "f2",
        x: 210,
        y: 102,
        headingDegrees: 0,
        confidence: 0.98,
        lastSeenAt: new Date("2026-02-26T23:20:00Z")
      },
      {
        id: "a6",
        tenantId: "t1",
        siteId: "s2",
        type: "person",
        name: "Operator Lane 2",
        tags: ["ppe", "montreal"],
        floorplanId: "f2",
        x: 236,
        y: 52,
        headingDegrees: 270,
        confidence: 0.66,
        lastSeenAt: new Date("2026-02-26T23:34:00Z")
      }
    ]
  });

  await prisma.proximityEvent.createMany({
    data: [
      {
        id: "p1",
        tenantId: "t1",
        siteId: "s1",
        timestamp: new Date("2026-02-26T23:39:45Z"),
        robotId: "r1",
        assetId: "a1",
        distanceM: 1.8,
        riskLevel: "medium",
        zoneId: "z2"
      },
      {
        id: "p2",
        tenantId: "t1",
        siteId: "s1",
        timestamp: new Date("2026-02-26T23:38:50Z"),
        robotId: "r6",
        assetId: "a2",
        distanceM: 1.3,
        riskLevel: "medium",
        zoneId: "z2"
      },
      {
        id: "p3",
        tenantId: "t1",
        siteId: "s1",
        timestamp: new Date("2026-02-26T23:35:40Z"),
        robotId: "r5",
        assetId: "a1",
        distanceM: 0.9,
        riskLevel: "high",
        zoneId: "z2"
      },
      {
        id: "p4",
        tenantId: "t1",
        siteId: "s1",
        timestamp: new Date("2026-02-26T22:56:10Z"),
        robotId: "r4",
        assetId: "a3",
        distanceM: 2.4,
        riskLevel: "low",
        zoneId: "z6"
      },
      {
        id: "p5",
        tenantId: "t1",
        siteId: "s2",
        timestamp: new Date("2026-02-26T23:37:55Z"),
        robotId: "r9",
        assetId: "a4",
        distanceM: 1.7,
        riskLevel: "medium",
        zoneId: "z7"
      },
      {
        id: "p6",
        tenantId: "t1",
        siteId: "s2",
        timestamp: new Date("2026-02-26T23:28:15Z"),
        robotId: "r10",
        assetId: "a5",
        distanceM: 2.1,
        riskLevel: "low",
        zoneId: "z8"
      },
      {
        id: "p7",
        tenantId: "t1",
        siteId: "s2",
        timestamp: new Date("2026-02-26T23:24:25Z"),
        robotId: "r11",
        assetId: "a6",
        distanceM: 1.0,
        riskLevel: "high",
        zoneId: "z9"
      },
      {
        id: "p8",
        tenantId: "t1",
        siteId: "s2",
        timestamp: new Date("2026-02-26T21:10:25Z"),
        robotId: "r12",
        assetId: "a4",
        distanceM: 3.6,
        riskLevel: "low",
        zoneId: "z8"
      }
    ]
  });

  await prisma.apiKey.createMany({
    data: [
      {
        id: "k1",
        tenantId: "t1",
        name: "Ops API Key",
        scopes: ["robots.read", "missions.read", "incidents.read", "audit.read"],
        createdAt: new Date("2026-02-01T11:00:00Z"),
        lastUsedAt: new Date("2026-02-26T23:00:00Z"),
        revokedAt: null
      },
      {
        id: "k2",
        tenantId: "t1",
        name: "Integration Worker",
        scopes: ["missions.read", "missions.write", "incidents.read", "incidents.write"],
        createdAt: new Date("2026-02-03T14:00:00Z"),
        lastUsedAt: new Date("2026-02-26T22:40:00Z"),
        revokedAt: null
      },
      {
        id: "k3",
        tenantId: "t1",
        name: "Diagnostics Script",
        scopes: ["robots.read", "robots.control", "audit.read"],
        createdAt: new Date("2026-02-08T09:00:00Z"),
        lastUsedAt: new Date("2026-02-25T19:10:00Z"),
        revokedAt: null
      }
    ]
  });

  await prisma.integration.createMany({
    data: [
      {
        id: "ig1",
        tenantId: "t1",
        type: "wms",
        name: "North WMS Connector",
        status: "active",
        config: {
          endpoint: "https://wms.example.internal",
          warehouse: "TOR-01",
          syncIntervalMinutes: 5
        },
        lastSyncAt: new Date("2026-02-26T23:10:00Z"),
        createdAt: new Date("2026-02-01T09:00:00Z"),
        updatedAt: new Date("2026-02-26T23:10:00Z")
      },
      {
        id: "ig2",
        tenantId: "t1",
        type: "slack",
        name: "Ops Slack Alerts",
        status: "error",
        config: {
          channel: "#robotops-alerts",
          severityThreshold: "major"
        },
        lastSyncAt: new Date("2026-02-26T22:44:00Z"),
        createdAt: new Date("2026-02-03T15:00:00Z"),
        updatedAt: new Date("2026-02-26T22:44:00Z")
      },
      {
        id: "ig3",
        tenantId: "t1",
        type: "webhook",
        name: "Incident Webhook Sink",
        status: "disabled",
        config: {
          endpoint: "https://hooks.example.internal/robotops/incidents"
        },
        lastSyncAt: null,
        createdAt: new Date("2026-02-10T11:00:00Z"),
        updatedAt: new Date("2026-02-10T11:00:00Z")
      }
    ]
  });

  await prisma.integrationTestRun.createMany({
    data: [
      {
        id: "itr1",
        integrationId: "ig1",
        tenantId: "t1",
        status: "success",
        message: "Connection OK. Sync sample payload accepted.",
        details: {
          latency_ms: 142,
          checked_at: "2026-02-26T23:10:00Z"
        },
        createdAt: new Date("2026-02-26T23:10:00Z")
      },
      {
        id: "itr2",
        integrationId: "ig2",
        tenantId: "t1",
        status: "error",
        message: "Slack webhook returned 403 for current token.",
        details: {
          code: "AUTH_FORBIDDEN",
          checked_at: "2026-02-26T22:44:00Z"
        },
        createdAt: new Date("2026-02-26T22:44:00Z")
      },
      {
        id: "itr3",
        integrationId: "ig2",
        tenantId: "t1",
        status: "success",
        message: "Connection OK after token refresh.",
        details: {
          latency_ms: 196,
          checked_at: "2026-02-25T20:05:00Z"
        },
        createdAt: new Date("2026-02-25T20:05:00Z")
      }
    ]
  });

  await prisma.adapterHealthState.createMany({
    data: [
      {
        id: "ahs1",
        tenantId: "t1",
        siteId: "s1",
        vendor: "vendor_acme",
        adapterName: "demo_polling",
        status: "healthy",
        lastSuccessAt: new Date("2026-02-27T21:00:00Z"),
        lastErrorAt: null,
        lastError: null,
        lastRunId: "arr1",
        updatedAt: new Date("2026-02-27T21:00:00Z")
      },
      {
        id: "ahs2",
        tenantId: "t1",
        siteId: "s1",
        vendor: "vendor_beta",
        adapterName: "demo_streaming",
        status: "error",
        lastSuccessAt: new Date("2026-02-26T18:00:00Z"),
        lastErrorAt: new Date("2026-02-27T20:30:00Z"),
        lastError: "Simulated stream disconnect during replay",
        lastRunId: "arr2",
        updatedAt: new Date("2026-02-27T20:30:00Z")
      }
    ]
  });

  await prisma.adapterReplayRun.createMany({
    data: [
      {
        id: "arr1",
        tenantId: "t1",
        captureId: "seed-capture-vendor-acme",
        status: "completed",
        startedAt: new Date("2026-02-27T20:55:00Z"),
        endedAt: new Date("2026-02-27T21:00:00Z"),
        acceptedCount: 12,
        duplicateCount: 2,
        failedCount: 0,
        options: {
          replay_speed_multiplier: 1,
          deterministic_ordering: true
        },
        errorSummary: null,
        createdBy: "u3",
        createdAt: new Date("2026-02-27T20:55:00Z"),
        updatedAt: new Date("2026-02-27T21:00:00Z")
      },
      {
        id: "arr2",
        tenantId: "t1",
        captureId: "seed-capture-vendor-beta",
        status: "failed",
        startedAt: new Date("2026-02-27T20:20:00Z"),
        endedAt: new Date("2026-02-27T20:30:00Z"),
        acceptedCount: 7,
        duplicateCount: 1,
        failedCount: 3,
        options: {
          replay_speed_multiplier: 2,
          deterministic_ordering: true
        },
        errorSummary: "3 entries failed canonical transform",
        createdBy: "u3",
        createdAt: new Date("2026-02-27T20:20:00Z"),
        updatedAt: new Date("2026-02-27T20:30:00Z")
      }
    ]
  });

  await prisma.adapterReplayRunEvent.createMany({
    data: [
      {
        id: "arre1",
        tenantId: "t1",
        runId: "arr1",
        messageId: "11111111-1111-4111-8111-111111111111",
        messageType: "robot_state",
        result: "accepted",
        error: null,
        createdAt: new Date("2026-02-27T20:56:00Z")
      },
      {
        id: "arre2",
        tenantId: "t1",
        runId: "arr1",
        messageId: "22222222-2222-4222-8222-222222222222",
        messageType: "robot_event",
        result: "duplicate",
        error: null,
        createdAt: new Date("2026-02-27T20:57:00Z")
      },
      {
        id: "arre3",
        tenantId: "t1",
        runId: "arr2",
        messageId: null,
        messageType: null,
        result: "failed",
        error: "Raw payload missing robot_id",
        createdAt: new Date("2026-02-27T20:22:00Z")
      }
    ]
  });

  await prisma.savedView.createMany({
    data: [
      {
        id: "sv1",
        tenantId: "t1",
        createdBy: "u2",
        page: "overview",
        name: "Ops Daily Snapshot",
        filters: {
          site_id: "s1",
          time_range: "24h",
          robot_tags: ["amr"]
        },
        layout: {
          pinnedWidgets: ["active_robots", "incidents_open", "mission_throughput"]
        },
        isShared: true,
        createdAt: new Date("2026-02-11T08:00:00Z"),
        updatedAt: new Date("2026-02-26T18:00:00Z")
      },
      {
        id: "sv2",
        tenantId: "t1",
        createdBy: "u3",
        page: "analytics",
        name: "Reliability Deep Dive",
        filters: {
          site_id: "s1",
          time_range: "7d",
          vendor: "v2"
        },
        layout: {
          sections: ["uptime", "failure_modes", "interventions"]
        },
        isShared: true,
        createdAt: new Date("2026-02-14T10:00:00Z"),
        updatedAt: new Date("2026-02-26T19:15:00Z")
      },
      {
        id: "sv3",
        tenantId: "t1",
        createdBy: "u1",
        page: "fleet",
        name: "Low Battery Watch",
        filters: {
          site_id: "s1",
          battery_min: 0,
          battery_max: 35
        },
        layout: {
          columns: ["robot", "battery", "status", "last_seen"]
        },
        isShared: false,
        createdAt: new Date("2026-02-18T13:00:00Z"),
        updatedAt: new Date("2026-02-26T20:10:00Z")
      }
    ]
  });

  await prisma.roleDashboardDefault.createMany({
    data: [
      {
        id: "rd1",
        tenantId: "t1",
        role: "OpsManager",
        page: "overview",
        savedViewId: "sv1",
        createdBy: "u1",
        createdAt: new Date("2026-02-20T09:00:00Z"),
        updatedAt: new Date("2026-02-20T09:00:00Z")
      },
      {
        id: "rd2",
        tenantId: "t1",
        role: "Engineer",
        page: "analytics",
        savedViewId: "sv2",
        createdBy: "u1",
        createdAt: new Date("2026-02-20T09:05:00Z"),
        updatedAt: new Date("2026-02-20T09:05:00Z")
      }
    ]
  });

  await prisma.dashboardConfig.createMany({
    data: [
      {
        id: "dc1",
        tenantId: "t1",
        name: "Ops Core Dashboard",
        schemaVersion: "1",
        widgets: [
          { id: "kpi_active_robots", type: "kpi", metric: "active_robots" },
          { id: "chart_failure_modes", type: "bar", metric: "incident_categories" }
        ],
        rules: {
          refreshSeconds: 30
        },
        appliesTo: {
          role: "OpsManager",
          site_ids: ["s1", "s2"]
        },
        isActive: true,
        createdBy: "u1",
        createdAt: new Date("2026-02-12T08:00:00Z"),
        updatedAt: new Date("2026-02-26T16:20:00Z")
      },
      {
        id: "dc2",
        tenantId: "t1",
        name: "Engineer Deep Ops",
        schemaVersion: "1",
        widgets: [
          { id: "chart_telemetry", type: "line", metric: "battery" },
          { id: "table_audit", type: "table", metric: "audit_events" }
        ],
        rules: {
          refreshSeconds: 60
        },
        appliesTo: {
          role: "Engineer",
          site_ids: ["s1"]
        },
        isActive: false,
        createdBy: "u3",
        createdAt: new Date("2026-02-16T12:00:00Z"),
        updatedAt: new Date("2026-02-22T12:00:00Z")
      }
    ]
  });

  await prisma.auditLog.createMany({
    data: [
      {
        id: "al1",
        tenantId: "t1",
        timestamp: new Date("2026-02-26T23:15:00Z"),
        actorType: "user",
        actorId: "u2",
        action: "incident.ack.requested",
        resourceType: "incident",
        resourceId: "i1",
        diff: { status: "open" },
        ip: "127.0.0.1",
        userAgent: "seed-script"
      },
      {
        id: "al2",
        tenantId: "t1",
        timestamp: new Date("2026-02-26T23:33:20Z"),
        actorType: "system",
        actorId: "system",
        action: "incident.created",
        resourceType: "incident",
        resourceId: "i2",
        diff: { severity: "critical", category: "safety" },
        ip: "127.0.0.1",
        userAgent: "seed-script"
      },
      {
        id: "al3",
        tenantId: "t1",
        timestamp: new Date("2026-02-26T23:34:40Z"),
        actorType: "user",
        actorId: "u3",
        action: "mission.created",
        resourceType: "mission",
        resourceId: "m3",
        diff: { type: "inventory", priority: "normal" },
        ip: "127.0.0.1",
        userAgent: "seed-script"
      },
      {
        id: "al4",
        tenantId: "t1",
        timestamp: new Date("2026-02-26T23:24:30Z"),
        actorType: "api_key",
        actorId: "k2",
        action: "incident.created",
        resourceType: "incident",
        resourceId: "i6",
        diff: { status: "open", category: "connectivity" },
        ip: "127.0.0.1",
        userAgent: "seed-script"
      },
      {
        id: "al5",
        tenantId: "t1",
        timestamp: new Date("2026-02-26T22:58:10Z"),
        actorType: "system",
        actorId: "system",
        action: "incident.resolved",
        resourceType: "incident",
        resourceId: "i7",
        diff: { status: "resolved" },
        ip: "127.0.0.1",
        userAgent: "seed-script"
      },
      {
        id: "al6",
        tenantId: "t1",
        timestamp: new Date("2026-02-26T22:05:30Z"),
        actorType: "user",
        actorId: "u2",
        action: "mission.completed",
        resourceType: "mission",
        resourceId: "m5",
        diff: { state: "succeeded" },
        ip: "127.0.0.1",
        userAgent: "seed-script"
      },
      {
        id: "al7",
        tenantId: "t1",
        timestamp: new Date("2026-02-26T21:03:00Z"),
        actorType: "user",
        actorId: "u1",
        action: "robot.action.speed_limit",
        resourceType: "robot",
        resourceId: "r4",
        diff: { max_speed_mps: 0.5 },
        ip: "127.0.0.1",
        userAgent: "seed-script"
      },
      {
        id: "al8",
        tenantId: "t1",
        timestamp: new Date("2026-02-26T20:15:00Z"),
        actorType: "api_key",
        actorId: "k3",
        action: "robot.diagnostics.requested",
        resourceType: "robot",
        resourceId: "r11",
        diff: { diagnostics: true },
        ip: "127.0.0.1",
        userAgent: "seed-script"
      }
    ]
  });

  await prisma.copilotThread.createMany({
    data: [
      {
        id: "ct1",
        tenantId: "t1",
        siteId: "s1",
        createdBy: "u2",
        createdAt: new Date("2026-02-26T22:00:00Z")
      },
      {
        id: "ct2",
        tenantId: "t1",
        siteId: "s1",
        createdBy: "u3",
        createdAt: new Date("2026-02-26T23:05:00Z")
      },
      {
        id: "ct3",
        tenantId: "t1",
        siteId: "s2",
        createdBy: "u2",
        createdAt: new Date("2026-02-26T23:08:00Z")
      }
    ]
  });

  await prisma.copilotMessage.createMany({
    data: [
      {
        id: "cm1",
        threadId: "ct1",
        timestamp: new Date("2026-02-26T22:00:00Z"),
        role: "user",
        content: "Show me open incidents",
        toolCalls: [],
        citations: []
      },
      {
        id: "cm2",
        threadId: "ct1",
        timestamp: new Date("2026-02-26T22:00:03Z"),
        role: "assistant",
        content: "You have multiple open incidents across safety, connectivity, and battery categories.",
        toolCalls: [{ name: "query_incidents" }],
        citations: [{ resource: "incident:i1" }, { resource: "incident:i2" }, { resource: "incident:i5" }]
      },
      {
        id: "cm3",
        threadId: "ct2",
        timestamp: new Date("2026-02-26T23:05:00Z"),
        role: "user",
        content: "Which robots are trending low battery this shift?",
        toolCalls: [],
        citations: []
      },
      {
        id: "cm4",
        threadId: "ct2",
        timestamp: new Date("2026-02-26T23:05:04Z"),
        role: "assistant",
        content: "AMR 05, AGV 14, and AGV 22 are the lowest battery robots and should be prioritized for dock/maintenance.",
        toolCalls: [{ name: "query_telemetry" }, { name: "query_robots" }],
        citations: [{ resource: "robot:r3" }, { resource: "robot:r8" }, { resource: "robot:r11" }]
      },
      {
        id: "cm5",
        threadId: "ct3",
        timestamp: new Date("2026-02-26T23:08:00Z"),
        role: "user",
        content: "Summarize Montreal site health.",
        toolCalls: [],
        citations: []
      },
      {
        id: "cm6",
        threadId: "ct3",
        timestamp: new Date("2026-02-26T23:08:06Z"),
        role: "assistant",
        content: "Montreal has one running mission, one blocked mission, and two open incidents needing intervention.",
        toolCalls: [{ name: "query_missions" }, { name: "query_incidents" }],
        citations: [{ resource: "mission:m8" }, { resource: "mission:m9" }, { resource: "incident:i5" }, { resource: "incident:i6" }]
      }
    ]
  });

  const telemetryRows: Array<{
    id: string;
    tenantId: string;
    robotId: string;
    metric: string;
    value: number;
    timestamp: Date;
  }> = [];

  const batteryProfiles = [
    { robotId: "r1", base: 82, slope: 0.08 },
    { robotId: "r2", base: 44, slope: 0.16 },
    { robotId: "r3", base: 15, slope: 0.03 },
    { robotId: "r4", base: 91, slope: 0.04 },
    { robotId: "r5", base: 62, slope: 0.09 },
    { robotId: "r6", base: 73, slope: 0.1 },
    { robotId: "r7", base: 35, slope: 0.13 },
    { robotId: "r8", base: 9, slope: 0.02 },
    { robotId: "r9", base: 78, slope: 0.08 },
    { robotId: "r10", base: 86, slope: 0.07 },
    { robotId: "r11", base: 37, slope: 0.12 },
    { robotId: "r12", base: 11, slope: 0.03 }
  ];

  for (let index = 0; index < 120; index += 1) {
    const offsetMinutes = 120 - index;
    const ts = new Date(Date.now() - offsetMinutes * 60 * 1000);

    for (const profile of batteryProfiles) {
      telemetryRows.push({
        id: `tp-${profile.robotId}-battery-${index}`,
        tenantId: "t1",
        robotId: profile.robotId,
        metric: "battery",
        value: Math.max(0, profile.base - index * profile.slope),
        timestamp: ts
      });
    }

    for (const robotId of ["r2", "r7", "r11"]) {
      telemetryRows.push({
        id: `tp-${robotId}-temp-${index}`,
        tenantId: "t1",
        robotId,
        metric: "temp_c",
        value: 64 + index * 0.08,
        timestamp: ts
      });
    }

    if (index % 2 === 0) {
      for (const robotId of ["r1", "r6", "r9", "r10"]) {
        telemetryRows.push({
          id: `tp-${robotId}-cpu-${index}`,
          tenantId: "t1",
          robotId,
          metric: "cpu_percent",
          value: 34 + (index % 18),
          timestamp: ts
        });
      }
    }

    if (index % 3 === 0) {
      for (const robotId of ["r3", "r8", "r12"]) {
        telemetryRows.push({
          id: `tp-${robotId}-rssi-${index}`,
          tenantId: "t1",
          robotId,
          metric: "network_rssi",
          value: -95 + (index % 5),
          timestamp: ts
        });
      }
    }
  }

  await prisma.telemetryPoint.createMany({ data: telemetryRows });

  const pathRows: Array<{
    id: string;
    tenantId: string;
    robotId: string;
    floorplanId: string;
    x: number;
    y: number;
    headingDegrees: number;
    confidence: number;
    timestamp: Date;
  }> = [];

  for (let index = 0; index < 180; index += 1) {
    const ts = new Date(Date.now() - (180 - index) * 20 * 1000);
    pathRows.push({
      id: `rp-r1-${index}`,
      tenantId: "t1",
      robotId: "r1",
      floorplanId: "f1",
      x: 120 + Math.sin(index / 8) * 24 + index * 0.2,
      y: 62 + Math.cos(index / 10) * 10,
      headingDegrees: (index * 5) % 360,
      confidence: 0.88,
      timestamp: ts
    });
    pathRows.push({
      id: `rp-r2-${index}`,
      tenantId: "t1",
      robotId: "r2",
      floorplanId: "f1",
      x: 260 - index * 0.18,
      y: 128 + Math.sin(index / 7) * 12,
      headingDegrees: (220 + index * 3) % 360,
      confidence: 0.8,
      timestamp: ts
    });
    pathRows.push({
      id: `rp-r9-${index}`,
      tenantId: "t1",
      robotId: "r9",
      floorplanId: "f2",
      x: 92 + index * 0.26,
      y: 146 - Math.sin(index / 9) * 18,
      headingDegrees: (300 + index * 4) % 360,
      confidence: 0.9,
      timestamp: ts
    });
  }

  await prisma.robotPathPoint.createMany({ data: pathRows });

  await prisma.roleScopeOverride.createMany({
    data: [
      {
        id: "rso1",
        tenantId: "t1",
        role: "Operator",
        allowScopes: ["alerts.read"],
        denyScopes: ["incidents.resolve"],
        createdBy: "u1",
        updatedBy: "u1",
        createdAt: new Date("2026-02-26T22:10:00Z"),
        updatedAt: new Date("2026-02-26T22:10:00Z")
      }
    ]
  });

  await prisma.alertPolicy.createMany({
    data: [
      {
        id: "ap1",
        tenantId: "t1",
        name: "Critical Incident Escalation",
        description: "Escalate critical and major incident alerts through deterministic channels",
        isActive: true,
        createdBy: "u1",
        createdAt: new Date("2026-02-26T22:11:00Z"),
        updatedAt: new Date("2026-02-26T22:11:00Z")
      }
    ]
  });

  await prisma.alertPolicyStep.createMany({
    data: [
      {
        id: "aps1",
        tenantId: "t1",
        policyId: "ap1",
        orderIndex: 0,
        delaySeconds: 0,
        channel: "slack",
        target: "#robotops-alerts",
        severityMin: "warning",
        template: "Incident {{incident_id}} opened",
        createdAt: new Date("2026-02-26T22:11:05Z"),
        updatedAt: new Date("2026-02-26T22:11:05Z")
      },
      {
        id: "aps2",
        tenantId: "t1",
        policyId: "ap1",
        orderIndex: 1,
        delaySeconds: 300,
        channel: "email",
        target: "oncall@demo.com",
        severityMin: "major",
        template: "Escalation step 2 for {{incident_id}}",
        createdAt: new Date("2026-02-26T22:11:06Z"),
        updatedAt: new Date("2026-02-26T22:11:06Z")
      }
    ]
  });

  await prisma.alertRule.createMany({
    data: [
      {
        id: "ar1",
        tenantId: "t1",
        name: "Safety Major/Critical Incidents",
        eventType: "incident",
        policyId: "ap1",
        priority: 10,
        isActive: true,
        severity: "major",
        category: "safety",
        siteId: "s1",
        conditions: { source: "seed" },
        createdBy: "u1",
        createdAt: new Date("2026-02-26T22:12:00Z"),
        updatedAt: new Date("2026-02-26T22:12:00Z")
      },
      {
        id: "ar2",
        tenantId: "t1",
        name: "Integration Connector Errors",
        eventType: "integration_error",
        policyId: "ap1",
        priority: 30,
        isActive: true,
        severity: "major",
        category: "integration",
        siteId: null,
        conditions: { source: "seed" },
        createdBy: "u1",
        createdAt: new Date("2026-02-26T22:13:00Z"),
        updatedAt: new Date("2026-02-26T22:13:00Z")
      }
    ]
  });

  await prisma.alertEvent.createMany({
    data: [
      {
        id: "ae1",
        tenantId: "t1",
        ruleId: "ar1",
        policyId: "ap1",
        incidentId: "i1",
        state: "open",
        severity: "major",
        title: "Restricted zone entry alert",
        payload: {
          site_id: "s1",
          severity: "major",
          category: "safety",
          incident_id: "i1"
        },
        triggeredAt: new Date("2026-02-26T23:12:10Z"),
        acknowledgedAt: null,
        acknowledgedBy: null,
        resolvedAt: null,
        createdAt: new Date("2026-02-26T23:12:10Z"),
        updatedAt: new Date("2026-02-26T23:12:10Z")
      }
    ]
  });

  await prisma.alertDelivery.createMany({
    data: [
      {
        id: "ad1",
        tenantId: "t1",
        alertEventId: "ae1",
        policyStepId: "aps1",
        attempt: 1,
        state: "sent",
        channel: "slack",
        target: "#robotops-alerts",
        scheduledFor: new Date("2026-02-26T23:12:10Z"),
        sentAt: new Date("2026-02-26T23:12:13Z"),
        message: "Deterministic stub delivery sent to slack:#robotops-alerts",
        error: null,
        details: { deterministic: true },
        createdAt: new Date("2026-02-26T23:12:10Z"),
        updatedAt: new Date("2026-02-26T23:12:13Z")
      },
      {
        id: "ad2",
        tenantId: "t1",
        alertEventId: "ae1",
        policyStepId: "aps2",
        attempt: 1,
        state: "scheduled",
        channel: "email",
        target: "oncall@demo.com",
        scheduledFor: new Date("2026-02-26T23:17:10Z"),
        sentAt: null,
        message: "Scheduled deterministic email delivery",
        error: null,
        details: { deterministic: true },
        createdAt: new Date("2026-02-26T23:12:10Z"),
        updatedAt: new Date("2026-02-26T23:12:10Z")
      }
    ]
  });

  await prisma.siteAnalyticsRollupHourly.createMany({
    data: [
      {
        id: "sarh1",
        tenantId: "t1",
        siteId: "s1",
        bucketStart: new Date("2026-02-26T22:00:00Z"),
        missionsTotal: 7,
        missionsSucceeded: 5,
        incidentsOpen: 3,
        interventionsCount: 4,
        fleetSize: 8,
        uptimePercent: 75,
        createdAt: new Date("2026-02-26T23:00:00Z"),
        updatedAt: new Date("2026-02-26T23:00:00Z")
      },
      {
        id: "sarh2",
        tenantId: "t1",
        siteId: "s2",
        bucketStart: new Date("2026-02-26T22:00:00Z"),
        missionsTotal: 3,
        missionsSucceeded: 2,
        incidentsOpen: 2,
        interventionsCount: 1,
        fleetSize: 4,
        uptimePercent: 50,
        createdAt: new Date("2026-02-26T23:00:00Z"),
        updatedAt: new Date("2026-02-26T23:00:00Z")
      }
    ]
  });

  await prisma.tenantAnalyticsRollupHourly.createMany({
    data: [
      {
        id: "tarh1",
        tenantId: "t1",
        bucketStart: new Date("2026-02-26T22:00:00Z"),
        missionsTotal: 10,
        missionsSucceeded: 7,
        incidentsOpen: 5,
        interventionsCount: 5,
        fleetSize: 12,
        uptimePercent: 67,
        createdAt: new Date("2026-02-26T23:00:00Z"),
        updatedAt: new Date("2026-02-26T23:00:00Z")
      }
    ]
  });

  await prisma.canonicalMessage.createMany({
    data: [
      {
        id: "cmsg1",
        tenantId: "t1",
        siteId: "s1",
        messageId: "11111111-1111-4111-8111-111111111111",
        schemaVersion: 1,
        messageType: "robot_state",
        timestamp: new Date("2026-02-26T23:15:00Z"),
        sourceType: "edge",
        sourceId: "edge-west-1",
        vendor: "vendor_acme",
        protocol: "http",
        entityType: "robot",
        robotId: "r1",
        severity: null,
        category: null,
        payload: {
          sequence: 101,
          status: "online",
          battery_percent: 82,
          metrics: {
            battery: 82,
            temp_c: 37.2,
            cpu_percent: 44,
            network_rssi: -58,
            disk_percent: 61
          },
          pose: {
            vendor_map_id: "acme-s1-main",
            floorplan_id: "f1",
            x: 42.1,
            y: 24.7,
            heading_degrees: 95,
            confidence: 0.98
          }
        },
        rawEnvelope: {
          message_id: "11111111-1111-4111-8111-111111111111",
          schema_version: 1,
          tenant_id: "t1",
          site_id: "s1",
          message_type: "robot_state",
          timestamp: "2026-02-26T23:15:00Z",
          source: {
            source_type: "edge",
            source_id: "edge-west-1",
            vendor: "vendor_acme",
            protocol: "http"
          },
          entity: {
            entity_type: "robot",
            robot_id: "r1"
          },
          payload: {
            sequence: 101,
            status: "online",
            battery_percent: 82,
            metrics: {
              battery: 82,
              temp_c: 37.2,
              cpu_percent: 44,
              network_rssi: -58,
              disk_percent: 61
            },
            pose: {
              vendor_map_id: "acme-s1-main",
              floorplan_id: "f1",
              x: 42.1,
              y: 24.7,
              heading_degrees: 95,
              confidence: 0.98
            }
          }
        },
        createdAt: new Date("2026-02-26T23:15:01Z")
      },
      {
        id: "cmsg2",
        tenantId: "t1",
        siteId: "s1",
        messageId: "22222222-2222-4222-8222-222222222222",
        schemaVersion: 1,
        messageType: "robot_event",
        timestamp: new Date("2026-02-26T23:16:00Z"),
        sourceType: "adapter",
        sourceId: "vendor-adapter-1",
        vendor: "vendor_acme",
        protocol: "internal",
        entityType: "robot",
        robotId: "r2",
        severity: "warning",
        category: "connectivity",
        payload: {
          sequence: 12,
          dedupe_key: "seed-r2-connectivity-drop",
          event_type: "connectivity_drop",
          severity: "warning",
          category: "connectivity",
          title: "Packet loss detected",
          message: "Robot lost vendor heartbeat for 6 seconds",
          create_incident: true,
          occurred_at: "2026-02-26T23:16:00Z",
          meta: {
            packet_loss_percent: 42
          }
        },
        rawEnvelope: {
          message_id: "22222222-2222-4222-8222-222222222222",
          schema_version: 1,
          tenant_id: "t1",
          site_id: "s1",
          message_type: "robot_event",
          timestamp: "2026-02-26T23:16:00Z",
          source: {
            source_type: "adapter",
            source_id: "vendor-adapter-1",
            vendor: "vendor_acme",
            protocol: "internal"
          },
          entity: {
            entity_type: "robot",
            robot_id: "r2"
          },
          payload: {
            sequence: 12,
            dedupe_key: "seed-r2-connectivity-drop",
            event_type: "connectivity_drop",
            severity: "warning",
            category: "connectivity",
            title: "Packet loss detected",
            message: "Robot lost vendor heartbeat for 6 seconds",
            create_incident: true,
            occurred_at: "2026-02-26T23:16:00Z",
            meta: {
              packet_loss_percent: 42
            }
          }
        },
        createdAt: new Date("2026-02-26T23:16:01Z")
      },
      {
        id: "cmsg3",
        tenantId: "t1",
        siteId: "s1",
        messageId: "33333333-3333-4333-8333-333333333333",
        schemaVersion: 1,
        messageType: "task_status",
        timestamp: new Date("2026-02-26T23:17:00Z"),
        sourceType: "simulator",
        sourceId: "sim-run-17",
        vendor: "robotops_sim",
        protocol: "internal",
        entityType: "robot",
        robotId: "r3",
        severity: null,
        category: null,
        payload: {
          sequence: 44,
          task_id: "m2",
          state: "running",
          percent_complete: 55,
          updated_at: "2026-02-26T23:17:00Z",
          message: "Entered waypoint corridor",
          meta: {
            waypoint_index: 4
          }
        },
        rawEnvelope: {
          message_id: "33333333-3333-4333-8333-333333333333",
          schema_version: 1,
          tenant_id: "t1",
          site_id: "s1",
          message_type: "task_status",
          timestamp: "2026-02-26T23:17:00Z",
          source: {
            source_type: "simulator",
            source_id: "sim-run-17",
            vendor: "robotops_sim",
            protocol: "internal"
          },
          entity: {
            entity_type: "robot",
            robot_id: "r3"
          },
          payload: {
            sequence: 44,
            task_id: "m2",
            state: "running",
            percent_complete: 55,
            updated_at: "2026-02-26T23:17:00Z",
            message: "Entered waypoint corridor",
            meta: {
              waypoint_index: 4
            }
          }
        },
        createdAt: new Date("2026-02-26T23:17:01Z")
      },
      {
        id: "cmsg4",
        tenantId: "t1",
        siteId: "s1",
        messageId: "44444444-4444-4444-8444-444444444444",
        schemaVersion: 1,
        messageType: "robot_state",
        timestamp: new Date("2026-02-26T23:18:00Z"),
        sourceType: "edge",
        sourceId: "edge-mezz-1",
        vendor: "vendor_acme",
        protocol: "http",
        entityType: "robot",
        robotId: "r4",
        severity: null,
        category: null,
        payload: {
          status: "online",
          battery_percent: 64,
          pose: {
            vendor_map_name: "mezzanine_map",
            x: 38.4,
            y: 17.1,
            heading_degrees: 22,
            confidence: 0.93
          }
        },
        rawEnvelope: {
          message_id: "44444444-4444-4444-8444-444444444444",
          schema_version: 1,
          tenant_id: "t1",
          site_id: "s1",
          message_type: "robot_state",
          timestamp: "2026-02-26T23:18:00Z",
          source: {
            source_type: "edge",
            source_id: "edge-mezz-1",
            vendor: "vendor_acme",
            protocol: "http"
          },
          entity: {
            entity_type: "robot",
            robot_id: "r4"
          },
          payload: {
            status: "online",
            battery_percent: 64,
            pose: {
              vendor_map_name: "mezzanine_map",
              x: 38.4,
              y: 17.1,
              heading_degrees: 22,
              confidence: 0.93
            }
          }
        },
        createdAt: new Date("2026-02-26T23:18:01Z")
      },
      {
        id: "cmsg5",
        tenantId: "t1",
        siteId: "s1",
        messageId: "55555555-5555-4555-8555-555555555555",
        schemaVersion: 1,
        messageType: "robot_state",
        timestamp: new Date("2026-02-26T23:19:00Z"),
        sourceType: "edge",
        sourceId: "edge-unmapped-1",
        vendor: "vendor_acme",
        protocol: "http",
        entityType: "robot",
        robotId: "r2",
        severity: null,
        category: null,
        payload: {
          status: "online",
          battery_percent: 51,
          pose: {
            vendor_map_id: "missing-map-key",
            floorplan_id: "unknown-floorplan",
            x: 10.5,
            y: 8.2,
            heading_degrees: 180,
            confidence: 0.9
          }
        },
        rawEnvelope: {
          message_id: "55555555-5555-4555-8555-555555555555",
          schema_version: 1,
          tenant_id: "t1",
          site_id: "s1",
          message_type: "robot_state",
          timestamp: "2026-02-26T23:19:00Z",
          source: {
            source_type: "edge",
            source_id: "edge-unmapped-1",
            vendor: "vendor_acme",
            protocol: "http"
          },
          entity: {
            entity_type: "robot",
            robot_id: "r2"
          },
          payload: {
            status: "online",
            battery_percent: 51,
            pose: {
              vendor_map_id: "missing-map-key",
              floorplan_id: "unknown-floorplan",
              x: 10.5,
              y: 8.2,
              heading_degrees: 180,
              confidence: 0.9
            }
          }
        },
        createdAt: new Date("2026-02-26T23:19:01Z")
      }
    ]
  });

  await prisma.ingestionEvent.createMany({
    data: [
      {
        id: "ievt1",
        tenantId: "t1",
        canonicalMessageId: "cmsg1",
        source: "edge:edge-west-1",
        dedupeKey: "11111111-1111-4111-8111-111111111111",
        status: "processed",
        payload: {
          message_id: "11111111-1111-4111-8111-111111111111",
          schema_version: 1,
          tenant_id: "t1",
          site_id: "s1",
          message_type: "robot_state",
          timestamp: "2026-02-26T23:15:00Z",
          source: {
            source_type: "edge",
            source_id: "edge-west-1",
            vendor: "vendor_acme",
            protocol: "http"
          },
          entity: {
            entity_type: "robot",
            robot_id: "r1"
          },
          payload: {
            sequence: 101,
            status: "online",
            battery_percent: 82,
            metrics: {
              battery: 82,
              temp_c: 37.2,
              cpu_percent: 44,
              network_rssi: -58,
              disk_percent: 61
            },
            pose: {
              vendor_map_id: "acme-s1-main",
              floorplan_id: "f1",
              x: 42.1,
              y: 24.7,
              heading_degrees: 95,
              confidence: 0.98
            }
          }
        },
        error: null,
        createdAt: new Date("2026-02-26T23:15:01Z"),
        processedAt: new Date("2026-02-26T23:15:02Z")
      },
      {
        id: "ievt2",
        tenantId: "t1",
        canonicalMessageId: "cmsg2",
        source: "adapter:vendor-adapter-1",
        dedupeKey: "22222222-2222-4222-8222-222222222222",
        status: "processed",
        payload: {
          message_id: "22222222-2222-4222-8222-222222222222",
          schema_version: 1,
          tenant_id: "t1",
          site_id: "s1",
          message_type: "robot_event",
          timestamp: "2026-02-26T23:16:00Z",
          source: {
            source_type: "adapter",
            source_id: "vendor-adapter-1",
            vendor: "vendor_acme",
            protocol: "internal"
          },
          entity: {
            entity_type: "robot",
            robot_id: "r2"
          },
          payload: {
            sequence: 12,
            dedupe_key: "seed-r2-connectivity-drop",
            event_type: "connectivity_drop",
            severity: "warning",
            category: "connectivity",
            title: "Packet loss detected",
            message: "Robot lost vendor heartbeat for 6 seconds",
            create_incident: true,
            occurred_at: "2026-02-26T23:16:00Z",
            meta: {
              packet_loss_percent: 42
            }
          }
        },
        error: null,
        createdAt: new Date("2026-02-26T23:16:01Z"),
        processedAt: new Date("2026-02-26T23:16:03Z")
      },
      {
        id: "ievt3",
        tenantId: "t1",
        canonicalMessageId: "cmsg3",
        source: "simulator:sim-run-17",
        dedupeKey: "33333333-3333-4333-8333-333333333333",
        status: "processed",
        payload: {
          message_id: "33333333-3333-4333-8333-333333333333",
          schema_version: 1,
          tenant_id: "t1",
          site_id: "s1",
          message_type: "task_status",
          timestamp: "2026-02-26T23:17:00Z",
          source: {
            source_type: "simulator",
            source_id: "sim-run-17",
            vendor: "robotops_sim",
            protocol: "internal"
          },
          entity: {
            entity_type: "robot",
            robot_id: "r3"
          },
          payload: {
            sequence: 44,
            task_id: "m2",
            state: "running",
            percent_complete: 55,
            updated_at: "2026-02-26T23:17:00Z",
            message: "Entered waypoint corridor",
            meta: {
              waypoint_index: 4
            }
          }
        },
        error: null,
        createdAt: new Date("2026-02-26T23:17:01Z"),
        processedAt: new Date("2026-02-26T23:17:02Z")
      },
      {
        id: "ievt4",
        tenantId: "t1",
        canonicalMessageId: "cmsg4",
        source: "edge:edge-mezz-1",
        dedupeKey: "44444444-4444-4444-8444-444444444444",
        status: "processed",
        payload: {
          message_id: "44444444-4444-4444-8444-444444444444",
          schema_version: 1,
          tenant_id: "t1",
          site_id: "s1",
          message_type: "robot_state",
          timestamp: "2026-02-26T23:18:00Z",
          source: {
            source_type: "edge",
            source_id: "edge-mezz-1",
            vendor: "vendor_acme",
            protocol: "http"
          },
          entity: {
            entity_type: "robot",
            robot_id: "r4"
          },
          payload: {
            status: "online",
            battery_percent: 64,
            pose: {
              vendor_map_name: "mezzanine_map",
              x: 38.4,
              y: 17.1,
              heading_degrees: 22,
              confidence: 0.93
            }
          }
        },
        error: null,
        createdAt: new Date("2026-02-26T23:18:01Z"),
        processedAt: new Date("2026-02-26T23:18:02Z")
      },
      {
        id: "ievt5",
        tenantId: "t1",
        canonicalMessageId: "cmsg5",
        source: "edge:edge-unmapped-1",
        dedupeKey: "55555555-5555-4555-8555-555555555555",
        status: "failed",
        payload: {
          message_id: "55555555-5555-4555-8555-555555555555",
          schema_version: 1,
          tenant_id: "t1",
          site_id: "s1",
          message_type: "robot_state",
          timestamp: "2026-02-26T23:19:00Z",
          source: {
            source_type: "edge",
            source_id: "edge-unmapped-1",
            vendor: "vendor_acme",
            protocol: "http"
          },
          entity: {
            entity_type: "robot",
            robot_id: "r2"
          },
          payload: {
            status: "online",
            battery_percent: 51,
            pose: {
              vendor_map_id: "missing-map-key",
              floorplan_id: "unknown-floorplan",
              x: 10.5,
              y: 8.2,
              heading_degrees: 180,
              confidence: 0.9
            }
          }
        },
        error: "No vendor site map matched and pose.floorplan_id is not a valid RobotOps floorplan for tenant/site",
        createdAt: new Date("2026-02-26T23:19:01Z"),
        processedAt: null
      },
      {
        id: "ievt6",
        tenantId: "t1",
        canonicalMessageId: null,
        source: "seed",
        dedupeKey: "invalid-envelope-1",
        status: "failed",
        payload: {
          tenant_id: "t1",
          site_id: "s1",
          schema_version: 999,
          payload: {
            bad: true
          }
        },
        error: "Invalid canonical envelope",
        createdAt: new Date("2026-02-26T23:18:01Z"),
        processedAt: null
      }
    ]
  });

  await prisma.messageDedupeWindow.createMany({
    data: [
      {
        id: "mdw1",
        tenantId: "t1",
        siteId: "s1",
        messageType: "robot_event",
        entityId: "r2",
        dedupeKey: "seed-r2-connectivity-drop",
        windowSeconds: 1800,
        firstSeenAt: new Date("2026-02-26T23:16:00Z"),
        expiresAt: new Date("2026-02-26T23:46:00Z"),
        lastMessageId: "22222222-2222-4222-8222-222222222222"
      },
      {
        id: "mdw2",
        tenantId: "t1",
        siteId: "s1",
        messageType: "task_status",
        entityId: "m2",
        dedupeKey: "m2:running:2026-02-26T23:17:00.000Z",
        windowSeconds: 86400,
        firstSeenAt: new Date("2026-02-26T23:17:00Z"),
        expiresAt: new Date("2026-02-27T23:17:00Z"),
        lastMessageId: "33333333-3333-4333-8333-333333333333"
      }
    ]
  });

  await prisma.telemetryDeadLetter.createMany({
    data: [
      {
        id: "tdl1",
        tenantId: "t1",
        source: "seed",
        payload: {
          tenant_id: "t1",
          site_id: "s1",
          schema_version: 999,
          payload: {
            bad: true
          }
        },
        error: "Invalid canonical envelope",
        createdAt: new Date("2026-02-26T23:16:03Z")
      },
      {
        id: "tdl2",
        tenantId: "t1",
        source: "edge:edge-unmapped-1",
        payload: {
          message_id: "55555555-5555-4555-8555-555555555555",
          schema_version: 1,
          tenant_id: "t1",
          site_id: "s1",
          message_type: "robot_state",
          timestamp: "2026-02-26T23:19:00Z",
          source: {
            source_type: "edge",
            source_id: "edge-unmapped-1",
            vendor: "vendor_acme",
            protocol: "http"
          },
          entity: {
            entity_type: "robot",
            robot_id: "r2"
          },
          payload: {
            status: "online",
            battery_percent: 51,
            pose: {
              vendor_map_id: "missing-map-key",
              floorplan_id: "unknown-floorplan",
              x: 10.5,
              y: 8.2,
              heading_degrees: 180,
              confidence: 0.9
            }
          }
        },
        error: "No vendor site map matched and pose.floorplan_id is not a valid RobotOps floorplan for tenant/site",
        createdAt: new Date("2026-02-26T23:19:03Z")
      }
    ]
  });

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
