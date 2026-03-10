require('dotenv').config();
const mongoose = require('mongoose');
const Guidelines = require('../models/Guidelines');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mbm';

const defaultContent = `
<h1>System Guidelines</h1>
<p>Welcome to the <strong>Multi-Branch CRM</strong>. This guide explains how to use the system: creating, updating, and editing branches, customers, memberships, packages, staff, and more.</p>

<h2>1. What the System Is</h2>
<p>This is a <strong>multi-branch CRM</strong>. It helps you manage branches, staff (vendors), customers, memberships, packages, leads, appointments, settlements, and sales across locations.</p>
<ul>
  <li><strong>Branches</strong> – Locations (name, address, zip code).</li>
  <li><strong>Staff (Vendors)</strong> – Users assigned to branches; they see only their branch data where applicable.</li>
  <li><strong>Customers</strong> – People who buy memberships; each has name, phone, email, optional card ID and primary branch.</li>
  <li><strong>Packages</strong> – Membership types (e.g. Basic, Premium) with price and number of sessions.</li>
  <li><strong>Memberships</strong> – A customer’s purchase of a package; tracks total/used/remaining sessions and status.</li>
  <li><strong>Leads</strong> – Incoming leads; follow up and convert to appointments.</li>
  <li><strong>Appointments</strong> – Booked and completed appointments.</li>
  <li><strong>Settlements</strong> – Money owed between branches when one branch uses a membership sold by another.</li>
  <li><strong>Sales</strong> – Membership revenue and manual (daily) sales per branch.</li>
</ul>

<h2>2. How to Use as Admin</h2>
<p>As an <strong>admin</strong>, you have access to all areas of the system. Use the left sidebar to open:</p>
<ul>
  <li><strong>Dashboard</strong> – Overview and metrics.</li>
  <li><strong>Staff (assign branch)</strong> – Manage staff and assign branches.</li>
  <li><strong>Branches</strong> – Add, edit, or delete branch locations.</li>
  <li><strong>Memberships</strong> – View and manage all memberships.</li>
  <li><strong>Customers</strong> – Add, edit, and view customers.</li>
  <li><strong>Packages</strong> – Create and edit membership packages.</li>
  <li><strong>Leads</strong> – Inbox and follow-up.</li>
  <li><strong>Appointments</strong> – Booked and completed appointments.</li>
  <li><strong>Settlements</strong> – Inter-branch settlements.</li>
  <li><strong>Sales</strong> – Sales dashboard and manual sales.</li>
  <li><strong>Settings</strong> – System settings.</li>
</ul>

<h2>3. How to Use as Vendor</h2>
<p>As a <strong>vendor</strong> (branch user), you see data for your assigned branch. From the sidebar you can use:</p>
<ul>
  <li><strong>Dashboard</strong> – Your branch overview.</li>
  <li><strong>Sales</strong> – Sales for your branch.</li>
  <li><strong>Memberships</strong> – Memberships at your branch.</li>
  <li><strong>Customers</strong> – Customers (view and manage as allowed).</li>
  <li><strong>Leads</strong> – Leads inbox.</li>
  <li><strong>Appointments</strong> – Appointments at your branch.</li>
</ul>
<p>Vendors cannot create packages or edit Settings; they can only view this Guidelines page (read-only).</p>

<h2>4. How to Create and Edit</h2>

<h3>Branches</h3>
<ul>
  <li><strong>Add branch</strong> – Open <strong>Branches</strong> from the sidebar, click <strong>Add branch</strong>, enter name, address, and zip code, then submit.</li>
  <li><strong>Edit branch</strong> – In the branches list, click <strong>Edit</strong> on a row; change name/address/zip and save.</li>
  <li><strong>View / Delete</strong> – Use <strong>View</strong> to see details, or <strong>Delete</strong> to remove a branch (use with care).</li>
  <li>You can also <strong>Import from JSON</strong> to bulk-add branches.</li>
</ul>

<h3>Customers</h3>
<ul>
  <li><strong>Add customer</strong> – Go to <strong>Customers</strong>, click <strong>Add customer</strong>, fill name, phone, optional email and notes; admin can set primary branch. Card ID is often auto-generated.</li>
  <li><strong>Edit/View</strong> – Click a customer row to open their detail page; from there you can edit info or go to their memberships and appointments.</li>
  <li>Use <strong>Create membership</strong> from the customer list or from the customer detail to assign a package.</li>
</ul>

<h3>Packages</h3>
<ul>
  <li><strong>Add package</strong> – Admin: open <strong>Packages</strong>, click <strong>Add package</strong>, enter name, price, discount, and number of sessions. Settlement amount is calculated automatically.</li>
  <li><strong>Edit package</strong> – In the packages table, click <strong>Edit</strong> on a row, change fields, and save. You can also <strong>Delete</strong> (admin only).</li>
</ul>

<h3>Memberships</h3>
<ul>
  <li><strong>Create membership</strong> – Go to <strong>Memberships</strong>, click <strong>Create new membership</strong>, select customer and package; admin can choose “sold at” branch. Submit to create.</li>
  <li><strong>View / Edit / Use</strong> – Click a membership row to open it; there you can see details, record usage (sessions used), or edit. Admin can delete with confirmation.</li>
  <li>You can <strong>Import from CSV or JSON</strong> for bulk memberships; use <strong>Import sessions (JSON)</strong> to record usage in bulk.</li>
</ul>

<h3>Staff (Vendors)</h3>
<ul>
  <li><strong>Add staff</strong> – Admin: use <strong>Add new staff</strong> from the sidebar, enter name, email, password, and assign a branch. The user can then log in as a vendor.</li>
  <li><strong>Edit / Block / Delete</strong> – In <strong>Staff (assign branch)</strong>, open a vendor to update password, block, or delete. You can also change assigned branch.</li>
</ul>

<h3>Sales</h3>
<ul>
  <li><strong>Sales dashboard</strong> – View total sales (membership + manual), filter by date and branch (admin). Click a branch name to see its manual sales and membership breakdown.</li>
  <li><strong>Add manual sale</strong> – In branch details on the Sales dashboard, click <strong>+ Add manual sale</strong>, enter date and amount, optionally attach a receipt image. Admin can delete manual sales.</li>
</ul>

<h2>5. Editing This Guidelines Page</h2>
<p><strong>Admins only:</strong> Open <strong>Guidelines</strong> from the sidebar (above Settings). Use the rich text editor to change this content: add sections, format text, add lists and links. Click <strong>Save</strong> to publish. All logged-in users (admin and vendors) will see the updated guidelines when they open the Guidelines page.</p>
`.trim();

async function seedGuidelines() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    const doc = await Guidelines.findOneAndUpdate(
      {},
      { $set: { content: defaultContent } },
      { new: true, upsert: true }
    );
    console.log('Guidelines seeded successfully. Content length:', doc.content?.length ?? 0);

    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seedGuidelines();
