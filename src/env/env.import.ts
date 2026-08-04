import dotenv from "dotenv";
dotenv.config();

// node Env

const node_env = process.env.NODE_ENV as String

// port

export const PORT = process.env.PORT || (10000 as unknown as number);

// Database

const MONGO_URI = process.env.MONGO_URI as string;
const MONGO_PASS = process.env.MONGO_PASS as string;

// jwt

const jwtAccessSecret = process.env.ACCESS_TOKEN_SECRET as string;
const jwtRefreshSecret = process.env.REFRESH_TOKEN_SECRET as string;

// redis

const redisUrl = process.env.REDIS_URL as string;

// mailer

const SMTP_EMAIL = process.env.SMTP_EMAIL as string;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD as string;

// google auth keys

const googleClientId = process.env.GOOGLE_CLIENT_ID as string;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET as string;
const googleFallbackUrl = process.env.GOOGLE_FALLBACK_URL as string;
// facebook auth keys

const facebookClientId = process.env.FACEBOOK_APP_ID as string;
const facebookSecret = process.env.FACEBOOK_SECRET as string;
const facebookFallbackUrl = process.env.FACEBOOK_FALLBACK_URL as string;

// github auth keys

const githubClientId = process.env.GITHUB_APP_ID as string;
const githubSecret = process.env.GITHUB_SECRET as string;
const githubFallbackUrl = process.env.GITHUB_FALLBACK_URL as string;

// clodinary config url

const cloudinaryUrl = process.env.CLOUDINARY_URL as string;
const encryptionSecret = process.env.ENCRYPTION_SECRET as string;

// vvector db

const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME as string;
const PINECONE_API_KEY = process.env.PINECONE_API_KEY as string;
const PINECONE_REGION = process.env.PINECONE_REGION as string;

export {
  node_env,
  redisUrl,
  SMTP_EMAIL,
  SMTP_PASSWORD,
  MONGO_URI,
  jwtAccessSecret,
  jwtRefreshSecret,
  googleClientId,
  googleSecret,
  googleFallbackUrl,
  facebookClientId,
  facebookSecret,
  facebookFallbackUrl,
  githubClientId,
  githubSecret,
  githubFallbackUrl,
  cloudinaryUrl,
  encryptionSecret,
  PINECONE_INDEX_NAME,
  PINECONE_API_KEY,
  PINECONE_REGION,
};
