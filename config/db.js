const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const options = {
      bufferCommands: false,
      maxPoolSize: 10,
    };
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mbm', options);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    if (error.message.includes('querySrv ECONNREFUSED') || error.message.includes('cluster.mongodb.net')) {
      console.error('Tip: If using Atlas, check network/DNS or try the standard (non-SRV) connection string.');
      console.error('For local dev, use: MONGO_URI=mongodb://127.0.0.1:27017/mbm (or unset MONGO_URI).');
    }
    process.exit(1);
  }
};

module.exports = connectDB;
