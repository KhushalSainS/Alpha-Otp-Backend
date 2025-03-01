import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const transactionSchema = new mongoose.Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  description: { type: String },
  timestamp: { type: Date, default: Date.now }
});

const transactionModel = mongoose.models.transaction || mongoose.model('transaction', transactionSchema);

export default transactionModel;
