const state = {
  orders: [],
  selectedOrder: null,
  statusFilter: 'ALL',
  search: '',
};

const elements = {
  refreshBtn: document.getElementById('refreshBtn'),
  orderList: document.getElementById('orderList'),
  detailPanel: document.getElementById('detailPanel'),
  statusBar: document.getElementById('statusBar'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  statTotal: document.getElementById('statTotal'),
  statPending: document.getElementById('statPending'),
  statApproved: document.getElementById('statApproved'),
  statRejected: document.getElementById('statRejected'),
};

function setStatus(message) {
  elements.statusBar.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID');
}

function badgeClass(status) {
  if (status === 'APPROVED' || status === 'PAID') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  return 'pending';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const json = await response.json();
  if (!response.ok || json.success === false) {
    throw new Error(json.message || 'Request gagal');
  }
  return json;
}

async function loadOrders() {
  setStatus('Mengambil data order...');
  const json = await api('/api/orders');
  state.orders = json.data || [];
  renderStats();
  renderOrderList();
  if (state.selectedOrder) {
    const updated = state.orders.find((order) => order.id === state.selectedOrder.id);
    if (updated) {
      state.selectedOrder = updated;
      renderDetailPanel();
    }
  }
  setStatus(`Loaded ${state.orders.length} order.`);
}

function renderStats() {
  const total = state.orders.length;
  const pending = state.orders.filter((order) => order.orderStatus === 'WAITING_VERIFICATION').length;
  const approved = state.orders.filter((order) => order.orderStatus === 'APPROVED').length;
  const rejected = state.orders.filter((order) => order.orderStatus === 'REJECTED').length;

  elements.statTotal.textContent = String(total);
  elements.statPending.textContent = String(pending);
  elements.statApproved.textContent = String(approved);
  elements.statRejected.textContent = String(rejected);
}

function getFilteredOrders() {
  const query = state.search.trim().toLowerCase();
  return state.orders.filter((order) => {
    const statusMatch = state.statusFilter === 'ALL' || order.orderStatus === state.statusFilter;
    const haystack = [
      order.id,
      order.coinSymbol,
      order.orderStatus,
      order.paymentStatus,
      order.user?.username,
      order.user?.telegramId,
      order.rejectReason,
    ]
      .join(' ')
      .toLowerCase();

    const searchMatch = !query || haystack.includes(query);
    return statusMatch && searchMatch;
  });
}

function renderOrderList() {
  const orders = getFilteredOrders();

  if (orders.length === 0) {
    elements.orderList.innerHTML = '<div class="detail-empty">Tidak ada order yang cocok dengan filter.</div>';
    return;
  }

  elements.orderList.innerHTML = orders
    .map((order) => {
      const userLabel = order.user?.username || order.user?.telegramId || '-';
      return `
        <div class="order-item">
          <div class="order-head">
            <div>
              <div class="order-title">#${order.id} - ${escapeHtml(order.coinSymbol)}</div>
              <div class="muted">User: ${escapeHtml(userLabel)}</div>
            </div>
            <div>
              <span class="badge ${badgeClass(order.orderStatus)}">${escapeHtml(order.orderStatus)}</span>
            </div>
          </div>

          <div class="meta">
            <div><strong>Nominal</strong><br/>${escapeHtml(formatRupiah(order.rupiahAmount))}</div>
            <div><strong>Payment</strong><br/>${escapeHtml(order.paymentStatus)}</div>
            <div><strong>Metode</strong><br/>${escapeHtml(order.paymentMethod)}</div>
            <div><strong>Dibuat</strong><br/>${escapeHtml(formatDate(order.createdAt))}</div>
          </div>

          <div class="actions">
            <button class="secondary" data-action="view" data-id="${order.id}">Lihat detail</button>
            <button class="success" data-action="approve" data-id="${order.id}" ${order.orderStatus !== 'WAITING_VERIFICATION' ? 'disabled' : ''}>Approve</button>
            <button class="danger" data-action="reject" data-id="${order.id}">Reject</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderDetailPanel() {
  const order = state.selectedOrder;
  if (!order) {
    elements.detailPanel.innerHTML = '<div class="detail-empty">Pilih salah satu order untuk melihat detail lengkap.</div>';
    return;
  }

  const logs = (order.adminActions || [])
    .map(
      (log) => `
        <div class="log-item">
          <strong>${escapeHtml(log.actionType)}</strong> oleh ${escapeHtml(log.adminName)}<br/>
          <span class="muted">${escapeHtml(formatDate(log.createdAt))}</span><br/>
          Catatan: ${escapeHtml(log.notes || '-')}
        </div>
      `
    )
    .join('');

  elements.detailPanel.innerHTML = `
    <div class="meta">
      <div><strong>ID Order</strong><br/>#${order.id}</div>
      <div><strong>User</strong><br/>${escapeHtml(order.user?.username || order.user?.telegramId || '-')}</div>
      <div><strong>Coin</strong><br/>${escapeHtml(order.coinSymbol)}</div>
      <div><strong>Nominal</strong><br/>${escapeHtml(formatRupiah(order.rupiahAmount))}</div>
      <div><strong>Estimasi coin</strong><br/>${escapeHtml(order.estimatedCoinAmount)}</div>
      <div><strong>Metode</strong><br/>${escapeHtml(order.paymentMethod)}</div>
      <div><strong>Payment status</strong><br/><span class="badge ${badgeClass(order.paymentStatus)}">${escapeHtml(order.paymentStatus)}</span></div>
      <div><strong>Order status</strong><br/><span class="badge ${badgeClass(order.orderStatus)}">${escapeHtml(order.orderStatus)}</span></div>
      <div><strong>Proof image</strong><br/>${order.proofImageUrl ? `<a class="proof-link" target="_blank" href="${escapeHtml(order.proofImageUrl)}">Buka bukti transfer</a>` : 'Belum upload'}</div>
      <div><strong>Reject reason</strong><br/>${escapeHtml(order.rejectReason || '-')}</div>
      <div><strong>Dibuat</strong><br/>${escapeHtml(formatDate(order.createdAt))}</div>
      <div><strong>Diupdate</strong><br/>${escapeHtml(formatDate(order.updatedAt))}</div>
    </div>

    <div class="actions">
      <button class="success" id="detailApproveBtn" ${order.orderStatus !== 'WAITING_VERIFICATION' ? 'disabled' : ''}>Approve</button>
      <button class="danger" id="detailRejectBtn">Reject</button>
    </div>

    <div style="margin-top: 12px;">
      <label for="rejectReason"><strong>Alasan reject</strong></label>
      <textarea id="rejectReason" placeholder="Contoh: bukti transfer blur, nominal tidak sesuai, rekening tujuan salah">${escapeHtml(order.rejectReason || '')}</textarea>
    </div>

    <div style="margin-top: 16px;">
      <strong>Admin log</strong>
      <div class="log-list" style="margin-top: 8px;">
        ${logs || '<div class="detail-empty">Belum ada log admin.</div>'}
      </div>
    </div>
  `;

  document.getElementById('detailApproveBtn')?.addEventListener('click', () => approveOrder(order.id));
  document.getElementById('detailRejectBtn')?.addEventListener('click', () => {
    const reason = document.getElementById('rejectReason')?.value?.trim();
    rejectOrder(order.id, reason);
  });
}

function selectOrder(orderId) {
  state.selectedOrder = state.orders.find((item) => item.id === Number(orderId)) || null;
  renderDetailPanel();
}

async function refreshOrderDetail(orderId) {
  const json = await api(`/api/orders/${orderId}`);
  const updated = json.data;
  state.orders = state.orders.map((order) => (order.id === updated.id ? updated : order));
  state.selectedOrder = updated;
  renderStats();
  renderOrderList();
  renderDetailPanel();
}

async function approveOrder(orderId) {
  try {
    setStatus(`Approve order #${orderId}...`);
    await api(`/api/orders/${orderId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ adminName: 'dashboard-admin' }),
    });
    await refreshOrderDetail(orderId);
    setStatus(`Order #${orderId} berhasil di-approve.`);
  } catch (error) {
    setStatus(error.message);
    alert(error.message);
  }
}

async function rejectOrder(orderId, reason) {
  try {
    const finalReason = (reason || '').trim();
    if (!finalReason) {
      alert('Alasan reject wajib diisi.');
      return;
    }
    setStatus(`Reject order #${orderId}...`);
    await api(`/api/orders/${orderId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ adminName: 'dashboard-admin', notes: finalReason }),
    });
    await refreshOrderDetail(orderId);
    setStatus(`Order #${orderId} berhasil di-reject.`);
  } catch (error) {
    setStatus(error.message);
    alert(error.message);
  }
}

function attachEvents() {
  elements.refreshBtn.addEventListener('click', loadOrders);
  elements.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value;
    renderOrderList();
  });
  elements.statusFilter.addEventListener('change', (event) => {
    state.statusFilter = event.target.value;
    renderOrderList();
  });
  elements.orderList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const { action, id } = button.dataset;
    const orderId = Number(id);

    if (action === 'view') {
      await refreshOrderDetail(orderId);
      return;
    }
    if (action === 'approve') {
      await approveOrder(orderId);
      return;
    }
    if (action === 'reject') {
      const reason = window.prompt(`Alasan reject untuk order #${orderId}:`);
      if (reason === null) return;
      await rejectOrder(orderId, reason);
    }
  });
}

async function init() {
  attachEvents();
  await loadOrders();
}

init().catch((error) => {
  console.error(error);
  setStatus(error.message || 'Gagal memuat dashboard');
});
