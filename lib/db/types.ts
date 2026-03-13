/**
 * Complete TypeScript interfaces for all database tables
 * Organized by domain area
 */

// ===== FIRM & TENANT MANAGEMENT =====

export interface Firm {
  firm_id: string
  firm_code: string
  firm_name: string
  domain_prefix: string
  storage_strategy: 'SHARED' | 'PRIVATE'
  billing_status: string
  status: string
  default_locale: string
  default_timezone: string
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface StorageConfig {
  storage_config_id: string
  firm_id: string
  provider_type: 'M365_SHAREPOINT'
  storage_strategy: 'SHARED' | 'PRIVATE'
  tenant_id: string
  client_id: string
  client_secret_encrypted: string
  secret_version: number
  base_site_id: string
  base_drive_id: string
  base_site_url: string | null
  base_relative_path: string
  permission_mode: string
  connection_status: 'PENDING' | 'CONNECTED' | 'FAILED'
  provisioning_status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  last_tested_at: string | null
  last_test_result: string | null
  last_test_detail_json: Record<string, any> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface FirmBranding {
  firm_branding_id: string
  firm_id: string
  portal_display_name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string | null
  secondary_color: string | null
  login_background_image_url: string | null
  support_email: string | null
  support_phone: string | null
  email_from_name: string | null
  email_footer_text: string | null
  created_at: string
  updated_at: string
}

export interface FirmDomain {
  firm_domain_id: string
  firm_id: string
  subdomain: string | null
  custom_domain: string | null
  domain_status: 'PENDING' | 'VERIFIED' | 'FAILED'
  ssl_status: 'PENDING' | 'ISSUED' | 'FAILED'
  dns_validation_token: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface FirmStoragePolicy {
  storage_policy_id: string
  firm_id: string
  stored_filename_rule_code: string
  stored_filename_template: string
  path_rule_code: string
  path_template: string
  status_prefix_sync_enabled: boolean
  approved_prefix: string
  pending_prefix: string
  rejected_prefix: string
  rename_on_status_change: boolean
  created_at: string
  updated_at: string
}

// ===== COMPANY & BUSINESS ENTITY =====

export interface Company {
  company_id: string
  firm_id: string
  company_code: string
  company_name: string
  external_customer_code: string | null
  industry_code: string | null
  fiscal_year_end_mmdd: string | null
  status: string
  created_at: string
  updated_at: string
}

// ===== USER & ACCESS CONTROL =====

export interface AppUser {
  user_id: string
  firm_id: string
  company_id: string | null
  email: string
  display_name: string
  user_type: 'PLATFORM_ADMIN' | 'FIRM_ADMIN' | 'FIRM_STAFF' | 'CLIENT_USER'
  auth_provider: string
  auth_subject: string | null
  status: string
  last_login_at: string | null
  created_at: string
  updated_at: string
}

// ===== TEMPLATES =====

export interface Template {
  template_id: string
  firm_id: string
  template_code: string
  template_name: string
  fiscal_year_type: string | null
  version_no: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TemplateItem {
  template_item_id: string
  firm_id: string
  template_id: string
  doc_no: string
  item_title: string
  item_description: string | null
  required_flag: boolean
  allow_multiple_files: boolean
  due_day_offset: number | null
  display_order: number
  status: string
  created_at: string
  updated_at: string
}

// ===== ENGAGEMENT & REQUEST =====

export interface Engagement {
  engagement_id: string
  firm_id: string
  company_id: string
  template_id: string | null
  engagement_code: string
  engagement_name: string
  fiscal_year: number
  due_date: string | null
  engagement_status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'ARCHIVED'
  notes_internal: string | null
  notes_client: string | null
  sharepoint_folder_path: string | null
  created_at: string
  updated_at: string
}

export interface RequestItem {
  request_item_id: string
  firm_id: string
  engagement_id: string
  template_item_id: string | null
  doc_no: string
  item_title: string
  item_description: string | null
  required_flag: boolean
  allow_multiple_files: boolean
  item_status: 'REQUESTED' | 'UPLOADED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
  due_date: string | null
  uploaded_files_count: number
  last_uploaded_at: string | null
  last_uploaded_by: string | null
  client_marked_complete_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
}

export interface RequestItemFile {
  request_item_file_id: string
  firm_id: string
  company_id: string
  engagement_id: string
  request_item_id: string
  original_filename: string
  original_extension: string | null
  mime_type: string | null
  file_size_bytes: number
  stored_filename_rule_code: string
  stored_filename_template: string
  stored_filename: string
  storage_relative_path: string
  storage_provider_type: 'M365_SHAREPOINT' | 'SUPABASE_STORAGE'
  sharepoint_site_id: string | null
  sharepoint_drive_id: string | null
  sharepoint_item_id: string | null
  sharepoint_web_url: string | null
  etag: string | null
  checksum_sha256: string | null
  upload_mode: 'SIMPLE' | 'RESUMABLE'
  upload_status: 'SESSION_CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  upload_session_id: string | null
  upload_session_url: string | null
  upload_offset_bytes: number
  resumable_status: 'NOT_APPLICABLE' | 'ACTIVE' | 'EXPIRED' | 'FAILED'
  session_expires_at: string | null
  is_latest_version: boolean
  version_no: number
  uploaded_by: string | null
  uploaded_at: string | null
  approved_name_sync_status: 'NOT_APPLIED' | 'APPLIED' | 'FAILED'
  created_at: string
  updated_at: string
}

export interface RequestItemComment {
  request_item_comment_id: string
  firm_id: string
  engagement_id: string
  request_item_id: string
  author_user_id: string
  comment_visibility: 'CLIENT_VISIBLE' | 'INTERNAL_ONLY'
  comment_type: 'TEXT' | 'STATUS_CHANGE' | 'FILE_UPLOAD'
  comment_body: string
  parent_comment_id: string | null
  created_at: string
  updated_at: string
}

// ===== PROVISIONING & OPERATIONS =====

export interface ProvisioningJob {
  provisioning_job_id: string
  firm_id: string
  storage_config_id: string
  job_type: string
  requested_by: string | null
  job_status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  current_step: string | null
  step_status_json: Record<string, any> | null
  request_payload_json: Record<string, any> | null
  result_payload_json: Record<string, any> | null
  retry_count: number
  failure_code: string | null
  failure_message: string | null
  failure_detail_json: Record<string, any> | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface ProvisioningErrorLog {
  provisioning_error_log_id: string
  provisioning_job_id: string
  firm_id: string
  step_name: string
  step_order: number
  error_code: string | null
  error_category: string
  error_message: string
  error_detail_json: Record<string, any> | null
  http_status_code: number | null
  graph_request_id: string | null
  occurred_at: string
}

export interface StorageReconciliationJob {
  reconciliation_job_id: string
  firm_id: string
  request_item_file_id: string | null
  storage_config_id: string
  job_type: string
  job_status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  target_path: string | null
  target_sharepoint_item_id: string | null
  retry_count: number
  last_error_message: string | null
  payload_json: Record<string, any> | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

// ===== AUDIT & LOGGING =====

export interface AuditLog {
  audit_log_id: string
  firm_id: string
  actor_user_id: string | null
  entity_type: string
  entity_id: string | null
  action_type: string
  action_result: 'SUCCESS' | 'FAILURE'
  request_id: string | null
  source_ip: string | null
  summary: string
  detail_json: Record<string, any> | null
  created_at: string
}
