// src/utils/mailer.ts

import nodemailer from "nodemailer";
import { SMTP_EMAIL, SMTP_PASSWORD } from "../env/env.import.js";

const isProd = process.env.NODE_ENV === "production";

// ── Transporter (Gmail SMTP) ─────────────────────

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // Use SSL/TLS to avoid Render port blocking
  family: 4,
  auth: {
    user: SMTP_EMAIL,
    pass: SMTP_PASSWORD, // Make sure to use an App Password if using Gmail
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// ── Types ──────────────────────────────────────────────────

type EmailType = "otp" | "welcome" | "passwordChanged" | "notification" | "invoice";

interface BaseEmailOptions {
  to: string;
  type: EmailType;
}

interface OTPEmailOptions extends BaseEmailOptions {
  type: "otp";
  payload: { otp: string; username: string };
}

interface WelcomeEmailOptions extends BaseEmailOptions {
  type: "welcome";
  payload: { username: string };
}

interface PasswordChangedEmailOptions extends BaseEmailOptions {
  type: "passwordChanged";
  payload: { username: string };
}

interface NotificationEmailOptions extends BaseEmailOptions {
  type: "notification";
  payload: { username: string; title: string; body: string };
}

interface InvoiceEmailOptions extends BaseEmailOptions {
  type: "invoice";
  payload: {
    username: string;
    orderId: string;
    paymentId: string;
    itemName: string;
    amount: number;
    currency: string;
    tokens: number;
    date: string;
  };
}

type EmailOptions =
  | OTPEmailOptions
  | WelcomeEmailOptions
  | PasswordChangedEmailOptions
  | NotificationEmailOptions
  | InvoiceEmailOptions;

// ── Templates ──────────────────────────────────────────────

const baseLayout = (content: string): string => `
  <div style="
    font-family: Arial, sans-serif;
    max-width: 520px;
    margin: auto;
    border: 1px solid #e4e4e4;
    border-radius: 10px;
    overflow: hidden;
  ">
    <div style="background: #4F46E5; padding: 20px 30px;">
      <h1 style="color: white; margin: 0; font-size: 22px;">AI ChatBot</h1>
    </div>
    <div style="padding: 30px;">
      ${content}
    </div>
    <div style="background: #f9f9f9; padding: 16px 30px; text-align: center;">
      <p style="color: #aaa; font-size: 12px; margin: 0;">
        © ${new Date().getFullYear()} AI ChatBot. All rights reserved.
      </p>
    </div>
  </div>
`;

const templates: Record<
  EmailType,
  (payload: EmailOptions["payload"]) => { subject: string; html: string }
> = {
  otp: (payload) => {
    const { otp, username } = payload as OTPEmailOptions["payload"];
    return {
      subject: "Verify your email - OTP",
      html: baseLayout(`
        <h2 style="color: #333;">Hello, ${username} 👋</h2>
        <p style="color: #555;">
          Use the OTP below to verify your account.
          It expires in <strong>10 minutes</strong>.
        </p>
        <div style="
          font-size: 38px;
          font-weight: bold;
          letter-spacing: 10px;
          text-align: center;
          padding: 20px;
          background: #f4f4f4;
          border-radius: 8px;
          margin: 24px 0;
          color: #4F46E5;
        ">
          ${otp}
        </div>
        <p style="color: #888; font-size: 13px;">
          If you didn't request this, please ignore this email.
        </p>
      `),
    };
  },

  welcome: (payload) => {
    const { username } = payload as WelcomeEmailOptions["payload"];
    return {
      subject: "Welcome to AI ChatBot 🎉",
      html: baseLayout(`
        <h2 style="color: #333;">Welcome aboard, ${username}! 🚀</h2>
        <p style="color: #555;">
          We're excited to have you. Your account has been successfully created.
        </p>
        <p style="color: #555;">
          Start exploring the AI ChatBot and experience the future of conversation.
        </p>
        <a href="${process.env.CLIENT_URL}" style="
          display: inline-block;
          margin-top: 20px;
          padding: 12px 28px;
          background: #4F46E5;
          color: white;
          border-radius: 6px;
          text-decoration: none;
          font-weight: bold;
        ">
          Get Started
        </a>
      `),
    };
  },

  passwordChanged: (payload) => {
    const { username } = payload as PasswordChangedEmailOptions["payload"];
    return {
      subject: "Your password was changed",
      html: baseLayout(`
        <h2 style="color: #333;">Hi, ${username}</h2>
        <p style="color: #555;">
          Your password has been changed successfully.
        </p>
        <p style="color: #e53e3e; font-weight: bold;">
          If you did not make this change, please contact support immediately.
        </p>
        <a href="${process.env.CLIENT_URL}/contact" style="
          display: inline-block;
          margin-top: 20px;
          padding: 12px 28px;
          background: #e53e3e;
          color: white;
          border-radius: 6px;
          text-decoration: none;
          font-weight: bold;
        ">
          Contact Support
        </a>
      `),
    };
  },

  notification: (payload) => {
    const { username, title, body } =
      payload as NotificationEmailOptions["payload"];
    return {
      subject: title,
      html: baseLayout(`
        <h2 style="color: #333;">Hi, ${username}</h2>
        <h3 style="color: #4F46E5;">${title}</h3>
        <p style="color: #555;">${body}</p>
      `),
    };
  },

  invoice: (payload) => {
    const { username, orderId, paymentId, itemName, amount, currency, tokens, date } =
      payload as InvoiceEmailOptions["payload"];
    return {
      subject: `Payment Invoice - ${itemName} [${orderId}]`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: auto; border: 1px solid #242424; border-radius: 12px; overflow: hidden; background-color: #09090b; color: #e4e4e7;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px 32px;">
            <h1 style="color: #000; margin: 0; font-size: 22px; font-weight: 800;">GoChat AI — Official Receipt</h1>
            <p style="color: #1c1917; margin: 4px 0 0 0; font-size: 13px; font-weight: 600;">Payment & Subscription Invoice</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">Hello ${username},</h2>
            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6;">
              Thank you for your purchase! Your payment has been successfully processed, and your plan credentials have been activated.
            </p>

            <div style="background-color: #141417; border: 1px solid #27272a; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <tr>
                  <td style="padding: 6px 0; color: #71717a;">Order ID:</td>
                  <td style="padding: 6px 0; color: #ffffff; font-weight: bold; font-family: monospace;">${orderId}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a;">Payment ID:</td>
                  <td style="padding: 6px 0; color: #ffffff; font-weight: bold; font-family: monospace;">${paymentId}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717a;">Transaction Date:</td>
                  <td style="padding: 6px 0; color: #ffffff;">${date}</td>
                </tr>
              </table>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
              <thead>
                <tr style="border-bottom: 1px solid #27272a; text-transform: uppercase; font-size: 11px; color: #71717a;">
                  <th style="padding: 10px 0; text-align: left;">Item Description</th>
                  <th style="padding: 10px 0; text-align: center;">Tokens</th>
                  <th style="padding: 10px 0; text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #1f1f23;">
                  <td style="padding: 14px 0; color: #ffffff; font-weight: bold;">${itemName}</td>
                  <td style="padding: 14px 0; text-align: center; color: #f59e0b; font-weight: bold;">+${tokens.toLocaleString()}</td>
                  <td style="padding: 14px 0; text-align: right; color: #ffffff; font-weight: bold;">₹${amount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div style="background-color: #18181b; border-radius: 8px; padding: 16px; text-align: right;">
              <span style="color: #a1a1aa; font-size: 13px; margin-right: 12px;">Total Paid:</span>
              <span style="color: #f59e0b; font-size: 22px; font-weight: 800;">₹${amount.toLocaleString()} ${currency}</span>
            </div>

            <p style="color: #71717a; font-size: 12px; margin-top: 28px; line-height: 1.5;">
              If you have any questions regarding this invoice, please reach out to our support team at <a href="mailto:support@gochat.ai" style="color: #f59e0b; text-decoration: none;">support@gochat.ai</a>.
            </p>
          </div>
          <div style="background-color: #121215; padding: 16px 32px; text-align: center; border-top: 1px solid #27272a;">
            <p style="color: #52525b; font-size: 11px; margin: 0;">
              © ${new Date().getFullYear()} GoChat AI Studio. All rights reserved.
            </p>
          </div>
        </div>
      `,
    };
  },
};

// ── Main sendEmail ─────────────────────────────────────────
// KEY CHANGE from original: this NEVER throws. It logs and resolves
// to true/false, so a failed email can never break register/login/
// reset-password/payment flows.

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  const { subject, html } = templates[options.type](options.payload);

  try {
    const info = await transporter.sendMail({
      from: `"AI ChatBot" <${SMTP_EMAIL}>`,
      to: options.to,
      subject,
      html,
    });

    console.log(`[Mailer] Sent "${options.type}" to ${options.to} (${info.messageId})`);
    return true;
  } catch (err) {
    console.error(
      `[Mailer] Failed to send "${options.type}" email to ${options.to}:`,
      (err as Error).message
    );
    return false; // swallow — caller decides what to do, but auth flow never breaks
  }
};
