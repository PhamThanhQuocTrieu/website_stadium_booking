const Booking = require('../models/Booking');

const activeSlotStatuses = [
  'pending',
  'confirmed',
  'playing',
  'completed',
  'cancel_requested',
  'Pending',
  'Confirmed',
  'Completed',
  'PENDING_PAYMENT',
  'CONFIRMED',
  'COMPLETED'
];

const ensureBookingIndexes = async () => {
  const collection = Booking.collection;
  const indexes = await collection.indexes();
  const legacyIndex = indexes.find((index) => (
    index.name !== 'unique_active_booking_slot' &&
    index.unique &&
    index.key?.field === 1 &&
    index.key?.date === 1 &&
    index.key?.startTime === 1
  ));

  if (legacyIndex) {
    await collection.dropIndex(legacyIndex.name);
  }

  await collection.createIndex(
    { field: 1, date: 1, startTime: 1 },
    {
      unique: true,
      name: 'unique_active_booking_slot',
      partialFilterExpression: { status: { $in: activeSlotStatuses } }
    }
  );
};

module.exports = ensureBookingIndexes;
