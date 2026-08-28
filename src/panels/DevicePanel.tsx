import type { Device, DeviceId } from '../data/types'
import { connectorOf } from '../data/setup'

export function DevicePanel({
  device,
  pendingPortId,
  onPort,
}: {
  device: Device | undefined
  pendingPortId: string | null
  onPort: (id: DeviceId) => void
}) {
  if (!device) {
    return (
      <div className="panel">
        <h2>기기</h2>
        <p className="hint">기기를 클릭하면 치수·포트·미확인 항목이 여기 표시된다. 드래그로 배치를 옮긴다.</p>
      </div>
    )
  }
  return (
    <div className="panel">
      <h2>
        {device.name}
        {device.verified === false && <span className="tag">추정</span>}
        {device.planned && <span className="tag tag-plan">예정</span>}
      </h2>
      <dl className="specs">
        <div>
          <dt>치수 (W×D×H)</dt>
          <dd>
            {device.dims.w} × {device.dims.d} × {device.dims.h} mm
          </dd>
        </div>
        <div>
          <dt>무게</dt>
          <dd>{device.weightKg} kg</dd>
        </div>
        <div>
          <dt>mount</dt>
          <dd>{typeof device.mount === 'string' ? device.mount : `on: ${device.mount.on}`}</dd>
        </div>
        <div>
          <dt>위치 (x / z / yOff)</dt>
          <dd>
            {device.pos.x} / {device.pos.z} / {device.pos.yOff}
          </dd>
        </div>
      </dl>
      {device.notes && <p className="device-note">{device.notes}</p>}
      {device.ports && device.ports.length > 0 && (
        <>
          <h3>포트</h3>
          <div className="ports">
            {device.ports.map((p) => (
              <button
                key={p.id}
                className={`port${pendingPortId === p.id ? ' is-pending' : ''}`}
                style={{ borderColor: connectorOf(p.type).color }}
                onClick={() => onPort(p.id)}
                title={`${p.id} · ${p.dir}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="hint">포트를 클릭한 뒤 다른 포트를 클릭하면 연결된다.</p>
        </>
      )}
    </div>
  )
}
