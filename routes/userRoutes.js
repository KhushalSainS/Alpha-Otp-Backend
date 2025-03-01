import express from "express";
import { authenticateJWT } from "../middleware/auth.js";
import { 
  register, 
  login, 
  createApiKey, 
  deleteApiKey, 
  getApiKeys,
  createOrder,
  getOrders,
  getTransactions,
  getPlans,
  updatePlan,
  getWallet
} from "../controllers/userController.js";

const userRouter = express.Router();

// Public authentication routes
userRouter.post("/register", register);
userRouter.post("/login", login);

// Protected routes - API key management
userRouter.post("/create-api-key", authenticateJWT, createApiKey);
userRouter.get("/api-keys", authenticateJWT, getApiKeys);
userRouter.delete("/api-key/:apiKeyId", authenticateJWT, deleteApiKey);

// Protected routes - Orders and transactions
userRouter.post("/plan-pay", authenticateJWT, createOrder);
userRouter.get("/orders", authenticateJWT, getOrders);
userRouter.get("/transactions", authenticateJWT, getTransactions);

// Protected routes - Subscription plans
userRouter.get("/plans", getPlans);
userRouter.post("/update-plan", authenticateJWT, updatePlan);

// Protected routes - Wallet
userRouter.get("/wallet", authenticateJWT, getWallet);

export default userRouter;
