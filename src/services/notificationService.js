const nodemailer = require('nodemailer');

class NotificationService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendEmail(to, subject, html) {
    if (!process.env.SMTP_USER) {
      console.log('SMTP not configured, skipping email:', subject);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html
      });
      console.log('Email sent to', to);
    } catch (error) {
      console.error('Email send failed:', error);
    }
  }

  async sendBookingConfirmation(userEmail, booking) {
    const subject = 'Booking Confirmation - CarHive';
    const html = `
      <h1>Your booking is confirmed!</h1>
      <p>Booking ID: ${booking.id}</p>
      <p>Vehicle: ${booking.vehicle?.make} ${booking.vehicle?.model}</p>
      <p>Dates: ${booking.startDate} to ${booking.endDate}</p>
      <p>Total: $${booking.totalPrice}</p>
      <p>Thank you for choosing CarHive!</p>
    `;
    await this.sendEmail(userEmail, subject, html);
  }

  async sendBookingReminder(userEmail, booking) {
    const subject = 'Vehicle Ready for Pickup - CarHive';
    const html = `
      <h1>Your vehicle is ready for pickup!</h1>
      <p>Booking ID: ${booking.id}</p>
      <p>Vehicle: ${booking.vehicle?.make} ${booking.vehicle?.model}</p>
      <p>Pickup Location: ${booking.pickupLocation?.name || 'TBD'}</p>
      <p>Pickup Date/Time: ${booking.startDate}</p>
      <p>Please arrive at the location with your ID and driver's license.</p>
    `;
    await this.sendEmail(userEmail, subject, html);
  }

  async sendBookingAlert(userEmail, booking, alerts) {
    const subject = 'Booking Alert - CarHive';
    const html = `
      <h1>Alert for your active booking</h1>
      <p>Booking ID: ${booking.id}</p>
      <p>Vehicle: ${booking.vehicle?.make} ${booking.vehicle?.model}</p>
      <p>Alerts: ${alerts.join(', ')}</p>
      <p>Please check your vehicle and driving conditions.</p>
    `;
    await this.sendEmail(userEmail, subject, html);
  }

  async sendReturnReceipt(userEmail, booking, adjustments) {
    const subject = 'Return Receipt - CarHive';
    const html = `
      <h1>Vehicle Return Processed</h1>
      <p>Booking ID: ${booking.id}</p>
      <p>Vehicle: ${booking.vehicle?.make} ${booking.vehicle?.model}</p>
      <p>Return Date: ${new Date().toLocaleDateString()}</p>
      <p>Base Amount: $${(booking.totalPrice - adjustments.totalAdjustments).toFixed(2)}</p>
      ${adjustments.lateFee ? `<p>Late Fee: $${adjustments.lateFee.toFixed(2)}</p>` : ''}
      ${adjustments.extraMileageCost ? `<p>Extra Mileage: $${adjustments.extraMileageCost.toFixed(2)}</p>` : ''}
      ${adjustments.fuelCost ? `<p>Fuel Top-up: $${adjustments.fuelCost.toFixed(2)}</p>` : ''}
      ${adjustments.damageCost ? `<p>Damage Cost: $${adjustments.damageCost.toFixed(2)}</p>` : ''}
      <p><strong>Total Amount: $${booking.totalPrice.toFixed(2)}</strong></p>
      <p>Thank you for choosing CarHive!</p>
    `;
    await this.sendEmail(userEmail, subject, html);
  }

  async sendReviewRequest(userEmail, booking) {
    const subject = 'How was your rental experience? - CarHive';
    const html = `
      <h1>We hope you enjoyed your rental!</h1>
      <p>Booking ID: ${booking.id}</p>
      <p>Please take a moment to share your feedback: <a href="${process.env.FRONTEND_URL}/review/${booking.id}">Leave a Review</a></p>
      <p>Your feedback helps us improve our service.</p>
      <p>Thank you!</p>
    `;
    await this.sendEmail(userEmail, subject, html);
  }

  async sendCancellationNotice(userEmail, booking, details) {
    const subject = 'Booking Cancellation Confirmation - CarHive';
    const html = `
      <h1>Your booking has been cancelled</h1>
      <p>Booking ID: ${booking.id}</p>
      <p>Vehicle: ${booking.vehicle?.make} ${booking.vehicle?.model}</p>
      <p>Cancellation Fee: $${details.cancellationFee.toFixed(2)}</p>
      <p>Refund Amount: $${details.refundAmount.toFixed(2)}</p>
      <p>If you have any questions, please contact our support team.</p>
    `;
    await this.sendEmail(userEmail, subject, html);
  }

  async sendIncidentReport(adminEmail, booking, incident) {
    const subject = `Incident Report - Booking ${booking.id}`;
    const html = `
      <h1>Incident Reported</h1>
      <p>Booking ID: ${booking.id}</p>
      <p>User: ${booking.user?.name} (${booking.user?.email})</p>
      <p>Vehicle: ${booking.vehicle?.make} ${booking.vehicle?.model}</p>
      <p>Type: ${incident.type}</p>
      <p>Severity: ${incident.severity}</p>
      <p>Description: ${incident.description}</p>
      <p>Location: ${incident.location}</p>
      <p>Please handle immediately.</p>
    `;
    await this.sendEmail(adminEmail, subject, html);
  }

  async sendDigitalAgreement(userEmail, booking, qrCode) {
    const subject = 'Digital Rental Agreement & QR Code - CarHive';
    const html = `
      <h1>Your Digital Rental Agreement</h1>
      <p>Booking ID: ${booking.id}</p>
      <p>Vehicle: ${booking.vehicle?.make} ${booking.vehicle?.model}</p>
      <p>Pickup: ${booking.startDate} at ${booking.pickupLocation?.name}</p>
      <p>Drop-off: ${booking.endDate} at ${booking.dropoffLocation?.name}</p>
      <p>Total: $${booking.totalPrice}</p>
      <p>QR Code for Pickup: ${qrCode}</p>
      <p>Please bring this QR code to the pickup location.</p>
      <p>Terms & Conditions: [Link to full agreement]</p>
    `;
    await this.sendEmail(userEmail, subject, html);
  }

  async sendSOSAlert(adminEmail, booking, payload) {
    const subject = `SOS Requested - Booking ${booking.id}`;
    const html = `
      <h1>Roadside Assistance Needed</h1>
      <p>Booking ID: ${booking.id}</p>
      <p>User: ${booking.user?.name} (${booking.user?.email})</p>
      <p>Vehicle: ${booking.vehicle?.make} ${booking.vehicle?.model}</p>
      <p>Note: ${payload?.note || ''}</p>
      <p>Location: ${payload?.location || 'Unknown'}</p>
      <p>Please dispatch assistance ASAP.</p>
    `;
    await this.sendEmail(adminEmail, subject, html);
  }

  async sendCheckinReminder(userEmail, booking) {
    const subject = 'Online Check-in Reminder - CarHive';
    const html = `
      <h1>Complete Your Online Check-in</h1>
      <p>Booking ID: ${booking.id}</p>
      <p>Your pickup is in 24 hours. Please complete online check-in: <a href="${process.env.FRONTEND_URL}/checkin/${booking.id}">Check-in Now</a></p>
      <p>Upload documents and sign the digital agreement.</p>
    `;
    await this.sendEmail(userEmail, subject, html);
  }
}

module.exports = new NotificationService();