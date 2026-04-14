import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않는 메서드입니다.' })
  }

  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' })
  }

  // 사용자 조회
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, password_hash')
    .eq('username', username)
    .single()

  if (error || !user) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' })
  }

  // 비밀번호 검증
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' })
  }

  // JWT 발급
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  )

  return res.status(200).json({
    token,
    user: { id: user.id, username: user.username }
  })
}
