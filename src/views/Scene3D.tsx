import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Cable, Desk, Device, DeviceId } from '../data/types'
import { absoluteCenter, indexDevices, lineageOf } from '../model/mount'
import { indexPorts, ownerOf } from '../model/derive'
import { connectorOf } from '../data/setup'

interface Props {
  desk: Desk
  deskHeight: number
  devices: Device[]
  cables: Cable[]
  activeCableIds: Set<string>
  selectedDeviceId: DeviceId | null
  onSelect: (id: DeviceId | null) => void
  onHover: (id: DeviceId | null) => void
}

/**
 * 3D 뷰. model/ 이 React 에 의존하지 않게 만들어 둔 덕분에
 * 좌표 계산은 2D 뷰와 완전히 같은 함수를 그대로 쓴다.
 * 씬 좌표는 mm 를 그대로 쓰고, 카메라 거리로 스케일을 맞춘다.
 */
export function Scene3D({
  desk,
  deskHeight,
  devices,
  cables,
  activeCableIds,
  selectedDeviceId,
  onSelect,
  onHover,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    controls: OrbitControls
    content: THREE.Group
    raycaster: THREE.Raycaster
    dispose: () => void
  } | null>(null)

  // 씬은 한 번만 만든다. 데이터 변경은 아래 effect 에서 content 만 갈아끼운다.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x10161a)
    scene.fog = new THREE.Fog(0x10161a, 3500, 9000)

    const camera = new THREE.PerspectiveCamera(38, 1, 10, 20000)
    camera.position.set(2300, 1500, 2600)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(desk.w / 2, 700, desk.d / 2)
    controls.maxPolarAngle = Math.PI / 2 - 0.02
    controls.minDistance = 600
    controls.maxDistance = 9000

    scene.add(new THREE.HemisphereLight(0xbcd4de, 0x1b262c, 1.5))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(1800, 3000, 2200)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    const s = 2600
    key.shadow.camera.left = -s
    key.shadow.camera.right = s
    key.shadow.camera.top = s
    key.shadow.camera.bottom = -s
    key.shadow.camera.far = 9000
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x8fd4e0, 0.35)
    fill.position.set(-1500, 900, -1200)
    scene.add(fill)

    // 바닥
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14000, 14000),
      new THREE.MeshStandardMaterial({ color: 0x151d22, roughness: 1 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.set(desk.w / 2, 0, desk.d / 2)
    floor.receiveShadow = true
    scene.add(floor)

    const grid = new THREE.GridHelper(12000, 48, 0x2b3a42, 0x1e2a30)
    grid.position.set(desk.w / 2, 1, desk.d / 2)
    scene.add(grid)

    const content = new THREE.Group()
    scene.add(content)

    const raycaster = new THREE.Raycaster()

    const resize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    let raf = 0
    const tick = () => {
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    const dispose = () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
    stateRef.current = { renderer, scene, camera, controls, content, raycaster, dispose }
    return dispose
  }, [desk.w, desk.d])

  // 클릭 선택
  useEffect(() => {
    const st = stateRef.current
    const host = hostRef.current
    if (!st || !host) return
    const onClick = (e: MouseEvent) => {
      const r = st.renderer.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      )
      st.raycaster.setFromCamera(ndc, st.camera)
      const hits = st.raycaster.intersectObjects(st.content.children, true)
      const hit = hits.find((h) => h.object.userData.deviceId)
      onSelect(hit ? (hit.object.userData.deviceId as DeviceId) : null)
    }
    // 호버: 클릭 가능하다는 걸 보여주고, 이름표 없이도 무엇인지 짚어준다.
    let hovered: THREE.Mesh | null = null
    const onMove = (e: MouseEvent) => {
      const r = st.renderer.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      )
      st.raycaster.setFromCamera(ndc, st.camera)
      const hit = st.raycaster
        .intersectObjects(st.content.children, true)
        .find((h) => h.object.userData.deviceId)
      const mesh = (hit?.object as THREE.Mesh) ?? null
      if (mesh === hovered) return
      if (hovered) setEmissive(hovered, 0x000000)
      hovered = mesh
      if (hovered) setEmissive(hovered, 0x1d4d57)
      st.renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab'
      onHover(hovered ? (hovered.userData.deviceId as DeviceId) : null)
    }

    const el = st.renderer.domElement
    el.style.cursor = 'grab'
    el.addEventListener('click', onClick)
    el.addEventListener('pointermove', onMove)
    return () => {
      el.removeEventListener('click', onClick)
      el.removeEventListener('pointermove', onMove)
    }
  }, [onSelect, onHover])

  // 데이터가 바뀌면 content 를 다시 그린다. 객체 수십 개라 전체 재생성으로 충분하다.
  useEffect(() => {
    const st = stateRef.current
    if (!st) return
    const { content } = st
    clear(content)

    const index = indexDevices(devices)
    const ports = indexPorts(devices)

    // 상판
    const topMat = new THREE.MeshStandardMaterial({ color: 0x3b4f5a, roughness: 0.75 })
    const top = new THREE.Mesh(new THREE.BoxGeometry(desk.w, desk.thickness, desk.d), topMat)
    top.position.set(desk.w / 2, deskHeight - desk.thickness / 2, desk.d / 2)
    top.castShadow = true
    top.receiveShadow = true
    content.add(top)

    // 다리
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a3840, roughness: 0.9 })
    const legH = deskHeight - desk.thickness
    for (const lx of [desk.legInset + desk.legW / 2, desk.w - desk.legInset - desk.legW / 2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(desk.legW, legH, desk.legW), legMat)
      leg.position.set(lx, legH / 2, desk.d / 2)
      leg.castShadow = true
      content.add(leg)
    }

    // 기기
    for (const d of devices) {
      const c = absoluteCenter(d.id, deskHeight, index)
      const onDesk = lineageOf(d.id, index) === 'desk'
      const selected = selectedDeviceId === d.id
      const mat = new THREE.MeshStandardMaterial({
        color: selected ? 0x3fc4d4 : onDesk ? 0x4d6b7a : 0x35505c,
        roughness: 0.55,
        metalness: 0.12,
        transparent: d.verified === false,
        opacity: d.verified === false ? 0.72 : 1,
      })
      const box = new THREE.Mesh(new THREE.BoxGeometry(d.dims.w, d.dims.h, d.dims.d), mat)
      box.position.set(c.x, c.y, c.z)
      box.castShadow = true
      box.receiveShadow = true
      box.userData.deviceId = d.id
      content.add(box)

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(box.geometry),
        new THREE.LineBasicMaterial({ color: selected ? 0x9beaf3 : 0x7d99a6 }),
      )
      edges.position.copy(box.position)
      content.add(edges)

      // 이름표를 전부 띄우면 화면이 뒤덮인다. 선택한 것만 보여준다.
      if (selected) content.add(makeLabel(d.name, c, d.dims.h))
    }

    // 케이블 — 기기 중심을 잇는 맨해튼 경로를 그대로 3D 로 그린다.
    for (const cab of cables) {
      const a = ownerOf(cab.from, ports, index)
      const b = ownerOf(cab.to, ports, index)
      if (!a || !b) continue
      const pa = absoluteCenter(a, deskHeight, index)
      const pb = absoluteCenter(b, deskHeight, index)
      const active = activeCableIds.has(cab.id)
      const pts = [
        new THREE.Vector3(pa.x, pa.y, pa.z),
        new THREE.Vector3(pb.x, pa.y, pa.z),
        new THREE.Vector3(pb.x, pa.y, pb.z),
        new THREE.Vector3(pb.x, pb.y, pb.z),
      ]
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4)
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 48, active ? 9 : 5, 6, false),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(connectorOf(cab.type).color),
          roughness: 0.6,
          transparent: !active,
          opacity: active ? 1 : 0.22,
        }),
      )
      tube.castShadow = active
      content.add(tube)
    }
  }, [desk, deskHeight, devices, cables, activeCableIds, selectedDeviceId])

  return <div ref={hostRef} className="scene3d" />
}

