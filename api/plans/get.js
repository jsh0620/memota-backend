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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: '허용되지 않는 메서드입니다.' })
  }

  let decoded
  try {
    decoded = verifyToken(req)
  } catch {
    return res.status(401).json({ error: '인증이 필요합니다. 다시 로그인해주세요.' })
  }

  const { data, error } = await supabase
    .from('plans')
    .select('data')
    .eq('user_id', decoded.userId)
    .single()

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: '데이터를 불러오는 중 오류가 발생했습니다.' })
  }

  return res.status(200).json({ plans: data?.data ?? {} })
}
