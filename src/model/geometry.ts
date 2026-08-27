import type { Device, DeviceId, Vec3 } from '../data/types'
import { absoluteCenter, type DeviceIndex } from './mount'

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
 * B2 미결정 상태의 기본값: 비례 15% + 고정 50mm.
 * 두 값 모두 UI에서 조절 가능하게 두어, 결정이 오면 상수만 바꾸면 되게 한다.
 */
export interface SlackRule {
  /** 경로 길이에 곱하는 여유 비율. 0.15 = 15% */
  ratio: number
  /** 경로 길이에 더하는 고정 여유(mm). 커넥터 굽힘 반경 등. */
  fixedMm: number
}

export const DEFAULT_SLACK: SlackRule = { ratio: 0.15, fixedMm: 50 }

export function applySlack(pathMm: number, slack: SlackRule): number {
  return pathMm * (1 + slack.ratio) + slack.fixedMm
}

/**
 * 두 기기 사이의 경로 길이.
 *
 * B1 미결정 상태의 기본값: 맨해튼 거리(축별 이동의 합).
 * waypoint(트레이·다리 경유)로 바뀌면 이 함수만 교체하면 되도록 격리해 둔다.
 */
export function pathLength(
  a: DeviceId,
  b: DeviceId,
  deskHeight: number,
  index: DeviceIndex,
  waypoints: readonly { x: number; y: number; z: number }[] = [],
): number {
  const pa = absoluteCenter(a, deskHeight, index)
  const pb = absoluteCenter(b, deskHeight, index)
  const chain = [pa, ...waypoints, pb]
  let total = 0
  for (let i = 1; i < chain.length; i++) {
    total += manhattan(chain[i - 1]!, chain[i]!)
  }
  return total
}

function manhattan(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)
}
