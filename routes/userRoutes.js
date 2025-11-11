const express = require("express");
const User = require("../models/user");
const Admin = require("../models/AdminAuth");

const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const UserRouter = express.Router();
const SECRET_KEY = "SECRET_KEY12356789";
const AdminSECRET_KEY = "AdminSECRET_KEY12356789";
// GET all users
const Commission = require("../models/Commission");
const Withdraw = require("../models/Withdraw");
const Purchase = require("../models/purchase");
const Payment = require("../models/payment");
const sendOtpLess = async (phoneNo, otp) => {
  try {
    const dv_key = "1pULP3Aj0i"; // 🔹 Replace with your actual API key
    const url = `https://dvhosting.in/api-sms-v3.php?api_key=${dv_key}&number=${phoneNo}&otp=${otp}`;

    const response = await fetch(url, {
      method: "GET",
      agent: new (require("https").Agent)({ rejectUnauthorized: false }), // disable SSL verification (like PHP)
    });

    const data = await response.json(); // response may be plain text, not JSON
    console.log("✅ OTP Send Response:", data);

    return { success: data.return, data, otp };
  } catch (error) {
    console.error("❌ Error sending OTP:", error);
    return { success: false, message: error.message };
  }
};
function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const generateReferralCode = () =>
  Math.random().toString(36).substr(2, 6).toUpperCase();

