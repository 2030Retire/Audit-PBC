"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

export default function SetupAdminPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [registeredPassword, setRegisteredPassword] = useState("");

  useEffect(() => {
    // 이미 관리자(최초 사용자)가 있는지 확인
    checkAdminExists();
  }, []);

  async function checkAdminExists() {
    // const { data, error } = await supabase.from("employees").select("*").eq("role", "admin");
    // if (data && data.length > 0) {
    //   router.replace("/login");
    // }
    setChecking(false);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    // 서버 API로 요청
    const res = await fetch("/api/setup-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const result = await res.json();
    if (!res.ok) {
      setError(result.error || "관리자 생성 실패");
    } else {
      setSuccess(true);
      setRegisteredEmail(email);
      setRegisteredPassword(password);
      setEmail("");
      setPassword("");
      setTimeout(() => router.replace("/login"), 10000);
    }
    setLoading(false);
  }

  if (checking) return <div style={{ textAlign: "center", marginTop: 100 }}>관리자 존재 여부 확인 중...</div>;

  return (
    <div style={{ maxWidth: 400, margin: "40px auto" }}>
      <h2>최초 관리자 등록</h2>
      <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="관리자 이메일 입력"
          required
        />
        <input
          type="text"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="임시 비밀번호 입력"
          required
        />
        <button type="submit" disabled={loading || !email || !password}>등록</button>
      </form>
      {success && (
        <div style={{ color: "green", marginBottom: 16 }}>
          <b>관리자 계정이 생성되었습니다.</b><br />
          이메일로 받은 초대 링크를 클릭한 후,<br />
          아래 임시 비밀번호로 로그인하여 비밀번호를 변경해 주세요.<br /><br />
          <b>이메일:</b> {registeredEmail}<br />
          <b>임시 비밀번호:</b> {registeredPassword}<br /><br />
          (10초 후 로그인 페이지로 이동합니다)
        </div>
      )}
      {error && <div style={{ color: "red", marginBottom: 16 }}>{error}</div>}
    </div>
  );
} 