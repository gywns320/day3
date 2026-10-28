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
