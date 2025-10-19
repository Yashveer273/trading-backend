const mongoose = require("mongoose");

const SocialLinksSchema = new mongoose.Schema({
  telegramUsernameLink: {
    type: String,
    required: true,
  },
  telegramGroupLink: {
    type: String,
    required: true,
  },
}, { timestamps: true });


module.exports = mongoose.model("SocialLinks", SocialLinksSchema);