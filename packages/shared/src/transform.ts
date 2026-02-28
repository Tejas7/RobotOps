import type { VendorPosePoint, VendorPoseTransformParams, VendorPoseTransformResult } from "./types";

export function normalizeHeading0To360(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function transformVendorPosePoint(
  point: VendorPosePoint,
  params: VendorPoseTransformParams
): VendorPoseTransformResult {
  const scaledX = point.x * params.scale;
  const scaledY = point.y * params.scale;
  const radians = (params.rotationDegrees * Math.PI) / 180;
  const rotatedX = scaledX * Math.cos(radians) - scaledY * Math.sin(radians);
  const rotatedY = scaledX * Math.sin(radians) + scaledY * Math.cos(radians);

  return {
    x: rotatedX + params.translateX,
    y: rotatedY + params.translateY,
    headingDegrees:
      point.headingDegrees === undefined ? undefined : normalizeHeading0To360(point.headingDegrees + params.rotationDegrees),
    confidence: point.confidence
  };
}

export function transformVendorPosePoints(points: VendorPosePoint[], params: VendorPoseTransformParams) {
  return points.map((point) => transformVendorPosePoint(point, params));
}
