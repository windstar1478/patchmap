import { describe, expect, it } from 'vitest'
import { desk, devices, plannedDevices } from '../data/setup'
import { absoluteY, indexDevices } from './mount'
import { cableHoleCenter, corridorLevel, grooveOutline, routeCable, routeLength } from './route'

const dIndex = indexDevices([...devices, ...plannedDevices])
const H = 710

/** 경로가 축을 따라만 꺾이는가 (대각선으로 상판을 가로지르지 않는가). */
function isAxisAligned(points: { x: number; y: number; z: number }[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const moved = [a.x !== b.x, a.y !== b.y, a.z !== b.z].filter(Boolean).length
    if (moved > 1) return false
  }
  return true
}

describe('배선 경로', () => {
  it('책상에 배선트레이와 배선홀이 정의돼 있다', () => {
    expect(desk.tray).toBeDefined()
    expect(desk.tray!.w).toBe(660)
    expect(desk.tray!.h).toBe(140)
    expect(desk.cableHole).toBeDefined()
  })

  it('배선홈은 상판 뒷변 중앙이 파인 것이다 — 트레이 뒷판이 아니다', () => {
    const hole = desk.cableHole!
    expect(hole.verified).toBe(true)
    expect(hole.x).toBe(desk.w / 2) // 중앙
    expect(hole.depth).toBeGreaterThan(0)
    expect(hole.depth).toBeLessThan(desk.d / 2) // 상판을 가로지르지는 않는다
    // 홈의 중심은 상판 뒷변 바로 안쪽
    const center = cableHoleCenter(desk)!
    expect(center.z).toBe(desk.d - hole.depth / 2)
    expect(center.z).toBeGreaterThan(desk.d - hole.depth)
  })

  it('배선홈 가로 폭은 상판 폭의 1/5~1/4 이다', () => {
    const hole = desk.cableHole!
    expect(hole.w).toBeGreaterThanOrEqual(desk.w / 5)
    expect(hole.w).toBeLessThanOrEqual(desk.w / 4)
  })

  it('배선홈은 뒷변의 얕은 홈이다 — 상판을 깊게 자르지 않는다', () => {
    const hole = desk.cableHole!
    expect(hole.depth).toBeGreaterThan(desk.d * 0.05)
    expect(hole.depth).toBeLessThan(desk.d * 0.12)
    // 폭이 깊이보다 훨씬 넓은, 옆으로 퍼진 홈이다.
    expect(hole.w).toBeGreaterThan(hole.depth * 3)
  })

  it('홈 윤곽선은 뒷변에서 나가 뒷변으로 돌아오고, 폭·깊이가 데이터와 맞는다', () => {
    const hole = desk.cableHole!
    const outline = grooveOutline(desk)
    expect(outline.length).toBeGreaterThan(8)
    expect(outline[0]!.z).toBeCloseTo(desk.d, 6)
    expect(outline.at(-1)!.z).toBeCloseTo(desk.d, 6)
    expect(outline[0]!.x).toBeCloseTo(hole.x - hole.w / 2, 6)
    expect(outline.at(-1)!.x).toBeCloseTo(hole.x + hole.w / 2, 6)
    // 가장 깊이 파고든 지점이 곧 홈의 깊이다.
    const deepest = Math.min(...outline.map((p) => p.z))
    expect(desk.d - deepest).toBeCloseTo(hole.depth, 6)
  })

  it('모니터는 좌측 30% 후면 클램프의 모니터암을 따라 높이가 정해진다', () => {
    const arm = dIndex.get('arm')!
    const monitor = dIndex.get('monitor')!
    expect(arm.pos.x).toBe(Math.round(desk.w * 0.3))
    expect(arm.pos.z).toBeGreaterThan(desk.d * 0.9) // 후면
    expect(monitor.mount).toEqual({ on: 'arm' })
    // 암 윗면에 그대로 얹힌다
    expect(absoluteY('monitor', H, dIndex)).toBe(absoluteY('arm', H, dIndex) + arm.dims.h)
  })

  it('받침대가 상판 배선홈보다 앞에 있다', () => {
    const stand = dIndex.get('stand')!
    expect(stand.pos.z + stand.dims.d / 2).toBeLessThan(desk.d - desk.cableHole!.depth)
  })

  it('멀티탭이 트레이 안에 들어간다', () => {
    const strip = dIndex.get('strip')!
    const tray = desk.tray!
    expect(strip.dims.w).toBeLessThanOrEqual(tray.w)
    expect(strip.dims.h).toBeLessThanOrEqual(tray.h)
    expect(strip.pos.yOff).toBe(-(desk.thickness + tray.h))
  })

  it('경계를 넘는 케이블은 배선홈을 거쳐 트레이 높이로 내려간다', () => {
    const path = routeCable('pc', 'stand', H, dIndex, desk)
    const corridorY = corridorLevel(H, desk)
    const center = cableHoleCenter(desk)!
    expect(path.some((p) => Math.abs(p.y - corridorY) < 1)).toBe(true)
    expect(path.some((p) => p.x === center.x && Math.abs(p.z - center.z) < 1)).toBe(true)
  })

  it('모든 구간이 축을 따라 꺾인다', () => {
    for (const [a, b] of [
      ['pc', 'stand'],
      ['pc', 'monitor'],
      ['strip', 'wall'],
      ['itf', 'spkL'],
    ] as const) {
      expect(isAxisAligned(routeCable(a, b, H, dIndex, desk))).toBe(true)
    }
  })

  it('상판 위끼리는 트레이로 내려가지 않는다', () => {
    const path = routeCable('itf', 'spkL', H, dIndex, desk)
    const corridorY = corridorLevel(H, desk)
    expect(path.every((p) => p.y > corridorY)).toBe(true)
  })

  it('direct 옵션은 트레이를 우회한다 — 간헐 연결용', () => {
    const viaTray = routeLength(routeCable('guitar', 'itf', H, dIndex, desk))
    const direct = routeLength(routeCable('guitar', 'itf', H, dIndex, desk, { direct: true }))
    expect(direct).toBeLessThan(viaTray)
  })

  it('경로 길이는 직선 거리보다 길다 — 실제로 돌아가기 때문', () => {
    const path = routeCable('pc', 'stand', H, dIndex, desk)
    const a = path[0]!
    const b = path.at(-1)!
    const straight = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)
    expect(routeLength(path)).toBeGreaterThan(straight)
  })

  it('상판을 올리면 경계 케이블 경로가 길어진다', () => {
    const low = routeLength(routeCable('pc', 'stand', desk.hMin, dIndex, desk))
    const high = routeLength(routeCable('pc', 'stand', desk.hMax, dIndex, desk))
    expect(high).toBeGreaterThan(low)
  })
})
