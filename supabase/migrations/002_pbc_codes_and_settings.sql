-- ============================================================
-- Migration 002: PBC Code Master & Firm Settings
-- ============================================================

-- 0. Add sort_order to request_items (display ordering)
ALTER TABLE request_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- 0b. Add pbc_category to template_items for categorization
ALTER TABLE template_items ADD COLUMN IF NOT EXISTS pbc_category VARCHAR(50) NULL;

-- 1. Firm-level settings table (for engagement code pattern, etc.)
CREATE TABLE IF NOT EXISTS firm_settings (
    firm_id UUID PRIMARY KEY REFERENCES firms(firm_id) ON DELETE CASCADE,
    engagement_code_pattern VARCHAR(100) NOT NULL DEFAULT '{COMPANY_CODE}-{YEAR}-{SEQ3}',
    engagement_seq_per_company BOOLEAN NOT NULL DEFAULT TRUE,
    default_due_days INTEGER NOT NULL DEFAULT 30,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul',
    locale VARCHAR(10) NOT NULL DEFAULT 'ko-KR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Engagement sequence counter (for auto-generating codes)
CREATE TABLE IF NOT EXISTS engagement_sequences (
    seq_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id) ON DELETE CASCADE,
    company_id UUID NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    last_seq INTEGER NOT NULL DEFAULT 0,
    UNIQUE (firm_id, company_id, fiscal_year)
);

