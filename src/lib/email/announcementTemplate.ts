/**
 * Feature announcement email template
 * Styled after Anthropic's product update emails:
 * Light background, card sections with icons, clean typography
 */

interface AnnouncementSection {
  icon: string; // emoji or text symbol
  title: string;
  items: { bold: string; text: string }[];
}

interface AnnouncementEmailOptions {
  firstName: string;
  intro: string;
  sections: AnnouncementSection[];
  closing: string;
  ctaText: string;
  ctaUrl: string;
}

export function generateAnnouncementEmail(options: AnnouncementEmailOptions): string {
  const { firstName, intro, sections, closing, ctaText, ctaUrl } = options;

  const sectionHtml = sections.map(section => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 24px 28px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size: 28px; vertical-align: middle; padding-right: 14px;">${section.icon}</td>
              <td style="font-family: 'Georgia', serif; font-size: 20px; font-weight: 700; color: #1a1a1a; vertical-align: middle;">${section.title}</td>
            </tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
            ${section.items.map(item => `
              <tr>
                <td style="padding: 6px 0 6px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: #404040;">
                  &bull;&nbsp;&nbsp;<strong style="color: #1a1a1a;">${item.bold}</strong> ${item.text}
                </td>
              </tr>
            `).join('')}
          </table>
        </td>
      </tr>
    </table>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>What's New at The Daily Athlete</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f0eb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f0eb; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom: 32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 32px; height: 32px; background-color: #1a1a1a; border-radius: 8px; text-align: center; vertical-align: middle; font-size: 14px;">
                    <span style="color: #ffffff; font-weight: 800;">&#x1F3CB;</span>
                  </td>
                  <td style="padding-left: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.3px;">
                    The Daily Athlete
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.7; color: #404040;">
              Hi ${firstName},
            </td>
          </tr>
          <tr>
            <td style="padding-bottom: 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.7; color: #404040;">
              ${intro}
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="padding-bottom: 24px; font-family: 'Georgia', serif; font-size: 26px; font-weight: 700; color: #1a1a1a; line-height: 1.3;">
              Here&rsquo;s what&rsquo;s new:
            </td>
          </tr>

          <!-- Sections -->
          <tr>
            <td>
              ${sectionHtml}
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 20px 0 32px;">
              <a href="${ctaUrl}" style="display: inline-block; background-color: #dc2626; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 10px;">
                ${ctaText} &rarr;
              </a>
            </td>
          </tr>

          <!-- Closing -->
          <tr>
            <td style="padding-bottom: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.7; color: #404040;">
              ${closing}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top: 1px solid #d4d4d4; padding-top: 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #999; line-height: 1.6;">
                    &copy; 2026 The Daily Athlete<br>
                    <a href="https://thedailyathlete.in" style="color: #999; text-decoration: underline;">thedailyathlete.in</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function generateFeatureUpdateEmail(firstName: string): { subject: string; html: string } {
  const subject = "What's new at The Daily Athlete — AI Reports, Weekly Wraps & more";

  const html = generateAnnouncementEmail({
    firstName,
    intro: `We&rsquo;ve been busy shipping updates to make your training experience better. From AI-powered reports to redesigned weekly summaries, here&rsquo;s everything that&rsquo;s new.`,
    sections: [
      {
        icon: '&#x1F4CA;',
        title: 'AI-Powered Reports',
        items: [
          { bold: 'Reports Hub:', text: 'A new home for all your training insights &mdash; daily AI tips, deep-dive reports, and quick access to your wraps and reviews.' },
          { bold: '6 Deep-Dive Reports:', text: 'Sport Deep Dive, Trend Report, Goal Tracker, Recovery Report, PR Timeline, and Training Analysis &mdash; all generated by AI from your actual data.' },
          { bold: 'Ask Anything:', text: 'Type any training question and get an AI-generated report with charts and stats.' },
        ],
      },
      {
        icon: '&#x1F4F1;',
        title: 'Better Training Summaries',
        items: [
          { bold: 'Weekly Wrap redesign:', text: 'Wider layout, daily activity bar chart, highlight of the week, and sport breakdown &mdash; all shareable.' },
          { bold: 'Monthly Review redesign:', text: 'Activity calendar, daily + weekly volume charts, vs-last-month comparison cards, and 2-column sport grid.' },
          { bold: 'Yearly Wrapped:', text: 'Interactive 8-slide experience with guess game, heatmap, records, and public sharing.' },
        ],
      },
      {
        icon: '&#x26A1;',
        title: 'Performance & Quality',
        items: [
          { bold: 'Faster login:', text: 'Sign-in is now near-instant with local caching and background profile refresh.' },
          { bold: 'Walk workouts:', text: 'Walking/hiking is now a first-class workout type with its own emoji, color, and Strava mapping.' },
          { bold: 'Strava timezone fix:', text: 'Late-evening workouts now appear on the correct calendar day.' },
          { bold: 'Smarter caching:', text: 'Dashboard pages load faster with 5-minute workout cache and prefetching.' },
        ],
      },
      {
        icon: '&#x1F6E1;',
        title: 'Security & Trust',
        items: [
          { bold: 'Privacy Policy &amp; Terms:', text: 'New legal pages at <a href="https://thedailyathlete.in/privacy" style="color: #dc2626; text-decoration: underline;">thedailyathlete.in/privacy</a> and <a href="https://thedailyathlete.in/terms" style="color: #dc2626; text-decoration: underline;">thedailyathlete.in/terms</a>.' },
          { bold: 'Admin dashboard:', text: 'Automated daily backups, user management, and system monitoring to keep your data safe.' },
        ],
      },
    ],
    closing: `All features are live now. We&rsquo;re building The Daily Athlete to be the best training companion for multi-sport athletes, and your feedback shapes what we build next.<br><br>Happy training,<br><strong>Ryan</strong><br><span style="color: #999;">Founder, The Daily Athlete</span>`,
    ctaText: 'Open The Daily Athlete',
    ctaUrl: 'https://thedailyathlete.in/dashboard',
  });

  return { subject, html };
}
