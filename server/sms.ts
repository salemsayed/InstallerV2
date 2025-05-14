import { log } from './vite';
import { db } from './db';
import { sql } from 'drizzle-orm';

// Mock SMS service for development
// In production, this would use Twilio or another SMS provider
export class MockSmsService {
  // We'll store OTPs in the database for persistence across instances
  
  constructor() {
    // Initialize OTP table and set up cleanup
    this.initializeOtpTable();
    
    // Cleanup expired OTPs every minute
    setInterval(() => {
      this.cleanupExpiredOtps();
    }, 60000);
  }
  
  // Initialize OTP table if it doesn't exist
  private async initializeOtpTable() {
    try {
      // Create otps table if it doesn't exist
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS otps (
          phone_number VARCHAR(15) PRIMARY KEY,
          otp VARCHAR(6) NOT NULL,
          expires BIGINT NOT NULL
        )
      `);
      // OTP table initialized 
    } catch (error) {
      console.error(`Error initializing OTP table: ${error}`);
    }
  }
  
  // Clean up expired OTPs from the database
  private async cleanupExpiredOtps() {
    try {
      const now = Date.now();
      await db.execute(sql`DELETE FROM otps WHERE expires < ${now}`);
    } catch (error) {
      console.error(`Error cleaning up OTPs: ${error}`);
    }
  }
  
  // Generate a 6-digit OTP
  generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  // Store OTP with 5-minute expiration in database
  async storeOtp(phoneNumber: string, otp: string): Promise<void> {
    // Format phone to international format if needed
    let formattedPhone = phoneNumber;
    if (phoneNumber.startsWith('0')) {
      formattedPhone = '+2' + phoneNumber;
    }
    
    // 5 minutes expiration
    const expires = Date.now() + 5 * 60 * 1000;
    
    try {
      // Insert or update the OTP
      await db.execute(sql`
        INSERT INTO otps (phone_number, otp, expires)
        VALUES (${formattedPhone}, ${otp}, ${expires})
        ON CONFLICT (phone_number) 
        DO UPDATE SET otp = ${otp}, expires = ${expires}
      `);
    } catch (error) {
      console.error(`Error storing OTP: ${error}`);
    }
  }
  
  // Verify OTP for phone number from database
  async verifyOtp(phoneNumber: string, otp: string): Promise<boolean> {
    // Format phone to international format if needed
    let formattedPhone = phoneNumber;
    if (phoneNumber.startsWith('0')) {
      formattedPhone = '+2' + phoneNumber;
    }
    
    try {
      const result = await db.execute(sql`
        SELECT * FROM otps WHERE phone_number = ${formattedPhone}
      `);
      
      const records = result.rows;
      if (!records || records.length === 0) {
        return false;
      }
      
      const record = records[0];
      const storedOtp = record.otp;
      const expires = Number(record.expires);
      
      if (expires < Date.now()) {
        // Delete expired OTP
        await db.execute(sql`DELETE FROM otps WHERE phone_number = ${formattedPhone}`);
        return false;
      }
      
      if (storedOtp !== otp) {
        return false;
      }
      
      // OTP verified, delete it to prevent reuse
      await db.execute(sql`DELETE FROM otps WHERE phone_number = ${formattedPhone}`);
      return true;
    } catch (error) {
      log(`Error verifying OTP: ${error}`, 'sms');
      return false;
    }
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