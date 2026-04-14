const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const SYSTEM = `당신은 한국어만 사용하는 전문 라이프코치입니다.
[필수 규칙]
1. 반드시 한글로만 작성합니다. 영어 사용 절대 금지.
2. 영어 단어도 한글 발음으로 표기합니다. (React → 리액트, AI → 인공지능)
3. 순수 JSON만 출력합니다. 코드블록(```) 사용 금지. 설명 텍스트 금지.

[출력 형식]
{
  "summary": "전체 계획 요약 2~3문장",
  "totalWeeks": 숫자,
  "weeks": [
    {
      "weekNum": 1,
      "theme": "주제 15자 이내",
      "mon": ["할일 20자 이내"],
      "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []
    }
  ],
  "tips": ["실천 팁"]
}

[계획 규칙]
- 각 요일 1~3개 항목
- 사용자가 언급한 가용 요일에만 배정
- 주말 언급 없으면 평일과 동일하게 배정
- 주차가 지날수록 난이도 점진적 상승
- 모든 텍스트는 반드시 한글`

const FEW_SHOT = [
  { role: 'user', content: '기간: 1주\n목표: 리액트 공부\n세부사항: 매일 저녁 2시간' },
  {
    role: 'assistant',
    content: JSON.stringify({
      summary: '리액트 기초를 다지는 1주 계획입니다. 매일 꾸준히 학습하여 기본 개념을 완성합니다.',
      totalWeeks: 1,
      weeks: [{
        weekNum: 1, theme: '리액트 기초 완성',
        mon: ['컴포넌트 개념 학습하기'], tue: ['상태 관리 기초 익히기'],
        wed: ['이벤트 처리 실습하기'],   thu: ['리스트 렌더링 연습하기'],
        fri: ['간단한 앱 만들어보기'],   sat: ['실습 프로젝트 이어서 만들기'],
        sun: ['이번 주 내용 정리하기'],
      }],
      tips: ['매일 같은 시간에 학습하는 습관을 들이세요.', '모르는 내용은 바로 검색하여 해결하세요.'],
    }),
  },
]

function sanitizeKorean(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F0-9\s.,!?:%~()\-]/g, '').trim()
  }
  if (Array.isArray(obj)) return obj.map(sanitizeKorean)
  if (obj && typeof obj === 'object') {
    const result = {}
    for (const [k, v] of Object.entries(obj)) result[k] = sanitizeKorean(v)
    return result
  }
  return obj
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).setHeaders(CORS).end()
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))

  if (req.method !== 'POST') return res.status(405).json({ error: '허용되지 않는 메서드입니다.' })

  const { period, goal, details } = req.body ?? {}
  if (!goal?.trim()) return res.status(400).json({ error: '목표를 입력해주세요.' })

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.45,
      max_tokens: 2500,
      messages: [
        { role: 'system', content: SYSTEM },
        ...FEW_SHOT,
        { role: 'user', content: `기간: ${period}주\n목표: ${goal}\n세부사항: ${details || '없음'}` },
      ],
    }),
  })

  if (!groqRes.ok) {
    const j = await groqRes.json().catch(() => ({}))
    return res.status(502).json({ error: j?.error?.message ?? 'AI 서버 오류' })
  }

  const groqData = await groqRes.json()
  const text  = groqData.choices?.[0]?.message?.content ?? ''
  const clean = text.replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(clean)
    return res.status(200).json(sanitizeKorean(parsed))
  } catch {
    return res.status(502).json({ error: 'AI 응답 파싱 오류' })
  }
}
