import Razorpay from "razorpay";
import { config } from "dotenv";

config();

const RAZORPAY_API_KEY = process.env.RAZORPAY_API_KEY as string;
const RAZORPAY_API_SECRET_KEY = process.env.RAZORPAY_API_SECRET_KEY as string;

if (!RAZORPAY_API_KEY || !RAZORPAY_API_SECRET_KEY) {
  console.warn("⚠️ Razorpay API keys are not set in environment variables.");
}

export const razorpay = new Razorpay({
  key_id: RAZORPAY_API_KEY || "dummy_key",
  key_secret: RAZORPAY_API_SECRET_KEY || "dummy_secret",
});