-- 3. PBC Code Master table
-- is_system = TRUE → platform-level (available to all firms)
-- is_system = FALSE → firm-specific custom code
CREATE TABLE IF NOT EXISTS pbc_codes (
    pbc_code_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NULL REFERENCES firms(firm_id) ON DELETE CASCADE, -- NULL = system code
    pbc_category VARCHAR(50) NOT NULL,   -- e.g. 'GENERAL', 'CASH', 'AR', 'INVENTORY'...
    pbc_code VARCHAR(30) NOT NULL,       -- e.g. 'GEN-001', 'CASH-001'
    pbc_name VARCHAR(200) NOT NULL,      -- Korean name
    pbc_name_en VARCHAR(200) NULL,       -- English name
    description TEXT NULL,               -- Detailed description
    typical_documents TEXT NULL,         -- What documents to expect
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (firm_id, pbc_code)
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_pbc_codes_firm ON pbc_codes(firm_id);
CREATE INDEX IF NOT EXISTS idx_pbc_codes_category ON pbc_codes(pbc_category);
CREATE INDEX IF NOT EXISTS idx_pbc_codes_system ON pbc_codes(is_system) WHERE is_system = TRUE;

-- 4. Seed system-level PBC codes (is_system=TRUE, firm_id=NULL)
-- GENERAL
INSERT INTO pbc_codes (firm_id, pbc_category, pbc_code, pbc_name, pbc_name_en, description, typical_documents, is_system, sort_order) VALUES
(NULL, 'GENERAL', 'GEN-001', '이사회 및 주주총회 의사록', 'Board & Shareholder Meeting Minutes', '감사기간 중 이사회 및 주주총회 회의록 전체', '이사회 의사록, 주주총회 의사록', TRUE, 10),
(NULL, 'GENERAL', 'GEN-002', '정관 및 법인 설립 서류', 'Articles of Incorporation & Corporate Documents', '최신 정관 및 법인 관련 공식 서류', '정관, 법인등기부등본', TRUE, 20),
(NULL, 'GENERAL', 'GEN-003', '조직도', 'Organizational Chart', '감사기준일 기준 현행 조직도', '조직도 (PDF 또는 Excel)', TRUE, 30),
(NULL, 'GENERAL', 'GEN-004', '특수관계자 목록', 'Related Party List', '임원, 대주주, 특수관계 회사 목록', '특수관계자 명세서', TRUE, 40),
(NULL, 'GENERAL', 'GEN-005', '은행 거래 수권자 목록', 'Authorized Signatories List', '은행 거래 및 계약 체결 권한 보유자 목록', '은행 수권자 목록, 인감 증명서', TRUE, 50),
(NULL, 'GENERAL', 'GEN-006', '계열사 현황', 'Group Structure / Subsidiaries List', '자회사, 관계회사 현황 및 지분 구조', '연결 대상 계열사 목록, 지분율', TRUE, 60),
(NULL, 'GENERAL', 'GEN-007', '주요 계약서 목록', 'Key Contracts List', '중요 계약서 (임대, 용역, 금융 등) 목록 및 사본', '계약서 목록 및 사본', TRUE, 70),

-- CASH
(NULL, 'CASH', 'CASH-001', '은행 계좌 목록', 'Bank Account List', '모든 금융기관 계좌 목록 (예금, 적금, 외화 등)', '계좌 목록 (은행명, 계좌번호, 잔액)', TRUE, 10),
(NULL, 'CASH', 'CASH-002', '은행 잔액 증명서', 'Bank Confirmation / Balance Certificates', '감사기준일 기준 각 은행 잔액 증명서', '잔액증명서 원본 또는 공증본', TRUE, 20),
(NULL, 'CASH', 'CASH-003', '월별 은행 계좌 거래명세서', 'Monthly Bank Statements', '감사기간 전체 월별 통장 사본 또는 거래명세서', '은행 거래명세서 (전 기간)', TRUE, 30),
(NULL, 'CASH', 'CASH-004', '은행 조정표', 'Bank Reconciliation Statements', '각 계좌별 장부잔액 vs 은행잔액 조정표', '은행 조정표 (월별 또는 기말)', TRUE, 40),
(NULL, 'CASH', 'CASH-005', '소액현금 시재 현황', 'Petty Cash Reconciliation', '소액현금 보유 현황 및 정산 내역', '소액현금 장부, 영수증 목록', TRUE, 50),

-- ACCOUNTS RECEIVABLE
(NULL, 'AR', 'AR-001', '매출채권 연령 분석표', 'Accounts Receivable Aging Schedule', '거래처별, 경과기간별 매출채권 명세', 'AR 연령분석표 (Excel)', TRUE, 10),
(NULL, 'AR', 'AR-002', '매출채권 잔액 확인서', 'AR Confirmation Letters', '주요 거래처로부터의 잔액 확인서', '확인서 원본 (응답 완료분)', TRUE, 20),
(NULL, 'AR', 'AR-003', '대손충당금 산정 내역', 'Allowance for Doubtful Accounts', '대손충당금 설정 기준 및 산정 내역', '대손충당금 계산 시트', TRUE, 30),
(NULL, 'AR', 'AR-004', '주요 거래처 계약서', 'Key Customer Contracts', '주요 매출 거래처와의 계약서 사본', '판매 계약서, 기본거래계약서', TRUE, 40),
(NULL, 'AR', 'AR-005', '기말 후 회수 내역', 'Subsequent Collections', '기말 이후 실제 회수된 채권 내역', '회수 내역 (기말 후 1~2개월)', TRUE, 50),
(NULL, 'AR', 'AR-006', '미청구공사/계약자산 명세', 'Unbilled Revenue / Contract Assets', '미청구공사 또는 계약자산 명세서', '공사 진행률, 미청구 산출 내역', TRUE, 60),

-- INVENTORY
(NULL, 'INVENTORY', 'INV-001', '재고자산 실사 명세서', 'Physical Inventory Count Sheets', '실사 시점 재고 수량 및 금액 명세', '재고 실사표 (위치별, 품목별)', TRUE, 10),
(NULL, 'INVENTORY', 'INV-002', '재고자산 평가 명세서', 'Inventory Valuation Schedule', '재고자산 원가 산정 방법 및 평가 내역', '재고 평가표 (원가 계산 포함)', TRUE, 20),
(NULL, 'INVENTORY', 'INV-003', '재고 이동 내역', 'Inventory Movement Report', '감사기간 중 입고/출고/반품 내역', '재고 원장, 입출고 보고서', TRUE, 30),
(NULL, 'INVENTORY', 'INV-004', '진부화/저가법 평가', 'Obsolescence / Lower of Cost or NRV Analysis', '진부화 재고 목록 및 평가손실 산정', '저가법 적용 내역, 진부화 분석', TRUE, 40),
(NULL, 'INVENTORY', 'INV-005', '재고 보험 증권', 'Inventory Insurance Policies', '재고자산 관련 보험 가입 내역', '보험 증권 사본', TRUE, 50),

-- FIXED ASSETS / PPE
(NULL, 'PPE', 'PPE-001', '유형자산 명세서', 'Fixed Asset Register / Schedule', '유형자산 취득가액, 감가상각 누계액, 장부가액 명세', '고정자산 대장 (Excel)', TRUE, 10),
(NULL, 'PPE', 'PPE-002', '감가상각비 산정 내역', 'Depreciation Schedule', '내용연수, 상각방법별 감가상각비 계산', '상각비 계산 시트', TRUE, 20),
(NULL, 'PPE', 'PPE-003', '자본적지출 내역', 'Capital Expenditure Schedule', '당기 취득 자산 목록 및 자본/수익 판단 내역', '투자지출 내역서, 구매 계약서', TRUE, 30),
(NULL, 'PPE', 'PPE-004', '자산 처분 내역', 'Asset Disposal Schedule', '당기 처분 자산 목록, 처분가액 및 처분손익', '처분 내역서, 거래 증빙', TRUE, 40),
(NULL, 'PPE', 'PPE-005', '리스 계약서 및 사용권자산 명세', 'Lease Agreements & Right-of-Use Assets', 'IFRS16/K-IFRS 적용 리스 계약 및 사용권자산 명세', '리스 계약서, ROU 자산 계산 시트', TRUE, 50),
(NULL, 'PPE', 'PPE-006', '자산 보험 내역', 'Asset Insurance Schedule', '유형자산 보험 가입 현황', '보험 증권 목록', TRUE, 60),

-- ACCOUNTS PAYABLE
(NULL, 'AP', 'AP-001', '매입채무 연령 분석표', 'Accounts Payable Aging Schedule', '거래처별, 경과기간별 매입채무 명세', 'AP 연령분석표 (Excel)', TRUE, 10),
(NULL, 'AP', 'AP-002', '주요 거래처 잔액 확인서', 'Vendor Statement Reconciliations', '주요 매입처 잔액 확인 및 조정', '거래처 잔액 확인서, 원장 조정 내역', TRUE, 20),
(NULL, 'AP', 'AP-003', '미지급비용 명세서', 'Accrued Expenses Schedule', '기말 미지급비용 항목별 산정 내역', '미지급비용 명세표', TRUE, 30),
(NULL, 'AP', 'AP-004', '기말 후 지급 내역', 'Subsequent Disbursements', '기말 이후 지급된 채무 내역 (적시성 확인)', '지급 내역 (기말 후 1~2개월)', TRUE, 40),
(NULL, 'AP', 'AP-005', '미착품/입고미청구 내역', 'Goods Received Not Invoiced (GRNI)', '물건 입고 후 세금계산서 미수령 내역', 'GRNI 목록', TRUE, 50),

-- LONG-TERM DEBT
(NULL, 'DEBT', 'DEBT-001', '차입금 약정서', 'Loan Agreements', '모든 차입금 약정서 및 담보 내역', '금전소비대차계약서, 담보설정 서류', TRUE, 10),
(NULL, 'DEBT', 'DEBT-002', '차입금 상환 일정표', 'Debt Repayment Schedule', '원금 및 이자 상환 일정', '상환 스케줄 (Excel)', TRUE, 20),
(NULL, 'DEBT', 'DEBT-003', '이자비용 산정 내역', 'Interest Expense Calculation', '차입금별 이자율 및 이자비용 계산', '이자비용 계산 시트', TRUE, 30),
(NULL, 'DEBT', 'DEBT-004', '재무 약정 준수 확인서', 'Covenant Compliance Certificate', '재무 약정 조건 현황 및 준수 여부', '코버넌트 체크리스트', TRUE, 40),
(NULL, 'DEBT', 'DEBT-005', '사채 관련 서류', 'Bond / Debenture Documents', '회사채 발행 서류 및 상환 현황', '사채 등록증, 이자 지급 내역', TRUE, 50),

-- REVENUE
(NULL, 'REVENUE', 'REV-001', '매출 내역서', 'Revenue Summary by Product/Service', '제품/서비스/사업부문별 매출 집계', '매출 집계표 (월별, 제품별)', TRUE, 10),
(NULL, 'REVENUE', 'REV-002', '주요 매출 계약서', 'Key Sales Contracts', '중요 매출 거래 계약서 사본', '납품계약서, 용역계약서', TRUE, 20),
(NULL, 'REVENUE', 'REV-003', '수익인식 정책 문서', 'Revenue Recognition Policy', '수익인식 회계정책 설명 및 적용 사례', '정책 문서, 수익인식 검토 내역', TRUE, 30),
(NULL, 'REVENUE', 'REV-004', '선수금/계약부채 명세', 'Deferred Revenue / Contract Liabilities', '선수금 및 계약부채 잔액 및 변동 내역', '선수금 명세표', TRUE, 40),
(NULL, 'REVENUE', 'REV-005', '매출 기산일 검토 내역', 'Revenue Cutoff Testing', '기말 전후 매출 거래의 귀속기간 확인', '기산일 검토 목록 (기말 ±15일)', TRUE, 50),

-- PAYROLL
(NULL, 'PAYROLL', 'PAY-001', '급여 대장 (전 기간)', 'Payroll Register (Full Year)', '감사기간 전체 급여 지급 내역', '급여 대장 (월별 또는 연간 집계)', TRUE, 10),
(NULL, 'PAYROLL', 'PAY-002', '임직원 목록 및 보수 현황', 'Employee Listing with Compensation', '재직자/퇴직자 목록, 급여/상여 내역', '인사 명단, 연봉 계약서', TRUE, 20),
(NULL, 'PAYROLL', 'PAY-003', '퇴직급여 충당부채 산정', 'Retirement Benefit Obligation', '퇴직급여 충당부채 계산 내역 (보험수리)', '퇴직급여 계산표, 퇴직연금 운용 현황', TRUE, 30),
(NULL, 'PAYROLL', 'PAY-004', '성과급/인센티브 지급 내역', 'Bonus / Incentive Payments', '성과급, 인센티브 지급 기준 및 내역', '성과급 지급 내역서', TRUE, 40),
(NULL, 'PAYROLL', 'PAY-005', '원천세 신고서', 'Payroll Tax Returns / Withholding Tax', '소득세, 4대보험 납부 내역 및 신고서', '원천세 신고서, 납부 영수증', TRUE, 50),

-- INCOME TAX
(NULL, 'TAX', 'TAX-001', '법인세 신고서', 'Corporate Income Tax Returns', '감사 사업연도 법인세 신고서 (과세표준 및 세액)', '법인세 신고서, 세무조정계산서', TRUE, 10),
(NULL, 'TAX', 'TAX-002', '이연법인세 계산 내역', 'Deferred Tax Calculation', '일시적차이, 이연법인세자산/부채 산정', '이연법인세 계산 시트', TRUE, 20),
(NULL, 'TAX', 'TAX-003', '세금 납부 확인서', 'Tax Payment Receipts', '각종 세금 납부 영수증 및 확인서', '납부 영수증 (법인세, 부가세 등)', TRUE, 30),
(NULL, 'TAX', 'TAX-004', '세무조사 및 과세 통지', 'Tax Notices & Correspondence', '세무조사 결과, 경정청구, 과세 관련 서신', '세무 서신, 결정통지서', TRUE, 40),
(NULL, 'TAX', 'TAX-005', '이전가격 관련 서류', 'Transfer Pricing Documentation', '특수관계자 거래 이전가격 분석 서류', '이전가격 보고서, 정상가격 산출 근거', TRUE, 50),

-- EQUITY
(NULL, 'EQUITY', 'EQ-001', '자본 변동표', 'Statement of Changes in Equity', '자본금, 자본잉여금, 이익잉여금 변동 내역', '자본 변동표 명세', TRUE, 10),
(NULL, 'EQUITY', 'EQ-002', '주주 명부', 'Shareholder Register', '기말 기준 주주 명부 및 지분율', '주주 명부 (주식 수, 지분율)', TRUE, 20),
(NULL, 'EQUITY', 'EQ-003', '배당 지급 내역', 'Dividend Distribution Records', '당기 배당 결의 및 지급 내역', '배당 결의서, 지급 내역', TRUE, 30),
(NULL, 'EQUITY', 'EQ-004', '주식매수선택권 현황', 'Stock Option / Warrant Schedule', '스톡옵션 부여, 행사, 소멸 내역', '스톡옵션 명세서', TRUE, 40),
(NULL, 'EQUITY', 'EQ-005', '자기주식 현황', 'Treasury Stock Schedule', '자기주식 취득, 처분, 소각 내역', '자기주식 명세서', TRUE, 50),

-- OTHER FINANCIAL
(NULL, 'OTHER', 'OTH-001', '우발부채 및 약정 현황', 'Contingencies & Commitments', '소송, 보증, 약정 등 우발부채 현황', '소송 목록, 법률의견서, 약정서', TRUE, 10),
(NULL, 'OTHER', 'OTH-002', '후속 사건 확인서', 'Post-Balance Sheet Events', '기말 후 주요 사건 (중요 계약, 소송 등)', '후속사건 확인 메모', TRUE, 20),
(NULL, 'OTHER', 'OTH-003', '경영자 확인서', 'Management Representation Letter', '경영진의 재무제표 적정성 확인서', '경영자 확인서 (감사인 양식 제공)', TRUE, 30),
(NULL, 'OTHER', 'OTH-004', '보험 현황', 'Insurance Schedule', '자산, 배상책임 등 보험 가입 현황', '보험 증권 목록', TRUE, 40),
(NULL, 'OTHER', 'OTH-005', '내부통제 관련 서류', 'Internal Control Documentation', '내부통제 정책, 절차 문서', 'IT 통제, 결재 절차 문서', TRUE, 50)
ON CONFLICT (firm_id, pbc_code) DO NOTHING;

-- Comment for reference
COMMENT ON TABLE pbc_codes IS 'PBC (Prepared by Client) code master - system and firm-level codes';
COMMENT ON TABLE firm_settings IS 'Firm-level configuration settings including engagement code pattern';
COMMENT ON TABLE engagement_sequences IS 'Sequence counters for auto-generating engagement codes';
