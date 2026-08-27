import type { Desk, Device } from '../data/types'
import { indexDevices } from '../model/mount'
import { totalLoad, underDeskClearance } from '../model/derive'

export function LoadPanel({
  devices,
  desk,
  deskHeight,
}: {
  devices: Device[]
  desk: Desk
  deskHeight: number
}) {
  const index = indexDevices(devices)
  const load = totalLoad(devices, index, desk)
  const clearance = underDeskClearance(devices, deskHeight, index)

  return (
    <div className="panel">
      <h2>하중</h2>
      <div className={`big ${load.status}`}>
        {load.totalKg.toFixed(2)} <small>/ {load.capKg} kg</small>
      </div>
      <div className="meter">
        <span style={{ width: `${Math.min(100, load.ratio * 100)}%` }} className={load.status} />
      </div>
      <p className="hint">
        정격 {load.capKg}kg 기준. 분산 하중은 {load.distributedCapKg}kg.
        {load.hasEstimates && ' 추정 무게가 포함돼 있다.'}
      </p>
      <ul className="load-list">
        {load.items.slice(0, 6).map((i) => (
          <li key={i.device.id}>
            <span>{i.device.name.replace(/\s*\(.*$/, '')}</span>
            <b>
              {i.kg} kg{i.device.verified === false && <em> 추정</em>}
            </b>
          </li>
        ))}
      </ul>
      {clearance.length > 0 && (
        <>
          <h3>상판 하부 여유</h3>
          <ul className="load-list">
            {clearance.map((c) => (
              <li key={c.device.id}>
                <span>{c.device.name.replace(/\s*\(.*$/, '')}</span>
                <b className={c.clearanceMm < 0 ? 'bad' : 'good'}>{Math.round(c.clearanceMm)} mm</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
