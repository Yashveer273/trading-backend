const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // ✔️ differentiate between main admin vs subordinate
  userType: { 
    type: String, 
    enum: ["admin", "subordinate"], 
    required: true 
  },

  // ✔️ subordinate created by main admin
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Admin", 
    default: null 
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("AdminAuth", adminSchema);
