import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import "dotenv/config";
import userRouter from "./routes/userRoutes.js";
import apiRouter from "./routes/apiRoutes.js";
import otpRouter from "./routes/otpRoutes.js";
import directApiRouter from "./routes/directApiRoutes.js";
import mongoose from 'mongoose';
import { checkBcrypt } from "./middleware/bcryptCheck.js";

const app = express();
const port = process.env.PORT || 5000;

// Middleware for parsing requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure CORS - updated to handle multiple origins
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps, curl requests)
        const allowedOrigins = [
            process.env.FRONTEND_URL 
        ];
        
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log(`Origin ${origin} not allowed by CORS`);
            callback(null, true); // Still allow for development purposes
        }
    },
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

// Add bcrypt check to all authentication routes
app.use("/api/user", checkBcrypt, userRouter);

// Other routes don't need bcrypt checking
app.use("/api/:apiKey([a-f0-9]{32})", directApiRouter);
app.use("/api/otp", otpRouter);
app.use("/api", apiRouter);

// Test route
app.get('/', (req, res) => {
    res.send("Error 404 API is running");
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

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });