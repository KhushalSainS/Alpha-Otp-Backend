import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const apiKeySchema = new mongoose.Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true, unique: true },
  emailConfig: {
    email: { type: String, required: true },
    password: { type: String, required: true },
    service: { type: String, default: "gmail" }
  },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const apiKeyModel = mongoose.models.apiKey || mongoose.model('apiKey', apiKeySchema);

export default apiKeyModel;
