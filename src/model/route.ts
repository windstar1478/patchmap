import type { Desk, DeviceId, Vec3 } from '../data/types'
import { absoluteCenter, lineageOf, type DeviceIndex } from './mount'

export type Point = { x: number; y: number; z: number }

/** 상판 뒷변 배선홈의 중심 위치. 홈은 뒷변에서 앞으로 depth 만큼 파여 있다. */
export function cableHoleCenter(desk: Desk): { x: number; z: number } | undefined {
  const hole = desk.cableHole
  if (!hole) return undefined
  return { x: hole.x, z: desk.d - hole.depth / 2 }
}

/**
 * 케이블이 실제로 지나가는 경로.
 *
 * 직선으로 이으면 다른 기기를 관통한다. 실제로는 이렇게 간다:
 *  - 상판 위끼리     → 받침대 뒤쪽을 타고 넘어간다
 *  - 경계를 넘을 때  → 상판 뒷변 배선홈으로 내려가 배선트레이를 통과한다
 *  - 상판 아래끼리   → 트레이 높이에서 바로 간다
 *
 * 순수 함수라 2D·3D 렌더러와 길이 계산이 같은 경로를 쓴다.
 */
export interface RouteOptions {
  /**
   * 트레이를 거치지 않고 바로 잇는다.
   * 기타처럼 연주할 때만 전면 잭에 꽂는 케이블은 배선트레이를 타지 않는다.
   */
  direct?: boolean
}

export function routeCable(
  a: DeviceId,
  b: DeviceId,
  deskHeight: number,
  index: DeviceIndex,
  desk: Desk,
  opts: RouteOptions = {},
): Point[] {
  const pa = absoluteCenter(a, deskHeight, index)
  const pb = absoluteCenter(b, deskHeight, index)

  const corridorY = corridorLevel(deskHeight, desk)
  const corridorZ = desk.tray?.z ?? desk.d - 120
  const backZ = desk.d - 40
  const hole = cableHoleCenter(desk)

  const aTop = isAboveDesktop(a, index, deskHeight, pa, desk)
  const bTop = isAboveDesktop(b, index, deskHeight, pb, desk)

  // 상시 배선이 아니면 트레이에 넣지 않는다 — 축을 따라 바로 간다.
  if (opts.direct) {
    return dedupe([pa, { x: pb.x, y: pa.y, z: pa.z }, { x: pb.x, y: pa.y, z: pb.z }, pb])
  }

  // 상판 위끼리 — 받침대 뒤쪽을 타고 넘어간다.
  if (aTop && bTop) {
    return dedupe([
      pa,
      { x: pa.x, y: pa.y, z: backZ },
      { x: pb.x, y: pa.y, z: backZ },
      { x: pb.x, y: pb.y, z: backZ },
      pb,
    ])
  }

  // 한쪽이라도 상판 아래(트레이·바닥)면 배선 통로를 쓴다.
  const enterA = descend(pa, aTop, corridorY, corridorZ, hole)
  const enterB = descend(pb, bTop, corridorY, corridorZ, hole)

  return dedupe([
    pa,
    ...enterA,
    { x: enterA.at(-1)?.x ?? pa.x, y: corridorY, z: corridorZ },
    { x: enterB.at(-1)?.x ?? pb.x, y: corridorY, z: corridorZ },
    ...[...enterB].reverse(),
    pb,
  ])
}

/** 배선 통로(트레이 안쪽)의 높이. */
export function corridorLevel(deskHeight: number, desk: Desk): number {
  const trayH = desk.tray?.h ?? 120
  return deskHeight - desk.thickness - trayH / 2
}

function isAboveDesktop(
  id: DeviceId,
  index: DeviceIndex,
  deskHeight: number,
  p: Point,
  desk: Desk,
): boolean {
  return lineageOf(id, index) === 'desk' && p.y > deskHeight - desk.thickness
}

/** 그 끝이 배선 통로까지 내려가는 구간. 상판 위면 배선홀을 거친다. */
function descend(
  p: Point,
  fromTop: boolean,
  corridorY: number,
  corridorZ: number,
  hole: { x: number; z: number } | undefined,
): Point[] {
  if (fromTop && hole) {
    // 축을 따라 배선홈까지 간 다음 수직으로 내려간다. 대각선으로 상판을 가로지르지 않게.
    return [
      { x: hole.x, y: p.y, z: p.z },
      { x: hole.x, y: p.y, z: hole.z },
      { x: hole.x, y: corridorY, z: hole.z },
      { x: hole.x, y: corridorY, z: corridorZ },
    ]
  }
  return [
    { x: p.x, y: corridorY, z: p.z },
    { x: p.x, y: corridorY, z: corridorZ },
  ]
}

/** 경로 총 길이 — 실제로 꺾여 도는 거리. */
export function routeLength(points: readonly Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
  }
  return total
}

function dedupe(points: Point[]): Point[] {
  return points.filter((p, i) => {
    if (i === 0) return true
    const q = points[i - 1]!
    return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) > 1
  })
}

export function toVec3(p: Point): Vec3 {
  return { x: p.x, z: p.z, yOff: p.y }
}
