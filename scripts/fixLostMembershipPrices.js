require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Membership = require('../models/Membership');
const Package = require('../models/Package');
const MembershipUsage = require('../models/MembershipUsage');
const InternalSettlement = require('../models/InternalSettlement');
const Customer = require('../models/Customer');

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function computeSettlementPerCredit(packagePrice, discountAmount, totalCredits) {
  const price = Number(packagePrice) || 0;
  const discount = Number(discountAmount) || 0;
  const credits = Math.max(1, Number(totalCredits) || 1);
  return (price + discount) / (2 * credits);
}

function normalizeName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parsePriceFromName(name) {
  const m = String(name || '').match(/\$?\s*([0-9]+(?:\.[0-9]{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

async function run() {
  const apply = process.argv.includes('--apply');
  const daysArg = process.argv.find((a) => a.startsWith('--days='));
  const uriArg = process.argv.find((a) => a.startsWith('--uri='));
  const days = Math.max(1, Number(daysArg ? daysArg.split('=')[1] : 21) || 21);
  if (uriArg) process.env.MONGO_URI = uriArg.slice('--uri='.length);
  const since = new Date();
  since.setDate(since.getDate() - days);
  await connectDB();

  const packages = await Package.find({}, { name: 1, price: 1, discountAmount: 1, totalSessions: 1 }).lean();
  const pkgByName = new Map();
  for (const p of packages) {
    const key = normalizeName(p.name);
    if (!key || pkgByName.has(key)) continue;
    pkgByName.set(key, p);
  }

  const memberships = await Membership.find(
    {
      purchaseDate: { $gte: since },
      $or: [{ packagePrice: { $exists: false } }, { packagePrice: null }, { packagePrice: 0 }],
    },
    { _id: 1, customerId: 1, packageName: 1, packagePrice: 1, discountAmount: 1, totalCredits: 1, settlementAmount: 1, createdAt: 1 }
  ).lean();

  const customerIds = Array.from(new Set(memberships.map((m) => String(m.customerId)).filter(Boolean)));
  const customers = await Customer.find(
    { _id: { $in: customerIds.map((id) => new mongoose.Types.ObjectId(id)) } },
    { _id: 1, customerPackage: 1, customerPackagePrice: 1, name: 1, phone: 1 }
  ).lean();
  const customerById = new Map(customers.map((c) => [String(c._id), c]));

  const toFix = [];
  for (const m of memberships) {
    const currentPrice = Number(m.packagePrice);
    const currentDiscount = Number(m.discountAmount || 0);
    const customer = customerById.get(String(m.customerId));
    const pkgByMembershipName = pkgByName.get(normalizeName(m.packageName));
    const pkgByCustomerName = pkgByName.get(normalizeName(customer?.customerPackage));

    let nextPrice = null;
    let nextDiscount = currentDiscount;
    let source = null;
    if (pkgByMembershipName && Number.isFinite(Number(pkgByMembershipName.price))) {
      nextPrice = Number(pkgByMembershipName.price);
      nextDiscount = Number(pkgByMembershipName.discountAmount || 0);
      source = 'packageName';
    } else if (pkgByCustomerName && Number.isFinite(Number(pkgByCustomerName.price))) {
      nextPrice = Number(pkgByCustomerName.price);
      nextDiscount = Number(pkgByCustomerName.discountAmount || 0);
      source = 'customerPackage';
    } else if (Number.isFinite(Number(customer?.customerPackagePrice)) && Number(customer.customerPackagePrice) >= 0) {
      nextPrice = Number(customer.customerPackagePrice);
      source = 'customerPackagePrice';
    } else {
      const parsed = parsePriceFromName(m.packageName);
      if (parsed != null) {
        nextPrice = parsed;
        source = 'parsedFromPackageName';
      }
    }

    const hasMissingPrice = !Number.isFinite(currentPrice);
    const hasZeroPrice = Number.isFinite(currentPrice) && currentPrice === 0;
    const canRepair = nextPrice != null && (hasMissingPrice || (hasZeroPrice && nextPrice > 0));
    if (!canRepair) continue;

    const nextSettlementPerCredit = computeSettlementPerCredit(nextPrice, nextDiscount, m.totalCredits);
    toFix.push({
      membershipId: String(m._id),
      customerId: String(m.customerId),
      packageName: m.packageName,
      customerName: customer?.name,
      customerPhone: customer?.phone,
      oldPrice: m.packagePrice,
      newPrice: nextPrice,
      oldDiscount: m.discountAmount || 0,
      newDiscount: nextDiscount,
      oldSettlementPerCredit: m.settlementAmount,
      newSettlementPerCredit: nextSettlementPerCredit,
      source,
    });
  }

  // Also include memberships in time range where settlement-per-credit is zero/missing,
  // if we can derive a valid package price/discount.
  const settlementIssueMemberships = await Membership.find(
    {
      purchaseDate: { $gte: since },
      $or: [{ settlementAmount: { $exists: false } }, { settlementAmount: null }, { settlementAmount: 0 }],
    },
    { _id: 1, customerId: 1, packageName: 1, packagePrice: 1, discountAmount: 1, totalCredits: 1, settlementAmount: 1, createdAt: 1 }
  ).lean();
  const seenMembershipIds = new Set(toFix.map((x) => x.membershipId));
  for (const m of settlementIssueMemberships) {
    const id = String(m._id);
    if (seenMembershipIds.has(id)) continue;
    const customer = customerById.get(String(m.customerId));
    const pkgByMembershipName = pkgByName.get(normalizeName(m.packageName));
    const pkgByCustomerName = pkgByName.get(normalizeName(customer?.customerPackage));
    let nextPrice = Number.isFinite(Number(m.packagePrice)) && Number(m.packagePrice) > 0 ? Number(m.packagePrice) : null;
    let nextDiscount = Number(m.discountAmount || 0);
    let source = 'existingMembershipPrice';
    if (!nextPrice && pkgByMembershipName && Number.isFinite(Number(pkgByMembershipName.price))) {
      nextPrice = Number(pkgByMembershipName.price);
      nextDiscount = Number(pkgByMembershipName.discountAmount || 0);
      source = 'packageName';
    } else if (!nextPrice && pkgByCustomerName && Number.isFinite(Number(pkgByCustomerName.price))) {
      nextPrice = Number(pkgByCustomerName.price);
      nextDiscount = Number(pkgByCustomerName.discountAmount || 0);
      source = 'customerPackage';
    } else if (!nextPrice && Number.isFinite(Number(customer?.customerPackagePrice)) && Number(customer.customerPackagePrice) > 0) {
      nextPrice = Number(customer.customerPackagePrice);
      source = 'customerPackagePrice';
    }
    if (!nextPrice || nextPrice <= 0) continue;
    const nextSettlementPerCredit = computeSettlementPerCredit(nextPrice, nextDiscount, m.totalCredits);
    if (!(nextSettlementPerCredit > 0)) continue;
    toFix.push({
      membershipId: id,
      customerId: String(m.customerId),
      packageName: m.packageName,
      customerName: customer?.name,
      customerPhone: customer?.phone,
      oldPrice: m.packagePrice,
      newPrice: nextPrice,
      oldDiscount: m.discountAmount || 0,
      newDiscount: nextDiscount,
      oldSettlementPerCredit: m.settlementAmount,
      newSettlementPerCredit: nextSettlementPerCredit,
      source,
    });
    seenMembershipIds.add(id);
  }

  const byMembershipId = new Set(toFix.map((x) => x.membershipId));
  const usages = await MembershipUsage.find(
    { membershipId: { $in: Array.from(byMembershipId).map((id) => new mongoose.Types.ObjectId(id)) } },
    { _id: 1, membershipId: 1, creditsUsed: 1 }
  ).lean();
  const usageByMembership = new Map();
  for (const u of usages) {
    const k = String(u.membershipId);
    const arr = usageByMembership.get(k) || [];
    arr.push(u);
    usageByMembership.set(k, arr);
  }

  const usageIds = usages.map((u) => u._id);
  const settlements = await InternalSettlement.find(
    { membershipUsageId: { $in: usageIds } },
    { _id: 1, membershipUsageId: 1, amount: 1, status: 1, fromBranchId: 1, toBranchId: 1 }
  ).lean();
  const settlementByUsageId = new Map(settlements.map((s) => [String(s.membershipUsageId), s]));

  let settlementUpdates = 0;
  let membershipUpdates = 0;
  const settlementOnlyFixes = [];

  // Also audit cross-branch settlement rows with amount 0 in time window.
  const zeroSettlements = await InternalSettlement.find(
    {
      createdAt: { $gte: since },
      membershipUsageId: { $exists: true, $ne: null },
      amount: { $lte: 0 },
    },
    { _id: 1, membershipUsageId: 1, amount: 1, createdAt: 1 }
  ).lean();
  if (zeroSettlements.length > 0) {
    const zeroUsageIds = zeroSettlements.map((s) => s.membershipUsageId).filter(Boolean);
    const zeroUsages = await MembershipUsage.find(
      { _id: { $in: zeroUsageIds } },
      { _id: 1, membershipId: 1, creditsUsed: 1 }
    ).lean();
    const usageById = new Map(zeroUsages.map((u) => [String(u._id), u]));
    const membershipIdsForZero = Array.from(new Set(zeroUsages.map((u) => String(u.membershipId)).filter(Boolean)));
    const membershipsForZero = await Membership.find(
      { _id: { $in: membershipIdsForZero.map((id) => new mongoose.Types.ObjectId(id)) } },
      { _id: 1, customerId: 1, packageName: 1, packagePrice: 1, discountAmount: 1, totalCredits: 1, settlementAmount: 1 }
    ).lean();
    const membershipById = new Map(membershipsForZero.map((m) => [String(m._id), m]));
    for (const s of zeroSettlements) {
      const u = usageById.get(String(s.membershipUsageId));
      if (!u) continue;
      const m = membershipById.get(String(u.membershipId));
      if (!m) continue;
      let perCredit = Number(m.settlementAmount || 0);
      if (!(perCredit > 0)) {
        const price = Number(m.packagePrice || 0);
        const discount = Number(m.discountAmount || 0);
        if (price > 0) perCredit = computeSettlementPerCredit(price, discount, m.totalCredits);
      }
      if (!(perCredit > 0)) continue;
      const newAmount = round2(perCredit * (Number(u.creditsUsed) || 1));
      if (!(newAmount > 0)) continue;
      settlementOnlyFixes.push({
        settlementId: String(s._id),
        membershipUsageId: String(s.membershipUsageId),
        membershipId: String(m._id),
        oldAmount: Number(s.amount || 0),
        newAmount,
      });
    }
  }

  if (apply) {
    for (const row of toFix) {
      await Membership.updateOne(
        { _id: row.membershipId },
        {
          $set: {
            packagePrice: row.newPrice,
            discountAmount: row.newDiscount,
            settlementAmount: row.newSettlementPerCredit,
          },
        }
      );
      membershipUpdates++;

      const linkedUsages = usageByMembership.get(row.membershipId) || [];
      for (const u of linkedUsages) {
        const s = settlementByUsageId.get(String(u._id));
        if (!s) continue;
        const newAmount = round2(row.newSettlementPerCredit * (Number(u.creditsUsed) || 1));
        if (Number(s.amount) === newAmount) continue;
        await InternalSettlement.updateOne({ _id: s._id }, { $set: { amount: newAmount } });
        settlementUpdates++;
      }

      await Customer.updateOne(
        { _id: row.customerId },
        { $set: { customerPackage: row.packageName, customerPackagePrice: row.newPrice } }
      );
    }
    for (const row of settlementOnlyFixes) {
      await InternalSettlement.updateOne({ _id: row.settlementId }, { $set: { amount: row.newAmount } });
      settlementUpdates++;
    }
  }

  const examplePhone = '2533306242';
  const exampleCustomer = await Customer.findOne({ phone: examplePhone }, { _id: 1, name: 1, phone: 1 }).lean();
  let exampleMemberships = [];
  if (exampleCustomer?._id) {
    exampleMemberships = await Membership.find(
      { customerId: exampleCustomer._id },
      { _id: 1, packageName: 1, packagePrice: 1, discountAmount: 1, totalCredits: 1, status: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .lean();
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        daysWindow: days,
        since,
        candidateMemberships: toFix.length,
        membershipUpdates,
        settlementCandidates: settlements.length,
        zeroSettlementCandidates: settlementOnlyFixes.length,
        settlementUpdates,
        sampleCandidates: toFix.slice(0, 10),
        sampleZeroSettlementCandidates: settlementOnlyFixes.slice(0, 10),
        exampleCustomer: exampleCustomer || null,
        exampleMemberships,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});

