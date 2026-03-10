import React, { useEffect, useMemo, useState, useRef } from 'react';
import { getMemberships, createMembership, importMemberships, recordMembershipUsage, deleteMembership, type ImportRow } from '../api/memberships';
import { getCustomers } from '../api/customers';
import { getBranches } from '../api/branches';
import { getPackages } from '../api/packages';
import { useAuth } from '../auth/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatCurrency } from '../utils/money';
import type { Membership, Branch } from '../types/crm';
import type { Customer } from '../types/common';
import type { PackageItem } from '../api/packages';

export default function MembershipsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [branchId, setBranchId] = useState(searchParams.get('branchId') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(searchParams.get('customerId') ? true : false);
  const [createCustomerId, setCreateCustomerId] = useState(searchParams.get('customerId') || '');
  const [createCustomerSearch, setCreateCustomerSearch] = useState('');
  const [createCustomerDropdownOpen, setCreateCustomerDropdownOpen] = useState(false);
  const createCustomerInputRef = useRef<HTMLInputElement>(null);
  const createCustomerDropdownRef = useRef<HTMLDivElement>(null);
  const [createSoldAtBranchId, setCreateSoldAtBranchId] = useState('');
  const [createPackageId, setCreatePackageId] = useState('');
  const [createPackagePrice, setCreatePackagePrice] = useState('');
  const [createDiscountAmount, setCreateDiscountAmount] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; createdCustomers: number; errors: { row: number; message: string }[] } | null>(null);
  const [sessionsImporting, setSessionsImporting] = useState(false);
  const [sessionsImportResult, setSessionsImportResult] = useState<{ ok: number; fail: number; skipped: number } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleteConfirmError, setDeleteConfirmError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const basePath = user?.role === 'admin' ? '/admin' : '/vendor';
  const isAdmin = user?.role === 'admin';
  const PAGE_SIZE = 10;

  const selectedPackage = useMemo(() => packages.find((p) => p.id === createPackageId), [packages, createPackageId]);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === createCustomerId), [customers, createCustomerId]);
  const createCustomerSearchLower = createCustomerSearch.trim().toLowerCase();
  const filteredCreateCustomers = useMemo(() => {
    if (!createCustomerSearchLower) return customers;
    return customers.filter((c) => {
      const name = (c.name ?? '').toLowerCase();
      const phone = (c.phone ?? '').toLowerCase();
      const email = (c.email ?? '').toLowerCase();
      const cardId = (c.membershipCardId ?? '').toLowerCase();
      return (
        name.includes(createCustomerSearchLower) ||
        phone.includes(createCustomerSearchLower) ||
        email.includes(createCustomerSearchLower) ||
        cardId.includes(createCustomerSearchLower)
      );
    });
  }, [customers, createCustomerSearchLower]);

  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      const target = ev.target as Node;
      if (
        createCustomerDropdownRef.current &&
        !createCustomerDropdownRef.current.contains(target) &&
        createCustomerInputRef.current &&
        !createCustomerInputRef.current.contains(target)
      ) {
        setCreateCustomerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { filteredMemberships, totalFiltered, totalPages, currentPage, paginatedMemberships } = useMemo(() => {
    const searchLower = searchQuery.trim().toLowerCase();
    const filtered = searchLower
      ? memberships.filter((m) => {
          const customerName = (m.customer?.name ?? '').toLowerCase();
          const customerPhone = (m.customer?.phone ?? '').toLowerCase();
          const customerEmail = (m.customer?.email ?? '').toLowerCase();
          const typeName = (m.typeName ?? '').toLowerCase();
          const soldAt = (m.soldAtBranch ?? '').toLowerCase();
          const statusStr = (m.status ?? '').toLowerCase();
          return (
            customerName.includes(searchLower) ||
            customerPhone.includes(searchLower) ||
            customerEmail.includes(searchLower) ||
            typeName.includes(searchLower) ||
            soldAt.includes(searchLower) ||
            statusStr.includes(searchLower)
          );
        })
      : memberships;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const current = Math.min(Math.max(1, page), pages);
    const paginated = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
    return {
      filteredMemberships: filtered,
      totalFiltered: total,
      totalPages: pages,
      currentPage: current,
      paginatedMemberships: paginated,
    };
  }, [memberships, searchQuery, page, PAGE_SIZE]);

  useEffect(() => {
    const customerIdFromUrl = searchParams.get('customerId');
    if (customerIdFromUrl) {
      setShowCreateForm(true);
      setCreateCustomerId(customerIdFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, branchId, status, dateFrom, dateTo]);

  useEffect(() => {
    if (!deleteConfirmId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDeleteConfirm();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteConfirmId]);

  function openDeleteConfirm(id: string) {
    setDeleteConfirmId(id);
    setDeleteConfirmInput('');
    setDeleteConfirmError('');
  }

  function closeDeleteConfirm() {
    setDeleteConfirmId(null);
    setDeleteConfirmInput('');
    setDeleteConfirmError('');
  }

  async function handleDeleteConfirmOk() {
    if (!deleteConfirmId) return;
    if (deleteConfirmInput.trim() !== 'CONFIRM') {
      setDeleteConfirmError('Type CONFIRM exactly to proceed.');
      return;
    }
    setDeleteConfirmError('');
    setDeletingId(deleteConfirmId);
    const res = await deleteMembership(deleteConfirmId);
    setDeletingId(null);
    closeDeleteConfirm();
    if (res.success) {
      setMemberships((prev) => prev.filter((m) => m.id !== deleteConfirmId));
    } else {
      setError(res.message || 'Failed to delete membership.');
    }
  }

  function escapeCsvCell(value: string | number): string {
    const s = String(value ?? '').replace(/"/g, '""');
    return /[,"\n\r]/.test(s) ? `"${s}"` : s;
  }

  function exportToCsv() {
    const headers = ['Date', 'Name', 'Total', 'Used', 'Remaining', 'Package Name', 'Package Price', 'Sold at', 'Status'];
    const rows = filteredMemberships.map((m) => {
      const remaining = m.remainingCredits ?? m.totalCredits - m.usedCredits;
      const dateStr = m.purchaseDate ? new Date(m.purchaseDate).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';
      const pkgName = m.packageName || m.typeName || '—';
      const priceStr = m.packagePrice != null
        ? formatCurrency(m.packagePrice)
        : '—';
      return [
        dateStr,
        m.customer?.name ?? '—',
        m.totalCredits,
        m.usedCredits,
        remaining,
        pkgName,
        priceStr,
        m.soldAtBranch ?? '—',
        m.status ?? '—',
      ].map(escapeCsvCell);
    });
    const csv = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memberships-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        i++;
        let cell = '';
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { cell += '"'; i += 2; continue; }
          if (line[i] === '"') { i++; break; }
          cell += line[i++];
        }
        out.push(cell);
      } else {
        let cell = '';
        while (i < line.length && line[i] !== ',') cell += line[i++];
        out.push(cell.trim());
        if (line[i] === ',') i++;
      }
    }
    return out;
  }

  function csvToImportRows(text: string): ImportRow[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = parseCsvLine(lines[0]).map((h) => h.trim());
    const get = (row: string[], name: string) => {
      const i = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
      return i >= 0 ? row[i] ?? '' : '';
    };
    const out: ImportRow[] = [];
    for (let r = 1; r < lines.length; r++) {
      const cells = parseCsvLine(lines[r]);
      const customerName = get(cells, 'Customer') || get(cells, 'customerName');
      const customerPhone = get(cells, 'Phone') || get(cells, 'customerPhone');
      const customerEmail = get(cells, 'Email') || get(cells, 'customerEmail');
      const totalCreditsRaw = get(cells, 'Total credits') || get(cells, 'totalCredits');
      const soldAtBranch = get(cells, 'Sold at') || get(cells, 'soldAtBranch') || get(cells, 'Branch');
      let packagePrice: number | undefined;
      const priceStr = get(cells, 'Package price') || get(cells, 'packagePrice');
      if (priceStr && priceStr !== '—' && priceStr !== '-') {
        const num = parseFloat(priceStr.replace(/[$,]/g, '').trim());
        if (!Number.isNaN(num)) packagePrice = num;
      }
      const totalCredits = parseInt(totalCreditsRaw, 10) || 0;
      if (!customerName.trim() && !customerPhone.trim()) continue;
      out.push({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        totalCredits: totalCredits || 1,
        soldAtBranch: soldAtBranch.trim(),
        packagePrice,
      });
    }
    return out;
  }

  function extractMembershipRows(parsed: unknown): Record<string, unknown>[] {
    if (Array.isArray(parsed)) {
      const tableObj = parsed.find((item) => item && typeof item === 'object' && (item as { type?: string }).type === 'table' && Array.isArray((item as { data?: unknown[] }).data));
      if (tableObj) return (tableObj as { data: Record<string, unknown>[] }).data;
      return parsed;
    }
    if (parsed && typeof parsed === 'object') {
      const o = parsed as Record<string, unknown>;
      if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
    }
    return [];
  }

  function jsonToImportRows(
    rawRows: Record<string, unknown>[],
    customerList: Customer[]
  ): { rows: Array<{ importRow: ImportRow; oldMembershipId: string; customerId: string; soldAtBranchId: string }>; skippedNoMap: number; skippedNoCustomer: number; skippedNoBranchPkg: number } {
    const customerLegacyMap: Record<string, string> = JSON.parse(localStorage.getItem('customerLegacyIdMap') || '{}');
    const branchLegacyMap: Record<string, string> = JSON.parse(localStorage.getItem('branchLegacyIdMap') || '{}');
    const branchesByIndex = [...branches].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    const packagesByIndex = [...packages].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    const customersByIndex = [...customerList].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    const str = (v: unknown) => (v != null && v !== '' ? String(v).trim() : '');
    const out: Array<{ importRow: ImportRow; oldMembershipId: string; customerId: string; soldAtBranchId: string }> = [];
    let skippedNoMap = 0, skippedNoCustomer = 0, skippedNoBranchPkg = 0;
    for (const row of rawRows) {
      const oldCustomerId = str(row.customer_id);
      let ourCustomerId = customerLegacyMap[oldCustomerId];
      if (!ourCustomerId && customersByIndex.length > 0) {
        const idx = Math.max(0, parseInt(oldCustomerId, 10) - 1);
        if (idx < customersByIndex.length) ourCustomerId = customersByIndex[idx].id;
      }
      if (!ourCustomerId) { skippedNoMap++; continue; }
      const customer = customerList.find((c) => c.id === ourCustomerId);
      if (!customer) { skippedNoCustomer++; continue; }
      const oldBranchId = str(row.branch_id);
      let branch = branchLegacyMap[oldBranchId] ? branches.find((b) => b.id === branchLegacyMap[oldBranchId]) : null;
      if (!branch) {
        const branchIdx = Math.max(0, parseInt(oldBranchId, 10) - 1);
        branch = branchesByIndex[branchIdx] || branchesByIndex[0];
      }
      const pkgIdx = Math.max(0, parseInt(str(row.package_id), 10) - 1);
      const pkg = packagesByIndex[pkgIdx] || packagesByIndex[0];
      if (!branch || !pkg) { skippedNoBranchPkg++; continue; }
      const totalCredits = pkg.totalSessions ?? 1;
      const oldMembershipId = str(row.id);
      out.push({
        importRow: {
          customerName: customer.name || '',
          customerPhone: customer.phone || '',
          customerEmail: customer.email,
          totalCredits,
          soldAtBranch: branch.name || '',
          packagePrice: pkg.price,
          customerPackage: pkg.name,
        },
        oldMembershipId,
        customerId: customer.id,
        soldAtBranchId: branch.id,
      });
    }
    return { rows: out, skippedNoMap, skippedNoCustomer, skippedNoBranchPkg };
  }

  async function handleImportFile(file: File) {
    setImportResult(null);
    setError('');
    const text = await file.text();
    const isJson = file.name.toLowerCase().endsWith('.json') || text.trim().startsWith('[') || text.trim().startsWith('{');
    let rows: ImportRow[] = [];
    if (isJson) {
      try {
        const parsed = JSON.parse(text);
        const rawRows = extractMembershipRows(parsed);
        if (rawRows.length === 0) {
          setError('No membership data found. Expected PHPMyAdmin table export or { data: [...] }.');
          return;
        }
        const freshRes = await getCustomers();
        const customerList = (freshRes.success && freshRes.customers) ? freshRes.customers : customers;
        const { rows: importRows, skippedNoMap, skippedNoCustomer, skippedNoBranchPkg } = jsonToImportRows(rawRows, customerList);
        if (importRows.length === 0) {
          const parts: string[] = [];
          if (skippedNoMap > 0) parts.push(`${skippedNoMap} rows: customer_id not found (import customers first, or ensure IDs match)`);
          if (skippedNoCustomer > 0) parts.push(`${skippedNoCustomer} rows: customer not in system`);
          if (skippedNoBranchPkg > 0) parts.push(`${skippedNoBranchPkg} rows: branch or package missing`);
          const mapSize = Object.keys(JSON.parse(localStorage.getItem('customerLegacyIdMap') || '{}')).length;
          const hint = mapSize === 0
            ? ' Re-import customers from the Customers page first to build the ID mapping.'
            : ` You have ${mapSize} mapped customer IDs. Ensure branches and packages exist.`;
          setError(`No valid rows from ${rawRows.length} in file. ${parts.join('; ')}.${hint}`);
          return;
        }
        setImporting(true);
        const membershipLegacyMap: Record<string, string> = JSON.parse(localStorage.getItem('membershipLegacyIdMap') || '{}');
        let imported = 0;
        for (const { importRow, oldMembershipId, customerId, soldAtBranchId } of importRows) {
          const res = await createMembership({
            customerId,
            totalCredits: importRow.totalCredits,
            soldAtBranchId: isAdmin ? soldAtBranchId : undefined,
            customerPackage: importRow.customerPackage,
            customerPackagePrice: importRow.packagePrice,
            discountAmount: importRow.discountAmount,
          });
          if (res.success && (res as unknown as { membership?: { id?: string } }).membership?.id && oldMembershipId) {
            membershipLegacyMap[oldMembershipId] = (res as unknown as { membership: { id: string } }).membership.id;
            imported++;
          }
        }
        if (Object.keys(membershipLegacyMap).length > 0) localStorage.setItem('membershipLegacyIdMap', JSON.stringify(membershipLegacyMap));
        setImporting(false);
        setImportResult({ imported, createdCustomers: 0, errors: [] });
        if (imported > 0) {
          getMemberships({ branchId: branchId || undefined, status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }).then((r) => {
            if (r.success && 'memberships' in r) setMemberships((r as { memberships: Membership[] }).memberships);
          });
        }
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid JSON');
        setImporting(false);
        return;
      }
    } else {
      rows = csvToImportRows(text);
    }
    if (rows.length === 0) {
      setError(isJson ? 'No matching memberships.' : 'No valid rows to import. CSV must have a header row with Customer, Phone, Sold at, Total credits (and optionally Email, Package price).');
      return;
    }
    setImporting(true);
    const res = await importMemberships(rows);
    setImporting(false);
    if (res.success && res.imported != null) {
      setImportResult({ imported: res.imported, createdCustomers: res.createdCustomers ?? 0, errors: res.errors ?? [] });
      getMemberships({
        branchId: branchId || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }).then((r) => {
        if (r.success && 'memberships' in r) setMemberships((r as { memberships: Membership[] }).memberships);
      });
    } else setError(res.message || 'Import failed.');
  }

  function extractSessionRows(parsed: unknown): Record<string, unknown>[] {
    if (Array.isArray(parsed)) {
      const tableObj = parsed.find((item) => {
        if (!item || typeof item !== 'object') return false;
        const t = item as { type?: string; name?: string; data?: unknown[] };
        return t.type === 'table' && Array.isArray(t.data) && (t.name === 'customer_sessions' || !t.name);
      });
      if (tableObj) return ((tableObj as { data: Record<string, unknown>[] }).data) || [];
      const anyTable = parsed.find((item) => item && typeof item === 'object' && (item as { type?: string }).type === 'table' && Array.isArray((item as { data?: unknown[] }).data));
      if (anyTable) return (anyTable as { data: Record<string, unknown>[] }).data;
    }
    if (parsed && typeof parsed === 'object') {
      const o = parsed as Record<string, unknown>;
      if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
    }
    return [];
  }

  async function handleImportSessionsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setSessionsImportResult(null);
    setSessionsImporting(true);
    let ok = 0, fail = 0, skipped = 0;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rawRows = extractSessionRows(parsed);
      if (rawRows.length === 0) {
        setError('No session data found. Expected PHPMyAdmin export for customer_sessions or { data: [...] }. Import memberships first.');
        setSessionsImporting(false);
        return;
      }
      const membershipMap: Record<string, string> = JSON.parse(localStorage.getItem('membershipLegacyIdMap') || '{}');
      const branchMap: Record<string, string> = JSON.parse(localStorage.getItem('branchLegacyIdMap') || '{}');
      const str = (v: unknown) => (v != null && v !== '' ? String(v).trim() : '');
      for (const row of rawRows) {
        const oldMembershipId = str(row.membership_id);
        const oldBranchId = str(row.branch_id);
        const creditsUsed = parseInt(str(row.no_of_sessions ?? row.credits_used ?? row.creditsUsed), 10) || 1;
        const ourMembershipId = membershipMap[oldMembershipId];
        const ourBranchId = branchMap[oldBranchId];
        if (!ourMembershipId || !ourBranchId) { skipped++; continue; }
        const res = await recordMembershipUsage(ourMembershipId, { creditsUsed, usedAtBranchId: ourBranchId });
        if (res.success) ok++;
        else fail++;
      }
      setSessionsImportResult({ ok, fail, skipped });
      if (ok > 0) {
        getMemberships({ branchId: branchId || undefined, status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }).then((r) => {
          if (r.success && 'memberships' in r) setMemberships((r as { memberships: Membership[] }).memberships);
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
    setSessionsImporting(false);
  }

  useEffect(() => {
    getBranches({ all: true }).then((r) => r.success && r.branches && setBranches(r.branches || []));
  }, []);

  useEffect(() => {
    getCustomers().then((r) => r.success && r.customers && setCustomers(r.customers || []));
    getPackages(false).then((r) => r.success && r.packages && setPackages(r.packages || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    getMemberships({
      branchId: branchId || undefined,
      status: status || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }).then((r) => {
      setLoading(false);
      if (r.success && 'memberships' in r) setMemberships((r as { memberships: Membership[] }).memberships);
      else setError((r as { message?: string }).message || 'Failed to load');
    });
  }, [branchId, status, dateFrom, dateTo]);

  useEffect(() => {
    if (createPackageId && selectedPackage) setCreatePackagePrice(String(selectedPackage.price));
  }, [createPackageId, selectedPackage?.price]);

  async function handleCreateMembership(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!createCustomerId) {
      setError('Customer is required.');
      return;
    }
    if (!createPackageId || !selectedPackage) {
      setError('Package is required. Please select a package from the list.');
      return;
    }
    const credits = selectedPackage.totalSessions ?? 1;
    const pkgPrice = createPackagePrice !== '' ? Number(createPackagePrice) : selectedPackage.price;
    if (Number.isNaN(pkgPrice) || pkgPrice < 0) {
      setError('Package price is required and must be 0 or greater.');
      return;
    }
    const discount = createDiscountAmount !== '' ? Number(createDiscountAmount) : undefined;
    if (discount != null && (discount < 0 || discount > pkgPrice)) {
      setError('Discount must be between 0 and total price.');
      return;
    }
    setCreateSubmitting(true);
    const res = await createMembership({
      customerId: createCustomerId,
      totalCredits: credits,
      soldAtBranchId: isAdmin ? createSoldAtBranchId || undefined : undefined,
      customerPackage: selectedPackage.name,
      customerPackagePrice: pkgPrice,
      discountAmount: discount,
    });
    setCreateSubmitting(false);
    if (res.success) {
      setShowCreateForm(false);
      setCreateCustomerId('');
      setCreateCustomerSearch('');
      setCreatePackageId('');
      setCreatePackagePrice('');
      setCreateDiscountAmount('');
      getMemberships({
        branchId: branchId || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }).then((r) => r.success && 'memberships' in r && setMemberships((r as { memberships: Membership[] }).memberships));
    } else setError((res as { message?: string }).message || 'Failed to create membership');
  }

  return (
    <div className="dashboard-content memberships-page">
      <header className="page-hero memberships-page-hero">
        <div>
          <h1 className="page-hero-title">Memberships</h1>
          <p className="page-hero-subtitle">Assign memberships to customers. View and use credits below.</p>
        </div>
        <button type="button" className="auth-submit memberships-create-btn" onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cancel' : 'Create new membership'}
        </button>
      </header>

      {showCreateForm && (
        <section className="content-card memberships-create-form-card">
          <form onSubmit={handleCreateMembership} className="auth-form" style={{ maxWidth: '480px' }}>
            <label>
              <span>Customer</span>
              <div ref={createCustomerDropdownRef} className="create-membership-customer-wrap">
                <input
                  ref={createCustomerInputRef}
                  type="text"
                  className="create-membership-customer-input"
                  value={createCustomerId ? (selectedCustomer ? `${selectedCustomer.name} — ${selectedCustomer.phone}` : '') : createCustomerSearch}
                  onChange={(e) => {
                    setCreateCustomerId('');
                    setCreateCustomerSearch(e.target.value);
                    setCreateCustomerDropdownOpen(true);
                  }}
                  onFocus={() => setCreateCustomerDropdownOpen(true)}
                  placeholder="Search by name, phone, email or Card ID"
                  autoComplete="off"
                  required
                />
                {createCustomerId && (
                  <button
                    type="button"
                    className="create-membership-clear-customer"
                    onClick={() => {
                      setCreateCustomerId('');
                      setCreateCustomerSearch('');
                      setCreateCustomerDropdownOpen(true);
                      createCustomerInputRef.current?.focus();
                    }}
                    aria-label="Clear customer selection"
                  >
                    ×
                  </button>
                )}
                {createCustomerDropdownOpen && (
                  <ul className="customer-name-dropdown settlements-dropdown create-membership-customer-dropdown" role="listbox">
                    {filteredCreateCustomers.length === 0 ? (
                      <li className="create-membership-customer-empty">No customers match</li>
                    ) : (
                      filteredCreateCustomers.slice(0, 100).map((c) => (
                        <li key={c.id} role="option" aria-selected={createCustomerId === c.id}>
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={() => {
                              setCreateCustomerId(c.id);
                              setCreateCustomerSearch('');
                              setCreateCustomerDropdownOpen(false);
                              createCustomerInputRef.current?.blur();
                            }}
                          >
                            {c.name} — {c.phone}{c.membershipCardId ? ` (${c.membershipCardId})` : ''}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </label>
            {isAdmin && (
              <label>
                <span>Branch (sold at)</span>
                <select value={createSoldAtBranchId} onChange={(e) => setCreateSoldAtBranchId(e.target.value)}>
                  <option value="">—</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            )}
            <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid var(--theme-border)' }} />
            <p style={{ fontSize: '0.9rem', color: 'var(--theme-text)', marginBottom: '0.75rem' }}>Package (required)</p>
            <label>
              <span>Package <strong>*</strong></span>
              <select value={createPackageId} onChange={(e) => setCreatePackageId(e.target.value)} required>
                <option value="">— Select package</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)} ({p.totalSessions ?? 1} sessions)</option>
                ))}
              </select>
            </label>
            {createPackageId && selectedPackage && (
              <p className="form-hint" style={{ marginTop: 0, marginBottom: 0 }}>
                This package includes {(selectedPackage.totalSessions ?? 1)} session{(selectedPackage.totalSessions ?? 1) !== 1 ? 's' : ''}.
              </p>
            )}
            <button type="submit" className="auth-submit" disabled={createSubmitting}>{createSubmitting ? 'Creating…' : 'Create membership'}</button>
          </form>
        </section>
      )}

      <section className="content-card memberships-search-card">
        <label className="memberships-search-label" htmlFor="memberships-search-input">
          Search memberships
        </label>
        <input
          id="memberships-search-input"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Customer name, phone, email, package, branch, status…"
          className="memberships-search-input"
          autoComplete="off"
          aria-label="Search memberships by customer, phone, package, branch or status"
        />
        <div className="memberships-search-meta">
          {isAdmin && (
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="memberships-filter-select" aria-label="Filter by branch">
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="memberships-filter-select" aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="used">Used</option>
            <option value="expired">Expired</option>
          </select>
          <label className="memberships-date-filter-label">
            <span>From (date taken)</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="memberships-date-input"
              aria-label="Filter from date (membership taken)"
            />
          </label>
          <label className="memberships-date-filter-label">
            <span>To (date taken)</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="memberships-date-input"
              aria-label="Filter to date (membership taken)"
            />
          </label>
          {totalFiltered > 0 && (
            <span className="memberships-search-count text-muted">
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalFiltered)} of {totalFiltered}
            </span>
          )}
          <button
            type="button"
            className="memberships-export-btn"
            onClick={exportToCsv}
            disabled={totalFiltered === 0}
            title={totalFiltered === 0 ? 'No data to export' : 'Export filtered results to CSV/Excel'}
          >
            Export to CSV / Excel
          </button>
          <label className="memberships-import-btn">
            <input
              type="file"
              accept=".csv,.txt,.json,text/csv,application/csv,application/json"
              className="memberships-import-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = '';
              }}
              disabled={importing}
            />
            {importing ? 'Importing…' : 'Import (CSV or JSON)'}
          </label>
          <label className="memberships-import-btn">
            <input
              type="file"
              accept=".json,application/json"
              className="memberships-import-input"
              aria-label="Import sessions from JSON"
              onChange={handleImportSessionsFile}
              disabled={sessionsImporting}
            />
            {sessionsImporting ? 'Importing sessions…' : 'Import sessions (JSON)'}
          </label>
        </div>
        {importResult && (
          <div className="memberships-import-result" role="status">
            <p className="memberships-import-success">
              Imported <strong>{importResult.imported}</strong> membership{importResult.imported !== 1 ? 's' : ''}
              {importResult.createdCustomers > 0 && `, created ${importResult.createdCustomers} new customer(s).`}
            </p>
            {importResult.errors.length > 0 && (
              <ul className="memberships-import-errors">
                {importResult.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>Row {err.row}: {err.message}</li>
                ))}
                {importResult.errors.length > 10 && <li>… and {importResult.errors.length - 10} more errors.</li>}
              </ul>
            )}
          </div>
        )}
        {sessionsImportResult && (
          <div className="memberships-import-result" role="status">
            <p className="memberships-import-success">
              Sessions import: <strong>{sessionsImportResult.ok}</strong> recorded, {sessionsImportResult.fail} failed, {sessionsImportResult.skipped} skipped (membership or branch not in map).
            </p>
          </div>
        )}
      </section>

      {error && <div className="auth-error vendors-error">{error}</div>}
      <section className="content-card memberships-list-card">
        <h2 className="page-section-title">Membership list</h2>
        {loading ? (
          <div className="vendors-loading"><div className="spinner" /><span>Loading...</span></div>
        ) : memberships.length === 0 ? (
          <p className="vendors-empty">No memberships found.</p>
        ) : filteredMemberships.length === 0 ? (
          <p className="vendors-empty">No memberships match your search.</p>
        ) : (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="num">Total / Used / Remaining</th>
                    <th>Package name</th>
                    <th>Sold at</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMemberships.map((m) => (
                  <tr
                    key={m.id}
                    className="memberships-row-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`${basePath}/memberships/${m.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`${basePath}/memberships/${m.id}`); } }}
                  >
                    <td><strong>{m.customer?.name || '—'}</strong> {m.customer?.phone && `(${m.customer.phone})`}</td>
                    <td className="num">{m.totalCredits} / {m.usedCredits} / {(m.remainingCredits ?? m.totalCredits - m.usedCredits)}</td>
                    <td>{m.packageName || m.typeName || '—'}</td>
                    <td>{m.soldAtBranch || '—'}</td>
                    <td><span className={`status-badge status-${m.status === 'active' ? 'approved' : m.status === 'used' ? 'rejected' : 'pending'}`}>{m.status}</span></td>
                    <td className="memberships-actions-cell" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="filter-btn"
                        onClick={() => navigate(`${basePath}/memberships/${m.id}`)}
                        title="View / Edit"
                      >
                        Edit
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          className="btn-reject"
                          onClick={() => openDeleteConfirm(m.id)}
                          disabled={deletingId !== null}
                          title="Delete membership"
                        >
                          {deletingId === m.id ? '…' : 'Delete'}
                        </button>
                      )}
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="customers-pagination">
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className="pagination-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {deleteConfirmId && (
        <div
          className="vendor-modal-backdrop block-confirm-backdrop"
          onClick={closeDeleteConfirm}
          role="presentation"
        >
          <div
            className="vendor-modal block-confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="membership-delete-confirm-title"
            aria-describedby="membership-delete-confirm-desc"
          >
            <div className="vendor-modal-header block-confirm-header">
              <h2 id="membership-delete-confirm-title">Confirm delete</h2>
              <button
                type="button"
                className="vendor-modal-close"
                onClick={closeDeleteConfirm}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="block-confirm-body">
              <p id="membership-delete-confirm-desc" className="block-confirm-message">
                This will permanently delete this membership and its usage history. Type <strong>CONFIRM</strong> below to proceed.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); handleDeleteConfirmOk(); }}>
                <label className="block-confirm-label">
                  <span className="block-confirm-label-text">Type CONFIRM</span>
                  <input
                    type="text"
                    value={deleteConfirmInput}
                    onChange={(e) => { setDeleteConfirmInput(e.target.value); setDeleteConfirmError(''); }}
                    className={`block-confirm-input ${deleteConfirmInput.trim() === 'CONFIRM' ? 'block-confirm-input-valid' : ''} ${deleteConfirmError ? 'block-confirm-input-error' : ''}`}
                    placeholder="CONFIRM"
                    autoComplete="off"
                    autoFocus
                    aria-invalid={!!deleteConfirmError}
                    aria-describedby={deleteConfirmError ? 'membership-delete-confirm-err' : undefined}
                  />
                </label>
                {deleteConfirmError && (
                  <p id="membership-delete-confirm-err" className="block-confirm-error" role="alert">
                    {deleteConfirmError}
                  </p>
                )}
                <div className="block-confirm-actions">
                  <button type="button" className="block-confirm-cancel" onClick={closeDeleteConfirm}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="block-confirm-ok"
                    disabled={deleteConfirmInput.trim() !== 'CONFIRM' || deletingId !== null}
                  >
                    {deletingId === deleteConfirmId ? 'Deleting…' : 'Delete membership'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
