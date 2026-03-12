-- ================================================================
-- 003_rls_policies.sql
-- Row Level Security — 모든 테이블에 firm_id 기반 RLS 적용
-- ================================================================

-- Helper: JWT에서 firm_id 추출
CREATE OR REPLACE FUNCTION auth.firm_id() RETURNS uuid AS $$
  SELECT COALESCE(
    (auth.jwt()->'user_metadata'->>'firm_id')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE sql STABLE;

-- Helper: JWT에서 role 추출
CREATE OR REPLACE FUNCTION auth.user_role() RETURNS text AS $$
  SELECT COALESCE(auth.jwt()->'user_metadata'->>'role', 'client');
$$ LANGUAGE sql STABLE;

-- ================================================================
-- firms
-- ================================================================
ALTER TABLE firms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firms: read own firm" ON firms
  FOR SELECT USING (
    firm_id = auth.firm_id()
    OR auth.user_role() = 'platform_admin'
  );

-- ================================================================
-- companies
-- ================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies: firm access" ON companies
  FOR ALL USING (firm_id = auth.firm_id());

-- ================================================================
-- engagements
-- ================================================================
ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "engagements: firm access" ON engagements
  FOR ALL USING (firm_id = auth.firm_id());

-- ================================================================
-- request_items
-- ================================================================
ALTER TABLE request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "request_items: firm access" ON request_items
  FOR ALL USING (firm_id = auth.firm_id());

-- ================================================================
-- request_item_files
-- ================================================================
ALTER TABLE request_item_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "request_item_files: firm access" ON request_item_files
  FOR ALL USING (firm_id = auth.firm_id());

-- ================================================================
-- request_item_comments
-- ================================================================
ALTER TABLE request_item_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "request_item_comments: firm access" ON request_item_comments
  FOR ALL USING (firm_id = auth.firm_id());

-- ================================================================
-- templates / template_items
-- ================================================================
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates: firm access" ON templates
  FOR ALL USING (firm_id = auth.firm_id());

ALTER TABLE template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "template_items: firm access" ON template_items
  FOR ALL USING (firm_id = auth.firm_id());

-- ================================================================
-- pbc_codes (read-only for all firm users)
-- ================================================================
ALTER TABLE pbc_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pbc_codes: firm access" ON pbc_codes
  FOR ALL USING (firm_id = auth.firm_id());

-- ================================================================
-- firm_settings
-- ================================================================
ALTER TABLE firm_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_settings: firm access" ON firm_settings
  FOR ALL USING (firm_id = auth.firm_id());

-- ================================================================
-- users (public)
-- ================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users: firm access" ON users
  FOR ALL USING (firm_id = auth.firm_id());

-- ================================================================
-- audit_logs (읽기 전용, firm 내)
-- ================================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs: firm read" ON audit_logs
  FOR SELECT USING (firm_id = auth.firm_id());

-- Service role bypasses all RLS automatically.
-- Platform admin can use service_role_key on server-side only.
