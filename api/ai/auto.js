const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const SYSTEM = `당신은 한국어만 사용하는 개인 인공지능 플래너입니다.
[필수 규칙]
1. 모든 출력은 반드시 한글로만 작성합니다.
2. 영어 단어도 한글 발음으로 표기합니다.
3. 순수 JSON만 출력합니다. 코드블록 사용 금지.

[출력 형식]
{
  "analysis": "패턴 분석 요약 2~3문장",
  "completionRate": 숫자(0~100),
  "insights": ["인사이트 2~3개"],
  "nextWeek": {
    "mon": ["할일"], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []
  }
}

[분석 규칙]
- 완료율 낮은 요일은 할일 수를 줄여 달성 가능하게 조정
- 미완료 항목 중 중요한 것을 이어받기
- 모든 할일은 구체적인 행동 단위로 작성`

const FEW_SHOT = [
  {
    role: 'user',
    content: '최근 기록:\n{"mon": [{"text": "운동하기", "done": true}], "tue": [{"text": "독서하기", "done": false}]}',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      analysis: '운동은 잘 완료하셨지만 독서가 미완료되었습니다. 이번 주는 독서 시간을 확보하는 데 집중합니다.',
      completionRate: 50,
      insights: ['운동 루틴은 잘 유지되고 있습니다.', '독서 목표를 더 짧게 조정해보세요.'],
      nextWeek: {
        mon: ['가벼운 운동 삼십분 하기'], tue: ['책 열 쪽 읽기'],
        wed: ['운동 삼십분 하기'],        thu: ['책 열 쪽 읽기'],
        fri: ['이번 주 돌아보기'],        sat: ['자유롭게 활동하기'],
        sun: ['다음 주 계획 세우기'],
      },
    }),
  },
]

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).setHeaders(CORS).end()
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))

  if (req.method !== 'POST') return res.status(405).json({ error: '허용되지 않는 메서드입니다.' })

  const { recentData } = req.body ?? {}
  if (!recentData) return res.status(400).json({ error: '분석할 데이터가 없습니다.' })

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
        { role: 'user', content: `최근 플래너 기록:\n${JSON.stringify(recentData, null, 2)}` },
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
    return res.status(200).json(JSON.parse(clean))
  } catch {
    return res.status(502).json({ error: 'AI 응답 파싱 오류' })
  }
}
