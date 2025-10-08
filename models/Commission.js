const mongoose = require("mongoose");

const commissionSchema = new mongoose.Schema(
  {
    level1: {
      type: Number,
      default: 25, // 25%
    },
    level2: {
      type: Number,
      default: 8, // 8%
    },
    level3: {
      type: Number,
      default: 2, // 2%
    },
  },
  { timestamps: true }
);
module.exports =  mongoose.model("Commission", commissionSchema);

