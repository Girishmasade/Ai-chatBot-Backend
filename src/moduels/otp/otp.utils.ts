// modules/auth/utils/otp.utils.ts  ← new file

import crypto from "crypto";
import redisClient from "../../config/redis.config.js";
import { sendEmail } from "../../services/mailer.utils.js";

const OTP_PREFIX   = "otp:";
const OTP_TTL      = 200;
const RETRY_PREFIX = "otp:retries:";
const RETRY_TTL    = 200;

export const generateOTP = (): string =>
  crypto.randomInt(100000, 999999).toString();

export const sendOTPToEmail = async (
  email: string,
  username: string,
): Promise<void> => {
  const otp = generateOTP();

  await redisClient.setEx(`${OTP_PREFIX}${email}`, OTP_TTL, otp);
  await redisClient.incr(`${RETRY_PREFIX}${email}`);
  await redisClient.expire(`${RETRY_PREFIX}${email}`, RETRY_TTL);

  await sendEmail({
    to: email,
    type: "otp",
    payload: { otp, username },
  });
};