-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===== FIRM & TENANT MANAGEMENT =====

CREATE TABLE firms (
    firm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_code VARCHAR(50) NOT NULL,
    firm_name VARCHAR(200) NOT NULL,
    domain_prefix VARCHAR(100) NOT NULL,
    storage_strategy VARCHAR(20) NOT NULL CHECK (storage_strategy IN ('SHARED', 'PRIVATE')),
    billing_status VARCHAR(30) NOT NULL DEFAULT 'TRIAL',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    default_locale VARCHAR(20) NOT NULL DEFAULT 'en-US',
    default_timezone VARCHAR(100) NOT NULL DEFAULT 'America/New_York',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NULL,
    updated_by UUID NULL,
    UNIQUE (firm_code),
    UNIQUE (domain_prefix)
);

CREATE TABLE storage_configs (
    storage_config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    provider_type VARCHAR(50) NOT NULL DEFAULT 'M365_SHAREPOINT',
    storage_strategy VARCHAR(20) NOT NULL CHECK (storage_strategy IN ('SHARED', 'PRIVATE')),
    tenant_id VARCHAR(100) NOT NULL,
    client_id VARCHAR(100) NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    secret_version INTEGER NOT NULL DEFAULT 1,
    base_site_id TEXT NOT NULL,
    base_drive_id TEXT NOT NULL,
    base_site_url TEXT NULL,
    base_relative_path TEXT NOT NULL DEFAULT '/Shared Documents/PBC',
    permission_mode VARCHAR(50) NOT NULL DEFAULT 'SITES_SELECTED',
    connection_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    provisioning_status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED',
    last_tested_at TIMESTAMPTZ NULL,
    last_test_result VARCHAR(30) NULL,
    last_test_detail_json JSONB NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_storage_configs_firm_active UNIQUE (firm_id, is_active)
);

CREATE TABLE firm_brandings (
    firm_branding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    portal_display_name VARCHAR(200) NOT NULL,
    logo_url TEXT NULL,
    favicon_url TEXT NULL,
    primary_color VARCHAR(20) NULL,
    secondary_color VARCHAR(20) NULL,
    login_background_image_url TEXT NULL,
    support_email VARCHAR(255) NULL,
    support_phone VARCHAR(50) NULL,
    email_from_name VARCHAR(200) NULL,
    email_footer_text TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (firm_id)
);

CREATE TABLE firm_domains (
    firm_domain_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    subdomain VARCHAR(100) NULL,
    custom_domain VARCHAR(255) NULL,
    domain_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    ssl_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    dns_validation_token VARCHAR(255) NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subdomain),
    UNIQUE (custom_domain)
);

CREATE TABLE firm_storage_policies (
    storage_policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    stored_filename_rule_code VARCHAR(50) NOT NULL DEFAULT 'DOCNO_ORIGINAL',
    stored_filename_template TEXT NOT NULL DEFAULT '{doc_no}_{original_filename}',
    path_rule_code VARCHAR(50) NOT NULL DEFAULT 'YEAR_ENGAGEMENT',
    path_template TEXT NOT NULL DEFAULT '/{fiscal_year}_{engagement_code}',
    status_prefix_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    approved_prefix VARCHAR(50) NOT NULL DEFAULT '[Approved]_',
    pending_prefix VARCHAR(50) NOT NULL DEFAULT '[Pending]_',
    rejected_prefix VARCHAR(50) NOT NULL DEFAULT '[Rejected]_',
    rename_on_status_change BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (firm_id)
);

-- ===== COMPANY & BUSINESS ENTITY =====

CREATE TABLE companies (
    company_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    company_code VARCHAR(50) NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    external_customer_code VARCHAR(100) NULL,
    industry_code VARCHAR(50) NULL,
    fiscal_year_end_mmdd VARCHAR(5) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (firm_id, company_code)
);

-- ===== USER & ACCESS CONTROL =====

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    user_type VARCHAR(30) NOT NULL,
    auth_provider VARCHAR(50) NOT NULL DEFAULT 'LOCAL',
    auth_subject VARCHAR(255) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (firm_id, email)
);

