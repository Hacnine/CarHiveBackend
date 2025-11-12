/**
 * Integration Service
 * Central abstraction layer for third-party API integrations
 */

// Twilio SMS Integration
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  } catch (error) {
    console.warn('Twilio not configured:', error.message);
  }
}

class IntegrationService {
  /**
   * Send SMS via Twilio
   * @param {string} to - Phone number in E.164 format (e.g., +15555555555)
   * @param {string} message - Text message content
   */
  static async sendSMS(to, message) {
    if (!twilioClient) {
      console.warn('Twilio not configured. SMS not sent to:', to);
      return { success: false, error: 'Twilio not configured' };
    }

    try {
      const result = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });

      console.log('SMS sent successfully:', result.sid);
      return { success: true, sid: result.sid };
    } catch (error) {
      console.error('SMS send error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send booking confirmation SMS
   */
  static async sendBookingConfirmationSMS(phone, booking) {
    const message = `CarHive: Your booking #${booking.id.slice(-6)} is confirmed! Pickup: ${new Date(booking.startDate).toLocaleDateString()}. Check details in your account.`;
    return await this.sendSMS(phone, message);
  }

  /**
   * Send SOS alert SMS
   */
  static async sendSOSAlertSMS(phone, booking, location) {
    const message = `CarHive EMERGENCY: SOS request from booking #${booking.id.slice(-6)}. Location: ${location || 'Unknown'}. Contact: ${booking.user?.phone || 'N/A'}`;
    return await this.sendSMS(phone, message);
  }

  /**
   * Send pickup reminder SMS
   */
  static async sendPickupReminderSMS(phone, booking) {
    const message = `CarHive: Your rental pickup is in 24 hours. Booking #${booking.id.slice(-6)}. Complete check-in: ${process.env.FRONTEND_URL}/checkin/${booking.id}`;
    return await this.sendSMS(phone, message);
  }

  /**
   * Get directions using Google Maps API
   * @param {object} origin - { lat, lng } or address string
   * @param {object} destination - { lat, lng } or address string
   */
  static async getDirections(origin, destination) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.warn('Google Maps API key not configured');
      return { success: false, error: 'Google Maps not configured' };
    }

    try {
      const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
      const destStr = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}&key=${apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        return {
          success: true,
          distance: route.legs[0].distance.text,
          duration: route.legs[0].duration.text,
          polyline: route.overview_polyline.points,
          steps: route.legs[0].steps.map(step => ({
            instruction: step.html_instructions,
            distance: step.distance.text,
            duration: step.duration.text
          }))
        };
      }

      return { success: false, error: data.status };
    } catch (error) {
      console.error('Google Maps API error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate distance between two coordinates
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance; // in kilometers
  }

  /**
   * Convert degrees to radians
   */
  static toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Geocode address to coordinates
   */
  static async geocodeAddress(address) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      return { success: false, error: 'Google Maps not configured' };
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return {
          success: true,
          lat: location.lat,
          lng: location.lng,
          formattedAddress: data.results[0].formatted_address
        };
      }

      return { success: false, error: data.status };
    } catch (error) {
      console.error('Geocoding error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process payment via Stripe (refactored placeholder)
   * Note: Actual Stripe integration should be implemented in payment controller
   */
  static async processPayment(amount, method, metadata = {}) {
    // This is a placeholder - actual Stripe integration exists in payment flow
    console.log('Payment processing:', { amount, method, metadata });
    
    // In production, call Stripe API here
    return {
      success: true,
      transactionId: `txn_${Date.now()}`,
      amount,
      method
    };
  }

  /**
   * Send multi-channel notification (email + SMS)
   */
  static async sendMultiChannelNotification(email, phone, subject, emailBody, smsMessage) {
    const results = {
      email: { success: false },
      sms: { success: false }
    };

    // Send email
    try {
      const notificationService = require('./notificationService');
      await notificationService.sendEmail(email, subject, emailBody);
      results.email.success = true;
    } catch (error) {
      console.error('Email send failed:', error);
      results.email.error = error.message;
    }

    // Send SMS
    if (phone) {
      results.sms = await this.sendSMS(phone, smsMessage);
    }

    return results;
  }
}

module.exports = IntegrationService;
