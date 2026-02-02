// assets/Javascript/kitchen/kitchen.js
// Kitchen Display System connected to API

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
    
    // For kitchen, we should get the branch from URL or user's assignment
    const urlParams = new URLSearchParams(window.location.search);
    const branchId = urlParams.get('branch_id');
    
    if (!branchId) {
      // Get first branch for this tenant
      const branches = await BranchAPI.getAll();
      if (branches.length === 0) {
        alert('No branches found');
        return;
      }
      currentBranch = branches[0];
    } else {
      currentBranch = await BranchAPI.getOne(branchId);
    }

    console.log("✅ Kitchen loaded for branch:", currentBranch.branch_name);
    
  } catch (error) {
    console.error("❌ Authentication error:", error);
    window.location.href = '../../index.html';
    return;
  }

  // ================== DOM ELEMENTS ==================
  const pendingCol = document.getElementById("pendingCol");
  const cookingCol = document.getElementById("cookingCol");
  const readyCol = document.getElementById("readyCol");

  const pendingCount = document.getElementById("pendingCount");
  const cookingCount = document.getElementById("cookingCount");
  const readyCount = document.getElementById("readyCount");

  const activeCount = document.getElementById("activeCount");

  let currentDetailId = null;
  let orders = [];

  // ================== LOAD ORDERS FROM API ==================
  async function loadOrders() {
    try {
      const allOrders = await OrderAPI.getAll(currentBranch.branch_id);
      
      // Kitchen only sees: pending, ordered, cooking, ready
      // NOT: serving, done (those are for staff)
      orders = allOrders.filter(o => ['pending', 'ordered', 'cooking', 'ready'].includes(o.status));
      
      console.log("📋 Loaded kitchen orders:", orders.length);
      console.log("   - Statuses:", orders.map(o => o.status));
      
      renderOrders();
    } catch (error) {
      console.error("❌ Failed to load orders:", error);
      // Show error UI
      if (pendingCol) pendingCol.innerHTML = '<div class="text-red-500 p-4">Failed to load orders</div>';
    }
  }

  // ================== RENDER ORDERS ==================
  function renderOrders() {
    pendingCol.innerHTML = "";
    cookingCol.innerHTML = "";
    readyCol.innerHTML = "";

    let p = 0, c = 0, r = 0;

    orders.forEach(order => {
      const card = createOrderCard(order);

      // IMPORTANT: Kitchen handles both "pending" AND "ordered" statuses
      if (order.status === "ordered" || order.status === "pending") {
        pendingCol.appendChild(card);
        p++;
      }
      if (order.status === "cooking") {
        cookingCol.appendChild(card);
        c++;
      }
      if (order.status === "ready") {
        readyCol.appendChild(card);
        r++;
      }
    });

    pendingCount.innerText = p;
    cookingCount.innerText = c;
    readyCount.innerText = r;

    if (activeCount)
      activeCount.innerText = orders.length;

    if (currentDetailId) showDetail(currentDetailId);
    
    console.log(`📊 Rendered: ${p} pending, ${c} cooking, ${r} ready`);
  }

  // ================== CREATE ORDER CARD ==================
  function createOrderCard(order) {
    const div = document.createElement("div");
    div.className =
      "kds-card bg-white rounded-3xl p-6 border border-slate-200 cursor-pointer hover:shadow-lg transition";

    div.onclick = () => showDetail(order.order_id);

    let border = "border-l-8 border-amber-400";
    let label = "CHỜ";
    let btn = "";

    if (order.status === "cooking") {
      border = "border-l-8 border-sky-400";
      label = "ĐANG NẤU";
      btn = `<button onclick="finishCooking('${order.order_id}'); event.stopPropagation();"
               class="bg-sky-400 hover:bg-sky-300 text-black px-5 py-2 rounded-xl font-black uppercase">
               Hoàn thành</button>`;
    }

    if (order.status === "ordered" || order.status === "pending") {
      btn = `<button onclick="startCooking('${order.order_id}'); event.stopPropagation();"
               class="bg-amber-400 hover:bg-amber-300 text-black px-5 py-2 rounded-xl font-black uppercase">
               Bắt đầu nấu</button>`;
    }

    if (order.status === "ready") {
      border = "border-l-8 border-emerald-400 processing-card";
      label = "SẴNG SÀNG";
      btn = "";
    }

    div.className += " " + border;

    div.innerHTML = `
      <div class="flex justify-between mb-3">
        <p class="font-black text-lg">${order.table_number}</p>
        <span class="font-black text-sm">${label}</span>
      </div>

      <ul class="space-y-2 text-slate-700 font-semibold">
        ${order.items.map(i => `<li>${i.quantity}× ${i.menu_item_name}</li>`).join("")}
      </ul>

      <div class="mt-5 flex justify-between items-center">
        <p class="text-xs text-slate-500 font-bold">
          ${order.status === "ready" ? "Hoàn thành" : "Đã đợi"} ${order.wait_minutes} phút
        </p>
        ${btn}
      </div>
    `;

    return div;
  }

  // ================== SHOW DETAIL PANEL ==================
  window.showDetail = function(orderId) {
    const order = orders.find(o => o.order_id === orderId);
    if (!order) return;

    currentDetailId = orderId;

    document.getElementById("detailEmpty").classList.add("hidden");
    document.getElementById("detailContent").classList.remove("hidden");

    document.getElementById("d_table").innerText = order.table_number;
    document.getElementById("d_info").innerText = `${order.branch_name} - Đơn bếp`;
    document.getElementById("d_time").innerText = order.wait_minutes + " phút";

    document.getElementById("d_status").innerText =
      (order.status === "ordered" || order.status === "pending") ? "Chờ chế biến" :
      order.status === "cooking" ? "Đang nấu" : "Hoàn thành";

    const itemsBox = document.getElementById("d_items");
    itemsBox.innerHTML = "";

    order.items.forEach(item => {
      const div = document.createElement("div");
      div.className = "bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4";

      // Use actual image from database or placeholder
      const imageUrl = item.menu_item_image || "https://via.placeholder.com/80";

      div.innerHTML = `
        <div class="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
          <img src="${imageUrl}" class="w-full h-full object-cover" onerror="this.src='https://via.placeholder.com/80'">
        </div>

        <div class="flex-1">
          <div class="flex items-center justify-between mb-1">
            <p class="font-black text-slate-800">${item.menu_item_name}</p>
            <span class="text-primary font-black text-lg">✓</span>
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 mt-1">
            📝 ${item.note && item.note.trim() !== "" ? item.note : "Không có yêu cầu đặc biệt"}
          </div>
        </div>

        <div class="ml-2 bg-white border border-slate-200 rounded-xl px-4 py-2 text-center">
          <p class="text-[10px] text-slate-400 font-bold uppercase">Số lượng</p>
          <p class="font-black text-lg">${item.quantity.toString().padStart(2,"0")}</p>
        </div>
      `;

      itemsBox.appendChild(div);
    });

    const btn = document.getElementById("detailAction");

    if (order.status === "ordered" || order.status === "pending") {
      btn.innerText = "BẮT ĐẦU NẤU";
      btn.disabled = false;
      btn.className = "w-full bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-xl uppercase transition";
      btn.onclick = () => startCooking(order.order_id);
    } 
    else if (order.status === "cooking") {
      btn.innerText = "HOÀN THÀNH";
      btn.disabled = false;
      btn.className = "w-full bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-xl uppercase transition";
      btn.onclick = () => finishCooking(order.order_id);
    } 
    else {
      btn.innerText = "ĐÃ HOÀN THÀNH";
      btn.disabled = true;
      btn.className = "w-full bg-slate-300 text-white font-black py-4 rounded-xl uppercase cursor-not-allowed";
    }
  };

  // ================== START COOKING ==================
  window.startCooking = async function(orderId) {
    try {
      console.log("🔥 Starting to cook order:", orderId);
      await OrderAPI.updateStatus(orderId, "cooking");
      await loadOrders();
    } catch (error) {
      console.error("❌ Failed to start cooking:", error);
      alert("Failed to update order status: " + error.message);
    }
  };

  // ================== FINISH COOKING ==================
  window.finishCooking = async function(orderId) {
    try {
      console.log("✅ Finishing order:", orderId);
      await OrderAPI.updateStatus(orderId, "ready");
      await loadOrders();
      
      // Notify staff that order is ready (you could add websocket here)
      console.log("📢 Order ready for pickup:", orderId);
    } catch (error) {
      console.error("❌ Failed to finish cooking:", error);
      alert("Failed to update order status: " + error.message);
    }
  };

  // ================== AUTO-REFRESH ==================
  // Reload orders every 5 seconds
  setInterval(async () => {
    console.log("🔄 Auto-refreshing orders...");
    await loadOrders();
  }, 5000);

  // ================== INITIALIZE ==================
  console.log("🚀 Initializing kitchen dashboard...");
  await loadOrders();

});