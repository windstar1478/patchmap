import { describe, expect, it } from 'vitest'
import { desk, devices, plannedDevices, cables, connectorTypes, scenarios } from '../data/setup'
import { indexDevices, lineageOf, absoluteY, rootMount } from './mount'
import { DEFAULT_SLACK } from './geometry'
import {
  cableFit,
  channelConflicts,
  crossesBoundary,
  exclusivityViolations,
  indexPorts,
  maxDeskHeight,
  ownerOf,
  portConflicts,
  totalLoad,
  typeMismatch,
  shortagesAt,
  underDeskClearance,
} from './derive'

const all = [...devices, ...plannedDevices]
const dIndex = indexDevices(all)
const pIndex = indexPorts(all)

describe('데이터 정합성', () => {
  it('포트 ID가 중복되지 않는다', () => {
    const ids = all.flatMap((d) => (d.ports ?? []).map((p) => p.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('모든 케이블 양끝이 포트 또는 기기로 해석된다', () => {
    const unresolved = cables.flatMap((c) =>
      [c.from, c.to].filter((e) => ownerOf(e, pIndex, dIndex) === undefined),
    )
    expect(unresolved).toEqual([])
  })

  it('mount 사슬에 순환이 없다', () => {
    for (const d of all) expect(rootMount(d.id, dIndex)).not.toBeUndefined()
  })

  it('시나리오의 activeCables 가 전부 실재한다', () => {
    const ids = new Set(cables.map((c) => c.id))
    for (const s of scenarios) {
      for (const id of s.activeCables ?? []) expect(ids.has(id)).toBe(true)
    }
  })

  it('전원 타입은 connectorTypes 에 없다 — 폴백이 필요하다 (점검결과 B)', () => {
    const used = new Set(cables.map((c) => c.type))
    const missing = [...used].filter((t) => !(t in connectorTypes))
    expect(missing).toEqual(['power'])
  })
})

describe('mount 해석', () => {
  it('상판 위 기기는 상판 높이를 따라 움직인다', () => {
    expect(absoluteY('itf', 630, dIndex)).toBe(630)
    expect(absoluteY('itf', 1280, dIndex)).toBe(1280)
  })

  it('받침대 위의 독은 받침대 높이만큼 더 올라간다', () => {
    // dock 은 stand(h=90) 위, stand 는 상판 위.
    expect(absoluteY('dock', 630, dIndex)).toBe(630 + 90)
  })

  it('상판 하부 멀티탭은 상판 윗면 기준 음수 yOff 로 내려간다', () => {
    // yOff 는 기준면에서 기기 밑면까지의 오프셋 (deskrise.html 규약).
    const strip = dIndex.get('strip')!
    expect(strip.pos.yOff).toBeLessThan(0)
    expect(absoluteY('strip', 630, dIndex)).toBe(630 + strip.pos.yOff)
    // 상판 아랫면(605)보다 기기 윗면이 아래에 있어야 물리적으로 말이 된다.
    expect(absoluteY('strip', 630, dIndex) + strip.dims.h).toBeLessThan(630 - desk.thickness)
  })

  it('바닥 고정 기기는 상판 높이와 무관하다', () => {
    expect(absoluteY('pc', 630, dIndex)).toBe(absoluteY('pc', 1280, dIndex))
  })

  it('계열 판정 — 받침대 위 기기도 상판계다', () => {
    expect(lineageOf('dock', dIndex)).toBe('desk')
    expect(lineageOf('strip', dIndex)).toBe('desk')
    expect(lineageOf('pc', dIndex)).toBe('ground')
    expect(lineageOf('wall', dIndex)).toBe('ground')
  })
})

describe('경계 통과 판정', () => {
  it('PC(바닥) ↔ 멀티탭(상판 하부) 은 경계를 넘는다', () => {
    const c = cables.find((x) => x.id === 'c-pwr-pc')!
    expect(crossesBoundary(c, pIndex, dIndex)).toBe(true)
  })

  it('2i2 ↔ MR4 는 둘 다 상판이라 경계를 넘지 않는다', () => {
    const c = cables.find((x) => x.id === 'c-trsL')!
    expect(crossesBoundary(c, pIndex, dIndex)).toBe(false)
  })

  it('길이 0인 동글은 길이 판정 대상이 아니다 (점검결과 F)', () => {
    const c = cables.find((x) => x.id === 'c-dongle-pc')!
    expect(crossesBoundary(c, pIndex, dIndex)).toBe(true)
    expect(cableFit(c, 630, pIndex, dIndex).status).toBe('unknown')
  })
})

describe('상판 높이 한계 — 점검결과 A', () => {
  it('현재 추정 길이로는 최저 높이에서도 부족한 케이블이 있다', () => {
    const ceiling = maxDeskHeight(cables, pIndex, dIndex, desk, DEFAULT_SLACK)
    expect(ceiling.shortAtMin.length).toBeGreaterThan(0)
    expect(ceiling.maxHeight).toBe(desk.hMin)
  })

  it('부족한 케이블은 받침대·모니터로 가는 세 가닥이다', () => {
    const ceiling = maxDeskHeight(cables, pIndex, dIndex, desk, DEFAULT_SLACK)
    expect(ceiling.shortAtMin.map((l) => l.cableId).sort()).toEqual([
      'c-dp-mon',
      'c-usb-mon',
      'c-usb-st',
    ])
  })

  it('여유를 0으로 두면 상승은 가능해지지만 여전히 711mm 에서 막힌다 (B2 민감도)', () => {
    // 결론이 여유율 규칙에 크게 좌우된다는 근거. B2 결정이 필요한 이유다.
    const ceiling = maxDeskHeight(cables, pIndex, dIndex, desk, { ratio: 0, fixedMm: 0 })
    expect(ceiling.shortAtMin).toEqual([])
    expect(ceiling.maxHeight).toBe(711)
    expect(ceiling.limitedBy.map((l) => l.cableId)).toEqual(['c-usb-st'])
  })

  it('경계를 넘지 않는 케이블은 한계 계산에 끼어들지 않는다', () => {
    const ceiling = maxDeskHeight(cables, pIndex, dIndex, desk, DEFAULT_SLACK)
    const ids = ceiling.limitedBy.map((l) => l.cableId)
    expect(ids).not.toContain('c-trsL')
  })

  it('길이를 넉넉히 주면 최고 높이까지 올라간다', () => {
    const generous = cables.map((c) => (c.lengthMm ? { ...c, lengthMm: 5000 } : c))
    const ceiling = maxDeskHeight(generous, pIndex, dIndex, desk, DEFAULT_SLACK)
    expect(ceiling.maxHeight).toBe(desk.hMax)
    expect(ceiling.shortAtMin).toEqual([])
  })
})

describe('실사용 높이 710mm — 질문 6 답변 반영', () => {
  const H = 710

  it('기본 여유에서는 세 가닥이 모자란다', () => {
    const short = shortagesAt(cables, H, pIndex, dIndex, DEFAULT_SLACK)
    expect(short.map((f) => f.cable.id).sort()).toEqual(['c-dp-mon', 'c-usb-mon', 'c-usb-st'])
  })

  it('여유 10%로 낮추면 c-usb-st 만 남는다', () => {
    const short = shortagesAt(cables, H, pIndex, dIndex, { ratio: 0.1, fixedMm: 0 })
    expect(short.map((f) => f.cable.id)).toEqual(['c-usb-st'])
  })

  it('c-usb-st 는 여유 0에서 겨우 1mm 남는다 — 사실상 길이가 없다', () => {
    const fit = cableFit(
      cables.find((c) => c.id === 'c-usb-st')!,
      H,
      pIndex,
      dIndex,
      { ratio: 0, fixedMm: 0 },
    )
    expect(Math.round(fit.marginMm!)).toBe(1)
  })

  it('c-usb-st 를 2m 로 바꾸면 기본 여유에서도 전부 충분해진다', () => {
    const swapped = cables.map((c) => (c.id === 'c-usb-st' ? { ...c, lengthMm: 2000 } : c))
    // 모니터 두 가닥도 함께 걸리므로, 그것까지 2m 로 두면 완전히 해소된다.
    const all2m = swapped.map((c) =>
      ['c-dp-mon', 'c-usb-mon'].includes(c.id) ? { ...c, lengthMm: 2000 } : c,
    )
    expect(shortagesAt(all2m, H, pIndex, dIndex, DEFAULT_SLACK)).toEqual([])
  })

  it('평소 쓰는 높이는 최저 630 보다 위이므로, 630 기준 판정보다 빡빡하다', () => {
    const at630 = shortagesAt(cables, 630, pIndex, dIndex, { ratio: 0.1, fixedMm: 0 })
    const at710 = shortagesAt(cables, H, pIndex, dIndex, { ratio: 0.1, fixedMm: 0 })
    expect(at710.length).toBeGreaterThanOrEqual(at630.length)
  })
})

describe('하중', () => {
  it('상판계 무게만 합산한다 — PC(바닥)는 빠진다', () => {
    const load = totalLoad(devices, dIndex, desk)
    const ids = load.items.map((i) => i.device.id)
    expect(ids).not.toContain('pc')
    expect(ids).toContain('dock')
  })

  it('정격 100kg 대비 여유가 있다', () => {
    const load = totalLoad(devices, dIndex, desk)
    expect(load.totalKg).toBeLessThan(desk.loadCapKg)
    expect(load.status).toBe('ok')
  })

  it('추정 무게가 섞여 있음을 표시한다', () => {
    expect(totalLoad(devices, dIndex, desk).hasEstimates).toBe(true)
  })
})

describe('상판 하부 여유', () => {
  it('최저 높이에서도 멀티탭이 바닥에 닿지 않는다', () => {
    const [strip] = underDeskClearance(devices, desk.hMin, dIndex)
    expect(strip!.clearanceMm).toBeGreaterThan(0)
  })
})

describe('충돌 판정', () => {
  it('타입 불일치는 NS2 3.5mm → RCA 하나뿐이다 (점검결과 E)', () => {
    const found = cables.map((c) => typeMismatch(c, pIndex)).filter(Boolean)
    expect(found.map((f) => f!.cableId)).toEqual(['c-ns2-rca'])
  })

  it('헤드폰은 두 자리에 동시 등록돼 있다 — 대체 자리 표시가 필요하다', () => {
    const conflicts = portConflicts(cables, pIndex)
    expect(conflicts.map((c) => c.portId)).toContain('hd-plug')
  })

  it('2i2 전면 잭과 후면 XLR 은 채널이 겹치지 않게 배선돼 있다', () => {
    const active = cables.filter((c) => ['c-mic', 'c-gtr'].includes(c.id))
    expect(channelConflicts(active, pIndex)).toEqual([])
  })

  it('동글 두 케이블은 동시에 존재할 수 없다', () => {
    const both = cables.filter((c) => c.id.startsWith('c-dongle'))
    expect(exclusivityViolations(both)).toHaveLength(1)
  })
})
