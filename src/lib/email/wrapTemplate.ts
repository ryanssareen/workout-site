// Weekly Wrap email template

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
  const statsHtml = data.sportStats.map(stat => `
    <tr>
      <td style="padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="40" style="font-size: 28px; vertical-align: top; padding-top: 2px;">${stat.emoji}</td>
            <td style="vertical-align: top;">
              <p style="margin: 0; color: #ffffff; font-size: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                You <span style="color: ${stat.color}; font-weight: 700;">${stat.label} ${stat.metric}</span>
              </p>
              ${stat.comparison ? `
                <p style="margin: 4px 0 0; font-size: 14px; color: ${stat.isPositive ? '#34d399' : '#6b7280'}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
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
      <td style="padding: 24px 0 0;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"
          style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px;">
          <tr>
            <td style="padding: 20px 24px;">
              <p style="margin: 0 0 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-weight: 600;">
                This week's highlight
              </p>
              <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                ${data.highlight.emoji} ${data.highlight.label}
              </p>
              <p style="margin: 6px 0 0; color: #6b7280; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
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
<body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #000000;">
    <tr>
      <td align="center" style="padding: 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background: linear-gradient(165deg, #0a0a0a 0%, #0f1729 40%, #1a1a2e 70%, #16213e 100%); border-radius: 24px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 32px 24px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="36" style="vertical-align: middle;">
                    <div style="width: 36px; height: 36px; background: #dc2626; border-radius: 10px; text-align: center; line-height: 36px; color: white; font-weight: bold; font-size: 14px;">CT</div>
                  </td>
                  <td style="padding-left: 10px; vertical-align: middle;">
                    <span style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">Your Week's Capsule</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 0 32px 8px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 700; line-height: 1.2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                Dear ${data.userName},
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 32px;">
              <p style="margin: 0; color: #9ca3af; font-size: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                this week was <span style="color: #ffffff; font-weight: 600;">${data.ratingWord}</span> ${data.ratingEmoji}
              </p>
            </td>
          </tr>

          <!-- Stats -->
          <tr>
            <td style="padding: 0 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${statsHtml}
              </table>
            </td>
          </tr>

          <!-- Highlight -->
          <tr>
            <td style="padding: 0 32px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                ${highlightHtml}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 32px 32px 16px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${data.appUrl}/wrap" style="display: inline-block; background: #ffffff; color: #000000; text-decoration: none; padding: 14px 40px; border-radius: 14px; font-size: 16px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                      View Full Wrap
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px 32px;">
              <p style="margin: 0; text-align: center; color: #4b5563; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                ${data.totalWorkouts} workouts · ${data.completedWorkouts} completed · ${data.weekLabel}
              </p>
              <p style="margin: 8px 0 0; text-align: center; color: #374151; font-size: 11px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                THE DAILY ATHLETE — Train Smarter. Every Day.
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
