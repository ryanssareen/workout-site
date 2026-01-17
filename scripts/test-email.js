const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ryansareen6@gmail.com',
    pass: 'etdwoglbwzqnzyed',
  },
});

(async () => {
  try {
    console.log('📧 Testing Gmail SMTP...');
    
    const info = await transporter.sendMail({
      from: '"Workout Tracker" <ryansareen6@gmail.com>',
      to: 'ryansareen6@gmail.com',
      subject: '🧪 Gmail SMTP Test - Workout Tracker',
      html: '<h1>🎉 Gmail SMTP Works!</h1><p>Your workout email system is ready!</p>',
    });

    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('\n📬 Check your email: ryansareen6@gmail.com');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();
