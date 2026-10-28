// api/tool.js — 에이전트 도구 find_spots, get_weather (설명 + 실행 함수)
const SPOTS = require('../jeju_spots.json').spots;   // 강사 배포 목록

const AREAS = ['동쪽', '서쪽', '서귀포', '제주시'];
const MAX = 8;

// 날씨 조회용 지역 대표 좌표 (Open-Meteo, 키 불필요)
const AREA_POINT = {
  '동쪽': [33.46, 126.88],
  '서쪽': [33.36, 126.30],
  '서귀포': [33.25, 126.56],
  '제주시': [33.51, 126.52],
};

// WMO 날씨 코드 → 한글
const WMO = (c) =>
  c === 0 ? '맑음' : c <= 3 ? '구름 조금~흐림' : c <= 48 ? '안개' : c <= 57 ? '이슬비' :
  c <= 67 ? '비' : c <= 77 ? '눈' : c <= 82 ? '소나기' : c <= 86 ? '눈 소나기' : '뇌우';

// Claude 도구 설명 (name / description / input_schema)
const findSpotsTool = {
  name: 'find_spots',
  description:
    '제주 관광지 목록에서 지역(area)과 실내 여부(indoor)로 장소를 골라 최대 8곳까지 돌려준다. ' +
    '각 장소는 이름·지역·실내 여부·설명(유형)을 담는다. 목록 밖 장소는 없다. ' +
    '결과에 없는 장소는 추천하거나 지어내지 말 것.',
  input_schema: {
    type: 'object',
    properties: {
      area: { type: 'string', enum: AREAS, description: '지역: 동쪽, 서쪽, 서귀포, 제주시 중 하나' },
      indoor: { type: 'boolean', description: 'true면 실내, false면 야외만. 생략하면 모두.' },
    },
    required: ['area'],
  },
};

const getWeatherTool = {
  name: 'get_weather',
  description:
    '제주 지역(area)의 지금 날씨를 Open-Meteo에서 가져온다. 기온, 날씨, 강수량, 바람, 오늘 비 올 확률과 ' +
    '비가 오는지(rainy)를 돌려준다. 실내/야외 중 무엇을 추천할지 정할 때 쓴다.',
  input_schema: {
    type: 'object',
    properties: {
      area: { type: 'string', enum: AREAS, description: '지역: 동쪽, 서쪽, 서귀포, 제주시 중 하나' },
    },
    required: ['area'],
  },
};

// 도구 실행: 이름·지역·실내 여부·설명만 반환 (좌표 제외)
function find_spots({ area, indoor } = {}) {
  if (typeof area !== 'string' || !AREAS.includes(area)) return { error: `area는 ${AREAS.join(', ')} 중 하나여야 합니다` };
  const spots = SPOTS
    .filter(s => (s.area === area || s.area.startsWith(area + '(')) && (typeof indoor !== 'boolean' || s.indoor === indoor))
    .slice(0, MAX)
    .map(s => ({ name: s.name, area: s.area, indoor: s.indoor, desc: s.type }));
  return { spots };
}

async function get_weather({ area } = {}) {
  if (typeof area !== 'string' || !AREAS.includes(area)) return { error: `area는 ${AREAS.join(', ')} 중 하나여야 합니다` };
  const [lat, lon] = AREA_POINT[area];
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
    '&current=temperature_2m,precipitation,weather_code,wind_speed_10m' +
    '&daily=precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=1';
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { error: '날씨 서버 응답 오류' };
    const d = await r.json();
    const c = d.current;
    const chance = d.daily && d.daily.precipitation_probability_max ? d.daily.precipitation_probability_max[0] : null;
    return {
      area,
      temperature_c: c.temperature_2m,
      condition: WMO(c.weather_code),
      precipitation_mm: c.precipitation,
      wind_kmh: c.wind_speed_10m,
      rain_chance_percent: chance,
      rainy: c.precipitation > 0 || c.weather_code >= 51 || (chance !== null && chance >= 60),
    };
  } catch (e) {
    return { error: '날씨를 가져오지 못했어요' };
  }
}

// Vercel 은 api/ 안의 파일을 함수로 보므로, 도구 목록을 돌려주는 핸들러로 내보내고 값은 속성으로 붙인다.
const handler = (req, res) => res.status(200).json({ tools: handler.tools });
handler.tools = [findSpotsTool, getWeatherTool];
handler.handlers = { find_spots, get_weather };
handler.AREAS = AREAS;
module.exports = handler;
