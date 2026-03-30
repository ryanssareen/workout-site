export function generateAccountDisabledEmail(
  firstName: string,
  reason: string
): { subject: string; html: string } {
  const subject = 'Your Account Has Been Disabled';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;">The Daily Athlete</h1>
    </div>
    <div style="background:#111;border:1px solid #222;border-radius:16px;padding:32px 24px;">
      <h2 style="color:#fff;font-size:18px;font-weight:600;margin:0 0 16px;">
        Hi ${firstName},
      </h2>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Your account has been disabled by an administrator.
      </p>
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <p style="color:#888;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">
          Reason
        </p>
        <p style="color:#e5e5e5;font-size:14px;line-height:1.5;margin:0;">
          ${reason}
        </p>
      </div>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0;">
        If you believe this was a mistake, please reach out to your coach or reply to this email.
      </p>
    </div>
    <p style="text-align:center;color:#555;font-size:11px;margin-top:24px;">
      The Daily Athlete &mdash; Train smarter, not harder
    </p>
  </div>
</body>
</html>`;

  return { subject, html };
}

export function generateAccountDeletedEmail(
  firstName: string,
  reason: string
): { subject: string; html: string } {
  const subject = 'Your Account Has Been Permanently Deleted';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;">The Daily Athlete</h1>
    </div>
    <div style="background:#111;border:1px solid #222;border-radius:16px;padding:32px 24px;">
      <h2 style="color:#fff;font-size:18px;font-weight:600;margin:0 0 16px;">
        Hi ${firstName},
      </h2>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Your account and all associated data have been permanently deleted by an administrator. This action cannot be undone.
      </p>
      <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
        <p style="color:#888;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">
          Reason
        </p>
        <p style="color:#e5e5e5;font-size:14px;line-height:1.5;margin:0;">
          ${reason}
        </p>
      </div>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0;">
        If you believe this was a mistake, please contact your coach directly.
      </p>
    </div>
    <p style="text-align:center;color:#555;font-size:11px;margin-top:24px;">
      The Daily Athlete &mdash; Train smarter, not harder
    </p>
  </div>
</body>
</html>`;

  return { subject, html };
}

export function generateAccountRestoredEmail(
  firstName: string
): { subject: string; html: string } {
  const subject = 'Your Account Has Been Restored';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;">The Daily Athlete</h1>
    </div>
    <div style="background:#111;border:1px solid #222;border-radius:16px;padding:32px 24px;">
      <h2 style="color:#fff;font-size:18px;font-weight:600;margin:0 0 16px;">
        Welcome back, ${firstName}!
      </h2>
      <p style="color:#999;font-size:14px;line-height:1.6;margin:0 0 20px;">
        Your account has been re-enabled. You can now sign in and access all your workouts and data as before.
      </p>
      <div style="text-align:center;margin-top:24px;">
        <a href="https://thedailyathlete.co/login" style="display:inline-block;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:10px;text-decoration:none;">
          Sign In
        </a>
      </div>
    </div>
    <p style="text-align:center;color:#555;font-size:11px;margin-top:24px;">
      The Daily Athlete &mdash; Train smarter, not harder
    </p>
  </div>
</body>
</html>`;

  return { subject, html };
}
