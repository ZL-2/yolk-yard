// Keep HUD nodes, focus and scroll position stable while changing live values.
// Parsing is throttled; unchanged markup never touches the DOM.
export function patchZombieHUD(root, html) {
  if (root.zMarkup === html) return;
  root.zMarkup = html;
  const template = document.createElement('template');
  template.innerHTML = html;
  const patch = (parent, source) => {
    const incoming = [...source.childNodes];
    for (let i = 0; i < incoming.length; i++) {
      const next = incoming[i], current = parent.childNodes[i];
      if (!current) { parent.append(next.cloneNode(true)); continue; }
      if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) { current.replaceWith(next.cloneNode(true)); continue; }
      if (next.nodeType === 3) { if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue; continue; }
      if (next.nodeType !== 1) continue;
      for (const attr of [...current.attributes]) if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
      for (const attr of next.attributes) if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
      patch(current, next);
    }
    while (parent.childNodes.length > incoming.length) parent.lastChild.remove();
  };
  patch(root, template.content);
}
