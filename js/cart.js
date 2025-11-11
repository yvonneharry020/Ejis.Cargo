// CART & PAYSTACK (frontend)
// PRODUCTS list — edit to match actual stock and images
const PRODUCTS = [
  {
    id: 'car-001',
    type: 'Car',
    title: 'Toyota Camry 2016',
    priceNGN: 4500000,
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200&q=80&auto=format&fit=crop'
  },
  {
    id: 'truck-001',
    type: 'Truck',
    title: 'Isuzu FSR 2015',
    priceNGN: 7800000,
    image: 'https://images.unsplash.com/photo-1582719478250-8e1b43bb5f6a?w=1200&q=80&auto=format&fit=crop'
  },
  {
    id: 'car-002',
    type: 'Car',
    title: 'Mercedes C200 2014',
    priceNGN: 5200000,
    image: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=1200&q=80&auto=format&fit=crop'
  }
];

const CART_KEY = 'ejis_cart_v1';
function getCart(){ return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
function saveCart(cart){ localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateCartUI(); }

function addToCart(productId, qty=1) {
  const cart = getCart();
  const p = PRODUCTS.find(x => x.id === productId);
  if (!p) return;
  const existing = cart.find(i => i.id === productId);
  if (existing) existing.qty += qty; else cart.push({ ...p, qty });
  saveCart(cart);
}

function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter(i => i.id !== productId);
  saveCart(cart);
}

function updateCartUI() {
  const cart = getCart();
  const count = cart.reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll('#cartCount, #cartCount2').forEach(el => { if (el) el.textContent = count; });
  const total = cart.reduce((s,i) => s + (i.qty * i.priceNGN), 0);
  document.getElementById('cartTotal')?.textContent = total.toLocaleString();
  document.getElementById('cartTotal2')?.textContent = total.toLocaleString();

  // render items in modal(s)
  const container = document.getElementById('cartItems') || document.getElementById('cartItems2');
  if (container) {
    container.innerHTML = '';
    if (!cart.length) container.innerHTML = '<p>Your cart is empty.</p>';
    cart.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-row';
      row.innerHTML = `<div><strong>${item.title}</strong> × ${item.qty}</div>
        <div>₦${(item.priceNGN * item.qty).toLocaleString()}</div>
        <div><button class="small" data-id="${item.id}">Remove</button></div>`;
      container.appendChild(row);
    });
    container.querySelectorAll('button.small').forEach(b => b.addEventListener('click', e => {
      removeFromCart(e.target.dataset.id);
    }));
  }
}

// render product list on sales page
function renderProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  grid.innerHTML = '';
  PRODUCTS.forEach(p => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.innerHTML = `<img src="${p.image}" alt="${p.title}">
      <div class="product-body">
        <h3>${p.title}</h3>
        <p class="price">₦${p.priceNGN.toLocaleString()}</p>
        <p><button class="btn btn-accent add-to-cart" data-id="${p.id}">Add to cart</button></p>
      </div>`;
    grid.appendChild(card);
  });
  document.querySelectorAll('.add-to-cart').forEach(btn => btn.addEventListener('click', e => {
    addToCart(e.target.dataset.id);
  }));
}

// PAYSTACK CHECKOUT
async function checkoutWithPaystack() {
  const cart = getCart();
  if (!cart.length) { alert('Cart is empty'); return; }
  const totalNGN = cart.reduce((s,i) => s + (i.qty * i.priceNGN), 0);
  const email = prompt('Enter buyer email for receipt (test@example.com):', 'test@example.com');
  if (!email) return alert('Email required');

  // create order payload
  const order = {
    id: 'ORD' + Date.now(),
    createdAt: new Date().toISOString(),
    type: 'order',
    items: cart,
    totalNGN,
    currency: 'NGN',
    email,
    status: 'pending'
  };

  // POST order to server (server should save it and return order id)
  const serverUrl = window.SERVER_URL || '/';
  try {
    const res = await fetch((serverUrl.endsWith('/') ? serverUrl : serverUrl + '/') + 'orders', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(order)
    });
    if (!res.ok) {
      // if server not available, save locally and still attempt checkout (but verification will fail)
      console.warn('Server not available, saving order locally');
      localStorage.setItem('ejis_temp_order', JSON.stringify(order));
    }
  } catch (err) {
    console.warn('Order save failed:', err);
    localStorage.setItem('ejis_temp_order', JSON.stringify(order));
  }

  // Paystack inline
  if (!window.PAYSTACK_PUBLIC_KEY) return alert('Paystack public key not configured. Set window.PAYSTACK_PUBLIC_KEY in main.js or template.');
  const handler = PaystackPop.setup({
    key: window.PAYSTACK_PUBLIC_KEY,
    email: email,
    amount: totalNGN * 100, // Paystack expects kobo
    currency: 'NGN',
    reference: order.id,
    metadata: {
      custom_fields: [
        { display_name: "Order ID", variable_name: "order_id", value: order.id }
      ]
    },
    callback: function(response){
      // response.reference
      // Call server to verify
      verifyPayment(response.reference);
    },
    onClose: function(){
      alert('Payment window closed.');
    }
  });
  handler.openIframe();
}

async function verifyPayment(reference) {
  const serverUrl = window.SERVER_URL || '/';
  try {
    const res = await fetch((serverUrl.endsWith('/') ? serverUrl : serverUrl + '/') + 'verify/' + encodeURIComponent(reference));
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (data.status === 'success') {
      alert('Payment verified — order completed.');
      // update local saved order status if present
      const temp = JSON.parse(localStorage.getItem('ejis_temp_order') || 'null');
      if (temp && temp.id === reference) {
        temp.status = 'paid';
        // try to POST update
        await fetch((serverUrl.endsWith('/') ? serverUrl : serverUrl + '/') + 'orders', {
          method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(temp)
        }).catch(()=>{ localStorage.setItem('ejis_order_' + temp.id, JSON.stringify(temp)); });
      }
      localStorage.removeItem(CART_KEY);
      updateCartUI();
      document.getElementById('cartModal')?.classList.add('hidden');
    } else {
      alert('Payment verification failed: ' + (data.message || 'unknown'));
    }
  } catch (err) {
    alert('Could not verify payment: ' + err.message);
  }
}

// wire up buttons & init
document.addEventListener('DOMContentLoaded', () => {
  updateCartUI();
  renderProducts();

  // checkout button(s)
  document.getElementById('checkoutBtn')?.addEventListener('click', checkoutWithPaystack);
  document.getElementById('checkoutBtn2')?.addEventListener('click', checkoutWithPaystack);

  // also populate product grid if on index
  // ensure Paystack script is loaded globally in your HTML (below)
});
