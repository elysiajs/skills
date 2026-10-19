# React Email

Render the template and send its HTML through the project's mail provider. Install `react`, `react-dom`, `@react-email/components`, and the provider. Use `react-email` for optional previews.

Use `.tsx` files and the project's React JSX configuration. Do not replace it with the Kita HTML factory from [plugins.md](plugins.md#html).

## Template and send function

```tsx
// emails/welcome.tsx
import * as React from 'react'
import { Html, Body, Text } from '@react-email/components'

export default function WelcomeEmail({ name }: { name: string }) {
	return (
		<Html>
			<Body><Text>Welcome, {name}.</Text></Body>
		</Html>
	)
}

WelcomeEmail.PreviewProps = { name: 'Alex' }
```

This Nodemailer example requires SMTP environment variables. Call it from the existing signup or notification workflow.

```tsx
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import nodemailer from 'nodemailer'
import WelcomeEmail from './emails/welcome'

const transport = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: 465,
	secure: true,
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASSWORD
	}
})

export async function sendWelcome(to: string, name: string) {
	return transport.sendMail({
		from: process.env.MAIL_FROM,
		to,
		subject: 'Welcome',
		html: renderToStaticMarkup(<WelcomeEmail name={name} />)
	})
}
```

Use the installed React Email renderer when templates need email-specific processing. Resend accepts `react: <WelcomeEmail name={name} />` directly. Nodemailer, SendGrid, and SES accept rendered HTML.

In an Elysia handler, validate recipient data with `t.String({ format: 'email' })`, then await the send operation or enqueue it through the project's job system. An OTP email template alone is not an authentication flow. That flow also needs a stored, expiring, single-use code and generation and verification limits.

## Preview

With `react-email` installed, add `"email": "email dev --dir src/emails"` as a package script and run `bun run email`. `PreviewProps` supplies sample data only.
