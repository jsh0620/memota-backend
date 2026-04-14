import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function verifyToken(req) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) throw new Error('토큰이 없습니다.')
  return jwt.verify(auth.slice(7), process.env.JWT_SECRET)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않는 메서드입니다.' })
  }

  let decoded
  try {
    decoded = verifyToken(req)
  } catch {
    return res.status(401).json({ error: '인증이 필요합니다. 다시 로그인해주세요.' })
  }

  const { plans } = req.body
  if (!plans) {
    return res.status(400).json({ error: '저장할 데이터가 없습니다.' })
  }

  // upsert — 없으면 insert, 있으면 update
  const { error } = await supabase
    .from('plans')
    .upsert(
      { user_id: decoded.userId, data: plans, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  if (error) {
    return res.status(500).json({ error: '저장 중 오류가 발생했습니다.' })
  }

  return res.status(200).json({ message: '저장되었습니다.' })
}
