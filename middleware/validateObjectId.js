const mongoose = require('mongoose');

/**
 * Middleware that validates req.params[paramName] is a valid MongoDB ObjectId.
 * Sends 400 if invalid; otherwise calls next().
 * @param {string} [paramName='id'] - The route param to validate (e.g. 'id', 'branchId').
 */
function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({ success: false, message: `Invalid ${paramName}.` });
    }
    next();
  };
}

module.exports = { validateObjectId };
