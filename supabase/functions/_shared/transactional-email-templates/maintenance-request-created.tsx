import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LeaseLoft'

interface Props {
  landlordName?: string
  tenantName?: string
  unitLabel?: string
  propertyName?: string
  title?: string
  description?: string
  priority?: string
}

const MaintenanceRequestCreatedEmail = ({
  landlordName, tenantName, unitLabel, propertyName, title, description, priority,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New maintenance request{title ? `: ${title}` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {landlordName ? `Hi ${landlordName},` : 'Hi,'}
        </Heading>
        <Text style={text}>
          {tenantName ? <>{tenantName} has</> : 'A tenant has'} submitted a new
          maintenance request{propertyName ? <> at <strong>{propertyName}</strong></> : ''}
          {unitLabel ? <> ({unitLabel})</> : ''}.
        </Text>
        <Section style={card}>
          {title && <Text style={cardTitle}>{title}</Text>}
          {priority && <Text style={cardMeta}>Priority: {priority}</Text>}
          {description && <Text style={cardText}>{description}</Text>}
        </Section>
        <Text style={text}>
          Sign in to {SITE_NAME} to view details and update its status.
        </Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MaintenanceRequestCreatedEmail,
  subject: (d: Record<string, any>) =>
    d?.title ? `New maintenance request: ${d.title}` : 'New maintenance request',
  displayName: 'Maintenance request created (landlord)',
  previewData: {
    landlordName: 'Alex',
    tenantName: 'Jane Doe',
    unitLabel: 'Apt 2B',
    propertyName: 'Maple Court',
    title: 'Leaking kitchen faucet',
    description: 'Water dripping under the sink, looks like a slow leak.',
    priority: 'High',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: 'hsl(168, 57%, 11%)', margin: '0 0 16px' }
const text = { fontSize: '15px', color: 'hsl(168, 12%, 38%)', lineHeight: '1.6', margin: '0 0 20px' }
const card = { backgroundColor: 'hsl(156, 50%, 92%)', borderRadius: '10px', padding: '16px 20px', margin: '0 0 24px' }
const cardTitle = { fontSize: '15px', fontWeight: 'bold', color: 'hsl(168, 57%, 11%)', margin: '0 0 6px' }
const cardMeta = { fontSize: '13px', color: 'hsl(165, 76%, 25%)', margin: '0 0 8px' }
const cardText = { fontSize: '14px', color: 'hsl(165, 76%, 25%)', lineHeight: '1.5', margin: 0 }
const footer = { fontSize: '13px', color: 'hsl(168, 12%, 50%)', margin: '32px 0 0' }
