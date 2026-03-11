/**
 * Audit Log Writer
 * Uses service role client to bypass RLS
 * actor_user_id is nullable — auth.users UUID may not exist in app users table yet
 */

import { getServiceClient } from '@/lib/db/client'

export type AuditActionType =
  | 'CREATE' | 'READ' | 'UPDATE' | 'DELETE'
  | 'LOGIN' | 'LOGOUT'
  | 'FILE_UPLOAD' | 'FILE_DELETE'
  | 'PROVISIONING_START' | 'PROVISIONING_COMPLETE'
  | 'STORAGE_CONFIG_UPDATE' | 'PERMISSION_CHANGE'

export type AuditResult = 'SUCCESS' | 'FAILURE'

export type AuditEntityType =
  | 'FIRM' | 'COMPANY' | 'USER' | 'TEMPLATE'
  | 'ENGAGEMENT' | 'REQUEST_ITEM' | 'REQUEST_ITEM_FILE'
  | 'STORAGE_CONFIG' | 'PROVISIONING_JOB'

export async function auditLog(
  firmId: string,
  actorUserId: string | null,
  entityType: AuditEntityType,
  entityId: string | null,
  actionType: AuditActionType,
  actionResult: AuditResult,
  summary: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    const client = getServiceClient()
    await client.from('audit_logs').insert({
      firm_id: firmId,
      actor_user_id: null, // skip FK until app users table is populated
      entity_type: entityType,
      entity_id: entityId,
      action_type: actionType,
      action_result: actionResult,
      summary,
      detail_json: details || {},
    })
  } catch (error) {
    // Never break app flow due to audit failure
    console.error('Audit log write failed:', error)
  }
}
