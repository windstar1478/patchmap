import type { Dims } from '../data/types'
import type { Point } from './route'

/**
 * 그려지는 케이블 선을 실제 배선에 가깝게 다듬는다.
 *
 * routeCable() 이 내놓는 것은 축을 따라 직각으로 꺾이는 뼈대 경로다.
 * 그대로 그리면 세 가지가 눈에 거슬린다.
 *  - 기기 한가운데에서 선이 솟아 나온다 (실제로는 몸통 표면의 포트에서 나온다)
 *  - 같은 통로를 지나는 케이블이 한 줄로 완전히 겹쳐 한 가닥처럼 보인다
 *  - 모서리가 칼같이 꺾인다 (실제 케이블은 굽힘 반경만큼 둥글게 돈다)
 *
 * 여기 있는 함수는 전부 표시용이다. 길이 판정은 뼈대 경로를 그대로 쓴다
 * (routeLength). 둥글린 선은 원래 경로보다 아주 조금 짧으므로, 그쪽을 재면
 * 필요 길이를 과소평가하게 된다 — 판정은 보수적인 뼈대 쪽에 남겨 둔다.
 */
export interface DrawOptions {
  /** 시작 기기의 치수. 주면 선이 그 몸통 표면에서 시작한다. */
  from?: Dims
  /** 끝 기기의 치수. */
  to?: Dims
  /** 몇 번째 가닥인가. 0 이면 통로 한가운데. */
  lane?: number
  /** 가닥 사이 간격(mm). */
  spacing?: number
  /** 모서리 굽힘 반경(mm). */
  radius?: number
}

const DEFAULTS = { lane: 0, spacing: 11, radius: 26 }

/** 뼈대 경로 → 화면에 그릴 선. 2D·3D 가 같은 결과를 쓰도록 여기 모아 둔다. */
export function cableDrawPath(route: readonly Point[], opts: DrawOptions = {}): Point[] {
  const { lane, spacing, radius } = { ...DEFAULTS, ...opts }
  if (route.length < 2) return [...route]
  const clipped = clipToBodies(route, opts.from, opts.to)
  const spread = spreadLane(clipped, lane, spacing)
  return roundCorners(spread, radius)
}

/**
 * 케이블 id 로 가닥 번호를 정한다.
 *
 * 배열 순서를 쓰면 시나리오를 바꿔 케이블이 걸러질 때마다 가닥이 자리를 옮긴다.
 * id 해시는 어떤 조합에서도 같은 케이블을 같은 자리에 둔다.
 */
export function laneOf(id: string, lanes = 7): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return (Math.abs(h) % lanes) - (lanes - 1) / 2
}

/**
 * 선을 기기 중심이 아니라 몸통 표면에서 시작·끝나게 자른다.
 * 첫 구간이 향하는 축으로 그 기기의 반쪽 치수만큼 밀어낸다.
 */
export function clipToBodies(route: readonly Point[], from?: Dims, to?: Dims): Point[] {
  const pts = [...route]
  if (from && pts.length >= 2) pts[0] = pullOut(pts[0]!, pts[1]!, from)
  if (to && pts.length >= 2) pts[pts.length - 1] = pullOut(pts.at(-1)!, pts.at(-2)!, to)
  return pts
}

/**
 * 통로를 함께 지나는 케이블을 옆으로 조금씩 비켜 놓는다.
 * 양 끝은 포트 자리를 지켜야 하므로 건드리지 않는다.
 *
 * x·z 두 축만 민다. y 를 밀면 상판에 놓인 케이블이 상판에 파묻히거나 떠 버린다.
 */
export function spreadLane(route: readonly Point[], lane: number, spacing: number): Point[] {
  if (lane === 0 || route.length < 3) return [...route]
  const dx = lane * spacing
  const dz = lane * spacing * 0.7
  return route.map((p, i) =>
    i === 0 || i === route.length - 1 ? { ...p } : { x: p.x + dx, y: p.y, z: p.z + dz },
  )
}

/**
 * 직각 모서리를 굽힘 반경만큼 둥글린다.
 * 반경은 양쪽 구간 길이의 절반을 넘지 못한다 — 짧은 구간을 삼켜 경로가 어긋나지 않게.
 */
export function roundCorners(route: readonly Point[], radius: number, seg = 6): Point[] {
  if (route.length < 3 || radius <= 0) return [...route]
  const out: Point[] = [{ ...route[0]! }]
  for (let i = 1; i < route.length - 1; i++) {
    const a = route[i - 1]!
    const v = route[i]!
    const b = route[i + 1]!
    const da = dir(v, a)
    const db = dir(v, b)
    const r = Math.min(radius, dist(v, a) / 2, dist(v, b) / 2)
    // 일직선이거나(꺾임 없음) 되꺾임이면 그대로 둔다.
    const dot = da.x * db.x + da.y * db.y + da.z * db.z
    if (r < 1 || dot < -0.999 || dot > 0.999) {
      out.push({ ...v })
      continue
    }
    const p0 = add(v, scale(da, r))
    const p1 = add(v, scale(db, r))
    for (let k = 0; k <= seg; k++) out.push(quad(p0, v, p1, k / seg))
  }
  out.push({ ...route.at(-1)! })
  return dedupe(out)
}

/** 경로 중 축을 따르는 구간의 반쪽 치수. */
function pullOut(p: Point, toward: Point, dims: Dims): Point {
  const d = dir(p, toward)
  const half = Math.abs(d.x) * (dims.w / 2) + Math.abs(d.y) * (dims.h / 2) + Math.abs(d.z) * (dims.d / 2)
  // 구간을 넘어서 밀면 경로가 되꺾인다. 다음 꼭짓점 앞에 최소한의 여유를 남긴다.
  const t = Math.min(half, Math.max(0, dist(p, toward) - 20))
  return add(p, scale(d, t))
}

function quad(p0: Point, c: Point, p1: Point, t: number): Point {
  const u = 1 - t
  const a = u * u
  const b = 2 * u * t
  const d = t * t
  return {
    x: a * p0.x + b * c.x + d * p1.x,
    y: a * p0.y + b * c.y + d * p1.y,
    z: a * p0.z + b * c.z + d * p1.z,
  }
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
}

function dir(from: Point, to: Point): Point {
  const len = dist(from, to) || 1
  return { x: (to.x - from.x) / len, y: (to.y - from.y) / len, z: (to.z - from.z) / len }
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

function scale(p: Point, k: number): Point {
  return { x: p.x * k, y: p.y * k, z: p.z * k }
}

function dedupe(points: Point[]): Point[] {
  return points.filter((p, i) => i === 0 || dist(points[i - 1]!, p) > 0.5)
}
