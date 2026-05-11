import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LeaseLoft'
const APP_URL = 'https://leaseloft.ai'

interface Props {
  firstName?: string
  inviteCode?: string
  landlordName?: string
  property?: string
}

const TenantInviteCodeEmail = ({ firstName, inviteCode, landlordName, property }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} invite code is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {firstName ? `Welcome, ${firstName}!` : `You're invited!`}
        </Heading>
        <Text style={text}>
          {landlordName ? `${landlordName} has` : 'Your landlord has'} invited
          you to join {SITE_NAME}
          {property ? ` for ${property}` : ''}. Use the invite code below to
          create your tenant account.
        </Text>
        <Section style={codeBox}>
          <Text style={codeLabel}>Your invite code</Text>
          <Text style={code}>{inviteCode ?? 'YOUR-CODE'}</Text>
        </Section>
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={`${APP_URL}/signup`} style={button}>
            Create your account
          </Button>
        </Section>
        <Text style={small}>
          This code is single-use and expires soon. Keep it private — do not
          share it with anyone.
        </Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TenantInviteCodeEmail,
  subject: `Your ${SITE_NAME} tenant invite code`,
  displayName: 'Tenant invite code',
  previewData: { firstName: 'Alex', inviteCode: 'TN-2026-A1B2', landlordName: 'Jordan Smith', property: 'Maple Apartments · Unit 3B' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: 'hsl(168, 57%, 11%)', margin: '0 0 16px' }
const text = { fontSize: '15px', color: 'hsl(168, 12%, 38%)', lineHeight: '1.6', margin: '0 0 20px' }
const codeBox = { backgroundColor: 'hsl(156, 50%, 92%)', borderRadius: '10px', padding: '20px', textAlign: 'center' as const, margin: '0 0 8px' }
const codeLabel = { fontSize: '12px', color: 'hsl(165, 76%, 25%)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: '0 0 8px' }
const code = { fontSize: '24px', fontFamily: 'monospace', fontWeight: 'bold', color: 'hsl(165, 76%, 25%)', margin: 0, letterSpacing: '0.05em' }
const button = { backgroundColor: 'hsl(158, 70%, 36%)', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block' }
const small = { fontSize: '13px', color: 'hsl(168, 12%, 50%)', lineHeight: '1.5', margin: '0 0 24px' }
const footer = { fontSize: '13px', color: 'hsl(168, 12%, 50%)', margin: '32px 0 0' }
