// Weekly Wrap email template — Anthropic-inspired clean design

export interface WrapSportStat {
  type: string;
  emoji: string;
  label: string;       // "ran", "cycled", etc.
  metric: string;      // "4.9km" or "145 min"
  color: string;       // hex
  comparison: string | null; // "25% more than last week"
  isPositive: boolean;
}

export interface WrapEmailData {
  userName: string;
  weekLabel: string;
  ratingWord: string;
  ratingEmoji: string;
  sportStats: WrapSportStat[];
  highlight: { emoji: string; label: string; detail: string } | null;
  totalWorkouts: number;
  completedWorkouts: number;
  appUrl: string;
}

export function generateWrapSubject(ratingEmoji: string, totalWorkouts: number): string {
  return `${ratingEmoji} Your Weekly Wrap — ${totalWorkouts} workout${totalWorkouts !== 1 ? 's' : ''} this week`;
}

export function generateWrapEmail(data: WrapEmailData): string {
  const font = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

  const statsHtml = data.sportStats.map(stat => `
    <tr>
      <td style="padding: 16px 20px; border-bottom: 1px solid #f3f4f6;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="44" style="font-size: 24px; vertical-align: middle;">${stat.emoji}</td>
            <td style="vertical-align: middle;">
              <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600; font-family: ${font};">
                You ${stat.label} <span style="color: ${stat.color};">${stat.metric}</span>
              </p>
              ${stat.comparison ? `
                <p style="margin: 3px 0 0; font-size: 13px; color: ${stat.isPositive ? '#059669' : '#9ca3af'}; font-family: ${font};">
                  ${stat.isPositive ? '↑' : '↓'} ${stat.comparison}
                </p>
              ` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  const highlightHtml = data.highlight ? `
    <tr>
      <td style="padding: 24px 28px 0;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"
          style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 12px;">
          <tr>
            <td style="padding: 16px 20px;">
              <p style="margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #92400e; font-family: ${font}; font-weight: 700;">
                ⭐ Highlight of the week
              </p>
              <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600; font-family: ${font};">
                ${data.highlight.emoji} ${data.highlight.label}
              </p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px; font-family: ${font};">
                ${data.highlight.detail}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: ${font};">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table cellpadding="0" cellspacing="0" border="0" width="560" style="max-width: 560px;">

          <!-- Logo -->
          <tr>
            <td style="padding: 0 0 24px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="32" style="vertical-align: middle;">
                    <div style="width: 32px; height: 32px; background: #dc2626; border-radius: 8px; text-align: center; line-height: 32px; color: white; font-weight: bold; font-size: 11px;">DA</div>
                  </td>
                  <td style="padding-left: 10px; vertical-align: middle;">
                    <span style="color: #111827; font-size: 15px; font-weight: 700; font-family: ${font};">The Daily Athlete</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 0 0 24px;">
              <p style="margin: 0 0 4px; color: #6b7280; font-size: 13px; font-family: ${font};">
                ${data.weekLabel}
              </p>
              <h1 style="margin: 0 0 8px; color: #111827; font-size: 28px; font-weight: 800; line-height: 1.2; font-family: ${font};">
                ${data.ratingEmoji} This week was ${data.ratingWord}, ${data.userName}.
              </h1>
              <p style="margin: 0; color: #6b7280; font-size: 15px; line-height: 1.5; font-family: ${font};">
                Here&rsquo;s your personalized training summary with ${data.totalWorkouts} workout${data.totalWorkouts !== 1 ? 's' : ''} logged.
              </p>
            </td>
          </tr>

          <!-- Sport Stats Card -->
          <tr>
            <td style="padding: 0 0 16px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px 8px;">
                    <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af; font-family: ${font}; font-weight: 700;">
                      Your training
                    </p>
                  </td>
                </tr>
                ${statsHtml}
              </table>
            </td>
          </tr>

          <!-- Highlight -->
          ${highlightHtml ? `
          <tr>
            <td style="padding: 0 0 16px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%"
                style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #92400e; font-family: ${font}; font-weight: 700;">
                      ⭐ Highlight of the week
                    </p>
                    <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600; font-family: ${font};">
                      ${data.highlight?.emoji} ${data.highlight?.label}
                    </p>
                    <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px; font-family: ${font};">
                      ${data.highlight?.detail}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- CTA -->
          <tr>
            <td style="padding: 8px 0 24px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${data.appUrl}/wrap" style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; font-family: ${font};">
                      View Full Wrap →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 0 20px;">
              <div style="height: 1px; background: #e5e7eb;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td>
              <p style="margin: 0 0 4px; color: #9ca3af; font-size: 12px; font-family: ${font};">
                ${data.totalWorkouts} workouts · ${data.completedWorkouts} completed · ${data.weekLabel}
              </p>
              <p style="margin: 0; color: #d1d5db; font-size: 11px; font-family: ${font};">
                The Daily Athlete · <a href="${data.appUrl}" style="color: #9ca3af; text-decoration: underline;">thedailyathlete.in</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
