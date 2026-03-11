import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  
  // Supabase Auth에 관리자 계정 생성
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // 이메일 인증 필요
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 이메일 인증 링크 발송
  const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(email);
  if (emailError) {
    return NextResponse.json({ error: emailError.message }, { status: 400 });
  }

  // employees 테이블에도 관리자 정보 저장
  await supabase.from("employees").insert([
    { user_id: data.user?.id, email, role: "admin", name: "관리자" }
  ]);

  return NextResponse.json({ 
    success: true,
    message: "관리자 계정이 생성되었습니다. 이메일을 확인하여 계정을 활성화해주세요."
  });
}


