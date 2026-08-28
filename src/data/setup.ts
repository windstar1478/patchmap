import raw from '../../data.json'
import type { Cable, Device, SetupData } from './types'

const data = raw as unknown as SetupData

export const desk = data.desk
export const connectorTypes = data.connectorTypes
export const scenarios = data.scenarios
export const power = data.power
export const openQuestions = data.openQuestions
export const cables: Cable[] = data.cables

/** 보유 기기. */
export const devices: Device[] = data.devices

/** 추가 예정 기기. B4 기본값에 따라 기본 제외이며, 토글로 켠다. */
export const plannedDevices: Device[] = data.plannedDevices.map((d) => ({ ...d, planned: true }))

/**
 * connectorTypes 에 없는 타입(전원 등)의 폴백.
 * data.json 을 고치지 않고 UI에서만 메운다 — 데이터는 사용자의 조사 결과다.
 */
export const FALLBACK_CONNECTOR = { label: '전원', color: '#7a8288', dia: 7.5 }

export function connectorOf(type: string) {
  return connectorTypes[type] ?? FALLBACK_CONNECTOR
}

/** 기본 외경(mm). dia 가 없는 타입은 흔한 신호선 굵기로 본다. */
const DEFAULT_DIA = 5

/** 그 커넥터 케이블의 외경(mm). 화면에서 선 굵기를 구분하는 데만 쓴다. */
export function cableDiameterOf(type: string): number {
  return connectorOf(type).dia ?? DEFAULT_DIA
}

export function allDevices(includePlanned: boolean): Device[] {
  return includePlanned ? [...devices, ...plannedDevices] : devices
}

/** 시나리오가 지정한 케이블만. activeCables 가 없으면 전체 배선. */
export function cablesForScenario(scenarioId: string): Cable[] {
  const s = scenarios.find((x) => x.id === scenarioId)
  if (!s?.activeCables) return cables
  const set = new Set(s.activeCables)
  return cables.filter((c) => set.has(c.id))
}

export default data
