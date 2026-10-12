export interface DefaultTermsAndConditionData {
  title: string;
  slug: string;
  version: string;
  summary: string;
  status: "draft" | "published" | "archived";
  isCurrent: boolean;
  effectiveDate: Date;
  lastUpdated: Date;
  contactEmail: string;
  governingLaw: string;
  bannerImage: {
    url: string;
    publicId: string;
    caption: string;
  };
  keyHighlights: string[];
  prohibitedActivities: string[];
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

export const defaultTermsAndCondition: DefaultTermsAndConditionData = {
  title: "GoChat AI Terms of Service & Generative Computing Agreement",
  slug: "terms-and-conditions",
  version: "1.0.0",
  summary:
    "These Terms of Service govern your access to and use of the GoChat AI platform, including conversational workspaces, prompt engineers, multimodal image and video synthesis studios, and document retrieval (RAG) vector stores. By creating an account or accessing our services, you agree to comply with all operational policies and usage guidelines set forth herein.",
  status: "published",
  isCurrent: true,
  effectiveDate: new Date("2026-01-01T00:00:00.000Z"),
  lastUpdated: new Date(),
  contactEmail: "legal@gochat.ai",
  governingLaw: "Laws of India / Standard Enterprise Technology Jurisdiction",
  bannerImage: {
    url: "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80",
    publicId: "default_terms_banner",
    caption: "GoChat AI Enterprise Legal Agreement & Safe Computing Charter",
  },
  keyHighlights: [
    "Non-refundable Token Allotments: Purchased or allocated inference tokens hold zero cash surrender value and are intended solely for generative compute.",
    "User Ownership of Generated Assets: Subject to upstream foundation model licenses, you retain rights to prompts and non-infringing generated outputs.",
    "Server-Side Model Proxies: We proxy API keys server-side to safeguard third-party developer secrets and prevent unauthorized credential exploitation.",
    "Continuous Safety Filters: All prompt submissions and synthesized media are processed through automated safety moderation filters.",
    "Multi-Device Session Management: Platform sessions are bound to rotating cryptographic tokens; rogue or abusive sessions may be terminated immediately.",
  ],
  prohibitedActivities: [
    "Generating non-consensual sexually explicit content, violent media, harassment, or unlawful hate speech.",
    "Attempting prompt injection, adversarial system prompt extraction, or jailbreaking model safety boundaries.",
    "Reverse engineering, decompiling, or intercepting client-server WebSocket communication streams.",
    "Distributing automated bots, scrapers, or initiating denial-of-service attacks against server endpoints.",
    "Reselling VIP subscription privileges or bypassing token consumption tracking mechanisms.",
  ],
  sections: [
    {
      title: "1. Agreement to Terms & Eligibility",
      content:
        "By accessing or using GoChat AI, you affirm that you are at least 18 years of age (or the age of legal majority in your jurisdiction) and possess full legal capacity to enter into these Terms. If you access our platform on behalf of an organization, you warrant that you are authorized to bind that entity to this binding contract.",
      order: 1,
      icon: "FileCheck",
    },
    {
      title: "2. User Accounts & Credential Security",
      content:
        "To access generative features, you must maintain an authenticated account. You are solely responsible for all actions conducted under your credentials. You agree to notify our security team immediately of any unauthorized account access. GoChat AI reserves the right to suspend or terminate accounts that present security threats or repeatedly fail authentication checks.",
      order: 2,
      icon: "UserCheck",
    },
    {
      title: "3. Token Credits, Subscriptions & Billing",
      content:
        "Access to advanced generative models (such as Google Gemini, high-definition image engines, and motion synthesis) requires token credits or an active VIP membership tier. Token packages are billed in advance via secure payment gateways (e.g., Razorpay) and are non-refundable. Credits expire in accordance with your plan billing cycle unless extended by administrative logs.",
      order: 3,
      icon: "CreditCard",
    },
    {
      title: "4. Acceptable Generative Computing Use",
      content:
        "You agree to use GoChat AI strictly for lawful, creative, and professional objectives. You must not generate visual, auditory, or textual media that violates local, national, or international regulations, incites hatred, encourages self-harm, or infringes intellectual property. Our moderation layer logs policy infractions to maintain platform integrity.",
      order: 4,
      icon: "ShieldAlert",
    },
    {
      title: "5. Intellectual Property & Output Ownership",
      content:
        "As between you and GoChat AI, you retain ownership of the original text, document uploads, and prompt instructions you submit. Subject to compliance with these Terms and upstream model terms, you own all non-infringing text, image, and video outputs generated from your sessions. GoChat AI retains all proprietary rights, trademarks, and source code powering the service.",
      order: 5,
      icon: "Cpu",
    },
    {
      title: "6. Server-Side Proxies & Third-Party LLM Connections",
      content:
        "We route AI requests through secure server-side proxy handlers to safeguard sensitive API keys and provider endpoints (e.g., Google DeepMind, Pinecone). You are strictly prohibited from attempting to bypass proxy routers, inject rogue HTTP headers, or spoof client socket payloads.",
      order: 6,
      icon: "Server",
    },
    {
      title: "7. System Availability, Rate Limits & Disclaimers",
      content:
        "GoChat AI is provided on an 'AS IS' and 'AS AVAILABLE' basis. While we strive for 99.9% uptime, we do not warrant that our service will be uninterrupted or error-free. We implement automated rate limits on API requests, model queries, and document embeddings to preserve cluster stability.",
      order: 7,
      icon: "Activity",
    },
    {
      title: "8. Limitation of Liability & Indemnification",
      content:
        "To the maximum extent permitted by applicable law, GoChat AI and its operators shall not be liable for any indirect, incidental, punitive, or consequential damages resulting from your use of generated outputs or service interruptions. You agree to indemnify and hold harmless GoChat AI from any third-party claims arising from your breach of these Terms.",
      order: 8,
      icon: "Scale",
    },
    {
      title: "9. Modifications to Terms",
      content:
        "We reserve the right to revise these Terms of Service at any time. Significant revisions will be communicated through platform notifications and documented in the revision ledger with updated effective dates. Continued use of the platform after updates constitutes acceptance of the modified Terms.",
      order: 9,
      icon: "History",
    },
    {
      title: "10. Governing Law & Dispute Resolution",
      content:
        "These Terms shall be governed by and construed in accordance with the laws of India, without regard to conflict of law principles. Any legal action or dispute arising under these Terms shall be resolved exclusively through binding arbitration or within competent courts of appropriate jurisdiction.",
      order: 10,
      icon: "Gavel",
    },
  ],
  changelog: "Initial formal release of GoChat AI platform terms and conditions.",
};
