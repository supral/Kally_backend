const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const memberships = db.collection('memberships');

  // Convert customerId from 24-hex string -> ObjectId, only when it looks valid.
  // This makes populate/search reliable and prevents blank customer details in UI.
  const filter = {
    customerId: { $type: 'string' },
    $expr: { $eq: [{ $strLenCP: '$customerId' }, 24] },
  };

  const totalToConvert = await memberships.countDocuments(filter);
  console.log(`Memberships with string customerId to convert: ${totalToConvert}`);
  if (totalToConvert === 0) {
    console.log('Nothing to do.');
    process.exit(0);
  }

  // MongoDB 4.2+ supports update with aggregation pipeline.
  const res = await memberships.updateMany(filter, [
    {
      $set: {
        customerId: { $toObjectId: '$customerId' },
      },
    },
  ]);

  console.log(`Matched: ${res.matchedCount ?? 0}, Modified: ${res.modifiedCount ?? 0}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

