-- ================================================================
-- 005_users_company_id.sql
-- users 테이블에 company_id 컬럼 추가
-- 클라이언트 사용자를 특정 고객사에 배정하기 위한 필드
-- ================================================================

-- company_id 컬럼 추가 (nullable: firm_admin/firm_staff는 null)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_id UUID NULL REFERENCES companies(company_id);

-- 인덱스: firm별 company별 사용자 조회
CREATE INDEX IF NOT EXISTS idx_users_firm_company
  ON users (firm_id, company_id);

-- 인덱스: firm별 user_type 조회
CREATE INDEX IF NOT EXISTS idx_users_firm_type
  ON users (firm_id, user_type);

-- ================================================================
-- RLS: users 테이블 정책 수정
-- (003_rls_policies.sql의 기존 정책을 대체)
-- ================================================================

-- 기존 정책 제거 후 재생성 (company_id 컬럼 추가 반영)
DROP POLICY IF EXISTS "users_firm_policy" ON users;
DROP POLICY IF EXISTS "users: firm isolation" ON users;

-- firm 구성원은 같은 firm의 users 레코드 접근 가능
CREATE POLICY "users: firm isolation"
  ON users
  FOR ALL
  USING (
    firm_id = ((auth.jwt()->'user_metadata'->>'firm_id')::uuid)
  );
