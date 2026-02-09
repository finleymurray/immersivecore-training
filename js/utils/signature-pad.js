/**
 * Creates a canvas-based signature pad.
 * @param {HTMLElement} container — element to mount the pad into
 * @param {Object} [options]
 * @returns {{ clear: Function, isEmpty: Function, toDataURL: Function }}
 */
export function createSignaturePad(container, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'signature-pad-canvas';
  canvas.width = options.width || 600;
  canvas.height = options.height || 150;

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'signature-pad-actions';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn btn-sm btn-secondary';
  clearBtn.textContent = 'Clear';
  actionsDiv.appendChild(clearBtn);

  container.innerHTML = '';
  container.appendChild(canvas);
  container.appendChild(actionsDiv);

  const ctx = canvas.getContext('2d');
  let drawing = false;
  let hasDrawn = false;

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // Save current drawing
    const imgData = hasDrawn ? canvas.toDataURL() : null;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Restore drawing
    if (imgData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = imgData;
    }
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  function startDraw(e) {
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!drawing) return;
    hasDrawn = true;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDraw() {
    drawing = false;
  }

  // Mouse events
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  // Touch events
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startDraw(e);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    draw(e);
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    stopDraw();
  }, { passive: false });

  function clear() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    hasDrawn = false;
  }

  clearBtn.addEventListener('click', clear);

  // Initial sizing
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  return {
    clear,
    isEmpty() { return !hasDrawn; },
    toDataURL() { return canvas.toDataURL('image/png'); },
  };
}
