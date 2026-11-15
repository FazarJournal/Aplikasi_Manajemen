/**
 * Helper pembuat DOM kecil. Hanya `html` yang menerima markup mentah;
 * gunakan hanya untuk markup tepercaya (ikon, bukan input pengguna).
 */
export function el(tagName, properties = {}, ...children) {
  const node = document.createElement(tagName);

  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key === 'on' && typeof value === 'object') {
      for (const [eventName, listener] of Object.entries(value)) {
        node.addEventListener(eventName, listener);
      }
    } else if (key === 'attrs' && typeof value === 'object') {
      for (const [attribute, attributeValue] of Object.entries(value)) {
        if (attributeValue !== null && attributeValue !== undefined && attributeValue !== false) {
          node.setAttribute(attribute, attributeValue === true ? '' : attributeValue);
        }
      }
    } else if (key in node && !['list', 'form'].includes(key)) {
      try {
        node[key] = value;
      } catch {
        node.setAttribute(key, value === true ? '' : value);
      }
    } else {
      node.setAttribute(key, value === true ? '' : value);
    }
  }

  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(node) {
  node.replaceChildren();
}

export function focusableElements(root) {
  return [...root.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}
