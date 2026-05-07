import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LeaseLoft'

interface Props {
  tenantName?: string
  title?: string
  newStatus?: string
  propertyName?: string
  unitLabel?: string
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const MaintenanceRequestUpdatedEmail = ({
  tenantName, title, newStatus, propertyName, unitLabel,
}: Props) => {
  const statusLabel = newStatus ? (STATUS_LABELS[newStatus] ?? newStatus) : ''
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Update on your maintenance request{title ? `: ${title}` : ''}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {tenantName ? `Hi ${tenantName},` : 'Hi,'}
          </Heading>
          <Text style={text}>
            Your landlord updated the status of your maintenance request
            {propertyName ? <> at <strong>{propertyName}</strong></> : ''}
            {unitLabel ? <> ({unitLabel})</> : ''}.
          </Text>
          <Section style={card}>
            {title && <Text style={cardTitle}>{title}</Text>}
            {statusLabel && <Text style={cardText}>New status: <strong>{statusLabel}</strong></Text>}
          </Section>
          <Text style={text}>
            Sign in to {SITE_NAME} to view the full details.
          </Text>
          <Text style={footer}>— The {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: MaintenanceRequestUpdatedEmail,
  subject: (d: Record<string, any>) => {
    const status = d?.newStatus ? (STATUS_LABELS[d.newStatus] ?? d.newStatus) : ''
    return d?.title
      ? `Maintenance update: ${d.title}${status ? ` — ${status}` : ''}`
      : 'Update on your maintenance request'
  },
  displayName: 'Maintenance request updated (tenant)',
  previewData: {
    tenantName: 'Jane',
    title: 'Leaking kitchen faucet',
    newStatus: 'in_progress',
    propertyName: 'Maple Court',
    unitLabel: 'Apt 2B',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: 'hsl(168, 57%, 11%)', margin: '0 0 16px' }
const text = { fontSize: '15px', color: 'hsl(168, 12%, 38%)', lineHeight: '1.6', margin: '0 0 20px' }
const card = { backgroundColor: 'hsl(156, 50%, 92%)', borderRadius: '10px', padding: '16px 20px', margin: '0 0 24px' }
const cardTitle = { fontSize: '15px', fontWeight: 'bold', color: 'hsl(168, 57%, 11%)', margin: '0 0 6px' }
const cardText = { fontSize: '14px', color: 'hsl(165, 76%, 25%)', lineHeight: '1.5', margin: 0 }
const footer = { fontSize: '13px', color: 'hsl(168, 12%, 50%)', margin: '32px 0 0' }
