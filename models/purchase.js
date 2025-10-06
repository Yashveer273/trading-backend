const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  productName: { type: String, required: true },
  amount: { type: Number, required: true },        // single unit price
  TotalAmount: { type: Number, required: true },  // total cost
  quantity: { type: Number, default: 1 },
  productId: { type: mongoose.Schema.Types.ObjectId, required: true },
  purchaseType: { type: String, default: "one-time" },
  cycleDuration:{ type: String,  },
      dailyIncome:  { type: String,  },
      cycleType:{ type: String,  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Purchase", purchaseSchema);
