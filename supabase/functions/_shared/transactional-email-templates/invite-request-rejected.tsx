import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'LeaseLoft'

interface Props {
  firstName?: string
}

const InviteRequestRejectedEmail = ({ firstName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>An update on your {SITE_NAME} access request</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {firstName ? `Hi ${firstName},` : 'Hi there,'}
        </Heading>
        <Text style={text}>
          Thank you for your interest in {SITE_NAME}. After reviewing your
          request, we're unable to approve access at this time.
        </Text>
        <Text style={text}>
          If you believe this was a mistake or your situation has changed, feel
          free to reply to this email and we'll take another look.
        </Text>
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InviteRequestRejectedEmail,
  subject: `Update on your ${SITE_NAME} access request`,
  displayName: 'Invite request rejected',
  previewData: { firstName: 'Jane' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: 'hsl(168, 57%, 11%)', margin: '0 0 16px' }
const text = { fontSize: '15px', color: 'hsl(168, 12%, 38%)', lineHeight: '1.6', margin: '0 0 20px' }
const footer = { fontSize: '13px', color: 'hsl(168, 12%, 50%)', margin: '32px 0 0' }
