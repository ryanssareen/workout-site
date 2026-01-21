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
    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-top: 20px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #fc4c02;">
        📊 Strava Stats
      </h3>
      <div style="display: flex; gap: 20px; flex-wrap: wrap;">
        ${data.stravaStats.distance > 0 ? `<div style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #333;">${data.stravaStats.distance.toFixed(1)}</div>
          <div style="font-size: 12px; color: #666;">km covered</div>
        </div>` : ''}
        ${data.stravaStats.time > 0 ? `<div style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #333;">${Math.round(data.stravaStats.time)}</div>
          <div style="font-size: 12px; color: #666;">minutes active</div>
        </div>` : ''}
        ${data.stravaStats.calories > 0 ? `<div style="text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #333;">${data.stravaStats.calories.toLocaleString()}</div>
          <div style="font-size: 12px; color: #666;">calories burned</div>
        </div>` : ''}
      </div>
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
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: bold;">
              📋 Your ${data.periodDays}-Day Summary
            </h1>
            <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
              Hey ${data.userName}! Here's how you did.
            </p>
          </div>

          <!-- Main Content -->
          <div style="padding: 30px;">
            <!-- Completion Stats -->
            <div style="background: linear-gradient(135deg, #f0f4ff 0%, #f5f0ff 100%); border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 25px;">
              <div style="font-size: 48px; font-weight: bold; color: ${motivational.color};">
                ${data.completionRate}%
              </div>
              <div style="font-size: 14px; color: #666; margin-bottom: 15px;">
                Completion Rate
              </div>
              <div style="font-size: 18px; color: #333;">
                <strong>${data.totalCompleted}</strong> of <strong>${data.totalAssigned}</strong> workouts completed
              </div>
            </div>

            <!-- Motivational Message -->
            <div style="background-color: ${motivational.color}15; border-left: 4px solid ${motivational.color}; padding: 15px 20px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
              <span style="font-size: 24px; margin-right: 10px;">${motivational.emoji}</span>
              <span style="font-size: 16px; color: #333;">${motivational.message}</span>
            </div>

            <!-- Workout Breakdown -->
            ${typeBreakdown.length > 0 ? `
            <div style="margin-bottom: 25px;">
              <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">
                Workout Breakdown
              </h3>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                ${data.byType.run > 0 ? `<span style="background: #dbeafe; color: #1d4ed8; padding: 8px 16px; border-radius: 20px; font-size: 14px;">🏃 ${data.byType.run} Run${data.byType.run > 1 ? 's' : ''}</span>` : ''}
                ${data.byType.bike > 0 ? `<span style="background: #dcfce7; color: #16a34a; padding: 8px 16px; border-radius: 20px; font-size: 14px;">🚴 ${data.byType.bike} Bike${data.byType.bike > 1 ? 's' : ''}</span>` : ''}
                ${data.byType.swim > 0 ? `<span style="background: #e0f2fe; color: #0284c7; padding: 8px 16px; border-radius: 20px; font-size: 14px;">🏊 ${data.byType.swim} Swim${data.byType.swim > 1 ? 's' : ''}</span>` : ''}
                ${data.byType.strength > 0 ? `<span style="background: #fce7f3; color: #be185d; padding: 8px 16px; border-radius: 20px; font-size: 14px;">💪 ${data.byType.strength} Strength</span>` : ''}
              </div>
            </div>
            ` : ''}

            ${stravaSection}

            <!-- CTA Button -->
            <div style="text-align: center; margin-top: 30px;">
              <a href="${data.appUrl}/calendar" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                View Your Calendar
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; color: #666; font-size: 12px;">
              This summary was sent from CoachTrack.
            </p>
            <p style="margin: 5px 0 0 0; color: #999; font-size: 11px;">
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
