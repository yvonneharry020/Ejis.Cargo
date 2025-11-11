// set global server URL if you host your server at a different origin
// Example: window.SERVER_URL = 'https://your-server.example.com';
document.addEventListener('DOMContentLoaded', () => {
  const y = new Date().getFullYear();
  document.querySelectorAll('#year,#yearAbout,#yearServices,#yearSales,#yearContact,#yearContact2,#yearAdmin')
    .forEach(el => { if (el) el.textContent = y; });

  // simple cart modal toggles (works for both pages)
  const cartBtn = document.getElementById('cartBtn') || document.getElementById('cartBtn2');
  const cartModal = document.getElementById('cartModal');
  const closeCart = document.getElementById('closeCart') || document.getElementById('closeCart2');
  if (cartBtn) cartBtn.addEventListener('click', () => {
    cartModal.classList.toggle('hidden');
    cartModal.setAttribute('aria-hidden', String(cartModal.classList.contains('hidden')));
  });
  if (closeCart) closeCart.addEventListener('click', () => {
    cartModal.classList.add('hidden');
    cartModal.setAttribute('aria-hidden', 'true');
  });
});