function setEmissive(mesh: THREE.Mesh, color: number) {
  const mat = mesh.material as THREE.MeshStandardMaterial
  if (mat?.emissive) mat.emissive.setHex(color)
}

function clear(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child)
    child.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
  }
}

/** 기기 위에 뜨는 이름표. 카메라를 향하도록 sprite 로 만든다. */
function makeLabel(
  name: string,
  c: { x: number; y: number; z: number },
  height: number,
): THREE.Sprite {
  const text = name.replace(/\s*\(.*$/, '')
  const pad = 16
  const font = 44
  const cv = document.createElement('canvas')
  const ctx = cv.getContext('2d')!
  ctx.font = `500 ${font}px -apple-system, "Apple SD Gothic Neo", sans-serif`
  const w = ctx.measureText(text).width
  cv.width = Math.ceil(w + pad * 2)
  cv.height = font + pad * 2
  const c2 = cv.getContext('2d')!
  c2.fillStyle = 'rgba(63,196,212,0.94)'
  c2.fillRect(0, 0, cv.width, cv.height)
  c2.font = `500 ${font}px -apple-system, "Apple SD Gothic Neo", sans-serif`
  c2.fillStyle = '#07181c'
  c2.textBaseline = 'middle'
  c2.fillText(text, pad, cv.height / 2)

  const tex = new THREE.CanvasTexture(cv)
  tex.minFilter = THREE.LinearFilter
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  )
  const scale = 0.62
  sprite.scale.set(cv.width * scale, cv.height * scale, 1)
  sprite.position.set(c.x, c.y + height / 2 + 70, c.z)
  sprite.renderOrder = 999
  return sprite
}
