// api/recommend.js — Claude 에이전트: find_spots + get_weather 를 스스로 골라 써서 추천
// 열쇠는 Vercel 환경변수 ANTHROPIC_API_KEY 에서만 읽습니다. 열쇠가 없으면 '연습 모드'로 같은 도구를 직접 호출해 답합니다.
const { tools, handlers, AREAS } = require('./tool');

const SYSTEM = [
  '너는 제주 여행 안내 에이전트야. 존댓말로 4문장 이내로 답해.',
  '추천 전에 반드시 get_weather 로 날씨를 확인하고, 비가 오면 실내(indoor=true), 맑으면 야외 위주로 find_spots 를 불러 장소를 골라.',
  '장소는 find_spots 결과 안에서만 추천해. 목록 밖 장소는 없으니 지어내지 마. 운영시간·요금은 단정하지 마.',
  '지역을 말하지 않으면 제주시로 보고, 그렇게 가정했다고 알려 줘. 제주 여행과 상관없는 질문에는 정중히 여행 이야기로 돌아와.',
].join('\n');

const MAX_TURNS = 5;

async function run(name, input) {
  const fn = handlers[name];
  return fn ? await fn(input) : { error: '알 수 없는 도구' };
}

// ── 연습 모드: 질문에서 지역·실내 단서를 찾아 두 도구를 직접 호출 ──
async function practice(question) {
  const area = AREAS.find(a => question.includes(a)) || (question.includes('서귀') ? '서귀포' : '제주시');
  const steps = [];
  const weather = await run('get_weather', { area });
  steps.push({ tool: 'get_weather', input: { area }, result: weather });
  const wantIndoor = /실내|비|우천/.test(question) ? true : /야외|산책|바다|오름/.test(question) ? false : undefined;
  const indoor = wantIndoor !== undefined ? wantIndoor : weather.rainy ? true : false;
  const found = await run('find_spots', { area, indoor });
  steps.push({ tool: 'find_spots', input: { area, indoor }, result: { count: (found.spots || []).length } });
  const picks = (found.spots || []).slice(0, 3);
  const w = weather.error ? '날씨를 확인하지 못했지만' : `${area}은 지금 ${weather.condition}, ${weather.temperature_c}°C라서`;
  const answer = picks.length
    ? `(연습 모드) ${w} ${indoor ? '실내' : '야외'} 장소를 골랐어요. ${picks.map(p => `${p.name}(${p.desc})`).join(', ')} 어떠세요?`
    : '(연습 모드) 조건에 맞는 장소를 목록에서 찾지 못했어요.';
  return { mode: 'practice', answer, steps, spots: picks };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 로만 물어봐 주세요' });
  const question = String((req.body && req.body.question) || '').slice(0, 300);
  if (!question.trim()) return res.status(400).json({ error: '질문이 비어 있어요' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json(await practice(question));

  const messages = [{ role: 'user', content: question }];
  const steps = [];
  let spots = [];
  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: process.env.CLAUDE_MODEL || 'claude-haiku-5-5',
          max_tokens: 700, system: SYSTEM, tools, messages,
        }),
      });
      if (!r.ok) return res.status(200).json({ mode: 'error', answer: '잠시 후 다시 물어봐 주세요.', steps });   // 오류 내용·열쇠는 숨김
      const data = await r.json();
      messages.push({ role: 'assistant', content: data.content });
      if (data.stop_reason !== 'tool_use') {
        const answer = data.content.filter(c => c.type === 'text').map(c => c.text).join('');
        return res.status(200).json({ mode: 'claude', answer, steps, spots });
      }
      const results = [];
      for (const b of data.content.filter(c => c.type === 'tool_use')) {
        const out = await run(b.name, b.input);
        if (b.name === 'find_spots' && out.spots) spots = out.spots;
        steps.push({ tool: b.name, input: b.input, result: b.name === 'find_spots' ? { count: (out.spots || []).length } : out });
        results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out) });
      }
      messages.push({ role: 'user', content: results });
    }
    return res.status(200).json({ mode: 'error', answer: '답을 정리하지 못했어요. 다시 물어봐 주세요.', steps });
  } catch (e) {
    return res.status(200).json({ mode: 'error', answer: '잠시 후 다시 물어봐 주세요.', steps });
  }
};
