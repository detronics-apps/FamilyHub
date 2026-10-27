// Drag and drop that works the same with a mouse and a finger. Native HTML
// drag and drop does nothing on phones, so this follows the pointer instead:
//   - a mouse starts dragging once it moves a few pixels;
//   - a finger has to press and hold (about a third of a second) first, so a
//     normal swipe still scrolls the page.
// A copy of the item follows the pointer; whatever drop target is under it is
// highlighted; letting go calls the target's onDrop with the dragged item's data.
// A click that ended a drag is swallowed, so dropping a link does not open it.

const HOLD_MS = 350;
const MOVE_PX = 6;

let drag = null;   // { node, data, ghost, target, dx, dy }

/** Make `node` draggable, carrying `data` to whatever it is dropped on. */
export function draggable(node, data) {
  node.classList.add('draggable');
  // A link (or image) has the browser's own drag, which would take over and cancel this one.
  node.setAttribute('draggable', 'false');
  node.addEventListener('dragstart', (e) => e.preventDefault());
  node.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || drag) return;
    const start = { x: e.clientX, y: e.clientY };
    const touch = e.pointerType !== 'mouse';
    let timer = null;
    const begin = (ev) => { cleanup(); startDrag(node, data, ev); };
    const move = (ev) => {
      const far = Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > MOVE_PX;
      if (!far) return;
      if (touch) cleanup();          // moved before the hold finished: it is a scroll
      else begin(ev);
    };
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', cleanup); window.removeEventListener('pointercancel', cleanup); };
    if (touch) timer = setTimeout(() => begin({ clientX: start.x, clientY: start.y }), HOLD_MS);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  });
  // The long press would otherwise open the phone's own menu for links and text.
  node.addEventListener('contextmenu', (e) => { if (drag) e.preventDefault(); });
  return node;
}

/** Make `node` a place things can be dropped. `onDrop(data)` gets what was dragged there. */
export function dropTarget(node, onDrop, { accepts = () => true } = {}) {
  node.classList.add('drop-target');
  node._drop = { onDrop, accepts };
  return node;
}

function startDrag(node, data, e) {
  const box = node.getBoundingClientRect();
  const ghost = node.cloneNode(true);
  ghost.classList.add('drag-ghost');
  Object.assign(ghost.style, { width: `${box.width}px`, left: `${box.left}px`, top: `${box.top}px` });
  document.body.append(ghost);
  node.classList.add('dragging');
  document.body.classList.add('is-dragging');
  drag = { node, data, ghost, target: null, dx: e.clientX - box.left, dy: e.clientY - box.top };
  navigator.vibrate?.(15);
  window.addEventListener('pointermove', follow);
  window.addEventListener('pointerup', finish, { once: true });
  window.addEventListener('pointercancel', cancel, { once: true });
  follow(e);
}

function follow(e) {
  if (!drag) return;
  drag.ghost.style.left = `${e.clientX - drag.dx}px`;
  drag.ghost.style.top = `${e.clientY - drag.dy}px`;
  const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.drop-target') ?? null;
  const target = under && under._drop.accepts(drag.data) ? under : null;
  if (target !== drag.target) {
    drag.target?.classList.remove('drop-over');
    target?.classList.add('drop-over');
    drag.target = target;
  }
  // Near the top or bottom of the window, scroll so far-away targets can be reached.
  const edge = 60;
  if (e.clientY < edge) window.scrollBy(0, -12);
  else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
}

function end() {
  window.removeEventListener('pointermove', follow);
  drag.ghost.remove();
  drag.node.classList.remove('dragging');
  drag.target?.classList.remove('drop-over');
  document.body.classList.remove('is-dragging');
  // Swallow the click the browser may send after the pointer is let go - and only that one.
  const swallow = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
  window.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => { window.removeEventListener('click', swallow, { capture: true }); drag = null; }, 50);
}

function finish() {
  if (!drag) return;
  const { target, data } = drag;
  end();
  if (target) target._drop.onDrop(data);
}

function cancel() { if (drag) end(); }

// While a finger is dragging, the page must not scroll under it.
document.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });
