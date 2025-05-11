import { log } from './vite';

// Mock SMS service for development
// In production, this would use Twilio or another SMS provider
export class MockSmsService {
  // Store OTPs with expiration for verification
  private otpStore: Map<string, { otp: string; expires: number }> = new Map();
  
  constructor() {
    log('Mock SMS Service initialized', 'sms');
    
    // Cleanup expired OTPs every minute
    setInterval(() => {
      const now = Date.now();
      for (const [phone, data] of this.otpStore.entries()) {
        if (data.expires < now) {
          this.otpStore.delete(phone);
        }
      }
    }, 60000);
  }
  
  // Generate a 6-digit OTP
  generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  // Store OTP with 5-minute expiration
  storeOtp(phoneNumber: string, otp: string): void {
    // Format phone to international format if needed
    let formattedPhone = phoneNumber;
    if (phoneNumber.startsWith('0')) {
      formattedPhone = '+2' + phoneNumber;
    }
    
    // 5 minutes expiration
    const expires = Date.now() + 5 * 60 * 1000;
    this.otpStore.set(formattedPhone, { otp, expires });
  }
  
  // Verify OTP for phone number
  verifyOtp(phoneNumber: string, otp: string): boolean {
    // Format phone to international format if needed
    let formattedPhone = phoneNumber;
    if (phoneNumber.startsWith('0')) {
      formattedPhone = '+2' + phoneNumber;
    }
    
    const record = this.otpStore.get(formattedPhone);
    
    if (!record) {
      return false;
    }
    
    if (record.expires < Date.now()) {
      this.otpStore.delete(phoneNumber);
      return false;
    }
    
    if (record.otp !== otp) {
      return false;
    }
    
    // OTP verified, delete it to prevent reuse
    this.otpStore.delete(phoneNumber);
    return true;
  }
  
  // Mock sending an SMS - in development just log to console
  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    // Validate Egyptian phone number format
    // Supports formats: 01xxxxxxxxx or +201xxxxxxxxx
    const egyptPhoneRegex = /^(\+20|0)1[0-2,5]{1}[0-9]{8}$/;
    
    if (!egyptPhoneRegex.test(phoneNumber)) {
      log(`Invalid Egyptian phone number format: ${phoneNumber}`, 'sms');
      return false;
    }
    
    // Format phone to international format if needed
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '+2' + phoneNumber;
    }
    
    log(`📱 SMS to ${phoneNumber}: ${message}`, 'sms');
    return true;
  }
  
  // Send OTP via SMS
  async sendOtp(phoneNumber: string): Promise<{ success: boolean; otp?: string }> {
    try {
      // Format phone to international format if needed
      let formattedPhone = phoneNumber;
      if (phoneNumber.startsWith('0')) {
        formattedPhone = '+2' + phoneNumber;
      }
      
      const otp = this.generateOtp();
      this.storeOtp(formattedPhone, otp);
      
      const message = `رمز التحقق الخاص بك لبرنامج مكافآت بريق هو: ${otp}`;
      const sent = await this.sendSms(formattedPhone, message);
      
      if (sent) {
        log(`OTP sent to ${formattedPhone}: ${otp}`, 'sms');
        // Return OTP in development for easy testing
        return { success: true, otp };
      } else {
        return { success: false };
      }
    } catch (error) {
      log(`Error sending OTP: ${error}`, 'sms');
      return { success: false };
    }
  }
}

export const smsService = new MockSmsService();