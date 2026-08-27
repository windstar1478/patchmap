import { scenarios } from '../data/setup'

export function ScenarioPanel({
  scenarioId,
  onSelect,
}: {
  scenarioId: string
  onSelect: (id: string) => void
}) {
  const current = scenarios.find((s) => s.id === scenarioId)
  return (
    <div className="panel">
      <h2>시나리오</h2>
      <div className="chips">
        {scenarios.map((s) => (
          <button
            key={s.id}
            className={`chip${s.id === scenarioId ? ' is-on' : ''}`}
            onClick={() => onSelect(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
      {current?.notes && (
        <ul className="notes-list">
          {current.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
