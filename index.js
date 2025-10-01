const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors"); // <--- import cors
const productRoutes = require("./routes/productRoutes");
const giftRouter = require("./routes/giftRourter");
const userRouter = require("./routes/userRoutes");
const connectDB = require("./config/db");
const path = require("path");

const fs = require("fs");

const QRPayRourter = require("./routes/QRPay");
const luckySpinRouter = require("./routes/luckspin");
const app = express();
app.use(bodyParser.json());
connectDB();

// Allow CORS for all origins (for development)
app.use(cors());



// Routes
// Routes
app.use("/api/products", productRoutes);
app.use("/api/giftcodes", giftRouter);
app.use("/api/users", userRouter);
app.use("/api/luckySpin", luckySpinRouter);
app.use("/uploads", express.static(path.join(__dirname, "routes/uploads"))); 



// Serve uploaded files as network URLs
app.use("/QRuploads", express.static(path.join(__dirname, "QRuploads")));
// Serve uploaded files
app.use("/media", express.static(path.join(__dirname, "media")));
// or adjust path if router file is nested
app.use("/QR", QRPayRourter);

// Default route for health check
app.get("/", (req, res) => {
  res.send("🚀 API is running...");
});


const PORT = 5004;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
