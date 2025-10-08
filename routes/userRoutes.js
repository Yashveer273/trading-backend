const express = require("express");
const User = require("../models/user");
const jwt = require('jsonwebtoken');

const UserRouter = express.Router();
const SECRET_KEY="SECRET_KEY12356789";
// GET all users
const Commission = require("../models/Commission");
UserRouter.get("/", async (req, res) => {
  try {
    const users = await User.find().populate("referredBy", "phone");
    res.status(200).json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
UserRouter.get("/user", async (req, res) => {
  const {userId}=req.query;
  try {
    const users = await User.findById(userId);
    res.status(200).json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
// Direct team (Stage 1)
UserRouter.get("/:userId/direct-team", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate("referrals.person", "phone");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const directTeam = user.referrals
      .filter(r => r.stage === 1)
      .map(r => ({
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
    const user = await User.findById(req.params.userId).populate("referrals.person", "phone");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const indirectTeam = user.referrals
      .filter(r => r.stage === 2 || r.stage === 3)
      .map(r => ({
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
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

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

// Update Withdraw Limit (Admin / Testing)
UserRouter.put("/:userId/withdraw-limit", async (req, res) => {
  try {
    const { limit } = req.body;
    if (!limit) return res.status(400).json({ success: false, message: "Limit is required" });

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { withdrawLimit: limit },
      { new: true }
    );

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

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




// POST /api/auth/register
const generateReferralCode = () =>
  Math.random().toString(36).substr(2, 6).toUpperCase();



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

    // 🔹 Create new user data object
    const newUserData = {
      phone,
      password, // ⚠️ hash in production
      referralCode,
      tradePassword,
     
      referredBy: refCode
        ? { refCode: level1User.referralCode, phone: level1User.phone }
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
     
              ids: [{ phone: newUser.phone,person: newUser._id, }],
            },
          },
           
        }
      );

      // Level 2
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
                 
                  ids: [{ phone: newUser.phone, person: newUser._id, }],
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
                    
                      ids: [{ phone: newUser.phone,person: newUser._id, }],
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
      return res.status(400).json({ success: false, message: "Phone and password are required" });
    }

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ⚠️ In production use bcrypt.compare
    if (user.password !== password) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Generate new JWT
    const token = jwt.sign({ phone: user.phone }, SECRET_KEY, { expiresIn: "7d" });

    // Save token in DB
    user.token = token;
    await user.save();

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
    if (!_id || !teamLevel) return res.json({ success: false, message: "Missing _id or teamLevel" });

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
    if (!_id) return res.status(400).json({ success: false, message: "Missing _id" });

    // 🔹 Find user
    const user = await User.findById(_id).lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // 🔹 Get current commission rates (assume one document)
    const commissionDoc = await Commission.findOne().lean();
    const rates = commissionDoc || { level1: 25, level2: 8, level3: 2 };

    // 🔹 Helper function
    const calcTeam = (team, rate) => {
      const totalRecharge = team.reduce((sum, m) => sum + (m.totalRecharge || 0), 0);
      const totalCommission = team.reduce((sum, m) => sum + (m.totalCommission || 0), 0);
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
      totalTeams: (user.team1?.length || 0) + (user.team2?.length || 0) + (user.team3?.length || 0),
    };

    res.json({ success: true, message: "Team overview fetched", overview });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// GET API: fetch team array for a specific level
UserRouter.get("/team-level", async (req, res) => {
  try {
    const { _id, level } = req.query;

    if (!_id) return res.status(400).json({ success: false, message: "Missing _id" });
    if (!level) return res.status(400).json({ success: false, message: "Missing level" });

    const user = await User.findById(_id).lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

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
        return res.status(400).json({ success: false, message: "Invalid level" });
    }

    res.json({ success: true, message: `Team ${level} fetched`, team: teamArray });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

module.exports = UserRouter;