UserRouter.get("/user", async (req, res) => {
  const { userId } = req.query;
  try {
    const users = await User.findById(userId);
    const activeTeamCount = users.team1.filter(
      (member) => member.totalRecharge > 0
    ).length;

    res
      .status(200)
      .json({ success: true, users, activeCount: activeTeamCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// Direct team (Stage 1)
UserRouter.get("/:userId/direct-team", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate(
      "referrals.person",
      "phone"
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const directTeam = user.referrals
      .filter((r) => r.stage === 1)
      .map((r) => ({
        phone: r.person?.phone || "-",
        stage: r.stage,
        totalCommission: r.totalCommission || 0,
      }));

    res.status(200).json({ success: true, team: directTeam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Indirect team (Stage 2 & 3)
UserRouter.get("/:userId/indirect-team", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate(
      "referrals.person",
      "phone"
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const indirectTeam = user.referrals
      .filter((r) => r.stage === 2 || r.stage === 3)
      .map((r) => ({
        phone: r.person?.phone || "-",
        stage: r.stage,
        totalCommission: r.totalCommission || 0,
      }));

    res.status(200).json({ success: true, team: indirectTeam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get Withdraw Limit
UserRouter.get("/:userId/withdraw-limit", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.status(200).json({
      success: true,
      withdrawLimit: user.withdrawLimit,
      balance: user.balance,
    });
  } catch (err) {
    console.error("Withdraw Limit Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// GET /api/users/search?query=<phone-or-id>

UserRouter.get("/search", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res
        .status(400)
        .json({ success: false, message: "Query is required" });
    }

    // Check if query is a valid ObjectId
    const isObjectId = mongoose.Types.ObjectId.isValid(query);

    // Search by phone OR _id (only if valid ObjectId)
    const user = await User.findOne({
      $or: isObjectId ? [{ phone: query }, { _id: query }] : [{ phone: query }],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user: [user] });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

UserRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Check if user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    // 2️⃣ Delete all related records
    const [deletedWithdraws, deletedPurchases, deletedPayments] =
      await Promise.all([
        Withdraw.deleteMany({ user: id }), // for Withdraw collection
        Purchase.deleteMany({ userId: id }), // for Purchase collection
        Payment.deleteMany({ userId: id }), // for Payment collection
      ]);

    // 3️⃣ Delete the user itself
    await User.deleteOne({ _id: id });

    // 4️⃣ Return a success response
    res.json({
      success: true,
      message: "User and related data deleted successfully",
      deleted: {
        userId: id,
        withdrawsDeleted: deletedWithdraws.deletedCount,
        purchasesDeleted: deletedPurchases.deletedCount,
        paymentsDeleted: deletedPayments.deletedCount,
      },
    });
  } catch (err) {
    console.error("❌ User Delete Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while deleting user",
    });
  }
});
// Update Withdraw Limit (Admin / Testing)

// POST /api/auth/register

UserRouter.post("/register", async (req, res) => {
  try {
    const { phone, password, refCode, tradePassword } = req.body;

    // 🔹 Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    // 🔹 Prepare variables
    let level1User = null;

    // 🔹 If referral code provided, validate it
    if (refCode) {
      level1User = await User.findOne({ referralCode: refCode });
      if (!level1User) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid referral code" });
      }
    }

    // 🔹 Generate referral code + token
    const referralCode = generateReferralCode();
    const token = jwt.sign({ phone }, SECRET_KEY, { expiresIn: "7d" });
    let referredUser = null;
    if (refCode) {
      referredUser = await User.findOne({ referralCode: refCode });
    }

    const newUserData = {
      phone,
      password,
      referralCode,
      referralBy_Phone: referredUser?.phone || "",
      tradePassword,
      referredBy: referredUser
        ? { refCode: referredUser.referralCode, phone: referredUser.phone }
        : null,
      team1: [],
      team2: [],
      team3: [],
    };

    // 🔹 Save new user
    const newUser = await User.create(newUserData);

    // 🔹 If referral used → update teams up to 3 levels
    if (level1User) {
      // Level 1
      await User.updateOne(
        { _id: level1User._id },
        {
          $push: {
            team1: {
              ids: [{ phone: newUser.phone, person: newUser._id }],
            },
          },
        }
      );

      if (level1User.referredBy?.refCode) {
        const level2User = await User.findOne({
          referralCode: level1User.referredBy.refCode,
        });
        if (level2User) {
          await User.updateOne(
            { _id: level2User._id },
            {
              $push: {
                team2: {
                  ids: [{ phone: newUser.phone, person: newUser._id }],
                },
              },
            }
          );

          // Level 3
          if (level2User.referredBy?.refCode) {
            const level3User = await User.findOne({
              referralCode: level2User.referredBy.refCode,
            });
            if (level3User) {
              await User.updateOne(
                { _id: level3User._id },
                {
                  $push: {
                    team3: {
                      ids: [{ phone: newUser.phone, person: newUser._id }],
                    },
                  },
                }
              );
            }
          }
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: newUser,
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

UserRouter.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Check if fields provided
    if (!phone || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Phone and password are required" });
    }

    // Find user
    const user = await User.findOne(
      { phone },
      {
        phone: 1,
        password: 1,
        referralCode: 1,
        referredBy: 1,

        tradePassword: 1,

        referralBy_Phone: 1,
      }
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // ⚠️ In production use bcrypt.compare
    if (user.password !== password) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Generate new JWT
    const token = jwt.sign({ phone: user.phone }, SECRET_KEY, {
      expiresIn: "7d",
    });

    // Save token in DB

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

UserRouter.post("/get-team", async (req, res) => {
  try {
    const { _id, teamLevel } = req.body;
    if (!_id || !teamLevel)
      return res.json({ success: false, message: "Missing _id or teamLevel" });

    const field = `team${teamLevel}`;
    const user = await User.findById(_id, field).lean();
    if (!user) return res.json({ success: false, message: "User not found" });

    res.json({
      success: true,
      message: `Team ${teamLevel} fetched`,
      count: user[field]?.length || 0,
      data: user[field] || [],
    });
  } catch (err) {
    res.json({ success: false, message: "Server error", error: err.message });
  }
});

UserRouter.get("/team-overview", async (req, res) => {
  try {
    const { _id } = req.query;
    if (!_id)
      return res.status(400).json({ success: false, message: "Missing _id" });

    // 🔹 Find user
    const user = await User.findById(_id).lean();
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // 🔹 Get current commission rates (assume one document)
    const commissionDoc = await Commission.findOne().lean();
    const rates = commissionDoc || { level1: 25, level2: 8, level3: 2 };

    // 🔹 Helper function
    const calcTeam = (team, rate) => {
      const totalRecharge = team.reduce(
        (sum, m) => sum + (m.totalRecharge || 0),
        0
      );
      const totalCommission = team.reduce(
        (sum, m) => sum + (m.totalCommission || 0),
        0
      );
      return {
        totalMembers: team.length,
        totalRecharge,
        totalCommission,
        commissionRate: rate,
      };
    };

    const overview = {
      team1: calcTeam(user.team1 || [], rates.level1),
      team2: calcTeam(user.team2 || [], rates.level2),
      team3: calcTeam(user.team3 || [], rates.level3),
      totalTeams:
        (user.team1?.length || 0) +
        (user.team2?.length || 0) +
        (user.team3?.length || 0),
    };

    res.json({ success: true, message: "Team overview fetched", overview });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

// GET API fetch team array for a specific level
UserRouter.get("/team-level", async (req, res) => {
  try {
    const { _id, level } = req.query;

    if (!_id)
      return res.status(400).json({ success: false, message: "Missing _id" });
    if (!level)
      return res.status(400).json({ success: false, message: "Missing level" });

    const user = await User.findById(_id).lean();
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    let teamArray = [];
    switch (Number(level)) {
      case 1:
        teamArray = user.team1 || [];
        break;
      case 2:
        teamArray = user.team2 || [];
        break;
      case 3:
        teamArray = user.team3 || [];
        break;
      default:
        return res
          .status(400)
          .json({ success: false, message: "Invalid level" });
    }

    res.json({
      success: true,
      message: `Team ${level} fetched`,
      team: teamArray,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

UserRouter.get("/account_data", async (req, res) => {
  try {
    const { userId } = req.query;

    const user = await User.findOne({ phone: userId }).select(
      "totalBuy pendingIncome productIncome tasksReward Withdrawal balance"
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      message: "User account data fetched successfully",
      data: user,
    });
  } catch (error) {
    console.error("Error fetching finance data:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});
UserRouter.get("/purchase", async (req, res) => {
  const { userId, totalOnly } = req.query;

  if (!userId) {
    return res
      .status(400)
      .json({ success: false, message: "userId is required" });
  }

  try {
    // Fetch only what we need
    const user = await User.findOne({ phone: userId })
      .select("purchases rechargeHistory withdrawHistory")
      .lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Calculate total purchases amount
    const totalRechargeAmount = (user.rechargeHistory || []).reduce(
      (sum, record) => sum + (record.amount || 0),
      0
    );
    const totalWithdrawAmount = (user.withdrawHistory || []).reduce(
      (sum, record) => sum + Number(record.amount || 0),
      0
    );
    // ✅ If only total requested
    if (totalOnly === "true") {
      return res.json({
        success: true,
        message: "Total purchases amount fetched successfully",
        totalRechargeAmount,
        totalWithdrawAmount,
      });
    }

    // Otherwise, prepare full data
    const sortAndLimit = (arr = []) =>
      arr
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 50);

    const purchases = user.purchases;
    const rechargeHistory = sortAndLimit(user.rechargeHistory);
    const withdrawHistory = sortAndLimit(user.withdrawHistory);

    return res.json({
      success: true,
      message: "User account data fetched successfully",
      data: { purchases, rechargeHistory, withdrawHistory },
      totalRechargeAmount,
      totalWithdrawAmount,
    });
  } catch (error) {
    console.error("Error fetching finance data:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

UserRouter.post("/user-luckySpin-validationcheck", async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId).lean();
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const today = new Date();
    const lastSpin = user.luckySpin?.lastSpinDate;

    const isSameDay =
      lastSpin &&
      lastSpin.getFullYear() === today.getFullYear() &&
      lastSpin.getMonth() === today.getMonth() &&
      lastSpin.getDate() === today.getDate();

    const spinsToday = isSameDay ? user.luckySpin.spinsToday : 0;
    const canSpin = spinsToday < (user.luckySpin?.SpinLimit || 1);

    res.json({
      success: true,
      canSpin,
      spinsToday,
      SpinLimit: user.luckySpin?.SpinLimit || 1,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

UserRouter.post("/user-luckySpin-dataCreate", async (req, res) => {
  try {
    const { userId, amount, data } = req.body;

    const parseAmount = (value) => {
      const num = Number(value);
      return isNaN(num) || !isFinite(num) ? 0 : num;
    };
    const NewAmount = parseAmount(amount);
    const today = new Date();

    // First get current spin info
    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const lastSpin = user.luckySpin?.lastSpinDate;
    const isSameDay =
      lastSpin &&
      lastSpin.getFullYear() === today.getFullYear() &&
      lastSpin.getMonth() === today.getMonth() &&
      lastSpin.getDate() === today.getDate();

    if (isSameDay) {
      if (user.luckySpin.spinsToday < user.luckySpin.SpinLimit) {
        await User.findByIdAndUpdate(
          userId,
          {
            $inc: {
              tasksReward: NewAmount,
              Withdrawal: NewAmount,
              pendingIncome: NewAmount,
              "luckySpin.spinsToday": 1,
            },
            $set: { "luckySpin.lastSpinDate": today },
            $push: { "luckySpin.History": { amount, today, data } },
          },
          { new: true }
        );
      }
    } else {
      // New day: reset spinsToday to 1
      await User.findByIdAndUpdate(
        userId,
        {
          $inc: {
            tasksReward: NewAmount,
            Withdrawal: NewAmount,
            pendingIncome: NewAmount,
          },
          $set: { "luckySpin.spinsToday": 1, "luckySpin.lastSpinDate": today },
          $push: { "luckySpin.History": { amount, today, data } },
        },
        { new: true }
      );
    }

    const updatedUser = await User.findById(userId).lean();
    res.json({ success: true, luckySpin: updatedUser.luckySpin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

UserRouter.post("/user-luckySpin-dataGet", async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId).lean();
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.json({ success: true, luckySpin: user.luckySpin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

UserRouter.post("/verify", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res
        .status(400)
        .json({ success: false, message: "Phone and OTP are required" });
    }

    // Check if user exists
    const user = await User.findOne({ phone });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let otp = randomNumber(100000, 999999);
    let otpResult = await sendOtpLess(phone, otp);
    console.log(otpResult);

    if (!otpResult.success) {
      return res
        .status(500)
        .json({ success: false, message: otpResult?.data?.message[0] });
    }

    res.json({
      success: true,
      message: "OTP sent successfully",
      data: otpResult,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
});

UserRouter.post("/sendOtp", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res
        .status(400)
        .json({ success: false, message: "Phone and OTP are required" });
    }

    // Check if user exists

    let otp = randomNumber(100000, 999999);
    let otpResult = await sendOtpLess(phone, otp);
    console.log(otpResult);

    if (!otpResult.success) {
      return res
        .status(500)
        .json({ success: false, message: otpResult?.data?.message[0] });
    }

    res.json({
      success: true,
      message: "OTP sent successfully",
      data: otpResult,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
});
UserRouter.post("/create-admin", async (req, res) => {
  const { phone, password } = req.body;

  const existing = await Admin.findOne({ phone });
  if (existing) return res.json({ success: false, message: "Admin exists" });

  const admin = await Admin.create({
    phone,
    password,
    userType: "admin",
    createdBy: null
  });

  res.json({ success: true, admin });
});


UserRouter.post("/check-admin-exist", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) return res.status(400).json({ success: false, message: "Phone required" });

    const allowedAdminNumbers = ["9522575732"]; // Only allowed numbers to register
    if (!allowedAdminNumbers.includes(phone)) {
      return res.json({ success: false, message: "This number is not allowed to register" });
    }

    const existing = await Admin.findOne({ phone, userType: "admin" });

    if (existing) {
      return res.json({ success: true, exists: true, message: "Admin already exists" });
    }

    return res.json({ success: true, exists: false, message: "Admin can register" });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const verifyAdmin = async (phone, password) => {
  if (!phone || !password) return { success: false, message: "Phone and password required" };

  const admin = await Admin.findOne({ phone, userType: "admin" });
  if (!admin) return { success: false, message: "Admin not found" };

  if (admin.password !== password) return { success: false, message: "Invalid password" };

  return { success: true, admin };
};

UserRouter.post("/admin-login", async (req, res) => {
  const { phone, password } = req.body;

  const admin = await Admin.findOne({ phone, userType: "admin" });

  if (!admin) return res.json({ success: false, message: "Admin not found" });
  if (admin.password !== password) return res.json({ success: false, message: "Invalid password" });

  const token = jwt.sign(
    { id: admin._id, phone: admin.phone, userType: admin.userType },
    AdminSECRET_KEY,
    { expiresIn: "7d" }
  );

  res.json({ success: true, token });
});
UserRouter.post("/create-subordinate", async (req, res) => {
  try {
    const { adminPhone, adminPassword, phone, password } = req.body;

    const verify = await verifyAdmin(adminPhone, adminPassword);
    if (!verify.success) return res.status(401).json({ success: false, message: verify.message });

    const existing = await Admin.findOne({ phone });
    if (existing) return res.json({ success: false, message: "User exists" });

    const subordinate = await Admin.create({
      phone,
      password,
      userType: "subordinate",
      createdBy: verify.admin._id
    });

    res.json({ success: true, subordinate });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

UserRouter.put("/subordinate/:id", async (req, res) => {
  try {
    const {  editPhone,editPassword } = req.body;
    const subId = req.params.id;

  
    
    const subordinate = await Admin.findOne({ _id: subId, });
    if (!subordinate) return res.status(404).json({ success: false, message: "Subordinate not found" });

    if (editPhone) {
      const exists = await Admin.findOne({ phone:editPhone });
      if (exists && exists._id.toString() !== subId) return res.status(400).json({ success: false, message: "Phone already in use" });
      subordinate.phone = phone;
    }

    if (editPassword) subordinate.password = editPassword;

    await subordinate.save();

    return res.json({ success: true, message: "Subordinate updated", subordinate });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
UserRouter.delete("/subordinate/:subId", async (req, res) => {
  try {

    const { subId } = req.params;

   

   

    // Find subordinate
    const subordinate = await Admin.findOne({ _id: subId});
    if (!subordinate) {
      return res.status(404).json({ success: false, message: "Subordinate not found or unauthorized" });
    }

    // Delete
    await Admin.deleteOne({ _id: subId });

    return res.json({ success: true, message: "Subordinate deleted successfully" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

UserRouter.post("/subordinate", async (req, res) => {
  try {
    const { adminPhone, adminPassword } = req.body;

    const verify = await verifyAdmin(adminPhone, adminPassword);
    if (!verify.success) return res.status(401).json({ success: false, message: verify.message });

    const list = await Admin.find({ createdBy: verify.admin._id }).select("-password");
    return res.json({ success: true, subordinates: list });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});


UserRouter.post("/subordinate-login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: "Phone and password are required" });
    }

    // Find subordinate by phone
    const subordinate = await Admin.findOne({ phone, userType: "subordinate" });
    if (!subordinate) {
      return res.status(404).json({ success: false, message: "Subordinate not found" });
    }

    // Check password
    if (subordinate.password !== password) {
      return res.status(401).json({ success: false, message: "Incorrect password" });
    }

    // ✅ Success response
    return res.json({
      success: true,
      message: "Subordinate logged in successfully",
      subordinate: {
        id: subordinate._id,
        phone: subordinate.phone,
        createdBy: subordinate.createdBy
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});





UserRouter.post("/forget-password", async (req, res) => {
  try {
    console.log(req.body);
    const { phone, type, confirmPassword } = req.body;
    // type = "password" or "tradePassword"

    if (!phone || !type || !confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "All fields required" });
    }

    // Determine the field to update
    let updateField = {};
    if (type === "password") {
      jwt.sign({ phone }, SECRET_KEY, { expiresIn: "7d" });
      updateField.password = confirmPassword;
    } else if (type === "tradePassword") {
      updateField.tradePassword = confirmPassword;
    } else {
      return res.status(400).json({ success: false, message: "Invalid type" });
    }
    const user = await User.findOne({ phone });
    // Update user using Mongo query by _id
    const result = await User.updateOne({ phone }, { $set: updateField });

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const token = jwt.sign({ phone: phone }, SECRET_KEY, {
      expiresIn: "7d",
    });
    res.json({
      success: true,
      message: `${type} updated successfully`,
      token,
      user,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
});

UserRouter.post("/Change-password", async (req, res) => {
  try {
    const { phone, type, currentPassword, confirmPassword } = req.body;
    if (type === "password") {
      if (!phone || !type || !confirmPassword || !currentPassword) {
        return res
          .status(400)
          .json({ success: false, message: "All fields are required" });
      }
    } else {
      if (!phone || !type || !confirmPassword) {
        return res
          .status(400)
          .json({ success: false, message: "All fields are required" });
      }
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    if (type === "password") {
      // Compare old password
      if (user.password !== currentPassword) {
        return res
          .status(401)
          .json({ success: false, message: "Incorrect current password" });
      }
    }

    let updateField = {};
    if (type === "password") {
      updateField.password = confirmPassword;
    } else if (type === "tradePassword") {
      updateField.tradePassword = confirmPassword;
    } else {
      return res.status(400).json({ success: false, message: "Invalid type" });
    }

    await User.updateOne({ phone }, { $set: updateField });
    // Generate new JWT
    const token = jwt.sign({ phone: User.phone }, SECRET_KEY, {
      expiresIn: "7d",
    });
    res.json({
      success: true,
      token,
      User,
      message: `${type} updated successfully`,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message });
  }
});

UserRouter.get("/tokenVerify", async (req, res) => {
  try {
    const { token, phone } = req.query;

    if (!token || !phone) {
      return res
        .status(400)
        .json({ success: false, message: "Token and phone required" });
    }

    // 🔹 Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, SECRET_KEY); // decoded = { phone, iat, exp }
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    // 🔹 Check that decoded phone matches query phone
    if (decoded.phone !== phone) {
      return res
        .status(403)
        .json({ success: false, message: "Token does not match phone" });
    }

    return res.json({
      success: true,
      message: "User token verified successfully",
      data: decoded, // or return phone/user info
    });
  } catch (error) {
    console.error("Error fetching token data:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// -------------------------------------------------------
// get  all user

UserRouter.get("/all", async (req, res) => {
  try {
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 10;
    const [users, total] = await Promise.all([
      User.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(),
    ]);
    res.json({
      success: true,
      page,
      totalPages: Math.ceil(total / limit),
      total,
      users,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

UserRouter.put("/:userId/withdraw-limit", async (req, res) => {
  try {
    const { limit } = req.body;
    if (!limit)
      return res
        .status(400)
        .json({ success: false, message: "Limit is required" });

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { withdrawLimit: limit },
      { new: true }
    );

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.status(200).json({
      success: true,
      message: "Withdraw limit updated",
      withdrawLimit: user.withdrawLimit,
    });
  } catch (err) {
    console.error("Update Withdraw Limit Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Initial load: base info + first 10 of each team using MongoDB $slice
UserRouter.get("/details/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Use projection to limit embedded arrays
    const user = await User.findById(id, {
      phone: 1,
      referralCode: 1,
      password: 1,
      tradePassword: 1,
      balance: 1,
      totalBuy: 1,
      productIncome: 1,
      pendingIncome: 1,
      withdrawLimit: 1,
      tasksReward: 1,
      luckySpin: 1,
      bankDetails: 1,
      Withdrawal: 1,
      withdrawHistory: 1,
      rechargeHistory: 1,
      createdAt: 1,
      team1: { $slice: 10 },
      team2: { $slice: 10 },
      team3: { $slice: 10 },
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ GET /api/users/:id/team?type=team1&page=1&limit=10
UserRouter.get("/:id/team", async (req, res) => {
  try {
    const { id } = req.params;
    const { type, page = 1, limit = 10 } = req.query;

    // ✅ Validate team type
    if (!["team1", "team2", "team3"].includes(type)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid team type" });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ✅ Use aggregation to paginate embedded array
    const data = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $project: {
          totalCount: { $size: `$${type}` },
          paginatedData: { $slice: [`$${type}`, skip, parseInt(limit)] },
        },
      },
    ]);

    if (!data.length)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const { totalCount, paginatedData } = data[0];

    res.json({
      success: true,
      type,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit),
      totalItems: totalCount,
      items: paginatedData,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/:id/purchases?page=1&limit=10
UserRouter.get("/:id/purchases", async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const start = (page - 1) * limit;

    const user = await User.findById(id, {
      purchases: { $slice: [start, parseInt(limit)] },
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const total =
      (
        await User.aggregate([
          { $match: { _id: user._id } },
          { $project: { count: { $size: "$purchases" } } },
        ])
      )[0]?.count || 0;

    res.json({
      success: true,
      currentPage: +page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      purchases: user.purchases,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// GET /api/users/:id/withdraws?page=1&limit=10
UserRouter.get("/:id/withdraws", async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const start = (page - 1) * limit;

    const user = await User.findById(id, {
      withdrawHistory: { $slice: [start, parseInt(limit)] },
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const total =
      (
        await User.aggregate([
          { $match: { _id: user._id } },
          { $project: { count: { $size: "$withdrawHistory" } } },
        ])
      )[0]?.count || 0;

    res.json({
      success: true,
      currentPage: +page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      withdrawHistory: user.withdrawHistory,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
UserRouter.get("/:id/recharge", async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const start = (page - 1) * limit;

    const user = await User.findById(id, {
      rechargeHistory: { $slice: [start, parseInt(limit)] },
    });

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const total =
      (
        await User.aggregate([
          { $match: { _id: user._id } },
          { $project: { count: { $size: "$rechargeHistory" } } },
        ])
      )[0]?.count || 0;

    res.json({
      success: true,
      currentPage: +page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      rechargeHistory: user.rechargeHistory,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = UserRouter;
