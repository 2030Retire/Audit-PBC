/**
 * Provisioning Orchestrator
 * Main orchestration for multi-step provisioning process
 * Steps: test credentials, verify site, create library, create folders, test upload
 * Logs each step and failure to provisioning_error_logs
 */

import { Client } from '@microsoft/microsoft-graph-client'
import { getSupabaseClient, ScopedQuery } from '@/lib/db/client'
import {
  StorageConfig,
  ProvisioningJob,
  ProvisioningErrorLog,
  Firm,
} from '@/lib/db/types'
import { StorageConfigResolver } from '@/lib/graph/StorageConfigResolver'
import { createGraphClient, getGraphToken } from '@/lib/graph/GraphClientFactory'
import { auditLog } from '@/lib/utils/auditLogger'

export enum ProvisioningStep {
  CREDENTIALS_TEST = 'credentials_test',
  SITE_ACCESS = 'site_access',
  DRIVE_ACCESS = 'drive_access',
  BASE_PATH_CREATE = 'base_path_create',
  ROOT_FOLDER_CREATE = 'root_folder_create',
  TEST_UPLOAD = 'test_upload',
}

export interface ProvisioningJobRequest {
  job_type: 'INITIAL_SETUP' | 'RETEST' | 'MIGRATION'
  create_new_site?: boolean
  site_name?: string
  initialize_default_folders?: boolean
  run_test_upload?: boolean
}

export interface DiagnosticResult {
  auth_status: string
  site_access_status: string
  drive_access_status: string
  base_path_status: string
  upload_test_status: string
  diagnosis_messages: string[]
  tested_at: string
}

