import nodemailer from 'nodemailer';

// Configure via env vars: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const FROM = process.env.EMAIL_FROM || '"Auction App" <noreply@auction.com>';

const send = async (to: string, subject: string, html: string) => {
  if (!process.env.EMAIL_USER) {
    console.warn('[email] EMAIL_USER not set, skipping email send');
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('[email] Failed to send:', err);
  }
};

export const sendOutbidEmail = async (to: string, data: { username: string; itemTitle: string; currentBid: number; itemId: string }) => {
  await send(
    to,
    `You've been outbid on "${data.itemTitle}"`,
    `<p>Hi ${data.username},</p>
     <p>Someone placed a higher bid of <strong>€${data.currentBid}</strong> on <strong>${data.itemTitle}</strong>.</p>
     <p><a href="${process.env.APP_URL}/items/${data.itemId}">Bid again</a></p>`
  );
};

export const sendWinEmail = async (to: string, data: { username: string; itemTitle: string; finalBid: number; itemId: string }) => {
  await send(
    to,
    `You won the auction for "${data.itemTitle}"!`,
    `<p>Hi ${data.username},</p>
     <p>Congratulations! You won <strong>${data.itemTitle}</strong> with a bid of <strong>€${data.finalBid}</strong>.</p>
     <p><a href="${process.env.APP_URL}/items/${data.itemId}">View your item</a></p>`
  );
};

export const sendAuctionEndingSoonEmail = async (to: string, data: { username: string; itemTitle: string; minutesLeft: number; itemId: string }) => {
  await send(
    to,
    `Auction ending soon: "${data.itemTitle}"`,
    `<p>Hi ${data.username},</p>
     <p>The auction for <strong>${data.itemTitle}</strong> ends in <strong>${data.minutesLeft} minutes</strong>.</p>
     <p><a href="${process.env.APP_URL}/items/${data.itemId}">Don't miss out</a></p>`
  );
};