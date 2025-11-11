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
const mongoose = require("mongoose");
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

// --- API 3: buy product  ---
QRPayRourter.post("/api/payments", async (req, res) => {
  try {
    const { userId, quantity, product, TotalAmount, } = req.body;
    console.log(req.body)
    if (!product) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const { _id, purchaseType, productName, price, cycleType, cycleValue,isdailyClaim } =
      product;

    if (!_id || !purchaseType ) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (purchaseType === "One time buy") {
      if (quantity > 1) {
        return res.status(409).json({
          success: false,
          message: "Product is one time buy, quantity must be 1.",
        });
      } else if (
        [...user.purchases]
          .reverse()
          .some((p) => p.productId.toString() === _id)
      ) {
        return res.status(409).json({
          success: false,
          message: "You have already purchased this product",
        });
      }
    }

    // Create payment record

    // Prepare purchase object
    const purchase = {
      productName,
      isdailyClaim,
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
      isdailyClaim,
      cycleType,
      cycleDuration: cycleValue,
      dailyIncome: product.cycleType === "hour" ? product.hour : product.daily,
    });

    await purchas.save();

    // ------------------------------ commission-----------------
    let currentUserId = user._id; // purchasing user
    const levels = ["team1", "team2", "team3"];
    const commissionRate = await commissionRates.findOne();

    if (!commissionRate) {
      return res.json({ success: true, balance: updatedUser.balance });
    }

    // const FUser = await User.findOne({
    //   referredBy: user.referredBy,
    // }).select("team1 Withdrawal");

    // // ✅ Step 3: Count current team size

    // // ✅ Step 4: Milestone mapping (only when exact match)
    // const milestoneMap = {
    //   20: 1600,
    //   70: 5000,
    //   200: 13000,
    //   500: 50000,
    //   2000: 180000,
    //   5000: 500000,
    //   10000: 1000000,
    // };

    // if (FUser) {
    //       const team1Length = FUser.team1?.length || 0;
    //   if (milestoneMap[team1Length] > FUser.milestoneMap) {
    //     const incValue = milestoneMap[team1Length];

    //     await User.updateOne(
    //       { _id: FUser._id },
    //       { $inc: { Withdrawal: incValue }, $set: { milestoneMap: incValue } }
    //     );
    //   }
    // }

    for (let i = 0; i < levels.length; i++) {
      // 1️⃣ Check if current user has a referrer
      const currentUser = await User.findById(currentUserId, "referredBy");
      if (!currentUser?.referredBy?.refCode) break;

      const uplineRefCode = currentUser.referredBy.refCode;
      const teamField = levels[i];
      const rate = commissionRate[`level${i + 1}`] || 0;
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
            Withdrawal: commission,
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
    const { id } = req.params;
    const { approved, remarks } = req.body;

    const payment = await Payment.findById(id);
    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });

    // Update payment record
    if (typeof approved === "string") payment.approved = approved;
    if (remarks) payment.remarks = remarks;
    await payment.save();

    // Update user's rechargeHistory by UTR
    if (payment.userId && payment.utr) {
      const updateFields = {};

      if (approved === "Approve") {
        updateFields.$inc = { balance: payment.amount };
      }

      // ✅ $set will update existing statusUpdateDate or create if missing
      updateFields.$set = {
        "rechargeHistory.$[entry].approved": approved,
        "rechargeHistory.$[entry].statusUpdateDate": new Date(), // creates if not exist
      };

      await User.updateOne(
        { _id: payment.userId, "rechargeHistory.utr": payment.utr },
        updateFields,
        { arrayFilters: [{ "entry.utr": payment.utr }] }
      );

      //  -------------------------------------------------------------------------------
      if (approved === "Approve") {
        const User1 = await User.findOne({ _id: payment.userId });

        const milestoneMap = {
          20: 1600,
          70: 5000,
          200: 13000,
          500: 50000,
          2000: 180000,
          5000: 500000,
          10000: 1000000,
        };

        const activeTeamCount = User1?.team1?.filter(
          (member) => member?.totalRecharge > 0
        ).length;

        if (milestoneMap[activeTeamCount] > User1?.milestoneMap) {
          const incValue = milestoneMap[activeTeamCount];

          await User.updateOne(
            { _id: User1?._id },
            { $inc: { Withdrawal: incValue }, $set: { milestoneMap: incValue } }
          );
        }
      }
      // -----------------------------------------------------------------
    }

    return res.json({
      success: true,
      message: "Payment updated successfully",
      payment,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// api 6 recharge balance---------

QRPayRourter.post("/api/recharge", async (req, res) => {
  try {
    const { userId, amount, utr, qrImageName } = req.body;
    console.log(userId);
    if (!userId || !amount || !utr || !qrImageName) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const User1 = await User.findOne({ _id: userId });

    if (!User1) {
      return res.status(404).json({ error: "User Not Fount" });
    }
    if (User1?.phone.startsWith("50")) {
      const payment = await Payment.create({
        phone:User1?.phone,
        userId,
        amount,
        utr,
        qrImageName,
        approved: "Approve",
      });
      const updatedUser = await User.findByIdAndUpdate(
        { _id: userId },
        {
          $push: {
            rechargeHistory: {
              amount,
              utr,
              qrImageName,
              approved: "Approve",
              date: new Date(),
              statusUpdateDate: new Date(),
            },
          },
          $inc: { balance: amount },
        },
        { new: true } // returns updated document
      );

      return res.json({ success: true, payment, balance: updatedUser.balance });
    } else {
      // Create payment record
      const payment = await Payment.create({
        userId,
        amount,
        utr,
        qrImageName,
        approved: "Pending",
      });
      const updatedUser = await User.findByIdAndUpdate(
        { _id: userId },
        {
          $push: {
            rechargeHistory: {
              amount,
              utr,
              qrImageName,
              approved: "Pending",
              date: new Date(),
              statusUpdateDate: new Date(),
            },
          },
        },
        { new: true } // returns updated document
      );

      return res.json({ success: true, payment, balance: updatedUser.balance });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", err });
  }
});
QRPayRourter.post("/api/Admin/recharge", async (req, res) => {
  try {
    const { phone, amount, utr } = req.body;

    if (!phone || !amount || !utr) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const User1 = await User.findOne({ phone: phone },"_id phone");

    if (!User1) {
      return res.status(404).json({ error: "User Not Fount" });
    }

    const qrs = await QR.find().sort({ createdAt: -1 }).limit(1);
    const qrImageName = `${req.protocol}://${req.get("host")}/QRuploads/${
      qrs.filename
    }`;
console.log(User1._id)
    const payment = await Payment.create({
      userId:  User1._id,
     phone: User1.phone,
      amount,
      utr,
      qrImageName,
      approved: "Approve",
    });
  const updatedUser = await User.findOneAndUpdate(
  { phone: phone },
  {
    $push: {
      rechargeHistory: {
        amount,
        utr,
        qrImageName,
        approved: "Approve",
        date: new Date(),
        statusUpdateDate: new Date(),
      },
    },
    $inc: { balance: amount },
  },
  { new: true }
);


    return res.json({ success: true, message:`current balance ${updatedUser.balance} INR`  });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.utr) {
      return res.status(409).json({
        success: false,
        message: "UTR duplicate",
        utr: err.keyValue.utr,
      });
    }

    return res.status(500).json({ error: "Server error", err });
 
  }
});

QRPayRourter.post("/api/Admin/recharge/minus", async (req, res) => {
  try {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const User1 = await User.findOne({ phone: phone });

    if (!User1) {
      return res.status(404).json({ error: "User Not Fount" });
    }
    if (User1?.balance<amount ) {
      return res.status(401).json({ error: `Minus amount must be lesser than current balance: ${User1?.balance} INR` });
    }


    const updatedUser = await User.findByIdAndUpdate(
    User1._id,
      {
        $inc: { balance: -amount },
      },
      { new: true } // returns updated document
    );

    return res.json({ success: true,  message:`current balance ${updatedUser.balance} INR` });
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
// -----------------------------------++++++++++++++++++++++++
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
// --- READ ALL QRs ---

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
QRPayRourter.put("/api/qrs/:id", upload.single("qr"), async (req, res) => {
  try {
    if (!req.file)
      return res
        .status(400)
        .json({ error: "No file uploaded (field name must be 'qr')" });

    const qr = await QR.findByIdAndUpdate(
      req.params.id,
      { filename: req.file.filename },
      { new: true }
    );

    if (!qr) return res.status(404).json({ error: "QR not found" });

    res.json({
      success: true,
      qr,
      url: `${req.protocol}://${req.get("host")}/QRuploads/${
        req.file.filename
      }`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- DELETE QR ---
QRPayRourter.delete("/api/qrs/:id", async (req, res) => {
  try {
    const qr = await QR.findByIdAndDelete(req.params.id);
    if (!qr) return res.status(404).json({ error: "QR not found" });
    res.json({ success: true, message: "QR deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------+++++++++++++++++++++++++++++++++++++
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
          _id: "$status",
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
        totalRechargeRejectedAmount,
        totalRechargeRejectedCases,
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
