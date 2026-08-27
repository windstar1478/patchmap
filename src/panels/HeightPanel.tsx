import type { Cable, Desk, Device } from '../data/types'
import { indexDevices } from '../model/mount'
import { indexPorts, maxDeskHeight } from '../model/derive'
import type { SlackRule } from '../model/geometry'

export function HeightPanel({
  cables,
  devices,
  desk,
  slack,
  onSlack,
}: {
  cables: Cable[]
  devices: Device[]
  desk: Desk
  slack: SlackRule
  onSlack: (s: Partial<SlackRule>) => void
}) {
  const index = indexDevices(devices)
  const ports = indexPorts(devices)
  const ceiling = maxDeskHeight(cables, ports, index, desk, slack)
  const blocked = ceiling.shortAtMin.length > 0
  const nameOf = (id: string) => cables.find((c) => c.id === id)?.name ?? id

  return (
    <div className="panel">
      <h2>상승 한계</h2>
      <div className={`big ${blocked ? 'over' : 'ok'}`}>
        {blocked ? '상승 불가' : `${ceiling.maxHeight} `}
        {!blocked && <small>mm</small>}
      </div>
      <p className="hint">
        {blocked ? (
          <>
            최저 {desk.hMin}mm 에서도 길이가 모자란 케이블이 있다:{' '}
            <b>{ceiling.shortAtMin.map((l) => nameOf(l.cableId)).join(', ')}</b>
          </>
        ) : (
          <>
            한계를 만드는 케이블: <b>{ceiling.limitedBy.map((l) => nameOf(l.cableId)).join(', ')}</b>
          </>
        )}
      </p>

      <h3>여유 규칙 <span className="undecided">B2 미결정</span></h3>
      <label className="slider-row">
        <span>비례 여유</span>
        <input
          type="range"
          min={0}
          max={40}
          value={Math.round(slack.ratio * 100)}
          onChange={(e) => onSlack({ ratio: Number(e.target.value) / 100 })}
        />
        <b>{Math.round(slack.ratio * 100)}%</b>
      </label>
      <label className="slider-row">
        <span>고정 여유</span>
        <input
          type="range"
          min={0}
          max={300}
          step={10}
          value={slack.fixedMm}
          onChange={(e) => onSlack({ fixedMm: Number(e.target.value) })}
        />
        <b>{slack.fixedMm}mm</b>
      </label>
      <p className="hint">
        결론이 이 두 값에 크게 좌우된다. 여유 0에서도 <code>c-usb-st</code> 때문에 711mm 에서 막힌다.
      </p>
    </div>
  )
}
