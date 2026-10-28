// 장소별 좌표가 없어서 지역 중심 좌표 주변에 흩어 표시 (정확한 위치 아님)
const CENTER = {
    "동쪽(성산)": [33.4581, 126.9425],
    "동쪽(구좌)": [33.54, 126.83],
    "제주시":     [33.51, 126.5219],
    "서쪽(한림)": [33.4114, 126.2655],
    "서쪽(안덕)": [33.26, 126.36],
    "서귀포":     [33.253, 126.56],
}
const MAX = 8
let SPOTS = []

const map = L.map("map").setView([33.38, 126.55], 10)
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map)
const layer = L.layerGroup().addTo(map)

// find_spots (api/tool.js) 와 같은 규칙: 지역 + 실내 여부, 최대 8곳
const findSpots = (area, indoor) => SPOTS
    .filter(s => (s.area === area || s.area.startsWith(area + "(")) &&
                 (indoor === null || s.indoor === indoor))
    .slice(0, MAX)

// 데이터 값은 textContent 로만 넣어 HTML 로 해석되지 않게 함
const popup = s => {
    const box = document.createElement("div")
    const b = document.createElement("b")
    b.textContent = s.name
    box.append(b, document.createElement("br"),
        `${s.area} · ${s.indoor ? "실내" : "야외"}`, document.createElement("br"), s.type)
    return box
}

const show = () => {
    const area = document.getElementById("area").value
    const v = document.getElementById("indoor").value
    const found = findSpots(area, v === "" ? null : v === "true")
    layer.clearLayers()
    const pts = []
    found.forEach((s, i) => {
        const c = CENTER[s.area]
        const ang = i * 2.4, r = 0.012 * Math.sqrt(i + 1)
        const p = [c[0] + r * Math.sin(ang), c[1] + r * Math.cos(ang)]
        pts.push(p)
        L.marker(p).addTo(layer)
            .bindPopup(popup(s))
    })
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 })
    document.getElementById("msg").textContent =
        found.length + "곳 (위치는 지역 중심 근처에 흩어 표시한 것입니다)"
}

document.getElementById("go").onclick = show
fetch("jeju_spots.json").then(r => r.json()).then(d => { SPOTS = d.spots; show() })
    .catch(() => document.getElementById("msg").textContent =
        "jeju_spots.json을 불러오지 못했어요. 파일을 더블클릭하지 말고 웹 서버로 열어 주세요.")
