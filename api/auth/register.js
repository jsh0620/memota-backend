import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

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
  if (username.length < 3) {
    return res.status(400).json({ error: '아이디는 3자 이상이어야 합니다.' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' })
  }

  // 중복 확인
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single()

  if (existing) {
    return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' })
  }

  // 비밀번호 해시화
  const password_hash = await bcrypt.hash(password, 12)

  const { data, error } = await supabase
    .from('users')
    .insert({ username, password_hash })
    .select('id, username')
    .single()

  if (error) {
    return res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' })
  }

  return res.status(201).json({ message: '회원가입이 완료되었습니다.', user: data })
}
