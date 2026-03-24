interface AssignmentEmailData {
  coachName: string;
  athleteName: string;
  workouts: Array<{
    name: string;
    type: string;
    date: string;
    description?: string;
  }>;
  dashboardUrl: string;
}

export function generateAssignmentEmail(data: AssignmentEmailData): string {
  const workoutRows = data.workouts.map(w => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #eee;">
        <strong style="color: #1a1a1a;">${w.name}</strong>
        <br><span style="color: #666; font-size: 13px;">${w.type} &middot; ${w.date}</span>
        ${w.description ? `<br><span style="color: #888; font-size: 12px;">${w.description}</span>` : ''}
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f5f5f5;">
      <div style="max-width:600px; margin:0 auto; background:#fff;">
        <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%); padding:30px; text-align:center;">
          <h1 style="margin:0; color:white; font-size:22px;">New Workout${data.workouts.length > 1 ? 's' : ''} Assigned</h1>
        </div>
        <div style="padding:30px;">
          <p style="font-size:16px; color:#333;">
            Hey ${data.athleteName}, <strong>${data.coachName}</strong> assigned you
            ${data.workouts.length} workout${data.workouts.length > 1 ? 's' : ''}:
          </p>
          <table style="width:100%; border-collapse:collapse; margin:20px 0;">
            ${workoutRows}
          </table>
          <div style="text-align:center; margin-top:25px;">
            <a href="${data.dashboardUrl}" style="display:inline-block; background:linear-gradient(135deg,#667eea,#764ba2); color:white; padding:12px 30px; text-decoration:none; border-radius:8px; font-weight:bold;">
              View in Dashboard
            </a>
          </div>
        </div>
        <div style="background:#f8f9fa; padding:15px 30px; text-align:center; border-top:1px solid #eee;">
          <p style="margin:0; color:#666; font-size:12px;">
            The Daily Athlete &middot;
            <a href="${data.dashboardUrl}/settings" style="color:#667eea;">Notification preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function generateAssignmentSubject(coachName: string, workoutCount: number): string {
  return workoutCount === 1
    ? `${coachName} assigned you a new workout`
    : `${coachName} assigned you ${workoutCount} new workouts`;
}
