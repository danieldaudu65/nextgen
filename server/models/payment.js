const mongoose = require('mongoose');

// Every Paystack payment (school plans and personal plans). Paid once → applied once.
const paymentSchema = new mongoose.Schema({
    reference:                  { type: String, required: true, unique: true },
    kind:                       { type: String, enum: ['school', 'personal'], required: true },
    school:                     { type: mongoose.Schema.Types.ObjectId, ref: 'schools', default: null, index: true },
    student:                    { type: mongoose.Schema.Types.ObjectId, ref: 'students', default: null, index: true },
    plan:                       { type: String, default: null },  // school plan id
    seats:                      { type: Number, default: 0 },
    days:                       { type: Number, default: 365 },
    amount:                     { type: Number, required: true }, // naira
    email:                      { type: String, lowercase: true, trim: true },
    status:                     { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending', index: true },
    provider:                   { type: String, enum: ['paystack', 'demo', 'manual'], default: 'paystack' },
    paidAt:                     { type: Date, default: null },
    appliedAt:                  { type: Date, default: null },     // when the seats / access were added
    sample:                     { type: Boolean, default: false },
}, {
    timestamps: true,
    collection: 'payments'
});

module.exports = mongoose.models.payments || mongoose.model('payments', paymentSchema);
