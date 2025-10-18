const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    categoryName: { type: String, required: true },
    productName: { type: String, required: true },
    price: { type: Number, required: true },
    cycleType: { type: String, enum: ["day", "hour"], required: true },
    cycleValue: { type: Number, required: true },
    daily: { type: Number, default: 0 },
    hour: { type: Number, default: 0 },  
    totalIncomeDay: { type: Number, default: 0 },  
    totalIncomeHour: { type: Number, default: 0 },
    imageUrl: { type: String, default: "" },  
    purchaseType: { type: String, default: "One time buy" } ,   
    productExplanation: { type: Array, default: [] },
    badge: {
      type: String,
      enum: ["non", "popular", "limited", "new"],
      default: "non",
    },
  },
  { timestamps: true }
);

// Auto-calculate total incomes before saving
productSchema.pre("save", function (next) {
  this.totalIncomeDay = this.daily * this.cycleValue;
  this.totalIncomeHour = this.hour * this.cycleValue;
  next();
});

// Optional: recalc totals on update
productSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.daily !== undefined && update.cycleValue !== undefined) {
    update.totalIncomeDay = update.daily * update.cycleValue;
  }
  if (update.hour !== undefined && update.cycleValue !== undefined) {
    update.totalIncomeHour = update.hour * update.cycleValue;
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);
