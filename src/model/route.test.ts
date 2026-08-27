import { describe, expect, it } from 'vitest'
import { desk, devices, plannedDevices } from '../data/setup'
import { indexDevices } from './mount'
import { corridorLevel, routeCable, routeLength } from './route'

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

  it('멀티탭이 트레이 안에 들어간다', () => {
    const strip = dIndex.get('strip')!
    const tray = desk.tray!
    expect(strip.dims.w).toBeLessThanOrEqual(tray.w)
    expect(strip.dims.h).toBeLessThanOrEqual(tray.h)
    expect(strip.pos.yOff).toBe(-(desk.thickness + tray.h))
  })

  it('경계를 넘는 케이블은 배선홀을 거쳐 트레이 높이로 내려간다', () => {
    const path = routeCable('pc', 'stand', H, dIndex, desk)
    const corridorY = corridorLevel(H, desk)
    expect(path.some((p) => Math.abs(p.y - corridorY) < 1)).toBe(true)
    expect(path.some((p) => p.x === desk.cableHole!.x)).toBe(true)
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