-- ===== TEMPLATES =====

CREATE TABLE templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    template_code VARCHAR(50) NOT NULL,
    template_name VARCHAR(200) NOT NULL,
    fiscal_year_type VARCHAR(30) NULL,
    version_no INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (firm_id, template_code, version_no)
);

CREATE TABLE template_items (
    template_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    template_id UUID NOT NULL REFERENCES templates(template_id),
    doc_no VARCHAR(50) NOT NULL,
    item_title VARCHAR(300) NOT NULL,
    item_description TEXT NULL,
    required_flag BOOLEAN NOT NULL DEFAULT TRUE,
    allow_multiple_files BOOLEAN NOT NULL DEFAULT FALSE,
    due_day_offset INTEGER NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (firm_id, template_id, doc_no)
);

-- ===== ENGAGEMENT & REQUEST =====

CREATE TABLE engagements (
    engagement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    company_id UUID NOT NULL REFERENCES companies(company_id),
    template_id UUID NULL REFERENCES templates(template_id),
    engagement_code VARCHAR(100) NOT NULL,
    engagement_name VARCHAR(300) NOT NULL,
    fiscal_year INTEGER NOT NULL,
    due_date DATE NULL,
    engagement_status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    notes_internal TEXT NULL,
    notes_client TEXT NULL,
    sharepoint_folder_path TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (firm_id, engagement_code)
);

CREATE TABLE request_items (
    request_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    engagement_id UUID NOT NULL REFERENCES engagements(engagement_id),
    template_item_id UUID NULL REFERENCES template_items(template_item_id),
    doc_no VARCHAR(50) NOT NULL,
    item_title VARCHAR(300) NOT NULL,
    item_description TEXT NULL,
    required_flag BOOLEAN NOT NULL DEFAULT TRUE,
    allow_multiple_files BOOLEAN NOT NULL DEFAULT FALSE,
    item_status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED',
    due_date DATE NULL,
    uploaded_files_count INTEGER NOT NULL DEFAULT 0,
    last_uploaded_at TIMESTAMPTZ NULL,
    last_uploaded_by UUID NULL,
    client_marked_complete_at TIMESTAMPTZ NULL,
    reviewed_at TIMESTAMPTZ NULL,
    reviewed_by UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (firm_id, engagement_id, doc_no)
);

