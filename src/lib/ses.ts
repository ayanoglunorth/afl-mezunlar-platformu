import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

let cachedClient: SESClient | null = null;

function getClient(): SESClient {
  if (cachedClient) return cachedClient;

  const region = process.env.AWS_SES_REGION;
  const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error('AWS SES is not configured. Set AWS_SES_REGION, AWS_SES_ACCESS_KEY_ID, and AWS_SES_SECRET_ACCESS_KEY.');
  }

  cachedClient = new SESClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  return cachedClient;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    return { success: false, error: 'EMAIL_FROM environment variable is not set.' };
  }

  try {
    const client = getClient();

    const command = new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    });

    const response = await client.send(command);
    return { success: true, messageId: response.MessageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SES error';
    return { success: false, error: message };
  }
}
