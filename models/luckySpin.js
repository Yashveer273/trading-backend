const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  imageUrl: { type: String, required: true },
  priority: { type: Number, default: 0 },
  reward: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("luckspin", itemSchema);
