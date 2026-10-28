// 공개 API(키 불필요): https://wheretheiss.at  — 약 1초에 1번까지 호출 가능
const API = "https://api.wheretheiss.at/v1/satellites/25544"
const $ = id => document.getElementById(id)

const map = L.map("map", { worldCopyJump: true, minZoom: 2 }).setView([20, 0], 3)
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors | ISS: wheretheiss.at"
}).addTo(map)

const icon = L.divIcon({ className: "", html: '<div class="iss">🛰️</div>', iconSize: [34, 34], iconAnchor: [17, 17] })
const marker = L.marker([0, 0], { icon }).addTo(map)
const footprint = L.circle([0, 0], { radius: 1, color: "#7aa2ff", weight: 1, fillOpacity: 0.12 }).addTo(map)
const trail = L.layerGroup().addTo(map)

let points = []   // [lat, lon] 지나온 경로

// 날짜변경선을 넘을 때 선이 지도를 가로지르지 않도록 끊어서 그림
const drawTrail = () => {
    trail.clearLayers()
    let seg = []
    points.forEach(p => {
        if (seg.length && Math.abs(p[1] - seg[seg.length - 1][1]) > 180) {
            L.polyline(seg, { color: "#ffd166", weight: 2 }).addTo(trail)
            seg = []
        }
        seg.push(p)
    })
    if (seg.length) L.polyline(seg, { color: "#ffd166", weight: 2 }).addTo(trail)
}

// 처음 한 번: 최근 45분 경로를 5분 간격으로 가져와 꼬리를 미리 그림
const loadPast = async () => {
    const now = Math.floor(Date.now() / 1000)
    const ts = Array.from({ length: 10 }, (_, i) => now - (9 - i) * 300).join(",")
    const r = await fetch(`${API}/positions?timestamps=${ts}`)
    const list = await r.json()
    points = list.map(p => [p.latitude, p.longitude])
    drawTrail()
}

let lastCode = ""
const update = async () => {
    try {
        const d = await (await fetch(API)).json()
        const p = [d.latitude, d.longitude]
        marker.setLatLng(p)
        footprint.setLatLng(p).setRadius(d.footprint * 500)   // footprint 는 지름(km)
        points.push(p)
        if (points.length > 400) points.shift()
        drawTrail()
        if ($("follow").checked) map.panTo(p, { animate: true })
        $("lat").textContent = d.latitude.toFixed(3) + "°"
        $("lon").textContent = d.longitude.toFixed(3) + "°"
        $("alt").textContent = d.altitude.toFixed(1) + " km"
        $("vel").textContent = Math.round(d.velocity).toLocaleString() + " km/h"
        $("status").textContent = "마지막 갱신 " + new Date().toLocaleTimeString()
        const c = await (await fetch(`https://api.wheretheiss.at/v1/coordinates/${d.latitude},${d.longitude}`)).json()
        lastCode = c.country_code && c.country_code !== "??" ? c.country_code : "바다 위"
        $("under").textContent = lastCode
    } catch (e) {
        $("status").textContent = "불러오지 못했어요. 잠시 후 다시 시도합니다."
    }
}

loadPast().catch(() => {}).finally(() => { update(); setInterval(update, 5000) })
