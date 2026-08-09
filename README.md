# AI ChatBot Backend

This backend is the server-side API for the AI ChatBot project. It is built with Node.js, TypeScript, Express, MongoDB, Redis, BullMQ, Passport social auth, Pinecone vector storage, Cloudinary media uploads, and socket-based real-time support.

## Key Features

- REST API with Express and TypeScript
- MongoDB data storage via Mongoose
- Redis caching and BullMQ job queues
- Social login via Google, Facebook, and GitHub
- JWT access/refresh authentication
- Cloudinary file upload and media storage
- Pinecone vector store for RAG and semantic search
- Email mailer support via SMTP
- Graceful shutdown and worker management

## Requirements

- Node.js 20+ or compatible
- npm or yarn
- MongoDB connection
- Redis server
- Cloudinary account or Cloudinary URL
- Pinecone API credentials for vector search
- SMTP credentials for email sending
- Optional social auth credentials for Google, Facebook, GitHub

## Setup

1. Clone or navigate into this backend folder.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file at the project root and define the required environment variables.

### Example `.env`

```env
NODE_ENV=development
PORT=5000

MONGO_URI=mongodb+srv://username:@cluster.mongodb.net/dbname
MONGO_PASS=your_database_password

ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
SESSION_SECRET=your_session_secret

REDIS_URL=redis://localhost:6379

SMTP_EMAIL=your-smtp-email@example.com
SMTP_PASSWORD=your-smtp-password
CLIENT_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_FALLBACK_URL=http://localhost:5000/auth/google/callback

FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_SECRET=your_facebook_secret
FACEBOOK_FALLBACK_URL=http://localhost:5000/auth/facebook/callback

GITHUB_APP_ID=your_github_app_id
GITHUB_SECRET=your_github_secret
GITHUB_FALLBACK_URL=http://localhost:5000/auth/github/callback

CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name
ENCRYPTION_SECRET=your_encryption_secret

PINECONE_INDEX_NAME=rag-documents
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_REGION=us-east-1
```

> Note: `CLIENT_URL` is used in email templates and redirect URLs.

## Scripts

- `npm run dev` — start the server in watch mode via `tsx`
- `npm run build` — compile TypeScript to the `dist` folder
- `npm start` — run the compiled production build

## How to Run

```bash
npm run dev
```

The backend will listen on the port defined by `PORT` or default to `5000`.

## Project Structure

- `src/server.ts` — entry point and app bootstrap
- `src/env/env.import.ts` — environment variable loader
- `src/config/` — configuration for database, Redis, Cloudinary, Passport, Razorpay, and RAG
- `src/routers/` — Express route registration
- `src/moduels/` — feature modules for auth, user, document, payment, AI request, and more
- `src/middlewares/` — common request middleware
- `src/redis/` — BullMQ worker and scheduler setup
- `src/vectorStore/` — Pinecone vector client and index management

## Notes

- The server uses `express-session` for session management and Passport for social login.
- BullMQ workers start automatically on server boot and use Redis.
- `configCloud()` initializes Cloudinary from `CLOUDINARY_URL`.
- `connectDb()` connects to MongoDB using `MONGO_URI`.

## Troubleshooting

- If the app fails to start, verify your `.env` values and ensure Redis/MongoDB are reachable.
- For social auth callbacks, confirm the callback URLs match the provider app settings.
- If emails do not send, verify `SMTP_EMAIL` and `SMTP_PASSWORD`.

## License

This backend is provided without license information. Add a license file if necessary.
