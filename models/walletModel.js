import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const walletSchema = new mongoose.Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  balance: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

const walletModel = mongoose.models.wallet || mongoose.model('wallet', walletSchema);

export default walletModel;
