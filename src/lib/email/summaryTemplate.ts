export interface SummaryData {
  userName: string;
  totalAssigned: number;
  totalCompleted: number;
  completionRate: number;
  byType: {
    run: number;
    bike: number;
    swim: number;
    strength: number;
  };
  stravaStats?: {
    distance: number; // in km
    calories: number;
    time: number; // in minutes
  };
  periodDays: number;
  appUrl: string;
}

function getMotivationalMessage(completionRate: number): { emoji: string; message: string; color: string } {
  if (completionRate >= 80) {
    return {
      emoji: '🔥',
      message: 'Excellent work! Keep crushing it!',
      color: '#22c55e', // green
    };
  } else if (completionRate >= 50) {
    return {
      emoji: '💪',
      message: 'Good progress! You\'re building momentum.',
      color: '#eab308', // yellow
    };
  } else {
    return {
      emoji: '🌟',
      message: 'Let\'s get back on track together!',
      color: '#ef4444', // red
    };
  }
}

export function generateSummaryEmail(data: SummaryData): string {
  const motivational = getMotivationalMessage(data.completionRate);

  const typeBreakdown = [];
  if (data.byType.run > 0) typeBreakdown.push(`${data.byType.run} run${data.byType.run > 1 ? 's' : ''}`);
  if (data.byType.bike > 0) typeBreakdown.push(`${data.byType.bike} bike${data.byType.bike > 1 ? 's' : ''}`);
  if (data.byType.swim > 0) typeBreakdown.push(`${data.byType.swim} swim${data.byType.swim > 1 ? 's' : ''}`);
  if (data.byType.strength > 0) typeBreakdown.push(`${data.byType.strength} strength`);

  const stravaSection = data.stravaStats ? `
    <div style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 18px; margin-top: 20px;">
      <div style="font-size: 11px; font-weight: 700; color: #fc4c02; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
        Strava Stats
      </div>
      <table style="width: 100%;">
        <tr>
          ${data.stravaStats.distance > 0 ? `<td style="text-align: center; padding: 5px;">
            <div style="font-size: 28px; font-weight: 900; color: #ffffff;">${data.stravaStats.distance.toFixed(1)}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">km</div>
          </td>` : ''}
          ${data.stravaStats.time > 0 ? `<td style="text-align: center; padding: 5px;">
            <div style="font-size: 28px; font-weight: 900; color: #ffffff;">${Math.round(data.stravaStats.time)}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">min</div>
          </td>` : ''}
          ${data.stravaStats.calories > 0 ? `<td style="text-align: center; padding: 5px;">
            <div style="font-size: 28px; font-weight: 900; color: #ffffff;">${data.stravaStats.calories.toLocaleString()}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">cal</div>
          </td>` : ''}
        </tr>
      </table>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Workout Summary</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #0a0a0a;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
            <div style="font-size: 32px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 2px; margin: 0;">
              THE DAILY ATHLETE
            </div>
            <div style="font-size: 14px; color: rgba(255,255,255,0.7); margin-top: 6px; text-transform: uppercase; letter-spacing: 3px;">
              ${data.periodDays}-Day Summary
            </div>
          </div>

          <!-- Main Content -->
          <div style="padding: 40px 30px;">
            <p style="color: #ffffff; font-size: 18px; margin: 0 0 25px 0; font-weight: 700;">
              Hey ${data.userName},
            </p>

            <!-- Completion Rate -->
            <div style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 25px;">
              <div style="font-size: 56px; font-weight: 900; color: ${motivational.color};">
                ${data.completionRate}%
              </div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">
                Completion Rate
              </div>
              <div style="font-size: 16px; color: rgba(255,255,255,0.7);">
                <strong style="color: #ffffff;">${data.totalCompleted}</strong> of <strong style="color: #ffffff;">${data.totalAssigned}</strong> workouts completed
              </div>
            </div>

            <!-- Motivational Message -->
            <div style="background-color: rgba(220,38,38,0.1); border-left: 4px solid ${motivational.color}; padding: 16px 20px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
              <span style="font-size: 22px; margin-right: 10px;">${motivational.emoji}</span>
              <span style="font-size: 15px; color: rgba(255,255,255,0.8); font-weight: 600;">${motivational.message}</span>
            </div>

            <!-- Workout Breakdown -->
            ${typeBreakdown.length > 0 ? `
            <div style="margin-bottom: 25px;">
              <div style="font-size: 11px; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                Workout Breakdown
              </div>
              <div>
                ${data.byType.run > 0 ? `<span style="display: inline-block; background: rgba(220,38,38,0.15); color: #fca5a5; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; margin: 3px 4px;">🏃 ${data.byType.run} Run${data.byType.run > 1 ? 's' : ''}</span>` : ''}
                ${data.byType.bike > 0 ? `<span style="display: inline-block; background: rgba(220,38,38,0.15); color: #fca5a5; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; margin: 3px 4px;">🚴 ${data.byType.bike} Bike${data.byType.bike > 1 ? 's' : ''}</span>` : ''}
                ${data.byType.swim > 0 ? `<span style="display: inline-block; background: rgba(220,38,38,0.15); color: #fca5a5; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; margin: 3px 4px;">🏊 ${data.byType.swim} Swim${data.byType.swim > 1 ? 's' : ''}</span>` : ''}
                ${data.byType.strength > 0 ? `<span style="display: inline-block; background: rgba(220,38,38,0.15); color: #fca5a5; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; margin: 3px 4px;">💪 ${data.byType.strength} Strength</span>` : ''}
              </div>
            </div>
            ` : ''}

            ${stravaSection}

            <!-- CTA Button -->
            <div style="text-align: center; margin-top: 30px;">
              <a href="${data.appUrl}/calendar" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 8px; font-weight: 800; font-size: 15px; text-transform: uppercase; letter-spacing: 1px;">
                View Calendar
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid rgba(255,255,255,0.08); padding: 25px 30px; text-align: center;">
            <p style="margin: 0; color: rgba(255,255,255,0.25); font-size: 12px;">
              Sent from The Daily Athlete — Train Smarter. Every Day.
            </p>
            <p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.15); font-size: 11px;">
              You're receiving this because you have workouts assigned in the app.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function generateSummarySubject(completionRate: number, periodDays: number): string {
  if (completionRate >= 80) {
    return `🔥 Amazing! Your ${periodDays}-Day Workout Summary`;
  } else if (completionRate >= 50) {
    return `💪 Your ${periodDays}-Day Workout Summary`;
  } else {
    return `📋 Your ${periodDays}-Day Workout Summary`;
  }
}
