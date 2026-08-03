// // ── RAG controller ────────────────────────────────────────────────────────────
// import type { RagNotificationPayload } from "./notification.type.js";

// const payload: RagNotificationPayload = {
//   userId:   userId,
//   title:    "Document Ready ✅",
//   message:  `"${Document}" is ready to use.`,
//   type:     "rag",
//   priority: "medium",
//   metadata: {
//     documentId:   doc._id.toString(),
//     documentName: doc.originalName,
//     chunkCount:   doc.chunkCount,
//   },
// };

// await createNotification(payload);

// // ── LangChain / LangGraph ─────────────────────────────────────────────────────
// import type { AgentNotificationPayload } from "./notification.type.js";

// const payload: AgentNotificationPayload = {
//   userId:   userId,
//   title:    "AI Agent Completed ✅",
//   message:  "Your task has been completed.",
//   type:     "chat",
//   priority: "medium",
//   metadata: {
//     taskId:    taskId,
//     taskName:  "Document QA",
//     agentType: "langgraph",
//     summary:   "Found 3 relevant answers.",
//     duration:  3200,          // ms
//     toolsUsed: ["retriever", "llm", "parser"],
//   },
// };

// await createNotification(payload);

// // ── Auth controller ───────────────────────────────────────────────────────────
// import type { AuthNotificationPayload } from "./notification.type.js";

// const payload: AuthNotificationPayload = {
//   userId:   userId,
//   title:    "New Login Detected 🔐",
//   message:  "A new login was detected on your account.",
//   type:     "auth",
//   priority: "high",
//   metadata: {
//     ip:        req.ip,
//     userAgent: req.headers["user-agent"],
//     timestamp: new Date(),
//   },
// };

// await createNotification(payload);

// // ── Payment controller ────────────────────────────────────────────────────────
// import type { PaymentNotificationPayload } from "./notification.type.js";

// const payload: PaymentNotificationPayload = {
//   userId:   userId,
//   title:    "Payment Successful 💳",
//   message:  "Your payment was processed successfully.",
//   type:     "payment",
//   priority: "high",
//   metadata: {
//     amount:        999,
//     currency:      "INR",
//     transactionId: "txn_abc123",
//     status:        "success",
//     plan:          "pro",
//   },
// };

// await createNotification(payload);