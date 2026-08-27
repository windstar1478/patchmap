import type { Desk, Device, DeviceId, Vec3 } from '../data/types'
import type { DeviceIndex } from './mount'
import { routeCable, routeLength, type RouteOptions } from './route'

export type View = 'front' | 'top' | 'side'

/**
 * 3뷰를 렌더러 하나로 처리하기 위한 투영.
 *
 *  뷰    | 화면 U   | 화면 V   | 드래그로 바뀌는 값
 *  front | x        | y(높이)  | x, yOff
 *  top   | x        | z        | x, z
 *  side  | z        | y(높이)  | z, yOff
 *
 * 화면 V 는 "위로 갈수록 크다"가 아니라 모델 값 그대로다.
 * 화면 좌표 뒤집기는 렌더러가 viewBox 로 처리한다.
 */
export function project(p: { x: number; y: number; z: number }, view: View): { u: number; v: number } {
  switch (view) {
    case 'front':
      return { u: p.x, v: p.y }
    case 'top':
      return { u: p.x, v: p.z }
    case 'side':
      return { u: p.z, v: p.y }
  }
}

/** 드래그 결과를 모델 좌표로 되돌린다. 해당 뷰가 건드리지 않는 축은 prev 를 유지한다. */
export function unproject(u: number, v: number, view: View, prev: Vec3): Vec3 {
  switch (view) {
    case 'front':
      return { ...prev, x: u, yOff: v }
    case 'top':
      return { ...prev, x: u, z: v }
    case 'side':
      return { ...prev, z: u, yOff: v }
  }
}

/** 뷰의 U/V 축이 각각 기기 치수의 어느 변에 대응하는가. */
export function extentFor(dims: Device['dims'], view: View): { w: number; h: number } {
  switch (view) {
    case 'front':
      return { w: dims.w, h: dims.h }
    case 'top':
      return { w: dims.w, h: dims.d }
    case 'side':
      return { w: dims.d, h: dims.h }
  }
}

/**
 * 케이블 여유(slack) 규칙.
 *
 * 질문 5 답변("보수적으로 최소쯤"): 비례 10%, 고정 여유 없음.
 * 0으로 두면 c-usb-st 가 +1mm 로 "충분" 판정을 받아 버려 신호가 죽는다.
 * 10% 는 최소에 가까우면서 그 경계선을 놓치지 않는 지점이다.
 */
export interface SlackRule {
  /** 경로 길이에 곱하는 여유 비율. 0.15 = 15% */
  ratio: number
  /** 경로 길이에 더하는 고정 여유(mm). 커넥터 굽힘 반경 등. */
  fixedMm: number
}

export const DEFAULT_SLACK: SlackRule = { ratio: 0.1, fixedMm: 0 }

/** 시중에서 실제로 파는 케이블 길이(mm). 권장 교체 길이는 여기서 고른다. */
export const STANDARD_LENGTHS = [300, 500, 1000, 1500, 2000, 3000, 5000, 10000] as const

/** 필요 길이를 만족하는 가장 짧은 규격 길이. 없으면 undefined. */
export function recommendedLength(requiredMm: number): number | undefined {
  return STANDARD_LENGTHS.find((l) => l >= requiredMm)
}

export function applySlack(pathMm: number, slack: SlackRule): number {
  return pathMm * (1 + slack.ratio) + slack.fixedMm
}

/**
 * 두 기기 사이의 경로 길이.
 *
 * 질문 4 답: 실제 경로는 상판 배선홀 → 배선트레이를 탄다.
 * routeCable() 이 그 꺾인 경로를 만들고, 여기서는 그 길이를 잰다.
 * 2D·3D 렌더러도 같은 경로를 그리므로 화면과 숫자가 어긋나지 않는다.
 */
export function pathLength(
  a: DeviceId,
  b: DeviceId,
  deskHeight: number,
  index: DeviceIndex,
  desk: Desk,
  opts: RouteOptions = {},
): number {
  return routeLength(routeCable(a, b, deskHeight, index, desk, opts))
}