CREATE TABLE request_item_files (
    request_item_file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    company_id UUID NOT NULL REFERENCES companies(company_id),
    engagement_id UUID NOT NULL REFERENCES engagements(engagement_id),
    request_item_id UUID NOT NULL REFERENCES request_items(request_item_id),
    original_filename TEXT NOT NULL,
    original_extension VARCHAR(20) NULL,
    mime_type VARCHAR(255) NULL,
    file_size_bytes BIGINT NOT NULL,
    stored_filename_rule_code VARCHAR(50) NOT NULL,
    stored_filename_template TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    storage_relative_path TEXT NOT NULL,
    storage_provider_type VARCHAR(50) NOT NULL DEFAULT 'M365_SHAREPOINT',
    sharepoint_site_id TEXT NULL,
    sharepoint_drive_id TEXT NULL,
    sharepoint_item_id TEXT NULL,
    sharepoint_web_url TEXT NULL,
    etag TEXT NULL,
    checksum_sha256 TEXT NULL,
    upload_mode VARCHAR(30) NOT NULL DEFAULT 'SIMPLE',
    upload_status VARCHAR(30) NOT NULL DEFAULT 'SESSION_CREATED',
    upload_session_id TEXT NULL,
    upload_session_url TEXT NULL,
    upload_offset_bytes BIGINT NOT NULL DEFAULT 0,
    resumable_status VARCHAR(30) NOT NULL DEFAULT 'NOT_APPLICABLE',
    session_expires_at TIMESTAMPTZ NULL,
    is_latest_version BOOLEAN NOT NULL DEFAULT TRUE,
    version_no INTEGER NOT NULL DEFAULT 1,
    uploaded_by UUID NULL,
    uploaded_at TIMESTAMPTZ NULL,
    approved_name_sync_status VARCHAR(30) NOT NULL DEFAULT 'NOT_APPLIED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE request_item_comments (
    request_item_comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    engagement_id UUID NOT NULL REFERENCES engagements(engagement_id),
    request_item_id UUID NOT NULL REFERENCES request_items(request_item_id),
    author_user_id UUID NOT NULL REFERENCES users(user_id),
    comment_visibility VARCHAR(30) NOT NULL DEFAULT 'CLIENT_VISIBLE',
    comment_type VARCHAR(30) NOT NULL DEFAULT 'TEXT',
    comment_body TEXT NOT NULL,
    parent_comment_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== PROVISIONING & OPERATIONS =====

CREATE TABLE provisioning_jobs (
    provisioning_job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    storage_config_id UUID NOT NULL REFERENCES storage_configs(storage_config_id),
    job_type VARCHAR(50) NOT NULL,
    requested_by UUID NULL,
    job_status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
    current_step VARCHAR(100) NULL,
    step_status_json JSONB NULL,
    request_payload_json JSONB NULL,
    result_payload_json JSONB NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    failure_code VARCHAR(100) NULL,
    failure_message TEXT NULL,
    failure_detail_json JSONB NULL,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE provisioning_error_logs (
    provisioning_error_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provisioning_job_id UUID NOT NULL REFERENCES provisioning_jobs(provisioning_job_id),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    step_name VARCHAR(100) NOT NULL,
    step_order INTEGER NOT NULL,
    error_code VARCHAR(100) NULL,
    error_category VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    error_detail_json JSONB NULL,
    http_status_code INTEGER NULL,
    graph_request_id VARCHAR(100) NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE storage_reconciliation_jobs (
    reconciliation_job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    request_item_file_id UUID NULL REFERENCES request_item_files(request_item_file_id),
    storage_config_id UUID NOT NULL REFERENCES storage_configs(storage_config_id),
    job_type VARCHAR(50) NOT NULL,
    job_status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
    target_path TEXT NULL,
    target_sharepoint_item_id TEXT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error_message TEXT NULL,
    payload_json JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL
);

-- ===== AUDIT & LOGGING =====

CREATE TABLE audit_logs (
    audit_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(firm_id),
    actor_user_id UUID NULL REFERENCES users(user_id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NULL,
    action_type VARCHAR(50) NOT NULL,
    action_result VARCHAR(30) NOT NULL,
    request_id UUID NULL,
    source_ip INET NULL,
    summary TEXT NOT NULL,
    detail_json JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== INDEXES =====

CREATE INDEX idx_companies_firm_status ON companies (firm_id, status);
CREATE INDEX idx_users_firm_status ON users (firm_id, status);
CREATE INDEX idx_engagements_firm_company ON engagements (firm_id, company_id);
CREATE INDEX idx_engagements_firm_status ON engagements (firm_id, engagement_status);
CREATE INDEX idx_request_items_firm_engagement ON request_items (firm_id, engagement_id);
CREATE INDEX idx_request_items_firm_status ON request_items (firm_id, item_status);
CREATE INDEX idx_request_item_files_firm_request_item ON request_item_files (firm_id, request_item_id);
CREATE INDEX idx_request_item_files_firm_status ON request_item_files (firm_id, upload_status);
CREATE INDEX idx_request_item_files_firm_session ON request_item_files (firm_id, upload_session_id);
CREATE INDEX idx_comments_firm_request_item ON request_item_comments (firm_id, request_item_id, created_at DESC);
CREATE INDEX idx_audit_logs_firm_created ON audit_logs (firm_id, created_at DESC);
CREATE INDEX idx_provisioning_jobs_firm_status ON provisioning_jobs (firm_id, job_status, created_at DESC);
CREATE INDEX idx_provisioning_error_logs_job_step ON provisioning_error_logs (provisioning_job_id, step_order);
CREATE INDEX idx_reconciliation_jobs_firm_status ON storage_reconciliation_jobs (firm_id, job_status, created_at DESC);
