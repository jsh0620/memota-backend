const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// 1. 프롬프트 강화: 교육 설계자 페르소나 및 구체적 단계 명시
const SYSTEM = `당신은 학습자의 수준에 맞춰 구체적이고 체계적인 커리큘럼을 설계하는 전문 교육 설계자입니다.
[필수 규칙]
1. 반드시 한글로만 작성합니다. 영어 사용 절대 금지.
2. 모든 전문 용어는 한글 발음으로 표기합니다. (예: AND -> 앤드, OR -> 오어, NAND -> 낸드, De Morgan -> 드모르간, Karnaugh Map -> 카르노 맵)
3. 순수 JSON만 출력합니다. 코드블록이나 설명 텍스트 금지.

[커리큘럼 설계 원칙]
- 초보자가 독학할 수 있도록 '이진법 변환', '진리표 작성'처럼 명확한 '행동' 위주로 할 일을 배정합니다.
- '공부하기', '학습하기'와 같은 추상적인 표현은 피하고 구체적인 주제를 명시합니다.
- 주차별로 기초 -> 원리 -> 심화 -> 실습 순으로 난이도를 점진적으로 높입니다.

[출력 형식]
{"summary":"전체 계획 요약 2~3문장","totalWeeks":숫자,"weeks":[{"weekNum":1,"theme":"주제 15자 이내","mon":["할일 20자 이내"],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}],"tips":["실천 팁"]}`

const FEW_SHOT = [
  {
    role: 'user',
    content: '기간: 1주\n목표: 컴퓨터 논리회로 이해\n세부사항: 비전공자 초보자'
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      summary: '컴퓨터의 기초인 이진법부터 주요 논리 게이트와 카르노 맵까지 핵심 원리를 단계별로 파악하는 1주 집중 과정입니다.',
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
        sun: ['가산기 구조 정리 및 이번 주 복습']
      }],
      tips: ['직접 종이에 진리표를 그려보는 것이 기억에 오래 남습니다.', '카르노 맵은 묶는 규칙을 눈에 익히는 것이 중요합니다.'],
    })
  }
]

// 2. 정제 함수 개선: 문장 부호와 한글, 숫자만 남기고 불필요한 기호 제거
function sanitizeKorean(obj) {
  if (typeof obj === 'string') {
    // 한글, 숫자, 공백, 필수 문장부호(.,!?:%~()-)만 허용
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
        temperature: 0.4, // 창의성보다는 구조적 답변을 위해 약간 낮춤
        max_tokens: 3000,
        messages: [
          { role: 'system', content: SYSTEM },
          ...FEW_SHOT,
          { role: 'user', content: `기간: ${period}주\n목표: ${goal}\n세부사항: ${details || '없음'}` },
        ],
        response_format: { type: "json_object" } // JSON 출력 보장 (모델 지원 시)
      }),
    })

    if (!groqRes.ok) {
      const j = await groqRes.json().catch(() => ({}))
      return res.status(502).json({ error: j?.error?.message ?? 'AI 서버 오류' })
    }

    const groqData = await groqRes.json()
    const text = groqData.choices?.[0]?.message?.content ?? ''
    
    // JSON 파싱 전 청소
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    
    // 최종 결과 반환 (한글 정제 포함)
    return res.status(200).json(sanitizeKorean(parsed))

  } catch (error) {
    console.error('API Error:', error)
    return res.status(502).json({ error: '데이터 처리 중 오류가 발생했습니다.' })
  }
}