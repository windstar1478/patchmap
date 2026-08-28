# patchmap — 데스크 셋업 배선/배치 플래너

## 이 프로젝트가 푸는 문제

기기가 늘어나면서 두 종류의 문제가 동시에 생겼다.

1. **신호 경로 문제** — 어떤 포트에서 어떤 포트로 연결해야 원하는 소리가 원하는 데서 나는가. 포트가 겹치거나 타입이 안 맞으면 어떤 변환/추가 장비가 필요한가.
2. **물리 배치 문제** — 모션데스크가 630~1280mm를 오르내린다. 상판과 함께 움직이는 기기와 바닥에 고정된 기기 사이의 케이블이 늘어나서, 가장 짧은 케이블 하나가 책상 전체의 상승 한계를 결정한다.

기존에는 이 둘을 별도 프로토타입 두 개로 만들었다(`prototypes/` 참고). 이번 프로젝트는 **하나의 앱으로 합치고, 뷰를 여러 개로 늘리고, 드래그로 배치를 조정**할 수 있게 만드는 것이다.

## 핵심 설계 결정

### 1) mount를 관계로 표현한다

기기의 높이를 절대값으로 저장하면 안 된다. 받침대 위에 NS2 독이 있고, 받침대 아래에 오디오 인터페이스가 있고, 받침대는 상판 위에 있고, 상판은 630~1280 사이를 움직인다. 이걸 절대 좌표로 관리하면 높이가 바뀔 때마다 전부 다시 계산해야 한다.

```ts
type Mount =
  | 'floor'           // 바닥 고정
  | 'fixed'           // 벽 등 완전 고정
  | 'desktop'         // 상판 윗면
  | 'under-desktop'   // 상판 아랫면
  | { on: DeviceId }  // 다른 기기 위

// 높이는 재귀로 해석
function absoluteY(device, deskHeight): number
```

이렇게 두면 상판 높이 슬라이더 하나만 바꿔도 전부 따라 움직인다.

### 2) 뷰는 투영 함수 하나로 통일한다

3개 뷰가 필요하다. 뷰마다 렌더러를 따로 만들면 기기를 추가할 때마다 세 군데를 고쳐야 한다.

| 뷰 | 화면 X | 화면 Y | 드래그로 바뀌는 값 |
|---|---|---|---|
| 정면도 (front) | x (좌우) | y (높이) | x, yOff |
| 평면도 (top)   | x (좌우) | z (앞뒤) | x, z |
| 측면도 (side)  | z (앞뒤) | y (높이) | z, yOff |

```ts
type View = 'front' | 'top' | 'side'
function project(pos: Vec3, view: View): { u: number; v: number }
function unproject(u: number, v: number, view: View, prev: Vec3): Vec3
```

렌더러는 하나만 만들고 `view` prop만 다르게 준다.

### 3) 파생값은 저장하지 않고 계산한다

전부 상태에서 유도되는 값이다. 캐시하지 말고 그때그때 계산할 것 (객체 수십 개 규모라 성능 문제 없음).

- `crossesBoundary(cable)` — 양끝의 mount 계열이 다른가 (상판계 vs 바닥계)
- `requiredLength(cable, deskHeight)` — 맨해튼 경로 + 여유값
- `maxDeskHeight()` — 모든 경계 케이블 중 가장 먼저 한계에 닿는 것
- `totalLoad()` — 상판 위 무게 합계 vs 정격 100kg
- `underDeskClearance(deskHeight)` — 상판 하부에 매단 기기의 바닥까지 여유
- `portConflicts()` — 한 포트에 연결이 둘 이상 (스위처/믹서 필요 신호)
- `typeMismatch(cable)` — 양끝 커넥터 타입 불일치 (변환 필요)
- `channelConflicts()` — 2i2처럼 물리적으로 배타적인 포트쌍 (`conflictsWith` 필드)

## 기능 범위

