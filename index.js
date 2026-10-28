const $ = id => document.getElementById(id)

// 사용자 입력·서버 응답은 textContent 로만 넣어 HTML 로 해석되지 않게 함
const addStep = text => {
    const li = document.createElement("li")
    li.textContent = text
    $("steps").append(li)
}

const describe = s => {
    const a = s.input && s.input.area ? s.input.area : ""
    if (s.tool === "get_weather") {
        const r = s.result || {}
        return r.error ? `🌤️ get_weather(${a}) → ${r.error}`
            : `🌤️ get_weather(${a}) → ${r.condition}, ${r.temperature_c}°C, 비 확률 ${r.rain_chance_percent}%`
    }
    const where = s.input && typeof s.input.indoor === "boolean" ? (s.input.indoor ? "실내" : "야외") : "전체"
    return `📍 find_spots(${a}, ${where}) → ${(s.result && s.result.count) || 0}곳`
}

const ask = async () => {
    const question = $("q").value.trim()
    if (!question) return
    $("go").disabled = true
    $("steps").replaceChildren()
    $("spots").replaceChildren()
    $("answer").style.display = "none"
    addStep("🤔 도구를 고르는 중…")
    try {
        const r = await fetch("/api/recommend", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ question }),
        })
        const d = await r.json()
        $("steps").replaceChildren()
        ;(d.steps || []).forEach(s => addStep(describe(s)))
        $("answer").textContent = d.answer || d.error || "답을 받지 못했어요."
        $("answer").style.display = "block"
        showMap(d.spots || [])
        ;(d.spots || []).forEach(s => {
            const sp = document.createElement("span")
            sp.textContent = `${s.name} · ${s.indoor ? "실내" : "야외"}`
            $("spots").append(sp)
        })
    } catch (e) {
        $("steps").replaceChildren()
        $("answer").textContent = "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요."
        $("answer").style.display = "block"
    }
    $("go").disabled = false
}

$("go").onclick = ask
document.querySelectorAll(".ex button").forEach(b => b.onclick = () => { $("q").value = b.textContent; ask() })

// ── 지도: 추천 장소 표시 (장소별 좌표가 없어 지역 중심 근처에 흩어 표시) ──
const CENTER = {
    "동쪽(성산)": [33.4581, 126.9425],
    "동쪽(구좌)": [33.54, 126.83],
    "제주시":     [33.51, 126.5219],
    "서쪽(한림)": [33.4114, 126.2655],
    "서쪽(안덕)": [33.26, 126.36],
    "서귀포":     [33.253, 126.56],
}
const map = L.map("map").setView([33.38, 126.55], 9)
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map)
const layer = L.layerGroup().addTo(map)

const popup = s => {
    const box = document.createElement("div")
    const b = document.createElement("b")
    b.textContent = s.name
    box.append(b, document.createElement("br"), `${s.area} · ${s.indoor ? "실내" : "야외"}`,
        document.createElement("br"), s.desc || s.type || "")
    return box
}

const showMap = spots => {
    layer.clearLayers()
    const pts = []
    spots.forEach((s, i) => {
        const c = CENTER[s.area]
        if (!c) return
        const ang = i * 2.4, r = 0.012 * Math.sqrt(i + 1)
        const p = [c[0] + r * Math.sin(ang), c[1] + r * Math.cos(ang)]
        pts.push(p)
        L.marker(p).addTo(layer).bindPopup(popup(s))
    })
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 })
}
