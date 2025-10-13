const express = require("express");
const QR = require("../models/QRs");
const Payment = require("../models/payment");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const QRPayRourter = express.Router();
const mediaDir = path.join(__dirname, "../QRuploads");
const User = require("../models/user");
const Purchase = require("../models/purchase");
const withdraw = require("../models/Withdraw");
const commissionRates = require("../models/Commission");
// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, mediaDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "-");
    const filename = `${Date.now()}-${base}${ext}`;
    cb(null, filename);
  },
});
const upload = multer({ storage });

// --- API 1: Upload QR Image ---
QRPayRourter.post("/api/upload", upload.single("qr"), async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ error: "No file uploaded (field name must be 'qr')" });
    const qr = await QR.create({ filename: req.file.filename });
    return res.json({
      success: true,
      qr,
      url: `${req.protocol}://${req.get("host")}/QRuploads/${
        req.file.filename
      }`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// --- API 2: Get Random QR (latest 3) ---
QRPayRourter.get("/api/qr/random", async (req, res) => {
  try {
    const qrs = await QR.find().sort({ createdAt: -1 }).limit(3);
    if (!qrs || qrs.length === 0)
      return res.status(404).json({ error: "No QRs available" });
    const choice = qrs[Math.floor(Math.random() * qrs.length)];
    return res.json({
      filename: choice.filename,
      url: `${req.protocol}://${req.get("host")}/QRuploads/${choice.filename}`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// --- API 3: buy product  ---
QRPayRourter.post("/api/payments", async (req, res) => {
  try {
    const { userId, quantity, product, TotalAmount } = req.body;
    if (!product) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const { _id, purchaseType, productName, price, cycleType, cycleValue } =
      product;

    if (!_id || !purchaseType) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (
      purchaseType === "One time buy" &&
      [...user.purchases].reverse().some((p) => p.productId.toString() === _id)
    ) {
      return res.status(409).json({
        success: false,
        message: "You have already purchased this product",
      });
    }
    // Create payment record

    // Prepare purchase object
    const purchase = {
      productName,
      amount: price,
      TotalAmount,
      quantity,
      productId: _id,
      cycleType,
      cycleValue,
      dailyIncome: product.cycleType === "hour" ? product.hour : product.daily,
      purchaseType,
      claim: "waiting",
      claimedCycles: [],
      createdAt: new Date(),
    };

    // Atomically update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { totalBuy: TotalAmount, balance: -TotalAmount },
        $push: { purchases: purchase },
      },
      { new: true } // return the updated document
    );
    const purchas = new Purchase({
      userId,
      productName,
      amount: price,
      TotalAmount,
      quantity,
      productId: _id,
      purchaseType,
      cycleType,
      cycleDuration: cycleValue,
      dailyIncome: product.cycleType === "hour" ? product.hour : product.daily,
    });

    await purchas.save();

    // ------------------------------ commission-----------------
    let currentUserId = user._id; // purchasing user
    const levels = ["team1", "team2", "team3"];

    for (let i = 0; i < levels.length; i++) {
      // 1️⃣ Check if current user has a referrer
      const currentUser = await User.findById(currentUserId, "referredBy");
      if (!currentUser?.referredBy?.refCode) break;

      const uplineRefCode = currentUser.referredBy.refCode;
      const teamField = levels[i];
      const rate = commissionRates[`level${i + 1}`] || 0;
      const commission = (TotalAmount * rate) / 100;

      // 2️⃣ Update totalRecharge & totalCommission for the matching ids entry
      await User.updateOne(
        {
          referralCode: uplineRefCode,
          [`${teamField}.ids.person`]: currentUserId.toString(),
        },
        {
          $inc: {
            [`${teamField}.$.totalRecharge`]: TotalAmount,
            [`${teamField}.$.totalCommission`]: commission,
            pendingIncome: commission,
            Withdrawal: TotalAmount,
          },
        }
      );

      // 3️⃣ Move up: set currentUserId to upline for next level
      const upline = await User.findOne(
        { referralCode: uplineRefCode },
        "_id referredBy"
      );
      if (!upline) break;

      currentUserId = upline._id;
    }

    return res.json({ success: true, balance: updatedUser.balance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
// ---------------------------------------------------------------------
// --- API 4: Get Pending Payments (Admin) ---
QRPayRourter.get("/api/admin/pending", async (req, res) => {
  try {
    const pending = await Payment.find({ approved: "Pending" })
      .sort({ createdAt: -1 })
      .select("_id userId amount utr qrImageName approved remarks createdAt")
      .lean();

    // Add QR URL
    const withUrl = pending.map((p) => ({
      ...p,
      qrUrl: `${req.protocol}://${req.get("host")}/QRuploads/${p.qrImageName}`,
    }));
    return res.json(withUrl);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// --- API 5: Update Payment Status (Admin) ---
QRPayRourter.patch("/api/admin/payments/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { approved, remarks } = req.body;
    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (typeof approved === "string") payment.approved = approved;
    if (remarks) payment.remarks = remarks;
    await payment.save();
    return res.json({ success: true, payment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
// api 6 recharge balance---------

QRPayRourter.post("/api/recharge", async (req, res) => {
  try {
    const { userId, amount, utr, qrImageName } = req.body;

    if (!userId || !amount || !utr || !qrImageName) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Create payment record
    const payment = await Payment.create({
      userId,
      amount,
      utr,
      qrImageName,
      approved: "Pending",
    });

    const updatedUser = await User.findByIdAndUpdate(
  userId,
  {
    $inc: { balance: amount }, // increase balance
    $push: {
      rechargeHistory: {
        amount,
        utr,
        qrImageName,
        approved: "Pending",
        date: new Date(),
      },
    },
  },
  { new: true } // returns updated document
);

    return res.json({ success: true, payment, balance: updatedUser.balance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", err });
  }
});

QRPayRourter.get("/recharge-list", async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch paginated purchases
    const transactions = await Payment.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments();

    res.status(200).json({
      success: true,
      message: "Transactions and stats fetched successfully",
      currentPage: page,
      totalPages: Math.ceil(total / limit),

      data: transactions,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching transactions",
    });
  }
});
// ---------------------------------------------------------------
// --- Extra API: List All QRs ---
QRPayRourter.get("/api/qrs", async (req, res) => {
  try {
    const qrs = await QR.find().sort({ createdAt: -1 });
    const result = qrs.map((qr) => ({
      _id: qr._id,
      filename: qr.filename,
      url: `${req.protocol}://${req.get("host")}/QRuploads/${qr.filename}`,
      createdAt: qr.createdAt,
    }));
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get paginated purchases + withdraw/recharge stats
QRPayRourter.get("/product-purchase-list", async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch paginated purchases
    const transactions = await Purchase.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Purchase.countDocuments();

    res.status(200).json({
      success: true,
      message: "Transactions and stats fetched successfully",
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total,
      data: transactions,
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching transactions",
    });
  }
});
QRPayRourter.get("/transaction-stats", async (req, res) => {
  try {
    // ---------- Withdraw Stats ----------
    const withdrawData = await withdraw.aggregate([
      {
        $group: {
          _id: "$approved",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    let TotalwithdrawPassamount = 0;
    let TotalwithdrawPassacase = 0;
    let totalrejectamount = 0;
    let totalrejectcase = 0;
    let pendingWithdrawAmount = 0;
    let pendingWithdrawCases = 0;

    withdrawData.forEach((item) => {
      if (item._id === "approved") {
        TotalwithdrawPassamount = item.totalAmount;
        TotalwithdrawPassacase = item.count;
      } else if (item._id === "rejected") {
        totalrejectamount = item.totalAmount;
        totalrejectcase = item.count;
      } else if (item._id === "pending") {
        pendingWithdrawAmount = item.totalAmount;
        pendingWithdrawCases = item.count;
      }
    });

    // ---------- Recharge Stats ----------
    const rechargeData = await Payment.aggregate([
      {
        $group: {
          _id: "$approved", // will be "Approve", "Pending", "Reject", etc.
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalRechargeApprovedAmount = 0;
    let totalRechargeApprovedCases = 0;
    let totalRechargePendingAmount = 0;
    let totalRechargePendingCases = 0;
    let totalRechargeRejectedAmount = 0;
    let totalRechargeRejectedCases = 0;

    rechargeData.forEach((item) => {
      switch (item._id) {
        case "Approve":
          totalRechargeApprovedAmount = item.totalAmount;
          totalRechargeApprovedCases = item.count;
          break;
        case "Pending":
          totalRechargePendingAmount = item.totalAmount;
          totalRechargePendingCases = item.count;
          break;
        case "Reject":
          totalRechargeRejectedAmount = item.totalAmount;
          totalRechargeRejectedCases = item.count;
          break;
      }
    });

    console.log({
      totalRechargeApprovedAmount,
      totalRechargeApprovedCases,
      totalRechargePendingAmount,
      totalRechargePendingCases,
      totalRechargeRejectedAmount,
      totalRechargeRejectedCases,
    });

    // ---------- Send Response ----------
    res.status(200).json({
      success: true,
      message: "Transaction stats fetched successfully",
      withdrawStats: {
        TotalwithdrawPassamount,
        TotalwithdrawPassacase,
        totalrejectamount,
        totalrejectcase,
        pendingWithdrawAmount,
        pendingWithdrawCases,
      },
      rechargeStats: {
        totalRechargeApprovedAmount,
        totalRechargeApprovedCases,
        totalRechargePendingAmount,
        totalRechargePendingCases,
      },
    });
  } catch (error) {
    console.error("Error fetching transaction stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching transaction stats",
    });
  }
});
module.exports = QRPayRourter;
