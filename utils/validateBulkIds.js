const mongoose = require('mongoose');

const MAX_BULK_IDS = 5000;

/**
 * Validate and sanitize an array of MongoDB ObjectIds from request body.
 * @param {unknown} ids - Raw ids from req.body (should be array of strings)
 * @returns {{ valid: boolean, ids: ObjectId[], message?: string }}
 */
function validateBulkIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { valid: false, ids: [], message: 'ids array is required.' };
  }
  if (ids.length > MAX_BULK_IDS) {
    return { valid: false, ids: [], message: `Too many ids. Max ${MAX_BULK_IDS} per request.` };
  }
  const objectIds = [];
  for (const id of ids) {
    const str = String(id).trim();
    if (!mongoose.Types.ObjectId.isValid(str)) continue;
    objectIds.push(new mongoose.Types.ObjectId(str));
  }
  if (objectIds.length === 0) {
    return { valid: false, ids: [], message: 'No valid ids provided.' };
  }
  return { valid: true, ids: objectIds };
}

module.exports = { validateBulkIds, MAX_BULK_IDS };
