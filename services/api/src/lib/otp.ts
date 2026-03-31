import crypto from "crypto"

export function generateOTP(): string{
  return crypto.randomInt(100000, 999999).toString(); 
}
export function getOTPExpiry(): Date{
  const expiry = new Date(); 
  expiry.setMinutes(expiry.getMinutes() + 15); 
  return expiry; 
}

export function isOTPExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}