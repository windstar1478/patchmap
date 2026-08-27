import { useMemo } from 'react'
import { usePatchmap } from './store'
import { cablesForScenario, desk } from './data/setup'
import type { View } from './model/geometry'
import { SceneView } from './views/SceneView'
import { CableTable } from './panels/CableTable'
import { LoadPanel } from './panels/LoadPanel'
import { HeightPanel } from './panels/HeightPanel'
import { ScenarioPanel } from './panels/ScenarioPanel'
import { DevicePanel } from './panels/DevicePanel'
import { QuestionPanel } from './panels/QuestionPanel'

const VIEWS: { id: View; label: string }[] = [
  { id: 'front', label: '정면도' },
  { id: 'top', label: '평면도' },
  { id: 'side', label: '측면도' },
]

export default function App() {
  const { state, dispatch, devices, cables } = usePatchmap()

  const activeCableIds = useMemo(
    () => new Set(cablesForScenario(state.scenarioId).map((c) => c.id)),
    [state.scenarioId],
  )
  const selected = devices.find((d) => d.id === state.selectedDeviceId)

  return (
    <div className="app">
      <header>
        <h1>patchmap</h1>
        <div className="views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`chip${state.view === v.id ? ' is-on' : ''}`}
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
          <SceneView
            view={state.view}
            desk={desk}
            deskHeight={state.deskHeight}
            devices={devices}
            cables={cables}
            activeCableIds={activeCableIds}
            selectedDeviceId={state.selectedDeviceId}
            onSelect={(id) => dispatch({ type: 'selectDevice', id })}
            onMove={(id, pos) => dispatch({ type: 'moveDevice', id, pos })}
          />
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
          deskHeight={state.deskHeight}
          slack={state.slack}
          activeCableIds={activeCableIds}
          onLength={(id, mm) => dispatch({ type: 'setLength', id, mm })}
        />
      </section>
    </div>
  )
}
