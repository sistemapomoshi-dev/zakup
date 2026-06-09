import nodemailer from 'nodemailer'

import { decryptSecret } from '../mail/crypto'

type MailboxCredentials = {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  login: string
  passwordEncrypted: string
  email: string
}

export async function sendDraftEmail(
  mailbox: MailboxCredentials,
  jwtSecret: string,
  input: {
    to: string
    subject: string
    bodyText: string
    inReplyTo?: string | null
  },
) {
  const password = await decryptSecret(mailbox.passwordEncrypted, jwtSecret)
  const transporter = nodemailer.createTransport({
    host: mailbox.smtpHost,
    port: mailbox.smtpPort,
    secure: mailbox.smtpSecure,
    auth: {
      user: mailbox.login,
      pass: password,
    },
  })

  const info = await transporter.sendMail({
    from: mailbox.email,
    to: input.to,
    subject: input.subject,
    text: input.bodyText,
    inReplyTo: input.inReplyTo ?? undefined,
  })

  return {
    messageId: info.messageId ?? `<sent-${Date.now()}@zakup.local>`,
    sentAt: new Date(),
  }
}
