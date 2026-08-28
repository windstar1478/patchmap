import { useMemo, useState } from 'react'
import { usePatchmap } from './store'
import { cablesForScenario, desk } from './data/setup'
import type { View } from './model/geometry'
import { SceneView } from './views/SceneView'
import { Scene3D } from './views/Scene3D'
import { CableTable } from './panels/CableTable'
import { LoadPanel } from './panels/LoadPanel'
import { HeightPanel } from './panels/HeightPanel'
import { ScenarioPanel } from './panels/ScenarioPanel'
import { DevicePanel } from './panels/DevicePanel'
import { QuestionPanel } from './panels/QuestionPanel'

/** '3d' 는 투영 함수를 쓰지 않으므로 View 와 별도로 둔다. */
type ViewMode = View | '3d'

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: '3d', label: '3D' },
  { id: 'front', label: '정면도' },
  { id: 'top', label: '평면도' },
  { id: 'side', label: '측면도' },
]

export default function App() {
  const { state, dispatch, devices, cables } = usePatchmap()
  // 호버는 저장할 필요 없는 순간 상태라 리듀서에 넣지 않는다.
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const activeCableIds = useMemo(
    () => new Set(cablesForScenario(state.scenarioId).map((c) => c.id)),
    [state.scenarioId],
  )
  const selected = devices.find((d) => d.id === state.selectedDeviceId)
  const hovered = devices.find((d) => d.id === hoveredId)

  return (
    <div className="app">
      <header>
        <h1>patchmap</h1>
        <div className="views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`chip${state.viewMode === v.id ? ' is-on' : ''}`}
              onClick={() => dispatch({ type: 'setView', view: v.id })}
            >
              {v.label}
            </button>
          ))}
        </div>
        <label className="height">
          <span>상판 높이</span>
          <input
            type="range"
            min={desk.hMin}
            max={desk.hMax}
            value={state.deskHeight}
            onChange={(e) => dispatch({ type: 'setDeskHeight', mm: Number(e.target.value) })}
          />
          <b>{state.deskHeight} mm</b>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={state.includePlanned}
            onChange={() => dispatch({ type: 'togglePlanned' })}
          />
          <span>추가 예정 기기 포함</span>
        </label>
        <button className="chip" onClick={() => dispatch({ type: 'reset' })}>
          초기화
        </button>
      </header>

      <main>
        <section className="stage">
          {state.viewMode === '3d' ? (
            <Scene3D
              desk={desk}
              deskHeight={state.deskHeight}
              devices={devices}
              cables={cables}
              activeCableIds={activeCableIds}
              selectedDeviceId={state.selectedDeviceId}
              onSelect={(id) => dispatch({ type: 'selectDevice', id })}
              onHover={setHoveredId}
            />
          ) : (
            <SceneView
              view={state.viewMode}
              desk={desk}
              deskHeight={state.deskHeight}
              devices={devices}
              cables={cables}
              activeCableIds={activeCableIds}
              selectedDeviceId={state.selectedDeviceId}
              onSelect={(id) => dispatch({ type: 'selectDevice', id })}
              onMove={(id, pos) => dispatch({ type: 'moveDevice', id, pos })}
            />
          )}
          <p className="stage-hint">
            {hovered ? (
              <b className="hovered">{hovered.name}</b>
            ) : state.viewMode === '3d' ? (
              '드래그로 회전 · 휠로 확대 · 기기 클릭으로 선택'
            ) : (
              '기기를 드래그해 배치를 옮긴다 · 이 뷰가 다루는 축만 바뀐다'
            )}
          </p>
        </section>

        <aside>
          <HeightPanel
            cables={cables}
            devices={devices}
            desk={desk}
            slack={state.slack}
            workingHeight={state.workingHeight}
            onSlack={(slack) => dispatch({ type: 'setSlack', slack })}
            onWorkingHeight={(mm) => dispatch({ type: 'setWorkingHeight', mm })}
          />
          <LoadPanel devices={devices} desk={desk} deskHeight={state.deskHeight} />
          <ScenarioPanel
            scenarioId={state.scenarioId}
            onSelect={(id) => dispatch({ type: 'setScenario', id })}
          />
          <DevicePanel
            device={selected}
            pendingPortId={state.pendingPortId}
            onPort={(id) => dispatch({ type: 'clickPort', id })}
          />
          <QuestionPanel />
        </aside>
      </main>

      <section className="bottom">
        <CableTable
          cables={cables}
          devices={devices}
          desk={desk}
          deskHeight={state.deskHeight}
          slack={state.slack}
          activeCableIds={activeCableIds}
          onLength={(id, mm) => dispatch({ type: 'setLength', id, mm })}
        />
      </section>
    </div>
  )
}
