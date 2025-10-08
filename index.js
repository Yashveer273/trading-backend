const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors"); 
const connectDB = require("./config/db");
const path = require("path");
const app = express();
app.use(bodyParser.json());
app.use(cors());
// ------------------------------------------
connectDB();

const productRoutes = require("./routes/productRoutes");
const giftRouter = require("./routes/giftRourter");
const userRouter = require("./routes/userRoutes");
const QRPayRourter = require("./routes/QRPay-and-buy-product");
const luckySpinRouter = require("./routes/luckspin");

const withdrawRoute = require("./routes/withdrawRoutes");
const commissionRouter=require("./routes/CommissionRoutes");
const ClaimRoiRouter= require("./routes/claimROI");


app.use("/api/products", productRoutes);
app.use("/api/giftcodes", giftRouter);
app.use("/api/users", userRouter);
app.use("/QR", QRPayRourter);// --- API 3: buy product  ---
app.use("/api/luckySpin", luckySpinRouter);
app.use("/api/claimROI",ClaimRoiRouter);
app.use("/api/withdraw", withdrawRoute);
app.use("/api/commission", commissionRouter);


app.use("/uploads", express.static(path.join(__dirname, "routes/uploads")));
// Serve uploaded files as network URLs
app.use("/QRuploads", express.static(path.join(__dirname, "QRuploads")));
// Serve uploaded files
app.use("/media", express.static(path.join(__dirname, "media")));

app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = 5004;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
