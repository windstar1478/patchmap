import { describe, expect, it } from 'vitest'
import { desk, devices, plannedDevices } from '../data/setup'
import { indexDevices } from './mount'
import { routeCable, routeLength, type Point } from './route'
import { cableDrawPath, clipToBodies, laneOf, roundCorners, spreadLane } from './cableDraw'

const dIndex = indexDevices([...devices, ...plannedDevices])
const H = 710

const route = () => routeCable('pc', 'stand', H, dIndex, desk)

/** 점에서 원래 경로까지의 거리 — 다듬은 선이 경로를 얼마나 벗어났는지 재는 데 쓴다. */
function distanceToPath(p: Point, path: Point[]): number {
  let best = Infinity
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!
    const b = path[i]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dz = b.z - a.z
    const len2 = dx * dx + dy * dy + dz * dz
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / len2))
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t), p.z - (a.z + dz * t)))
  }
  return best
}

describe('케이블 그리기', () => {
  it('선이 기기 중심이 아니라 몸통 표면에서 시작한다', () => {
    const raw = route()
    const pc = dIndex.get('pc')!
    const clipped = clipToBodies(raw, pc.dims, dIndex.get('stand')!.dims)
    // pc 는 바닥 기기라 첫 구간이 위로 향한다 — 케이스 윗면까지 올라와야 한다.
    expect(clipped[0]!.y).toBeGreaterThan(raw[0]!.y)
    expect(clipped[0]!.y).toBeCloseTo(raw[0]!.y + pc.dims.h / 2, 6)
    expect(clipped[0]!.x).toBeCloseTo(raw[0]!.x, 6)
  })

  it('구간보다 길게 밀어내지 않는다 — 경로가 되꺾이지 않게', () => {
    const path: Point[] = [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 0, z: 0 },
      { x: 100, y: 0, z: 400 },
    ]
    const huge = { w: 10000, d: 10, h: 10 }
    const clipped = clipToBodies(path, huge)
    expect(clipped[0]!.x).toBeLessThanOrEqual(80)
    expect(clipped[0]!.x).toBeGreaterThan(0)
  })

  it('가닥 번호는 케이블 id 로만 정해진다 — 시나리오를 바꿔도 자리가 안 흔들린다', () => {
    expect(laneOf('c-usb-st')).toBe(laneOf('c-usb-st'))
    for (const id of ['c-usb-st', 'c-hdmi-1', 'c-power', 'x']) {
      expect(Math.abs(laneOf(id))).toBeLessThanOrEqual(3)
    }
  })

  it('가닥을 옆으로 비켜도 양 끝(포트 자리)은 그대로다', () => {
    const raw = route()
    const moved = spreadLane(raw, 2, 11)
    expect(moved[0]).toEqual(raw[0])
    expect(moved.at(-1)).toEqual(raw.at(-1))
    // 중간 구간은 갈라져야 한다 — 겹쳐 그리면 한 가닥처럼 보인다.
    expect(moved[1]!.x).not.toBe(raw[1]!.x)
    expect(spreadLane(raw, -2, 11)[1]!.x).not.toBe(moved[1]!.x)
  })

  it('가닥 0 은 통로 한가운데 그대로 있다', () => {
    const raw = route()
    expect(spreadLane(raw, 0, 11)).toEqual(raw)
  })

  it('모서리를 둥글려도 경로에서 반경 이상 벗어나지 않는다', () => {
    const raw = route()
    const r = 26
    const rounded = roundCorners(raw, r)
    expect(rounded[0]).toEqual(raw[0])
    expect(rounded.at(-1)).toEqual(raw.at(-1))
    for (const p of rounded) expect(distanceToPath(p, raw)).toBeLessThanOrEqual(r)
  })

  it('둥글린 선은 원래 경로보다 짧다 — 그래서 길이 판정은 원래 경로로 한다', () => {
    const raw = route()
    const rounded = roundCorners(raw, 26)
    const shortened = routeLength(rounded)
    expect(shortened).toBeLessThan(routeLength(raw))
    // 모서리를 자른 만큼만 짧아진다. 경로가 통째로 달라지면 안 된다.
    expect(shortened).toBeGreaterThan(routeLength(raw) * 0.95)
  })

  it('짧은 구간을 삼키지 않는다 — 반경은 구간 절반까지만', () => {
    const path: Point[] = [
      { x: 0, y: 0, z: 0 },
      { x: 20, y: 0, z: 0 },
      { x: 20, y: 0, z: 20 },
      { x: 400, y: 0, z: 20 },
    ]
    const rounded = roundCorners(path, 200)
    for (const p of rounded) expect(distanceToPath(p, path)).toBeLessThanOrEqual(10.001)
  })

  it('그리기용 가공이 원본 경로를 건드리지 않는다', () => {
    const raw = route()
    const before = JSON.parse(JSON.stringify(raw))
    cableDrawPath(raw, { from: dIndex.get('pc')!.dims, lane: 3 })
    expect(raw).toEqual(before)
  })

  it('점이 두 개뿐인 경로도 그대로 처리한다', () => {
    const two: Point[] = [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 0, z: 0 },
    ]
    expect(cableDrawPath(two, { lane: 2 })).toHaveLength(2)
  })
})