export class ProvisioningOrchestrator {
  /**
   * Create and execute provisioning job
   */
  static async provision(
    firmId: string,
    storageConfigId: string,
    request: ProvisioningJobRequest,
    requestedByUserId?: string
  ): Promise<ProvisioningJob> {
    const client = await getSupabaseClient()
    const query = new ScopedQuery(client)

    // Create job record
    const job = await query.insert<ProvisioningJob>(
      'provisioning_jobs',
      firmId,
      {
        storage_config_id: storageConfigId,
        job_type: request.job_type,
        requested_by: requestedByUserId,
        job_status: 'QUEUED',
        request_payload_json: request,
        retry_count: 0,
      }
    )

    // Execute provisioning steps
    try {
      const storageConfig = await StorageConfigResolver.resolve(firmId)
      await this.executeSteps(
        client,
        firmId,
        job.provisioning_job_id,
        storageConfig,
        request
      )

      // Update job status
      await query.update<ProvisioningJob>(
        'provisioning_jobs',
        firmId,
        job.provisioning_job_id,
        {
          job_status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        'provisioning_job_id'
      )

      // Audit
      await auditLog(
        firmId,
        requestedByUserId || null,
        'PROVISIONING_JOB',
        job.provisioning_job_id,
        'PROVISIONING_COMPLETE',
        'SUCCESS',
        `Provisioning completed for ${request.job_type}`
      )
    } catch (error) {
      // Update job status
      await query.update<ProvisioningJob>(
        'provisioning_jobs',
        firmId,
        job.provisioning_job_id,
        {
          job_status: 'FAILED',
          failure_code: 'PROVISIONING_FAILED',
          failure_message: error instanceof Error ? error.message : String(error),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        'provisioning_job_id'
      )

      // Audit
      await auditLog(
        firmId,
        requestedByUserId || null,
        'PROVISIONING_JOB',
        job.provisioning_job_id,
        'PROVISIONING_START',
        'FAILURE',
        `Provisioning failed: ${error}`,
        { error: String(error) }
      )

      throw error
    }

    return job
  }

  /**
   * Execute provisioning steps
   */
  private static async executeSteps(
    supabaseClient: any,
    firmId: string,
    jobId: string,
    storageConfig: StorageConfig,
    request: ProvisioningJobRequest
  ): Promise<void> {
    const query = new ScopedQuery(supabaseClient)

    // Step 1: Test credentials
    try {
      await this.stepTestCredentials(storageConfig, jobId, firmId)
      await this.updateJobStep(query, firmId, jobId, ProvisioningStep.CREDENTIALS_TEST, 'COMPLETED')
    } catch (error) {
      await this.logError(
        query,
        firmId,
        jobId,
        ProvisioningStep.CREDENTIALS_TEST,
        1,
        'AUTH_FAILED',
        error
      )
      throw error
    }

    // Step 2: Verify site access
    try {
      const graphClient = await createGraphClient(storageConfig)
      await this.stepVerifySiteAccess(graphClient, storageConfig, jobId, firmId)
      await this.updateJobStep(query, firmId, jobId, ProvisioningStep.SITE_ACCESS, 'COMPLETED')
    } catch (error) {
      await this.logError(
        query,
        firmId,
        jobId,
        ProvisioningStep.SITE_ACCESS,
        2,
        'SITE_ACCESS_FAILED',
        error
      )
      throw error
    }

    // Step 3: Verify drive access
    try {
      const graphClient = await createGraphClient(storageConfig)
      await this.stepVerifyDriveAccess(graphClient, storageConfig, jobId, firmId)
      await this.updateJobStep(query, firmId, jobId, ProvisioningStep.DRIVE_ACCESS, 'COMPLETED')
    } catch (error) {
      await this.logError(
        query,
        firmId,
        jobId,
        ProvisioningStep.DRIVE_ACCESS,
        3,
        'DRIVE_ACCESS_FAILED',
        error
      )
      throw error
    }

    // Step 4: Create or verify base path
    try {
      const graphClient = await createGraphClient(storageConfig)
      await this.stepCreateBasePath(graphClient, storageConfig, jobId, firmId)
      await this.updateJobStep(query, firmId, jobId, ProvisioningStep.BASE_PATH_CREATE, 'COMPLETED')
    } catch (error) {
      await this.logError(
        query,
        firmId,
        jobId,
        ProvisioningStep.BASE_PATH_CREATE,
        4,
        'BASE_PATH_FAILED',
        error
      )
      throw error
    }

    // Step 5: Create root folder (optional)
    if (request.initialize_default_folders) {
      try {
        const graphClient = await createGraphClient(storageConfig)
        await this.stepCreateRootFolder(graphClient, storageConfig, jobId, firmId)
        await this.updateJobStep(query, firmId, jobId, ProvisioningStep.ROOT_FOLDER_CREATE, 'COMPLETED')
      } catch (error) {
        await this.logError(
          query,
          firmId,
          jobId,
          ProvisioningStep.ROOT_FOLDER_CREATE,
          5,
          'FOLDER_CREATE_FAILED',
          error
        )
        throw error
      }
    }

    // Step 6: Test upload (optional)
    if (request.run_test_upload) {
      try {
        const graphClient = await createGraphClient(storageConfig)
        await this.stepTestUpload(graphClient, storageConfig, jobId, firmId)
        await this.updateJobStep(query, firmId, jobId, ProvisioningStep.TEST_UPLOAD, 'COMPLETED')
      } catch (error) {
        await this.logError(
          query,
          firmId,
          jobId,
          ProvisioningStep.TEST_UPLOAD,
          6,
          'UPLOAD_TEST_FAILED',
          error
        )
        throw error
      }
    }
  }

  /**
   * Step 1: Test credentials
   */
  private static async stepTestCredentials(
    storageConfig: StorageConfig,
    jobId: string,
    firmId: string
  ): Promise<void> {
    try {
      const token = await getGraphToken(storageConfig)
      if (!token) {
        throw new Error('Failed to obtain Graph API token')
      }
    } catch (error) {
      throw new Error(`Credential test failed: ${error}`)
    }
  }

  /**
   * Step 2: Verify site access
   */
  private static async stepVerifySiteAccess(
    graphClient: Client,
    storageConfig: StorageConfig,
    jobId: string,
    firmId: string
  ): Promise<void> {
    try {
      const response = await graphClient
        .api(`/sites/${storageConfig.base_site_id}`)
        .get()

      if (!response.id) {
        throw new Error('Site not found or no access')
      }
    } catch (error) {
      throw new Error(`Site access failed: ${error}`)
    }
  }

  /**
   * Step 3: Verify drive access
   */
  private static async stepVerifyDriveAccess(
    graphClient: Client,
    storageConfig: StorageConfig,
    jobId: string,
    firmId: string
  ): Promise<void> {
    try {
      const response = await graphClient
        .api(`/drives/${storageConfig.base_drive_id}`)
        .get()

      if (!response.id) {
        throw new Error('Drive not found or no access')
      }
    } catch (error) {
      throw new Error(`Drive access failed: ${error}`)
    }
  }

  /**
   * Step 4: Create or verify base path
   */
  private static async stepCreateBasePath(
    graphClient: Client,
    storageConfig: StorageConfig,
    jobId: string,
    firmId: string
  ): Promise<void> {
    try {
      const path = storageConfig.base_relative_path
      // Try to access the path
      const response = await graphClient
        .api(`/drives/${storageConfig.base_drive_id}/root:${path}`)
        .get()
        .catch(() => null)

      if (!response) {
        // Path doesn't exist, try to create it
        const pathParts = path.split('/').filter(p => p)
        let currentPath = ''

        for (const part of pathParts) {
          currentPath += '/' + part
          await graphClient
            .api(
              `/drives/${storageConfig.base_drive_id}/root:${currentPath}:/children`
            )
            .post({
              name: part,
              folder: {},
            })
            .catch(() => {
              // Folder might already exist
            })
        }
      }
    } catch (error) {
      throw new Error(`Base path creation failed: ${error}`)
    }
  }

  /**
   * Step 5: Create root folder
   */
  private static async stepCreateRootFolder(
    graphClient: Client,
    storageConfig: StorageConfig,
    jobId: string,
    firmId: string
  ): Promise<void> {
    try {
      const basePath = storageConfig.base_relative_path
      const rootFolderPath = `${basePath}/root`

      await graphClient
        .api(
          `/drives/${storageConfig.base_drive_id}/root:${rootFolderPath}:/children`
        )
        .post({
          name: 'root',
          folder: {},
        })
        .catch(() => {
          // Folder might already exist
        })
    } catch (error) {
      throw new Error(`Root folder creation failed: ${error}`)
    }
  }

  /**
   * Step 6: Test upload
   */
  private static async stepTestUpload(
    graphClient: Client,
    storageConfig: StorageConfig,
    jobId: string,
    firmId: string
  ): Promise<void> {
    try {
      const testFilePath = `${storageConfig.base_relative_path}/test_${Date.now()}.txt`
      const testContent = Buffer.from('Provisioning test upload')

      await graphClient
        .api(`/drives/${storageConfig.base_drive_id}/root:${testFilePath}:/content`)
        .put(testContent)

      // Clean up test file
      await graphClient
        .api(`/drives/${storageConfig.base_drive_id}/root:${testFilePath}`)
        .delete()
        .catch(() => {
          // Ignore cleanup errors
        })
    } catch (error) {
      throw new Error(`Test upload failed: ${error}`)
    }
  }

  /**
   * Update job step status
   */
  private static async updateJobStep(
    query: any,
    firmId: string,
    jobId: string,
    step: string,
    status: string
  ): Promise<void> {
    const stepStatusJson = {
      current_step: step,
      step_completed_at: new Date().toISOString(),
      status,
    }

    await query.update(
      'provisioning_jobs',
      firmId,
      jobId,
      {
        current_step: step,
        step_status_json: stepStatusJson,
        job_status: 'IN_PROGRESS',
        updated_at: new Date().toISOString(),
      },
      'provisioning_job_id'
    )
  }

  /**
   * Log provisioning error
   */
  private static async logError(
    query: any,
    firmId: string,
    jobId: string,
    stepName: string,
    stepOrder: number,
    errorCode: string,
    error: any
  ): Promise<void> {
    await query.insert('provisioning_error_logs', firmId, {
      provisioning_job_id: jobId,
      step_name: stepName,
      step_order: stepOrder,
      error_code: errorCode,
      error_category: 'PROVISIONING_STEP_FAILURE',
      error_message: error instanceof Error ? error.message : String(error),
      error_detail_json: { raw_error: String(error) },
      occurred_at: new Date().toISOString(),
    })
  }

  /**
   * Run diagnostics without provisioning
   */
  static async runDiagnostics(
    firmId: string,
    storageConfigId: string
  ): Promise<DiagnosticResult> {
    const messages: string[] = []
    const results: Record<string, string> = {
      auth_status: 'FAILED',
      site_access_status: 'FAILED',
      drive_access_status: 'FAILED',
      base_path_status: 'FAILED',
      upload_test_status: 'FAILED',
    }

    try {
      const storageConfig = await StorageConfigResolver.resolve(firmId)

      // Test 1: Credentials
      try {
        const token = await getGraphToken(storageConfig)
        results.auth_status = 'SUCCESS'
        messages.push('✓ Credentials are valid')
      } catch (error) {
        messages.push(`✗ Credential test failed: ${error}`)
      }

      // Test 2: Site access
      try {
        const graphClient = await createGraphClient(storageConfig)
        await graphClient
          .api(`/sites/${storageConfig.base_site_id}`)
          .get()

        results.site_access_status = 'SUCCESS'
        messages.push('✓ Site access verified')
      } catch (error) {
        messages.push(`✗ Site access failed: ${error}`)
      }

      // Test 3: Drive access
      try {
        const graphClient = await createGraphClient(storageConfig)
        await graphClient
          .api(`/drives/${storageConfig.base_drive_id}`)
          .get()

        results.drive_access_status = 'SUCCESS'
        messages.push('✓ Drive access verified')
      } catch (error) {
        messages.push(`✗ Drive access failed: ${error}`)
      }

      // Test 4: Base path
      try {
        const graphClient = await createGraphClient(storageConfig)
        const path = storageConfig.base_relative_path
        const response = await graphClient
          .api(
            `/drives/${storageConfig.base_drive_id}/root:${path}`
          )
          .get()
          .catch(() => null)

        if (response) {
          results.base_path_status = 'SUCCESS'
          messages.push('✓ Base path exists and is accessible')
        } else {
          results.base_path_status = 'NOT_FOUND'
          messages.push(`! Base path ${path} not found (can be created during provisioning)`)
        }
      } catch (error) {
        messages.push(`✗ Base path check failed: ${error}`)
      }
    } catch (error) {
      messages.push(`✗ Configuration error: ${error}`)
    }

    return {
      ...results,
      diagnosis_messages: messages,
      tested_at: new Date().toISOString(),
    }
  }
}
