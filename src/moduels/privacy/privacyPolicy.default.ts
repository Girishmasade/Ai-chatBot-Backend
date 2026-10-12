export interface DefaultPrivacyPolicyData {
  title: string;
  slug: string;
  version: string;
  summary: string;
  status: "draft" | "published" | "archived";
  isCurrent: boolean;
  effectiveDate: Date;
  lastUpdated: Date;
  contactEmail: string;
  retentionPeriod: string;
  cookiePolicySummary: string;
  bannerImage: {
    url: string;
    publicId: string;
    caption: string;
  };
  securityMeasures: string[];
  userRights: string[];
  thirdPartyProcessors: Array<{
    name: string;
    purpose: string;
    privacyPolicyUrl?: string;
  }>;
  sections: Array<{
    title: string;
    content: string;
    order: number;
    icon?: string;
    image?: {
      url: string;
      publicId?: string;
      caption?: string;
    };
  }>;
  changelog: string;
}

export const defaultPrivacyPolicy: DefaultPrivacyPolicyData = {
  title: "GoChat AI Privacy Policy",
  slug: "privacy-policy",
  version: "1.0.0",
  summary:
    "At GoChat AI, your privacy and transparency in artificial intelligence interactions are our highest priorities. This Privacy Policy details how we collect, process, safeguard, and retain your data when you interact with our conversational bots, generative studios, and API integrations.",
  status: "published",
  isCurrent: true,
  effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
  lastUpdated: new Date(),
  contactEmail: "privacy@gochat.ai",
  retentionPeriod:
    "30 days for operational session logs; account lifetime for user profile data; immediate deletion upon user account closure.",
  cookiePolicySummary:
    "We use strictly necessary session cookies and encrypted JWT tokens for authentication. No third-party behavioral advertising cookies are tracked.",
  bannerImage: {
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
    publicId: "default_privacy_banner",
    caption: "GoChat AI Enterprise Security & Data Safeguards",
  },
  securityMeasures: [
    "AES-256 encryption at rest for database records",
    "TLS 1.3 encryption for all data in transit",
    "Isolated per-user vector namespaces in Pinecone",
    "Strict Role-Based Access Control (RBAC)",
    "Ephemeral API token proxies to protect LLM keys",
    "Automated audit logging and real-time security alerts",
  ],
  userRights: [
    "Right to Access: Request a full export of your personal data and chat history",
    "Right to Rectification: Update or correct your profile information at any time",
    "Right to Erasure ('Right to be Forgotten'): Permanently wipe your account, chats, and uploaded vectors",
    "Right to Restrict Processing: Pause AI model inference on your uploaded documents",
    "Right to Data Portability: Export your prompt templates, generated assets, and transaction records",
    "Right to Object: Opt out of non-essential usage telemetry",
  ],
  thirdPartyProcessors: [
    {
      name: "Google Gemini AI",
      purpose: "Core conversational and multimodal LLM inference",
      privacyPolicyUrl: "https://policies.google.com/privacy",
    },
    {
      name: "Pinecone Database",
      purpose: "Vector embeddings storage for Retrieval-Augmented Generation (RAG)",
      privacyPolicyUrl: "https://www.pinecone.io/privacy/",
    },
    {
      name: "Cloudinary",
      purpose: "Secure media hosting and visual asset storage",
      privacyPolicyUrl: "https://cloudinary.com/privacy",
    },
    {
      name: "Redis / Upstash",
      purpose: "High-performance session caching and rate-limiting",
      privacyPolicyUrl: "https://redis.io/legal/privacy-policy/",
    },
    {
      name: "Razorpay",
      purpose: "PCI-DSS compliant payment processing for VIP subscriptions",
      privacyPolicyUrl: "https://razorpay.com/privacy/",
    },
  ],
  sections: [
    {
      title: "1. Information We Collect",
      content:
        "We collect information you provide directly, including account credentials (name, email, avatar), user prompts, conversation history, uploaded files (documents, images, videos for multimodal RAG), and billing metadata. We also collect automated diagnostic telemetry such as IP addresses, browser types, and response latency to maintain platform security.",
      order: 1,
      icon: "Database",
    },
    {
      title: "2. How We Use and Process AI Data",
      content:
        "Your inputs are processed to generate completions, synthesize images and video, and query your indexed documents. Importantly, we do NOT sell your personal data or user prompts to third parties. Requests sent to third-party model providers are transmitted via secure, server-side encrypted proxies with enterprise data privacy agreements.",
      order: 2,
      icon: "Brain",
    },
    {
      title: "3. Vector Storage & RAG Isolation",
      content:
        "When you upload documents for RAG (Retrieval-Augmented Generation), your data is chunked, embedded, and stored in an isolated, user-specific namespace in Pinecone. Only authenticated requests originating from your active session have retrieval access to your vector chunks.",
      order: 3,
      icon: "Cpu",
    },
    {
      title: "4. Data Retention & Permanent Deletion",
      content:
        "You retain ownership and complete control over your data. Chat sessions, uploaded files, and vector embeddings can be purged at any time from your settings or chat interface. Upon account termination, all corresponding personal information, wallet records, and AI assets are permanently destroyed within 30 days.",
      order: 4,
      icon: "Trash2",
    },
    {
      title: "5. Security & Encryption Safeguards",
      content:
        "We implement industry-standard cryptographic protocols including TLS 1.3 for data in flight and AES-256 for data at rest. Access tokens are cryptographically signed using rotating refresh tokens, and sensitive third-party API keys are never exposed to client browsers.",
      order: 5,
      icon: "ShieldCheck",
    },
    {
      title: "6. Your Privacy Rights & GDPR/CCPA Compliance",
      content:
        "Regardless of your geographic location, you enjoy comprehensive data rights including the Right to Access, Correct, Port, and Delete your personal records. To exercise any of these rights or request a comprehensive data dump, contact our Privacy Operations team.",
      order: 6,
      icon: "Scale",
    },
    {
      title: "7. Policy Updates & Administrative Revisions",
      content:
        "Our administrators may periodically update this Privacy Policy to reflect architectural improvements or legal developments. When significant updates occur, we will notify you via platform alerts and update the revision history accessible in the legal repository.",
      order: 7,
      icon: "FileText",
    },
  ],
  changelog: "Initial release of the GoChat AI platform comprehensive privacy policy.",
};
