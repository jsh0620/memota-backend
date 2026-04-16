const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const SYSTEM = `당신은 학습자의 목표를 분석하여 실행 가능한 계획을 세우는 전문 교육 설계자입니다.

[필수 규칙]
1. 반드시 한글로만 작성합니다. 영어 사용 절대 금지. 전문 용어는 한글 발음으로 적습니다.
2. 입력된 목표가 너무 추상적이어서 구체적인 커리큘럼을 짤 수 없는 경우, 계획을 생성하지 말고 반려합니다.
3. 순수 JSON만 출력하며, 코드블록이나 추가 설명은 절대 금지합니다.

[반려 기준 (isVague: true)]
- 목표가 단어 하나뿐이거나(예: "공부", "시험"), 무엇을 공부하는지 대상이 명확하지 않은 경우.
- "시험 잘 보기", "열심히 살기"처럼 구체적인 학습 과목이나 분야가 없는 경우.

[출력 형식]
1. 정상적인 경우:
{"isVague":false, "summary":"요약", "totalWeeks":숫자, "weeks":[...], "tips":[...]}

2. 반려하는 경우 (목표가 추상적일 때):
{"isVague":true, "message":"구체적이지 않은 목표입니다. 과목명이나 구체적으로 무엇을 학습하고 싶은지 세부사항을 더 자세하게 작성해주세요."}

[커리큘럼 설계 원칙]
- 구체적인 '행동' 위주로 할 일을 배정 (예: 이진법 변환 연습, 진리표 작성).
- 주차별로 기초 -> 원리 -> 심화 순서로 구성.`

const FEW_SHOT = [
  {
    role: 'user',
    content: '기간: 1주\n목표: 시험 적당히 보기\n세부사항: 없음'
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      isVague: true,
      message: '어떤 과목의 시험인지, 혹은 어떤 분야를 공부하고 싶으신지 구체적인 목표를 알려주세요. 과목명을 명시해주시면 더 완벽한 계획을 짜드릴 수 있습니다!'
    })
  },
  {
    role: 'user',
    content: '기간: 1주\n목표: 컴퓨터 논리회로 이해\n세부사항: 비전공자 기초'
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      isVague: false,
      summary: '논리 게이트부터 부울 대수까지 컴퓨터의 기초 원리를 파악하는 1주 집중 과정입니다.',
      totalWeeks: 1,
      weeks: [{
        weekNum: 1,
        theme: '논리회로 핵심 기초',
        mon: ['이진법과 십진법 변환법 익히기'],
        tue: ['앤드, 오어, 낫 게이트 진리표 작성'],
        wed: ['낸드, 노어, 엑스오어 게이트 특성 파악'],
        thu: ['부울 대수 기본 법칙과 식 간소화'],
        fri: ['드모르간 법칙을 이용한 회로 변환'],
        sat: ['카르노 맵으로 논리식 최소화 연습'],
        sun: ['이번 주 학습 내용 최종 복습']
      }],
      tips: ['직접 손으로 진리표를 그려보는 것이 중요합니다.'],
    })
  }
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

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3, // 더 엄격한 판단을 위해 온도를 조금 더 낮춤
        max_tokens: 3000,
        messages: [
          { role: 'system', content: SYSTEM },
          ...FEW_SHOT,
          { role: 'user', content: `기간: ${period}주\n목표: ${goal}\n세부사항: ${details || '없음'}` },
        ],
        response_format: { type: "json_object" }
      }),
    })

    if (!groqRes.ok) {
      const j = await groqRes.json().catch(() => ({}))
      return res.status(502).json({ error: j?.error?.message ?? 'AI 서버 오류' })
    }

    const groqData = await groqRes.json()
    const text = groqData.choices?.[0]?.message?.content ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    
    const parsed = JSON.parse(clean)
    const sanitized = sanitizeKorean(parsed)

    // AI가 isVague: true를 뱉었다면 프론트엔드에서 경고창을 띄우기 쉽도록 그대로 반환
    return res.status(200).json(sanitized)

  } catch (error) {
    console.error('API Error:', error)
    return res.status(502).json({ error: '데이터 처리 중 오류가 발생했습니다.' })
  }
}