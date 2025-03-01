import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import "dotenv/config";
import userRouter from "./routes/userRoutes.js";
import apiRouter from "./routes/apiRoutes.js";
import otpRouter from "./routes/otpRoutes.js";
import directApiRouter from "./routes/directApiRoutes.js";

const app = express();
const port = process.env.PORT || 5000;

// Middleware for parsing requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

// Connect to Database
connectDB();

// Debug middleware to log all incoming requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// IMPORTANT: Order matters here - most specific routes first
// Direct API access route must come before the general /api route
app.use("/api/:apiKey([a-f0-9]{32})", directApiRouter);

// Regular API routes
app.use("/api/user", userRouter);
app.use("/api/otp", otpRouter);
app.use("/api", apiRouter);

// Test route
app.get('/', (req, res) => {
    res.send("API is running successfully!");
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: "Something went wrong!",
        error: err.message
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});