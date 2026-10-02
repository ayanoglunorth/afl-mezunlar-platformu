// HTML email templates for mentorship notifications.
// Visual language matches the registration confirmation email:
// Inter font, #1c6033 brand green, 520px card, consistent spacing.

const LOGO_URL = 'https://aflmezunlar.org/afl-logo.svg';

function escapeHtml(text: string): string {
  return text.replace(/[<>&"']/g, (ch) => {
    const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
    return map[ch] || ch;
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f4f5;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      padding: 40px 20px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
      border: 1px solid #e4e4e7;
      overflow: hidden;
    }
    .header {
      padding: 40px 40px 20px 40px;
      text-align: center;
    }
    .header img {
      height: 48px;
      width: auto;
    }
    .content {
      padding: 0 40px 40px 40px;
      text-align: center;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #18181b;
      margin: 0 0 16px 0;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #52525b;
      margin: 0 0 16px 0;
    }
    .button-container {
      margin: 32px 0;
    }
    .button {
      display: inline-block;
      background-color: #1c6033;
      color: #ffffff !important;
      font-weight: 600;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 15px;
      box-shadow: 0 2px 4px rgba(28, 96, 51, 0.2);
    }
    .quote-box {
      background-color: #f4f4f5;
      border: 1px solid #e4e4e7;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
      text-align: left;
    }
    .quote-box .label {
      font-size: 12px;
      font-weight: 600;
      color: #a1a1aa;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 8px 0;
    }
    .quote-box .text {
      font-size: 14px;
      line-height: 1.6;
      color: #3f3f46;
      margin: 0;
      white-space: pre-wrap;
    }
    .divider {
      height: 1px;
      background-color: #e4e4e7;
      margin: 32px 0;
    }
    .footer {
      text-align: center;
      font-size: 13px;
      color: #a1a1aa;
      line-height: 1.5;
    }
    .footer a {
      color: #1c6033;
      text-decoration: none;
    }
    .footer p {
      font-size: 13px;
      color: #a1a1aa;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="container" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="header">
          <img src="${LOGO_URL}" alt="AFL Mezunlar Platformu">
        </td>
      </tr>
      <tr>
        <td class="content">
          ${body}
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/**
 * Mail sent to the mentor when a student sends a matching request.
 */
export function mentorshipRequestReceivedHtml(
  mentorName: string,
  studentName: string,
  requestMessage: string,
  dashboardUrl: string,
): string {
  const body = `
          <h1>Yeni Mentorluk İsteği</h1>
          <p>Merhaba <strong>${escapeHtml(mentorName)}</strong>,</p>
          <p><strong>${escapeHtml(studentName)}</strong> sana bir tercih mentorluğu isteği gönderdi. İstek mesajını aşağıda görebilirsin.</p>

          <div class="quote-box">
            <p class="label">İstek mesajı</p>
            <p class="text">${escapeHtml(truncate(requestMessage, 500))}</p>
          </div>

          <div class="button-container">
            <a href="${escapeHtml(dashboardUrl)}" class="button">İstekleri Görüntüle</a>
          </div>

          <div class="divider"></div>

          <div class="footer">
            <p>İsteği platforma giriş yaparak kabul edebilir ya da reddedebilirsin.<br>
            &copy; 2026 AFL Mezunlar Platformu.</p>
          </div>`;

  return layout('Yeni Mentorluk İsteği', body);
}

/**
 * Mail sent to the student when the mentor accepts the matching request.
 */
export function mentorshipRequestAcceptedHtml(
  studentName: string,
  mentorName: string,
  chatUrl: string,
): string {
  const body = `
          <h1>İsteğin Kabul Edildi!</h1>
          <p>Merhaba <strong>${escapeHtml(studentName)}</strong>,</p>
          <p><strong>${escapeHtml(mentorName)}</strong> mentorluk isteğini kabul etti. Artık sohbet penceresinden doğrudan iletişime geçebilirsin.</p>

          <div class="button-container">
            <a href="${escapeHtml(chatUrl)}" class="button">Sohbete Git</a>
          </div>

          <div class="divider"></div>

          <div class="footer">
            <p>Tercih döneminde mentorunla iletişimde kal. İyi tercihler!<br>
            &copy; 2026 AFL Mezunlar Platformu.</p>
          </div>`;

  return layout('Mentorluk İsteğin Kabul Edildi', body);
}

/**
 * Mail sent when the first message is sent in a mentorship conversation.
 */
export function mentorshipFirstMessageHtml(
  recipientName: string,
  senderName: string,
  messagePreview: string,
  chatUrl: string,
): string {
  const body = `
          <h1>Yeni Mesajın Var</h1>
          <p>Merhaba <strong>${escapeHtml(recipientName)}</strong>,</p>
          <p><strong>${escapeHtml(senderName)}</strong> mentorluk sohbetinde sana bir mesaj gönderdi.</p>

          <div class="quote-box">
            <p class="label">Mesaj</p>
            <p class="text">${escapeHtml(truncate(messagePreview, 300))}</p>
          </div>

          <div class="button-container">
            <a href="${escapeHtml(chatUrl)}" class="button">Mesajı Yanıtla</a>
          </div>

          <div class="divider"></div>

          <div class="footer">
            <p>Bu mesaj AFL Mezunlar Platformu üzerinden gönderildi.<br>
            &copy; 2026 AFL Mezunlar Platformu.</p>
          </div>`;

  return layout('Mentorluk Sohbetinde Yeni Mesaj', body);
}

/**
 * Reminder mail when messages remain unread for 5 minutes.
 */
export function mentorshipUnreadReminderHtml(
  recipientName: string,
  unreadCount: number,
  messagePreview: string,
  chatUrl: string,
): string {
  const countText = unreadCount > 1 ? `${unreadCount} okunmamış mesajın` : 'Okunmamış bir mesajın';

  const body = `
          <h1>Okunmamış Mesajın Var</h1>
          <p>Merhaba <strong>${escapeHtml(recipientName)}</strong>,</p>
          <p>${countText} var. En son mesajın bir önizlemesini aşağıda görebilirsin.</p>

          <div class="quote-box">
            <p class="label">Son mesaj</p>
            <p class="text">${escapeHtml(truncate(messagePreview, 300))}</p>
          </div>

          <div class="button-container">
            <a href="${escapeHtml(chatUrl)}" class="button">Sohbete Git</a>
          </div>

          <div class="divider"></div>

          <div class="footer">
            <p>Bu hatırlatma okunmamış mesajların olduğu için gönderildi.<br>
            &copy; 2026 AFL Mezunlar Platformu.</p>
          </div>`;

  return layout('Okunmamış Mesajların Var', body);
}

export function forumMentionHtml(
  recipientName: string,
  actorName: string,
  threadTitle: string,
  forumUrl: string,
): string {
  const body = `
          <h1>Toplulukta etiketlendin</h1>
          <p>Merhaba <strong>${escapeHtml(recipientName)}</strong>,</p>
          <p><strong>${escapeHtml(actorName)}</strong> seni bir topluluk konusunda etiketledi.</p>
          <div class="quote-box">
            <p class="label">Konu</p>
            <p class="text">${escapeHtml(truncate(threadTitle, 300))}</p>
          </div>
          <div class="button-container">
            <a href="${escapeHtml(forumUrl)}" class="button">Konuyu görüntüle</a>
          </div>
          <div class="divider"></div>
          <div class="footer"><p>Bu bildirim AFL Mezun Platformu üzerinden gönderildi.<br>&copy; 2026 AFL Mezun Platformu.</p></div>`;
  return layout('Toplulukta etiketlendin', body);
}
