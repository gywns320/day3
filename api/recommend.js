// api/recommend.js — Gemini 에이전트: find_spots + get_weather 를 스스로 골라 써서 추천
// 열쇠는 Vercel 환경변수 GEMINI_API_KEY 에서만 읽습니다. 열쇠가 없으면 '연습 모드'로 같은 도구를 직접 호출해 답합니다.
const { tools, handlers, AREAS } = require('./tool');

const SYSTEM = [
  '너는 제주 여행 안내 에이전트야. 존댓말로 4문장 이내로 답해.',
  '추천 전에 반드시 get_weather 로 날씨를 확인하고, 비가 오면 실내(indoor=true), 맑으면 야외 위주로 find_spots 를 불러 장소를 골라.',
  '장소는 find_spots 결과 안에서만 추천해. 목록 밖 장소는 없으니 지어내지 마. 운영시간·요금은 단정하지 마.',
  '지역을 말하지 않으면 제주시로 보고, 그렇게 가정했다고 알려 줘. 제주 여행과 상관없는 질문에는 정중히 여행 이야기로 돌아와.',
].join('\n');

const MAX_TURNS = 5;

// tool.js 의 도구 설명(name/description/input_schema)을 Gemini 형식(functionDeclarations)으로 바꿈
const functionDeclarations = tools.map(t => ({ name: t.name, description: t.description, parameters: t.input_schema }));

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

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(200).json(await practice(question));

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const contents = [{ role: 'user', parts: [{ text: question }] }];
  const steps = [];
  let spots = [];
  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },   // 열쇠는 헤더로만 보냄(주소에 넣지 않음)
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          tools: [{ functionDeclarations }],
        }),
      });
      if (!r.ok) return res.status(200).json({ mode: 'error', answer: '잠시 후 다시 물어봐 주세요.', steps });   // 오류 내용·열쇠는 숨김
      const data = await r.json();
      const content = data.candidates && data.candidates[0] && data.candidates[0].content;
      if (!content || !content.parts) return res.status(200).json({ mode: 'error', answer: '답을 받지 못했어요. 다시 물어봐 주세요.', steps });
      contents.push(content);   // 모델 응답을 그대로 이어 붙임(함수 호출 정보 유지)
      const calls = content.parts.filter(p => p.functionCall);
      if (!calls.length) {
        const answer = content.parts.map(p => p.text || '').join('');
        return res.status(200).json({ mode: 'gemini', answer, steps, spots });
      }
      const responses = [];
      for (const p of calls) {
        const { name, args } = p.functionCall;
        const out = await run(name, args || {});
        if (name === 'find_spots' && out.spots) spots = out.spots;
        steps.push({ tool: name, input: args || {}, result: name === 'find_spots' ? { count: (out.spots || []).length } : out });
        responses.push({ functionResponse: { name, response: out } });
      }
      contents.push({ role: 'user', parts: responses });
    }
    return res.status(200).json({ mode: 'error', answer: '답을 정리하지 못했어요. 다시 물어봐 주세요.', steps });
  } catch (e) {
    return res.status(200).json({ mode: 'error', answer: '잠시 후 다시 물어봐 주세요.', steps });
  }
};
