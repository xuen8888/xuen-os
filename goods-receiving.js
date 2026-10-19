(() => {
  const demo = document.querySelector('#grs-demo');
  if (!demo) return;

  const panels = [...demo.querySelectorAll('[data-panel]')];
  const navItems = [...demo.querySelectorAll('.grs-nav-item')];
  const routeButtons = [...demo.querySelectorAll('[data-route]')];
  const toast = demo.querySelector('#grs-toast');
  let toastTimer;

  const purchaseOrders = {
    'PO-FIC-260184': { supplier: 'Northstar Textiles', material: 'Graphite woven fabric', sku: 'FAB-GR-042 · Roll', ordered: 24, unit: 'rolls' },
    'PO-FIC-260191': { supplier: 'Oakline Components', material: 'Beech wood sofa frames', sku: 'FRM-BE-118 · Frame', ordered: 36, unit: 'frames' },
    'PO-FIC-260197': { supplier: 'Meridian Foam Works', material: 'HR seat foam sets', sku: 'FOM-HR-090 · Set', ordered: 96, unit: 'sets' },
    'PO-FIC-260205': { supplier: 'Atlas Fittings', material: 'Zinc connector plates', sku: 'HDW-ZN-215 · Piece', ordered: 600, unit: 'pcs' }
  };

  const showToast = (message) => {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
  };

  const showPanel = (name) => {
    panels.forEach((panel) => {
      const active = panel.dataset.panel === name;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    navItems.forEach((item) => item.classList.toggle('is-active', item.dataset.view === name));
    demo.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  navItems.forEach((button) => button.addEventListener('click', () => showPanel(button.dataset.view)));
  routeButtons.forEach((button) => button.addEventListener('click', () => showPanel(button.dataset.route)));

  const poSelect = demo.querySelector('#po-select');
  const material = demo.querySelector('#receive-material');
  const sku = demo.querySelector('#receive-sku');
  const orderedQuantity = demo.querySelector('#ordered-quantity');
  const receivedQuantity = demo.querySelector('#received-quantity');
  const receiveForm = demo.querySelector('#receive-form');
  const receiptReview = demo.querySelector('#receipt-review');
  const reviewHeading = demo.querySelector('#review-heading');
  const reviewCopy = demo.querySelector('#review-copy');
  const condition = demo.querySelector('#condition-select');

  const syncPurchaseOrder = () => {
    const record = purchaseOrders[poSelect?.value];
    if (!record) return;
    material.textContent = record.material;
    sku.textContent = record.sku;
    orderedQuantity.value = String(record.ordered);
    receivedQuantity.value = String(record.ordered);
    receiptReview.hidden = true;
    receiveForm.hidden = false;
  };
  poSelect?.addEventListener('change', syncPurchaseOrder);

  receiveForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const record = purchaseOrders[poSelect.value];
    const quantity = Math.max(0, Number(receivedQuantity.value) || 0);
    reviewHeading.textContent = `${quantity} ${record.unit} received from ${record.supplier}`;
    reviewCopy.textContent = `${poSelect.value} · ${record.material} · ${condition.value}`;
    receiveForm.hidden = true;
    receiptReview.hidden = false;
  });

  demo.querySelector('#edit-receipt')?.addEventListener('click', () => {
    receiptReview.hidden = true;
    receiveForm.hidden = false;
  });

  demo.querySelector('#save-receipt')?.addEventListener('click', () => {
    const record = purchaseOrders[poSelect.value];
    const quantity = Math.max(0, Number(receivedQuantity.value) || 0);
    const difference = quantity !== record.ordered;
    const receiptId = `GR-FIC-${1050 + demo.querySelectorAll('#history-body tr[data-added]').length}`;
    const statusClass = difference ? 'status-review' : 'status-received';
    const statusText = difference ? 'Review' : 'Received';
    const row = document.createElement('tr');
    row.dataset.added = 'true';
    row.innerHTML = `<td>${receiptId}</td><td>19 Oct 2026</td><td>${record.supplier}</td><td>${poSelect.value}</td><td>${record.material}</td><td>${quantity} ${record.unit}</td><td><span class="status ${statusClass}">${statusText}</span></td>`;
    demo.querySelector('#history-body')?.prepend(row);

    const activityRow = document.createElement('tr');
    activityRow.innerHTML = `<td>${receiptId}</td><td>${record.supplier}</td><td>${record.material}</td><td>${quantity} ${record.unit}</td><td>Aina Rahman</td><td><span class="status ${statusClass}">${statusText}</span></td>`;
    demo.querySelector('#recent-activity-body')?.prepend(activityRow);

    const metric = demo.querySelector('#metric-received');
    if (metric) metric.textContent = String(Number(metric.textContent) + 1);
    receiptReview.hidden = true;
    receiveForm.reset();
    poSelect.value = 'PO-FIC-260184';
    demo.querySelector('#delivery-note').value = 'DN-FIC-88341';
    demo.querySelector('#received-date').value = '2026-10-19';
    syncPurchaseOrder();
    showPanel('history');
    showToast(`${receiptId} added to this browser demo.`);
  });

  const filterButtons = [...demo.querySelectorAll('[data-filter]')];
  const deliveryCards = [...demo.querySelectorAll('#delivery-list article')];
  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      filterButtons.forEach((item) => item.classList.toggle('is-active', item === button));
      deliveryCards.forEach((card) => { card.hidden = filter !== 'all' && card.dataset.status !== filter; });
    });
  });

  demo.querySelector('#history-search')?.addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    demo.querySelectorAll('#history-body tr').forEach((row) => {
      row.hidden = Boolean(query) && !row.textContent.toLowerCase().includes(query);
    });
  });

  demo.querySelector('#invite-demo-user')?.addEventListener('click', () => {
    showToast('Demo only — no account or invitation was created.');
  });
})();
