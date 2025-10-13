const express = require("express");
const router = express.Router();
const Withdraw = require("../models/Withdraw");
const User = require("../models/user");


// ✅ Withdraw Request
router.post("/", async (req, res) => {
  console.log("111");
  try {
    const { userId, amount, tradePassword } = req.body;

    if (!userId || !amount || !tradePassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // 🟢 Find user and validate trade password + bank details + balance + limit
    const user = await User.findOne({
      _id: userId,
      tradePassword: tradePassword,           // validate trade password directly in query
      "bankDetails.accountNumber": { $exists: true, $ne: "" }, // ensure bank info exists
      Withdrawal: { $gte: amount },              // sufficient balance
      withdrawLimit: { $gte: amount },  
      $push: {
      withdrawHistory: {
        amount,
        user: userId,
        status: "pending",
        date: new Date.now(),
      },
    },      // within withdraw limit
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "User not found, invalid trade password, insufficient balance, or bank details missing",
      });
    }

    // 🟢 Deduct balance atomically
   await User.updateOne(
      { _id: userId },
      { $inc: { Withdrawal: -amount } } // decrement balance
    );

    // 🟢 Save withdrawal request
    const withdraw = await Withdraw.create({ user: userId, amount });

    res.json({
      success: true,
      message: "Withdraw request submitted",
      withdraw,
    });
  } catch (err) {
    console.error("Withdraw Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



// ✅ Get Withdraw History
router.get("/history/:userId", async (req, res) => {
  try {
    const history = await Withdraw.find({ user: req.params.userId }).sort({ createdAt: -1 });
    res.json({ success: true, history });
  } catch (err) {
    console.error("Withdraw History Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
router.get("/withdraw-statement", async (req, res) => {
  try {
    // Get page and limit from query params, default: page=1, limit=10
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Total count of withdrawals
    const total = await Withdraw.countDocuments();

    // Fetch paginated withdrawals
    const history = await Withdraw.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      history
    });
  } catch (err) {
    console.error("Withdraw History Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/withdraw-pending", async (req, res) => {
  try {
    // Fetch all pending withdrawals, sort newest first
    const pending = await Withdraw.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .populate("user", "name email") // optional: include user's name/email
      .lean(); // faster, returns plain JS objects

    res.json({
      success: true,
      message: "Pending withdrawals fetched successfully",
      data: pending,
    });
  } catch (error) {
    console.error("Error fetching pending withdrawals:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Approve a withdrawal
router.put("/withdraw-approve/:id", async (req, res) => {
  try {
    const updated = await Withdraw.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    );
    res.json({ success: true, message: "Withdrawal approved", data: updated });
  } catch (error) {
    console.error("Error approving withdrawal:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Reject a withdrawal
router.put("/withdraw-reject/:id", async (req, res) => {
  try {
    const updated = await Withdraw.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );
    res.json({ success: true, message: "Withdrawal rejected", data: updated });
  } catch (error) {
    console.error("Error rejecting withdrawal:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// -------------------------------------------------------------------------------
// ✅ Save Bank Details (only once or update if needed)
router.post("/bank-details", async (req, res) => {
  try {
    const { userId, holderName, accountNumber, ifscCode, bankName, upiId } = req.body;

    // Validate
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    // ✅ MongoDB query update
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "bankDetails.holderName": holderName,
          "bankDetails.accountNumber": accountNumber,
          "bankDetails.ifscCode": ifscCode,
          "bankDetails.bankName": bankName,
          "bankDetails.upiId": upiId,
        },
      },
      { new: true } // return updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "Bank details saved successfully",
      bankDetails: updatedUser.bankDetails,
    });
  } catch (err) {
    console.error("Bank Details Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


router.get("/bank", async (req, res) => {
 
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    // ✅ Fetch only bankDetails field (projection for efficiency)
    const user = await User.findById(userId, { bankDetails: 1,balance: 1, _id: 0 });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ✅ If no bank details saved yet
    if (!user.bankDetails || Object.keys(user.bankDetails).length === 0) {
      return res.status(200).json({
        success: true,
        message: "No bank details found",
        bankDetails: {},
      });
    }

    // ✅ Return bank details
    res.json({
      success: true,
      message: "Bank details fetched successfully",
      bankDetails: user.bankDetails,
      balance:user.balance

    });
  } catch (err) {
    console.error("Get Bank Details Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/bank-details/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { bankDetails, tradePassword } = req.body;

    // 🧩 Basic validation
    if (!userId || !bankDetails || !tradePassword) {
      return res.status(400).json({
        success: false,
        message: "User ID, bank details, and trade password are required",
      });
    }

    // 🔍 Find user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 🔒 Compare trade password (assuming it's hashed in DB)
    const isPasswordMatch =
      user.tradePassword === tradePassword ||
      (await bcrypt.compare(tradePassword, user.tradePassword)); // if hashed

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid trade password",
      });
    }

    // ✅ Update bank details
    user.bankDetails = bankDetails;
    await user.save();

    res.json({
      success: true,
      message: "Bank details updated successfully",
      bankDetails: user.bankDetails,
    });
  } catch (err) {
    console.error("Update Bank Details Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
