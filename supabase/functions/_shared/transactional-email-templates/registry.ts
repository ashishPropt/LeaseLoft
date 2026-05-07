/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as inviteRequestReceived } from './invite-request-received.tsx'
import { template as inviteRequestApproved } from './invite-request-approved.tsx'
import { template as inviteRequestRejected } from './invite-request-rejected.tsx'
import { template as maintenanceRequestCreated } from './maintenance-request-created.tsx'
import { template as maintenanceRequestUpdated } from './maintenance-request-updated.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'invite-request-received': inviteRequestReceived,
  'invite-request-approved': inviteRequestApproved,
  'invite-request-rejected': inviteRequestRejected,
  'maintenance-request-created': maintenanceRequestCreated,
  'maintenance-request-updated': maintenanceRequestUpdated,
}
