/**
 * FarmLink Frontend Logic
 * Strictly handles UI state and dynamic rendering.
 * Wraps mock endpoints to simulate backend behavior as requested.
 */

// --- MOCK DATA ---
const mockStats = {
  totalListings: 1248,
  activeOrders: 156,
  farmersOnline: 342,
  todaysTrades: '$42.5k'
};

const mockProducts = [
  {
    id: 1,
    name: 'Organic Honeycrisp Apples',
    farm: 'Valley Green Orchards',
    location: 'Yakima Valley, WA',
    img: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6fac6?auto=format&fit=crop&q=80&w=400',
    type: 'organic',
    price: 3.50,
    unit: 'lb'
  },
  {
    id: 2,
    name: 'Surplus Carrots - Grade B',
    farm: 'Sunrise Roots',
    location: 'Salinas, CA',
    img: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&q=80&w=400',
    type: 'surplus',
    price: 0.85,
    unit: 'lb'
  },
  {
    id: 3,
    name: 'Heirloom Tomatoes',
    farm: 'Red Dirt Farm',
    location: 'Austin, TX',
    img: 'https://images.unsplash.com/photo-1592924357228-91a6daadf1a1?auto=format&fit=crop&q=80&w=400',
    type: 'organic',
    price: 4.20,
    unit: 'lb'
  },
];

const mockTimeline = [
  { status: 'Order Placed', time: 'Oct 24, 08:30 AM', desc: 'Awaiting farmer confirmation', active: false },
  { status: 'Packed', time: 'Oct 24, 11:15 AM', desc: 'Securely packed in cold bins', active: false },
  { status: 'Picked Up', time: 'Oct 24, 02:00 PM', desc: 'Handed over to logistics partner', active: true },
  { status: 'In Transit', time: 'Pending', desc: 'Estimated arrival in 14 hours', active: false },
  { status: 'Delivered', time: 'Pending', desc: 'Awaiting drop-off', active: false }
];

// --- MOCK FETCH FUNCTIONS ---
const api = {
  getStats: () => new Promise(res => setTimeout(() => res(mockStats), 1200)),
  getProducts: () => new Promise(res => setTimeout(() => res(mockProducts), 1500)),
  getLogistics: () => new Promise(res => setTimeout(() => res(mockTimeline), 1000)),
  processPayment: (amount) => new Promise((res) => setTimeout(() => res({ success: true }), 2000))
};

// --- DOM ELEMENTS ---
const elements = {
  navbar: document.getElementById('navbar'),
  statsContainer: document.getElementById('stats-container'),
  productGrid: document.getElementById('product-grid'),
  logisticsContainer: document.getElementById('logistics-container'),
  
  drawerOverlay: document.getElementById('drawer-overlay'),
  negotiationDrawer: document.getElementById('negotiation-drawer'),
  closeDrawer: document.getElementById('close-drawer'),
  negotiationSummary: document.getElementById('negotiation-summary'),
  
  modalOverlay: document.getElementById('modal-overlay'),
  closeModal: document.getElementById('close-modal'),
  paymentBody: document.getElementById('payment-body'),
  paymentSuccess: document.getElementById('payment-success'),
  paymentTotal: document.getElementById('payment-total'),
  confirmPaymentBtn: document.getElementById('confirm-payment'),
  
  toastContainer: document.getElementById('toast-container')
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initScrollEffects();
  renderSkeletons();
  loadDashboardData();
  setupEventListeners();
});

// --- RENDER LOGIC ---
function renderSkeletons() {
  // Products skeleton
  let skeletons = '';
  for(let i=0; i<3; i++) {
    skeletons += `
      <div class="product-card skeleton" style="height:400px; animation-delay: ${i*0.1}s"></div>
    `;
  }
  elements.productGrid.innerHTML = skeletons;
}

async function loadDashboardData() {
  try {
    const [stats, products, logistics] = await Promise.all([
      api.getStats(),
      api.getProducts(),
      api.getLogistics()
    ]);
    
    renderStats(stats);
    renderProducts(products);
    renderLogistics(logistics);
    
    // Add staggered fade in class
    document.querySelectorAll('.product-card').forEach((card, idx) => {
      card.style.animationDelay = `${idx * 0.1}s`;
    });
    
  } catch (error) {
    showToast('Error', 'Failed to load backend data', 'error');
  }
}

function renderStats(stats) {
  elements.statsContainer.innerHTML = `
    <div class="stat-card">
      <span class="stat-label">Total Listings</span>
      <span class="stat-value number">${stats.totalListings.toLocaleString()}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Active Orders</span>
      <span class="stat-value number">${stats.activeOrders.toLocaleString()}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Farmers Online</span>
      <span class="stat-value number">${stats.farmersOnline.toLocaleString()}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Today's Trades</span>
      <span class="stat-value number">${stats.todaysTrades}</span>
    </div>
  `;
}