### 필수
- [ ] 3뷰 전환 (정면/평면/측면), 상판 높이 슬라이더 630~1280
- [ ] 기기 드래그 배치 — 뷰별로 해당 축만 변경
- [ ] 포트 클릭 → 포트 클릭으로 케이블 연결/해제
- [ ] 케이블 표 — 보유 길이 입력, 필요 길이 자동 계산, 부족 판정
- [ ] 시나리오 5종 필터 (data.json의 `scenarios`) — 해당 경로만 강조, 나머지 흐리게
- [ ] 하중 합계 + 정격 대비 표시
- [ ] localStorage 저장/불러오기

### 나중에
- [ ] 케이블 경유점(waypoint) — 트레이·다리를 타는 실제 경로
- [ ] 기기 프리셋 라이브러리 + 검색
- [ ] JSON 내보내기/가져오기
- [ ] 3D 뷰 (Three.js) — 2D로 부족해지면
- [ ] 전력 합계 / 멀티탭 구수 계산

## 스택

Vite + React + TypeScript. 렌더링은 **SVG** (Canvas 아님 — 객체가 적고 드래그 히트 테스트가 훨씬 쉽다).
상태는 처음엔 `useReducer` 하나로 충분. 커지면 zustand.

```
src/
  data/          devices.ts, cables.ts, scenarios.ts  ← data.json에서 로드
  model/         mount.ts, geometry.ts, derive.ts,
                 route.ts(배선 경로·배선홈), cableDraw.ts(표시용 선 다듬기)
                                                      ← 순수 함수, 테스트 대상
  views/         SceneView.tsx (view prop 하나로 3뷰), Device.tsx, Cable.tsx
  panels/        CableTable.tsx, ScenarioPanel.tsx, LoadPanel.tsx, DeviceList.tsx
  store.ts
  App.tsx
```

`model/` 은 React에 의존하지 않게 유지할 것. 계산 로직 테스트가 쉬워지고, 나중에 3D 뷰를 붙여도 그대로 재사용된다.

## 데이터

`data.json` 에 전부 들어 있다. 기기 치수, 포트, 케이블, 시나리오, 전력, 미확인 항목.

**`verified` 필드를 반드시 UI에 노출할 것.** `false`인 값은 추정치라 실측하면 결과가 달라진다. 사용자가 어떤 숫자를 믿어도 되는지 구분할 수 있어야 한다.

`openQuestions` 배열은 아직 확인 못 한 항목이다. 답이 나오면 데이터를 고치고 해당 항목을 지우면 된다. 앱 안에 체크리스트로 띄워도 좋다.

## 배선 결론 (이미 확정된 것)

앱은 이 구성을 기본값으로 로드한다.

- 2i2 Monitor Out L/R → **MR4 TRS** L/R (6.35mm TRS 균형 2가닥) — PC/기타 소리
- NS2 3.5mm → **MR4 RCA** (3.5mm-2RCA 1가닥) — NS2 소리
- MR4가 TRS·RCA·AUX 세 입력을 **동시에** 받으므로 하드웨어 믹싱이 공짜로 된다. 입력 전환 조작이 없다.
- HD-600 → 2i2 헤드폰 아웃 (PC 전용) / MR4 전면 잭 (NS2 포함 믹스)
- 마이크 → 2i2 후면 **XLR 2번** (기타가 전면 잭 1번을 쓰므로 채널이 안 겹침)

**해결 안 되는 조합이 하나 있다**: 클라우드알파 무선으로 NS2 소리와 디스코드를 동시에 듣기. 헤드셋에 3.5mm도 블루투스도 없고 동글이 한 곳에만 꽂히므로 물리적으로 불가능하다. 스피커로 하면 그냥 되고, 헤드셋을 고집하면 캡처카드(오디오 지연)를 감수해야 한다. 앱에서 이 제약을 명시적으로 표시할 것.

## 참고: 이전 프로토타입

`prototypes/patchmap.html` — 포트/신호 모델, 시나리오 필터, 충돌 판정
`prototypes/deskrise.html` — 정면도, 높이 슬라이더, 케이블 길이 계산, 하중

둘 다 단일 파일 바닐라 JS. 로직은 참고하되 구조는 위 설계를 따를 것.
