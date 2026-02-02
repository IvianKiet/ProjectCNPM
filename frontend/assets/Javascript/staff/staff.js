// assets/Javascript/staff/staff.js
// Staff Service Dashboard connected to API

document.addEventListener("DOMContentLoaded", async () => {

  // ================== AUTHENTICATION CHECK ==================
  let currentUser = null;
  let currentBranch = null;

  try {
    currentUser = await initAuthenticatedPage();
    if (!currentUser) {
      window.location.href = '../../index.html';
      return;
    }
    
    // Get branch from URL or user's assignment
    const urlParams = new URLSearchParams(window.location.search);
    const branchId = urlParams.get('branch_id');
    
    if (!branchId) {
      const branches = await BranchAPI.getAll();
      if (branches.length === 0) {
        alert('No branches found');
        return;
      }
      currentBranch = branches[0];
    } else {
      currentBranch = await BranchAPI.getOne(branchId);
    }

    console.log("✅ Staff dashboard loaded for branch:", currentBranch.branch_name);
    
  } catch (error) {
    console.error("❌ Authentication error:", error);
    window.location.href = '../../index.html';
    return;
  }

  // ================== STATE ==================
  let orders = [];
  let searchKeyword = "";
  let waitSortMode = "NONE"; 

  // ================== DOM ==================
  const orderList = document.getElementById("orderList");
  const readyCounter = document.getElementById("readyCounter");
  const readyCountEl = document.getElementById("readyCount");
  const servedCountEl = document.getElementById("servedCount");
  const sortWaitBtn = document.getElementById("sortWaitBtn");
  const modal = document.getElementById("success_notifaction");
  const closeBtn = document.getElementById("close_modal");
  const searchInput = document.getElementById("searchInput");

  // ================== LOAD ORDERS ==================
  async function loadOrders() {
    try {
      // Get all orders for this branch
      const allOrders = await OrderAPI.getAll(currentBranch.branch_id);
      
      // Staff only sees: ready, serving, and done
      // NOT: pending, ordered, cooking (those are for kitchen)
      const staffOrders = allOrders.filter(o => ['ready', 'serving', 'done'].includes(o.status));

      // ✅ FIXED: Group orders by session_id and merge into ONE card per table.
      // The guest side accumulates items across multiple Order rows in the same
      // session.  The kitchen sees each Order separately (correct), but staff
      // must see a single unified card per table so the invoice matches what
      // the payment tab shows.
      const sessionMap = new Map();   // session_id → merged pseudo-order

      for (const order of staffOrders) {
        const key = order.session_id;

        if (!sessionMap.has(key)) {
          // First order we see for this session — use it as the base
          sessionMap.set(key, {
            ...order,
            items: [...order.items],          // copy so we don't mutate the original
            _orderIds: [order.order_id]       // track which raw orders were merged
          });
        } else {
          // Subsequent order in the same session — merge its items in
          const merged = sessionMap.get(key);
          merged.items.push(...order.items);
          merged._orderIds.push(order.order_id);

          // Use the "most advanced" status so the card shows the right action button.
          // Priority: serving > ready > done  (staff acts on the earliest incomplete state)
          const priority = { ready: 0, serving: 1, done: 2 };
          if ((priority[order.status] ?? 0) < (priority[merged.status] ?? 0)) {
            merged.status = order.status;     // pull back to the less-advanced status
          }

          // Use the earliest order_time for wait-time display
          if (new Date(order.order_time) < new Date(merged.order_time)) {
            merged.order_time = order.order_time;
          }

          // Recalculate wait_minutes from the earliest order_time
          merged.wait_minutes = Math.floor(
            (Date.now() - new Date(merged.order_time).getTime()) / 60000
          );
        }
      }

      orders = Array.from(sessionMap.values());

      console.log("📋 Loaded staff orders:", staffOrders.length, "raw →", orders.length, "merged (by session)");
      
      renderOrders();
    } catch (error) {
      console.error("❌ Failed to load orders:", error);
      if (orderList) {
        orderList.innerHTML = '<div class="col-span-full text-red-500 p-4">Failed to load orders: ' + error.message + '</div>';
      }
    }
  }

  // ================== RENDER ORDERS ==================
  function renderOrders() {
    orderList.innerHTML = "";

    let displayOrders = [...orders];

    // Search filter
    if (searchKeyword) {
      displayOrders = displayOrders.filter(order => {
        const inTable = order.table_number.toLowerCase().includes(searchKeyword);
        const inBranch = order.branch_name.toLowerCase().includes(searchKeyword);
        const inItems = order.items.some(i =>
          i.menu_item_name.toLowerCase().includes(searchKeyword)
        );
        return inTable || inBranch || inItems;
      });
    }

    // Sort by wait time
    if (waitSortMode === "ASC") {
      displayOrders.sort((a, b) => a.wait_minutes - b.wait_minutes);
    }
    if (waitSortMode === "DESC") {
      displayOrders.sort((a, b) => b.wait_minutes - a.wait_minutes);
    }

    // Render orders (skip 'done' orders in main view)
    const activeOrders = displayOrders.filter(o => o.status !== 'done');
    
    if (activeOrders.length === 0) {
      orderList.innerHTML = `
        <div class="col-span-full text-center py-20">
          <span class="material-symbols-outlined text-6xl text-slate-300 mb-4">check_circle</span>
          <p class="text-slate-400 text-lg">Không có đơn hàng nào cần phục vụ</p>
        </div>
      `;
    } else {
      activeOrders.forEach(order => {
        orderList.appendChild(createOrderCard(order));
      });
    }

    updateReadyCount();
    updateServedCount();
    updateSortLabel();
    
    console.log(`📊 Rendered: ${activeOrders.length} active orders`);
  }

  // ================== CREATE ORDER CARD ==================
  function createOrderCard(order) {
    const div = document.createElement("div");
    const isReady = order.status === "ready";

    div.className =
      `order-card flex flex-col bg-white dark:bg-slate-900 rounded-2xl overflow-hidden transition-all
       ${isReady ? "ready-card border-none" : "processing-card border border-slate-200 dark:border-slate-800"}`;

    const statusText = order.status === 'ready' ? 'SẴNG SÀNG PHỤC VỤ' : 
                      order.status === 'serving' ? 'ĐANG PHỤC VỤ' : 'HOÀN THÀNH';

    div.innerHTML = `
      <div class="p-6 ${isReady ? "bg-green-50 dark:bg-green-950/30 border-b border-green-100" : "border-b"}">
        <div class="flex justify-between items-start">
          <div>
            <span class="text-[11px] font-black uppercase tracking-widest
              ${isReady ? "text-green-600" : "text-slate-400"}">
              ${order.branch_name}
            </span>
            <h3 class="text-4xl font-black leading-none mt-2">
              ${order.table_number}
            </h3>
          </div>

          <span class="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase
            ${isReady ? "bg-primary text-white" : "bg-slate-200 text-slate-500"}">
            ${statusText}
          </span>
        </div>
      </div>

      <div class="p-6 flex-1 space-y-4">
        ${order.items.map(i => `
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-primary font-black text-lg">${i.quantity}×</span>
              <div>
                <span class="font-bold">${i.menu_item_name}</span>
                ${i.note ? `<p class="text-xs text-slate-500 mt-1">📝 ${i.note}</p>` : ''}
              </div>
            </div>
            <span>${isReady ? "✅" : "⏳"}</span>
          </div>
        `).join("")}
      </div>

      <div class="p-6 pt-0">
        ${
          isReady
          ? `<button class="serve-btn w-full bg-primary hover:bg-primary-dark
              text-white font-black py-4 rounded-xl uppercase transition">
              NHẬN ĐƠN
            </button>`
          : order.status === 'serving'
          ? `<button class="complete-btn w-full bg-blue-500 hover:bg-blue-600
              text-white font-black py-4 rounded-xl uppercase transition">
              Hoàn thành phục vụ
            </button>`
          : `<button disabled class="w-full bg-slate-100 text-slate-400
              font-bold py-4 rounded-xl uppercase cursor-not-allowed">
              Đã hoàn thành
            </button>`
        }
      </div>

      <div class="px-6 py-4 bg-slate-50 border-t flex justify-between items-center">
        <span class="text-slate-400 font-bold text-xs">Đợi ${order.wait_minutes} phút</span>
      </div>
    `;

    if (isReady) {
      div.querySelector(".serve-btn").onclick = () => startServing(order);
    }
    
    if (order.status === 'serving') {
      div.querySelector(".complete-btn").onclick = () => completeServing(order);
    }

    return div;
  }

  // ================== START SERVING ==================
  async function startServing(order) {
    try {
      // ✅ FIXED: update ALL order rows that were merged into this card
      const ids = order._orderIds || [order.order_id];
      console.log("🍽️ Starting to serve orders:", ids);

      await Promise.all(
        ids.map(id => OrderAPI.updateStatus(id, "serving"))
      );
      await loadOrders();
    } catch (error) {
      console.error("❌ Failed to start serving:", error);
      alert("Failed to update order status: " + error.message);
    }
  }

  // ================== COMPLETE SERVING ==================
  async function completeServing(order) {
    try {
      // ✅ FIXED: update ALL order rows that were merged into this card
      const ids = order._orderIds || [order.order_id];
      console.log("✅ Completing orders:", ids);

      await Promise.all(
        ids.map(id => OrderAPI.updateStatus(id, "done"))
      );
      showModal();
      await loadOrders();
    } catch (error) {
      console.error("❌ Failed to complete serving:", error);
      alert("Failed to complete serving: " + error.message);
    }
  }

  // ================== COUNTERS ==================
  function updateReadyCount() {
    const count = orders.filter(o => o.status === "ready").length;
    if (readyCountEl) readyCountEl.innerText = count;
  }

  function updateServedCount() {
    const served = orders.filter(o => o.status === "done").length;
    if (servedCountEl) servedCountEl.innerText = served;
  }

  // ================== MODAL ==================
  function showModal() {
    if (modal) {
      modal.style.display = "flex";
      setTimeout(() => modal.classList.add("show"), 10);
    }
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      if (modal) {
        modal.classList.remove("show");
        setTimeout(() => modal.style.display = "none", 300);
      }
    };
  }

  // ================== SORT MENU ==================
  function showSortMenu() {
    document.querySelectorAll(".wait-sort-menu").forEach(m => m.remove());

    const menu = document.createElement("div");
    menu.className = `
      wait-sort-menu absolute bg-white dark:bg-slate-900 
      border border-slate-200 dark:border-slate-800 
      rounded-xl shadow-xl overflow-hidden z-50
    `;

    menu.innerHTML = `
      <button class="sort-opt block w-full text-left px-5 py-3 hover:bg-slate-100" data-mode="ASC">
        Tăng dần
      </button>
      <button class="sort-opt block w-full text-left px-5 py-3 hover:bg-slate-100" data-mode="DESC">
        Giảm dần
      </button>
      <button class="sort-opt block w-full text-left px-5 py-3 hover:bg-slate-100 text-slate-400" data-mode="NONE">
        Không sắp xếp
      </button>
    `;

    document.body.appendChild(menu);

    const rect = sortWaitBtn.getBoundingClientRect();
    menu.style.top = rect.bottom + window.scrollY + "px";
    menu.style.left = rect.left + "px";

    menu.querySelectorAll(".sort-opt").forEach(btn => {
      btn.onclick = () => {
        waitSortMode = btn.dataset.mode;
        menu.remove();
        renderOrders();
      };
    });

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && e.target !== sortWaitBtn) {
        menu.remove();
      }
    }, { once: true });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchKeyword = searchInput.value.toLowerCase().trim();
      renderOrders();
    });
  }

  function updateSortLabel() {
    if (!sortWaitBtn) return;
    
    const icon = '<span class="material-symbols-outlined text-[20px]">sort</span>';
    if (waitSortMode === "ASC") {
      sortWaitBtn.innerHTML = icon + '<span>Tăng dần</span>';
    } else if (waitSortMode === "DESC") {
      sortWaitBtn.innerHTML = icon + '<span>Giảm dần</span>';
    } else {
      sortWaitBtn.innerHTML = icon + '<span>Thời gian chờ</span>';
    }
  }

  if (sortWaitBtn) {
    sortWaitBtn.onclick = (e) => {
      e.stopPropagation();
      showSortMenu();
    };
  }

  // ================== AUTO-REFRESH ==================
  setInterval(async () => {
    console.log("🔄 Auto-refreshing orders...");
    await loadOrders();
    if (activeTab === "payment") {
      await loadPayments();
    }
  }, 5000); // Refresh every 5 seconds

  // ================== TAB SWITCHING ==================
  let activeTab = "serving";   // "serving" | "payment"

  const tabServing  = document.getElementById("tabServing");
  const tabPayment  = document.getElementById("tabPayment");
  const orderListEl = document.getElementById("orderList");
  const paymentPanel = document.getElementById("paymentPanel");
  const cashPendingBadge = document.getElementById("cashPendingBadge");

  function switchTab(tab) {
    activeTab = tab;

    if (tab === "serving") {
      tabServing.classList.add("active", "bg-white", "dark:bg-slate-700", "shadow-sm", "text-slate-900", "dark:text-white");
      tabServing.classList.remove("text-slate-500", "dark:text-slate-400");
      tabPayment.classList.remove("active", "bg-white", "dark:bg-slate-700", "shadow-sm", "text-slate-900", "dark:text-white");
      tabPayment.classList.add("text-slate-500", "dark:text-slate-400");

      orderListEl.classList.remove("hidden");
      paymentPanel.classList.add("hidden");
    } else {
      tabPayment.classList.add("active", "bg-white", "dark:bg-slate-700", "shadow-sm", "text-slate-900", "dark:text-white");
      tabPayment.classList.remove("text-slate-500", "dark:text-slate-400");
      tabServing.classList.remove("active", "bg-white", "dark:bg-slate-700", "shadow-sm", "text-slate-900", "dark:text-white");
      tabServing.classList.add("text-slate-500", "dark:text-slate-400");

      orderListEl.classList.add("hidden");
      paymentPanel.classList.remove("hidden");
      loadPayments();
    }
  }

  if (tabServing)  tabServing.onclick  = () => switchTab("serving");
  if (tabPayment)  tabPayment.onclick  = () => switchTab("payment");

  // ================== PAYMENT LIST ==================
  let cashPendingBills = [];
  let qrPaidBills = [];

  async function loadPayments() {
    try {
      // Load both cash and QR payments in parallel
      const [cashBills, qrBills] = await Promise.all([
        BillAPI.getCashPending(currentBranch.branch_id),
        BillAPI.getQRPaid(currentBranch.branch_id)
      ]);
      
      cashPendingBills = cashBills;
      qrPaidBills = qrBills;
      
      console.log("💵 Loaded cash-pending bills:", cashPendingBills.length);
      console.log("💳 Loaded QR-paid bills:", qrPaidBills.length);
      
      renderPayments();
      updatePaymentBadge();
    } catch (error) {
      console.error("❌ Failed to load payments:", error);
      const paymentList = document.getElementById("paymentList");
      if (paymentList) {
        paymentList.innerHTML = '<div class="col-span-full text-red-500 p-4">Failed to load payments: ' + error.message + '</div>';
      }
    }
  }

  function updatePaymentBadge() {
    const totalCount = cashPendingBills.length + qrPaidBills.length;
    if (cashPendingBadge) {
      cashPendingBadge.textContent = totalCount;
      cashPendingBadge.style.display = totalCount > 0 ? "inline-flex" : "none";
    }
    
    const cashCountEl = document.getElementById("cashPendingCount");
    if (cashCountEl) cashCountEl.textContent = cashPendingBills.length;
    
    const qrCountEl = document.getElementById("qrPaidCount");
    if (qrCountEl) qrCountEl.textContent = qrPaidBills.length;
  }

  function renderPayments() {
    const paymentList = document.getElementById("paymentList");
    if (!paymentList) return;
    paymentList.innerHTML = "";

    const totalBills = cashPendingBills.length + qrPaidBills.length;

    if (totalBills === 0) {
      paymentList.innerHTML = `
        <div class="col-span-full text-center py-20">
          <span class="material-symbols-outlined text-6xl text-slate-300 mb-4">check_circle</span>
          <p class="text-slate-400 text-lg">Không có đơn hàng nào chờ thanh toán</p>
        </div>
      `;
      return;
    }

    // QR Paid Section
    if (qrPaidBills.length > 0) {
      const qrSection = document.createElement("div");
      qrSection.className = "col-span-full mb-8";
      qrSection.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
          <span class="material-symbols-outlined text-primary text-2xl">qr_code_scanner</span>
          <h3 class="text-xl font-black">QR Đã Thanh Toán - Chờ Xác Nhận</h3>
          <span class="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-black">${qrPaidBills.length}</span>
        </div>
        <p class="text-sm text-slate-500 mb-4">Khách đã chuyển khoản QR. Vui lòng kiểm tra ứng dụng ngân hàng và xác nhận.</p>
        <div id="qr-bills-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"></div>
      `;
      paymentList.appendChild(qrSection);

      const qrGrid = document.getElementById("qr-bills-grid");
      qrPaidBills.forEach(bill => {
        qrGrid.appendChild(createQRPaymentCard(bill));
      });
    }

    // Cash Pending Section  
    if (cashPendingBills.length > 0) {
      const cashSection = document.createElement("div");
      cashSection.className = "col-span-full";
      cashSection.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
          <span class="material-symbols-outlined text-amber-500 text-2xl">payments</span>
          <h3 class="text-xl font-black">Tiền Mặt - Chờ Thu</h3>
          <span class="px-3 py-1 bg-amber-500/20 text-amber-600 rounded-full text-sm font-black">${cashPendingBills.length}</span>
        </div>
        <p class="text-sm text-slate-500 mb-4">Khách chọn thanh toán tiền mặt tại quầy. Vui lòng thu tiền và xác nhận.</p>
        <div id="cash-bills-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"></div>
      `;
      paymentList.appendChild(cashSection);

      const cashGrid = document.getElementById("cash-bills-grid");
      cashPendingBills.forEach(bill => {
        cashGrid.appendChild(createPaymentCard(bill));
      });
    }
  }

  // ================== CREATE QR PAYMENT CARD ==================
  function createQRPaymentCard(bill) {
    const card = document.createElement("div");
    card.className = `payment-card flex flex-col bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-primary/30 dark:border-primary/50 shadow-md shadow-primary/10`;

    // Format order time
    const orderDate = new Date(bill.order_time);
    const timeStr = orderDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const dateStr = orderDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

    // Shorten order_id for display (first 8 chars)
    const shortOrderId = bill.order_id.substring(0, 8).toUpperCase();

    card.innerHTML = `
      <!-- HEADER: primary/green-tinted for QR -->
      <div class="p-5 bg-primary/10 dark:bg-primary/20 border-b border-primary/20">
        <div class="flex justify-between items-start">
          <div>
            <span class="text-[10px] font-black uppercase tracking-widest text-primary">
              ${bill.branch_name}
            </span>
            <h3 class="text-3xl font-black leading-none mt-1">${bill.table_number}</h3>
            <span class="text-[11px] text-slate-400 font-bold mt-1 block">#${shortOrderId} · ${timeStr} ${dateStr}</span>
          </div>
          <span class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-primary text-white shadow-sm flex items-center gap-1">
            <span class="material-symbols-outlined text-xs">qr_code_2</span>
            Đã QR
          </span>
        </div>
      </div>

      <!-- ITEMS LIST -->
      <div class="p-5 flex-1 space-y-3">
        ${bill.items.map(i => `
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-primary font-black text-lg">${i.quantity}×</span>
              <div>
                <span class="font-bold text-sm">${i.menu_item_name}</span>
                ${i.note ? `<p class="text-xs text-slate-500 mt-0.5">📝 ${i.note}</p>` : ""}
              </div>
            </div>
            <span class="text-sm font-bold text-slate-600">${(i.price * i.quantity).toLocaleString("vi-VN")}đ</span>
          </div>
        `).join("")}
      </div>

      <!-- TOTALS -->
      <div class="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-700">
        <div class="flex justify-between text-xs text-slate-400 mb-1">
          <span>Subtotal</span><span>${bill.subtotal.toLocaleString("vi-VN")}đ</span>
        </div>
        <div class="flex justify-between text-xs text-slate-400 mb-1">
          <span>VAT 10%</span><span>${bill.vat.toLocaleString("vi-VN")}đ</span>
        </div>
        <div class="flex justify-between font-black text-base text-slate-900 dark:text-white pt-1.5 border-t border-slate-200 dark:border-slate-700 mt-1.5">
          <span>Tổng</span><span class="text-primary">${bill.total_amount.toLocaleString("vi-VN")}đ</span>
        </div>
      </div>

      <!-- BANK VERIFICATION INFO -->
      <div class="px-5 py-3 bg-primary/5 dark:bg-primary/10 border-t border-primary/10">
        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Thông tin chuyển khoản</p>
        <div class="space-y-1 text-[11px] font-bold">
          <div class="flex justify-between">
            <span class="text-slate-500">Ngân hàng:</span>
            <span class="text-slate-700 dark:text-slate-300">${bill.bank_code || 'N/A'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Số TK:</span>
            <span class="text-slate-700 dark:text-slate-300 font-mono">${bill.bank_account_number || 'N/A'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Tên TK:</span>
            <span class="text-slate-700 dark:text-slate-300">${bill.bank_account_name || 'N/A'}</span>
          </div>
          <div class="flex justify-between pt-1 border-t border-primary/10 mt-1">
            <span class="text-slate-500">Số tiền:</span>
            <span class="text-primary font-black">${bill.total_amount.toLocaleString("vi-VN")}đ</span>
          </div>
        </div>
      </div>

      <!-- VERIFY INFO -->
      <div class="px-5 py-3 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-700">
        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Kiểm tra app ngân hàng</p>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-bold">
          <span>Mã GD: <span class="text-slate-700 dark:text-slate-300">DH ${shortOrderId}</span></span>
          <span>Bàn: <span class="text-slate-700 dark:text-slate-300">${bill.table_number}</span></span>
          <span>Giờ: <span class="text-slate-700 dark:text-slate-300">${timeStr}</span></span>
        </div>
      </div>

      <!-- VERIFY BUTTON -->
      <div class="p-5 pt-3">
        <button class="verify-qr-btn w-full bg-primary hover:bg-primary/90
            text-white font-black py-4 rounded-xl uppercase tracking-tight transition shadow-md shadow-primary/30 flex items-center justify-center gap-2"
            data-bill-id="${bill.bill_id}">
          <span class="material-symbols-outlined">check_circle</span>
          Xác Nhận Đã Nhận Tiền
        </button>
      </div>
    `;

    // Attach click handler to verify button
    const btn = card.querySelector(".verify-qr-btn");
    btn.onclick = () => verifyQRPayment(bill.bill_id, bill.table_number);

    return card;
  }

  // ================== CREATE CASH PAYMENT CARD ==================
  function createPaymentCard(bill) {
    const card = document.createElement("div");
    card.className = `payment-card flex flex-col bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-amber-200 dark:border-amber-900 shadow-md`;

    // Format order time
    const orderDate = new Date(bill.order_time);
    const timeStr = orderDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const dateStr = orderDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

    // Shorten order_id for display (first 8 chars)
    const shortOrderId = bill.order_id.substring(0, 8).toUpperCase();

    card.innerHTML = `
      <!-- HEADER: amber-tinted -->
      <div class="p-5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900">
        <div class="flex justify-between items-start">
          <div>
            <span class="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
              ${bill.branch_name}
            </span>
            <h3 class="text-3xl font-black leading-none mt-1">${bill.table_number}</h3>
            <span class="text-[11px] text-slate-400 font-bold mt-1 block">#${shortOrderId} · ${timeStr} ${dateStr}</span>
          </div>
          <span class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-amber-500 text-white shadow-sm">
            Chờ Thu Tiền
          </span>
        </div>
      </div>

      <!-- ITEMS LIST -->
      <div class="p-5 flex-1 space-y-3">
        ${bill.items.map(i => `
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-amber-600 font-black text-lg">${i.quantity}×</span>
              <div>
                <span class="font-bold text-sm">${i.menu_item_name}</span>
                ${i.note ? `<p class="text-xs text-slate-500 mt-0.5">📝 ${i.note}</p>` : ""}
              </div>
            </div>
            <span class="text-sm font-bold text-slate-600">${(i.price * i.quantity).toLocaleString("vi-VN")}đ</span>
          </div>
        `).join("")}
      </div>

      <!-- TOTALS -->
      <div class="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-700">
        <div class="flex justify-between text-xs text-slate-400 mb-1">
          <span>Subtotal</span><span>${bill.subtotal.toLocaleString("vi-VN")}đ</span>
        </div>
        <div class="flex justify-between text-xs text-slate-400 mb-1">
          <span>VAT 10%</span><span>${bill.vat.toLocaleString("vi-VN")}đ</span>
        </div>
        <div class="flex justify-between font-black text-base text-slate-900 dark:text-white pt-1.5 border-t border-slate-200 dark:border-slate-700 mt-1.5">
          <span>Tổng</span><span class="text-amber-600">${bill.total_amount.toLocaleString("vi-VN")}đ</span>
        </div>
      </div>

      <!-- VERIFY INFO (for physical cross-check) -->
      <div class="px-5 py-3 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-700">
        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">Thông tin xác minh</p>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 font-bold">
          <span>Order: <span class="text-slate-700 dark:text-slate-300">#${shortOrderId}</span></span>
          <span>Bàn: <span class="text-slate-700 dark:text-slate-300">${bill.table_number}</span></span>
          <span>Giờ: <span class="text-slate-700 dark:text-slate-300">${timeStr}</span></span>
          <span>Món: <span class="text-slate-700 dark:text-slate-300">${bill.items.length}</span></span>
        </div>
      </div>

      <!-- CONFIRM BUTTON -->
      <div class="p-5 pt-3">
        <button class="confirm-cash-btn w-full bg-amber-500 hover:bg-amber-600
            text-white font-black py-4 rounded-xl uppercase tracking-tight transition shadow-md shadow-amber-500/30"
            data-bill-id="${bill.bill_id}">
          ✓ Đã Thu Tiền Mặt
        </button>
      </div>
    `;

    // Attach click handler to confirm button
    const btn = card.querySelector(".confirm-cash-btn");
    btn.onclick = () => confirmCashPayment(bill.bill_id, bill.table_number);

    return card;
  }

  // ================== CONFIRM CASH PAYMENT ==================
  async function confirmCashPayment(billId, tableNumber) {
    // Confirmation dialog so staff doesn't accidentally tap
    if (!confirm(`Xác nhận đã thu tiền mặt cho bàn ${tableNumber}?`)) return;

    try {
      console.log("💵 Confirming cash payment for bill:", billId);
      await BillAPI.confirmCashPayment(billId);
      showModal();                // reuse the existing success modal
      await loadPayments();       // refresh the list
    } catch (error) {
      console.error("❌ Failed to confirm cash payment:", error);
      alert("Lỗi xác nhận thanh toán: " + error.message);
    }
  }

  // ================== VERIFY QR PAYMENT ==================
  async function verifyQRPayment(billId, tableNumber) {
    // Confirmation dialog
    if (!confirm(`Xác nhận đã kiểm tra app ngân hàng và nhận được tiền QR cho bàn ${tableNumber}?`)) return;

    try {
      console.log("💳 Verifying QR payment for bill:", billId);
      await BillAPI.verifyQRPayment(billId);
      showModal();                // reuse the existing success modal
      await loadPayments();       // refresh the list
    } catch (error) {
      console.error("❌ Failed to verify QR payment:", error);
      alert("Lỗi xác nhận thanh toán QR: " + error.message);
    }
  }

  // ================== INIT ==================
  console.log("🚀 Initializing staff dashboard...");
  await loadOrders();
  await loadPayments();           // also pre-fetch payment data for the badge

});