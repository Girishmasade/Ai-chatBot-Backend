import { Router } from "express";
import { authRouter } from "../moduels/auth/auth.route.js";
import { otpRouter } from "../moduels/otp/otp.route.js";
import { userRouter } from "@/moduels/user/user.route.js";
import { adminRouter } from "@/moduels/admin/admin.route.js";
import { subscriptionRouter } from "@/moduels/subscription/subscription.route.js";
import { providerRouter } from "@/moduels/Provider/providder-config.route.js";
import { serviceConfigRoute } from "@/moduels/service-config/service-config.route.js";
import { tokenPackageRoute } from "@/moduels/token/token.route.js";
import { adminTransactionRouter, userTransactionRouter } from "@/moduels/token/tokenTransaction/tokenTransaction.route.js";
import { adminWalletRouter, userWalletRouter } from "@/moduels/token/tokenWallet/tokenWallet.route.js";
import { aiRequestRouter } from "@/moduels/AIRequest/aiRequest.route.js";
import { providerApiKeyRoute } from "@/moduels/Provider-api-key/provider-api-key.route.js";
import RagRouter from "@/moduels/rag/rag.route.js";
import DocumentRouter from "@/moduels/document/document.routes.js";
import RetrievalRoute from "@/moduels/retrieval/retrieval.route.js";
import ModerationRouter from "@/moduels/moderation/moderation.route.js";
import PromptBuilderRoute from "@/moduels/prompt/promptbuilder.route.js";
import { paymentRouter } from "@/moduels/payment/payment.route.js";
import { menuRouter } from "@/moduels/admin/menu.route.js";
import { chatHistoryRouter } from "@/moduels/chat/chatHistory.route.js";

// NOTE: notification.route.ts is intentionally NOT mounted — its controller
// (notification.controller.ts) is all empty stub functions and the route
// file itself never defines any routes or an export. Mounting it would
// register a router with zero working endpoints. Build that module out
// before adding it here.

export const RouterFile = Router()

RouterFile.use("/auth", authRouter)
RouterFile.use("/otp", otpRouter)
RouterFile.use("/user", userRouter)
RouterFile.use("/admin", adminRouter)
RouterFile.use("/menu", menuRouter)
RouterFile.use("/service", serviceConfigRoute)
RouterFile.use("/subscription", subscriptionRouter)
RouterFile.use("/:service/provider", providerRouter)
RouterFile.use("/token-package", tokenPackageRoute)
RouterFile.use("/token-transaction", userTransactionRouter)
RouterFile.use("/admin/token-transaction", adminTransactionRouter)
RouterFile.use("/token-wallet", userWalletRouter)
RouterFile.use("/admin/token-wallet", adminWalletRouter)
RouterFile.use("/ai-request", aiRequestRouter)
RouterFile.use("/chat", chatHistoryRouter)
RouterFile.use("/provider-api-keys", providerApiKeyRoute)
RouterFile.use("/documents", DocumentRouter)
RouterFile.use("/retrieval", RetrievalRoute)
RouterFile.use("/rag", RagRouter)
RouterFile.use("/prompt", PromptBuilderRoute)
RouterFile.use("/admin/moderation", ModerationRouter)
RouterFile.use("/payment", paymentRouter)