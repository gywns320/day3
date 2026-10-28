// api/tool.js — Claude 도구 find_spots (설명 + 실행 함수)
const SPOTS = require('../jeju_spots.json').spots;   // 강사 배포 목록

const AREAS = ['동쪽', '서쪽', '서귀포', '제주시'];
const MAX = 8;

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

// 도구 실행: 이름·지역·실내 여부·설명만 반환 (좌표 제외)
function find_spots({ area, indoor } = {}) {
  if (typeof area !== 'string' || !AREAS.includes(area)) return { error: `area는 ${AREAS.join(', ')} 중 하나여야 합니다` };
  const spots = SPOTS
    .filter(s => (s.area === area || s.area.startsWith(area + '(')) && (typeof indoor !== 'boolean' || s.indoor === indoor))
    .slice(0, MAX)
    .map(s => ({ name: s.name, area: s.area, indoor: s.indoor, desc: s.type }));
  return { spots };
}

module.exports = { tools: [findSpotsTool], find_spots, findSpotsTool };
