# 제주 날씨 맞춤 추천 에이전트 (Gemini)

Gemini가 `get_weather`(Open-Meteo)와 `find_spots`(jeju_spots.json) 도구를 스스로 골라 호출해 추천합니다.

## Gemini API 키 발급 (Google AI Studio)
1. https://aistudio.google.com 접속 → Google 계정으로 로그인
2. 처음이면 이용약관 동의 후 계속
3. 왼쪽 메뉴(또는 첫 화면)의 **Get API key** 클릭 → 대시보드의 **API 키 만들기**
4. 만들어진 키를 **복사** (남에게 보이지 않게 보관)
5. 사용량·로그는 AI Studio 대시보드의 **사용량 / 로그 및 데이터 세트** 메뉴에서 확인

> 키를 코드·GitHub·채팅에 붙여 넣지 마세요. 유출되면 대시보드에서 삭제하고 새로 만드세요.

## Vercel에 키 등록
Vercel 프로젝트 → Settings → Environment Variables
- `GEMINI_API_KEY` = 복사한 키 (필수)
- `GEMINI_MODEL` = 사용할 모델 이름 (선택, 기본 `gemini-3.5-flash-lite`)

저장 후 **Redeploy** 해야 적용됩니다. 키가 없으면 "연습 모드"로 동작합니다.

## 내 컴퓨터에서 키만 먼저 테스트 (PowerShell)
```powershell
$env:GEMINI_API_KEY = "여기에 API 키 입력"
$body = '{"contents":[{"parts":[{"text":"안녕하세요"}]}]}'
Invoke-RestMethod -Method Post -ContentType "application/json; charset=utf-8" `
  -Uri "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent" `
  -Headers @{ "x-goog-api-key" = $env:GEMINI_API_KEY } `
  -Body ([Text.Encoding]::UTF8.GetBytes($body))
```