function renderProducts(products) {
  elements.productGrid.innerHTML = products.map(p => `
    <div class="product-card ${p.type === 'surplus' ? 'surplus' : ''}">
      <div class="card-img-container">
        <img src="${p.img}" alt="${p.name}" class="card-img">
        <span class="badge ${p.type === 'organic' ? 'badge-organic' : 'badge-surplus'} card-badge">
          ${p.type.toUpperCase()}
        </span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${p.name}</h3>
        <p class="card-farm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--primary)" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          ${p.farm} &middot; ${p.location}
        </p>
        <p class="card-price price">$${p.price.toFixed(2)} <span>/ ${p.unit}</span></p>
        <div class="card-actions">
          <button class="btn btn-secondary negotiate-btn" onclick='openNegotiation(${JSON.stringify(p)})'>Negotiate</button>
          <button class="btn btn-primary order-btn" onclick='openPaymentModal(${p.price})'>Order Now</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderLogistics(timelineData) {
  let timelineHTML = '<div class="timeline">';
  
  timelineData.forEach((item, idx) => {
    timelineHTML += `
      <div class="timeline-step ${item.active ? 'active' : ''}">
        <div class="step-marker"></div>
        <div class="step-content">
          <div class="step-header">
            <span class="step-title">${item.status}</span>
            <span class="step-time">${item.time}</span>
          </div>
          <p class="step-desc">${item.desc}</p>
        </div>
      </div>
    `;
  });
  
  timelineHTML += '</div>';
  
  const chartHTML = `
    <div class="cold-chain-chart">
      <h3 style="font-size: 1rem; margin-bottom: 1rem;">Cold Chain Temperature (°F)</h3>
      <canvas id="tempChart" height="200"></canvas>
    </div>
  `;
  
  elements.logisticsContainer.innerHTML = timelineHTML + chartHTML;
  
  initChart();
}

function initChart() {
  const ctx = document.getElementById('tempChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'],
      datasets: [{
        label: 'Container Temp',
        data: [34.2, 34.5, 34.1, 35.0, 34.8, 34.3, 34.6],
        borderColor: '#52B788',
        backgroundColor: 'rgba(82, 183, 136, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#2D6A4F'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { 
          min: 32, max: 38,
          grid: { color: '#E5E7EB' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

// --- INTERACTIVE BEHAVIORS ---
function initScrollEffects() {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      elements.navbar.style.boxShadow = 'var(--shadow-soft)';
    } else {
      elements.navbar.style.boxShadow = 'none';
    }
  });
}

function setupEventListeners() {
  elements.closeDrawer.addEventListener('click', closeDrawer);
  elements.drawerOverlay.addEventListener('click', closeDrawer);
  
  elements.closeModal.addEventListener('click', closeModal);
  elements.modalOverlay.addEventListener('click', (e) => {
    if(e.target === elements.modalOverlay) closeModal();
  });
  
  elements.confirmPaymentBtn.addEventListener('click', processPaymentAction);
  
  document.getElementById('accept-offer')?.addEventListener('click', () => {
    showToast('Success', 'Offer accepted! Moving to escrow.', 'success');
    setTimeout(() => { closeDrawer(); openPaymentModal(4.50 * 50); }, 1000); // Dummy logic
  });
  
  document.getElementById('send-counter')?.addEventListener('click', () => {
    const val = document.getElementById('counter-price').value;
    if(!val) return;
    
    // add message
    const chat = document.getElementById('chat-thread');
    chat.innerHTML += `
      <div class="message buyer" style="animation: slideUp 0.3s ease">
        <div class="msg-bubble">I counter at $${val}/lb.</div>
        <div class="msg-time">Just now</div>
      </div>
    `;
    document.getElementById('counter-price').value = '';
    chat.scrollTop = chat.scrollHeight;
  });
}

// Drawer Methods
window.openNegotiation = (product) => {
  elements.negotiationSummary.innerHTML = `
    <img src="${product.img}" alt="" class="neg-img">
    <div class="neg-details">
      <h4>${product.name}</h4>
      <p class="price">$${product.price.toFixed(2)} / lb</p>
    </div>
  `;
  elements.drawerOverlay.classList.add('active');
  elements.negotiationDrawer.classList.add('active');
};

function closeDrawer() {
  elements.drawerOverlay.classList.remove('active');
  elements.negotiationDrawer.classList.remove('active');
}

// Modal Methods
window.openPaymentModal = (amount) => {
  // Reset states
  elements.paymentBody.style.display = 'block';
  elements.paymentSuccess.style.display = 'none';
  elements.paymentTotal.textContent = '$' + amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  
  elements.modalOverlay.classList.add('active');
};

function closeModal() {
  elements.modalOverlay.classList.remove('active');
}

async function processPaymentAction() {
  const btn = elements.confirmPaymentBtn;
  const originalText = btn.innerHTML;
  btn.innerHTML = 'Processing...';
  btn.disabled = true;
  
  try {
    const res = await api.processPayment(500); // amount doesn't matter for mock
    if (res.success) {
      elements.paymentBody.style.display = 'none';
      elements.paymentSuccess.style.display = 'flex';
    }
  } catch (err) {
    showToast('Payment Failed', 'Something went wrong', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// Toasts
window.showToast = (title, message, type = 'success') => {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '';
  if(type === 'success') icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  if(type === 'warning') icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  if(type === 'error') icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-dark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';

  toast.innerHTML = `
    ${icon}
    <div class="toast-content">
      <h5>${title}</h5>
      <p>${message}</p>
    </div>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};
