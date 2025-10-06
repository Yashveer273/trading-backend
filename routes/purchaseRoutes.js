const express = require("express");
const PurchaseRouter = express.Router();
const Payment = require("../models/payment");

// ✅ Purchase History
PurchaseRouter.get("/history/:userId", async (req, res) => {
  try {
    const purchases = await Payment.find({ user: req.params.userId }).sort({ createdAt: -1 });
    res.json({ success: true, history: purchases });
  } catch (err) {
    console.error("Purchase History Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// ✅ User makes a purchase define in QR routes

module.exports = PurchaseRouter;
