export function showToast(message: string, durationMs = 4000): void {
  if (typeof document === 'undefined') return;

  const container = document.createElement('div');
  container.setAttribute('role', 'status');
  container.textContent = message;
  container.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:9999',
    'max-width:90vw',
    'padding:12px 20px',
    'border-radius:12px',
    'background:#18181b',
    'border:1px solid #3f3f46',
    'color:#fafafa',
    'font-size:14px',
    'font-family:system-ui,sans-serif',
    'box-shadow:0 8px 32px rgba(0,0,0,0.4)',
    'pointer-events:none',
  ].join(';');

  document.body.appendChild(container);

  window.setTimeout(() => {
    container.remove();
  }, durationMs);
}
