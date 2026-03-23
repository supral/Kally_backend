/**
 * Normalize a raw Customer document (Mongoose lean or native driver) to API shape.
 * Handles legacy imports that used customer_name, contact, customer, numeric id, etc.
 */

function firstNonEmptyString(...candidates) {
  for (const v of candidates) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

/**
 * @param {Record<string, unknown>} c - customer document from MongoDB
 * @param {{ populateBranch?: boolean }} [opts]
 */
function mapCustomerDocToApi(c, opts = {}) {
  if (!c) return null;

  const name = firstNonEmptyString(
    c.name,
    c.customer_name,
    c.customerName,
    c.customer,
    c.Customer,
    c.customer_name_text
  );

  const phone = firstNonEmptyString(
    c.phone,
    c.contact,
    c.mobile,
    c.phoneNumber,
    c.contact_no,
    c.Contact,
    c.PHONE,
    c.telephone
  );

  const emailRaw = firstNonEmptyString(c.email, c.customer_email, c.customerEmail);
  const email = emailRaw ? emailRaw.toLowerCase() : null;

  let membershipCardId = firstNonEmptyString(
    c.membershipCardId,
    c.cardId,
    c.card_id,
    c.membership_card_id,
    c.cardID
  );

  // Legacy numeric/string id from old systems — do not treat Mongo _id string as card id.
  if (!membershipCardId && c.id != null && c._id != null) {
    const legacyId = String(c.id).trim();
    const oid = String(c._id).trim();
    if (legacyId && legacyId !== oid) membershipCardId = legacyId;
  }

  const primaryBranch = c.primaryBranchId?.name || c.primaryBranch || null;
  const primaryBranchId =
    c.primaryBranchId?._id?.toString?.() || c.primaryBranchId?.toString?.() || c.primaryBranchId || null;

  const out = {
    id: c._id,
    name,
    phone,
    email,
    membershipCardId: membershipCardId || null,
    primaryBranch,
    primaryBranchId,
    customerPackage: c.customerPackage,
    customerPackagePrice: c.customerPackagePrice,
    customerPackageExpiry: c.customerPackageExpiry
      ? new Date(c.customerPackageExpiry).toISOString().split('T')[0]
      : null,
  };

  if (opts.includeNotes) out.notes = c.notes;
  if (opts.includeCreatedAt && c.createdAt) out.createdAt = c.createdAt;

  return out;
}

module.exports = { mapCustomerDocToApi, firstNonEmptyString };
