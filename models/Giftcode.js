const mongoose = require("mongoose");

const GiftcodeSchema = new mongoose.Schema({
  creator: { type: String, required: true },
  amount: { type: Number, required: true },
  users: { type: Number, required: true },
  newUsersOnly: { type: Boolean, default: false },
  expiry: { type: String, default: "No" }, // can store as ISO string
  time: { type: String, required: true }, // creation time as ISO string
});

module.exports = mongoose.model("Giftcode", GiftcodeSchema);
