"use client";
import React, { useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/utils/supabaseClient";

export default function CompanyUsersPage() {
  const params = useParams();
  const companyId = params.id as string;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    // Supabase Auth에 사용자 생성
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage(`사용자 초대가 완료되었습니다.\n임시 비밀번호: ${password}`);
      setEmail("");
      setPassword("");
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 500, margin: "40px auto" }}>
      <h2>사용자 초대</h2>
      <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="이메일 입력"
          required
        />
        <input
          type="text"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="임시 비밀번호 입력"
          required
        />
        <button type="submit" disabled={loading || !email || !password}>초대</button>
      </form>
      {message && <div style={{ color: "green", whiteSpace: "pre-line", marginBottom: 16 }}>{message}</div>}
      {error && <div style={{ color: "red", marginBottom: 16 }}>{error}</div>}
      {/* 사용자 리스트 등 추가 구현 가능 */}
    </div>
  );
} 