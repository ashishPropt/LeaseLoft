import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LeaseLoft'

interface Props {
  firstName?: string
  requestedRole?: 'landlord' | 'tenant'
}

const InviteRequestReceivedEmail = ({ firstName, requestedRole }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We received your request to join {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {firstName ? `Thanks, ${firstName}!` : 'Thanks for your interest!'}
        </Heading>
        <Text style={text}>
          We've received your request to join {SITE_NAME}
          {requestedRole ? ` as a ${requestedRole}` : ''}. Our team will review
          it and get back to you within 1–2 business days.
        </Text>
        <Section style={card}>
          <Text style={cardText}>
            If approved, you'll receive a follow-up email with a single-use
            invite code and a link to create your account.
          </Text>
        </Section>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InviteRequestReceivedEmail,
  subject: `We received your ${SITE_NAME} access request`,
  displayName: 'Invite request received',
  previewData: { firstName: 'Jane', requestedRole: 'landlord' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: 'hsl(168, 57%, 11%)', margin: '0 0 16px' }
const text = { fontSize: '15px', color: 'hsl(168, 12%, 38%)', lineHeight: '1.6', margin: '0 0 20px' }
const card = { backgroundColor: 'hsl(156, 50%, 92%)', borderRadius: '10px', padding: '16px 20px', margin: '0 0 24px' }
const cardText = { fontSize: '14px', color: 'hsl(165, 76%, 25%)', lineHeight: '1.5', margin: 0 }
const footer = { fontSize: '13px', color: 'hsl(168, 12%, 50%)', margin: '32px 0 0' }
