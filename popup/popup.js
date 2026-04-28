// popup.js - Focused editor for current page localStorage/sessionStorage.

let currentTabId = null;
let currentHostname = null;
let isContentScriptReady = false;
let activeStoreName = 'sessionStorage';
let selected = null;
let jsonDraft = null;
let jsonExpandState = {};
let snapshot = {
  localStorage: {},
  sessionStorage: {}
};
const STORE_THEME = {
  localStorage: 'local',
  sessionStorage: 'session'
};

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}

function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function setStatus(message, type = '') {
  const status = document.getElementById('status');
  if (!status) return;
  status.textContent = message || '';
  status.className = type ? `status-${type}` : '';
}

function showUnsupported(message) {
  const unsupported = document.getElementById('unsupported');
  const mainSections = document.querySelectorAll('.header, .workspace, .actions');
  unsupported.textContent = message || '此页面不受支持，请在 neikongyi.com 及其子域名页面使用本插件。';
  unsupported.style.display = 'block';
  mainSections.forEach((node) => {
    node.style.display = 'none';
  });
}

function sendPageMessage(message, callback, didInject = false) {
  chrome.tabs.sendMessage(currentTabId, message, (response) => {
    const error = chrome.runtime.lastError;
    if (!error) {
      isContentScriptReady = true;
      callback(response);
      return;
    }

    if (didInject || isContentScriptReady || !chrome.scripting?.executeScript) {
      callback(null, error.message);
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      files: ['content_scripts/content.js']
    }, () => {
      const injectError = chrome.runtime.lastError;
      if (injectError) {
        callback(null, injectError.message);
        return;
      }
      isContentScriptReady = true;
      sendPageMessage(message, callback, true);
    });
  });
}

function normalizeStore(store) {
  return Object.fromEntries(
    Object.entries(store || {}).map(([key, value]) => [String(key), String(value ?? '')])
  );
}

function parseStructuredJson(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || !['{', '['].includes(trimmed[0])) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      return {
        type: Array.isArray(parsed) ? 'array' : 'object',
        value: parsed
      };
    }
  } catch (e) {
    return null;
  }

  return null;
}

function getTypeLabel(value) {
  const json = parseStructuredJson(value);
  return json ? `JSON ${json.type}` : 'text';
}

function readCurrentStorage() {
  setStatus('正在读取页面 Storage...');
  sendPageMessage({ action: 'READ_STORAGE' }, (response, error) => {
    if (error || !response || response.error) {
      setStatus(`读取失败：${error || response?.error || '响应为空'}`, 'error');
      return;
    }

    snapshot = {
      localStorage: normalizeStore(response.localStorage),
      sessionStorage: normalizeStore(response.sessionStorage)
    };
    selected = pickInitialSelection();
    activeStoreName = selected?.storeName || 'sessionStorage';
    resetJsonEditorState();
    renderAll();
  });
}

function pickInitialSelection() {
  const sessionKey = Object.keys(snapshot.sessionStorage).sort()[0];
  if (sessionKey) return { storeName: 'sessionStorage', key: sessionKey };

  const localKey = Object.keys(snapshot.localStorage).sort()[0];
  if (localKey) return { storeName: 'localStorage', key: localKey };

  return null;
}

function renderAll() {
  renderTabs();
  renderKeyList();
  renderEditor();
}

function renderTabs() {
  document.body.dataset.activeStore = STORE_THEME[activeStoreName] || 'local';
  document.querySelectorAll('.store-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.store === activeStoreName);
  });
}

function getFilteredKeys() {
  const keys = Object.keys(snapshot[activeStoreName] || {}).sort((a, b) => a.localeCompare(b));
  const keyword = document.getElementById('store-search').value.trim().toLowerCase();
  if (!keyword) return keys;

  return keys.filter((key) => {
    const value = snapshot[activeStoreName][key] || '';
    return key.toLowerCase().includes(keyword) || value.toLowerCase().includes(keyword);
  });
}

function renderKeyList() {
  const list = document.getElementById('store-list');
  const empty = document.getElementById('store-empty');
  const count = document.getElementById('store-count');
  const keys = getFilteredKeys();
  const total = Object.keys(snapshot[activeStoreName] || {}).length;

  count.textContent = `${activeStoreName} · ${keys.length}/${total}`;
  empty.style.display = keys.length ? 'none' : 'block';
  list.innerHTML = keys.map((key) => {
    const isActive = selected?.storeName === activeStoreName && selected.key === key;
    const value = snapshot[activeStoreName][key] || '';
    return `
      <button class="key-item ${isActive ? 'active' : ''}" type="button" data-store="${activeStoreName}" data-key="${escapeHtml(key)}">
        <span class="key-line">
          <span class="key-name">${escapeHtml(key)}</span>
          <span class="key-type">${escapeHtml(getTypeLabel(value))}</span>
        </span>
      </button>
    `;
  }).join('');
}

function renderEditor() {
  const empty = document.getElementById('editor-empty');
  const form = document.getElementById('editor-form');

  if (!selected || !Object.prototype.hasOwnProperty.call(snapshot[selected.storeName], selected.key)) {
    selected = null;
    resetJsonEditorState();
    empty.style.display = 'block';
    form.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  form.style.display = 'flex';

  const rawValue = snapshot[selected.storeName][selected.key];
  const json = parseStructuredJson(rawValue);
  const valueType = document.getElementById('editor-value-type');
  const formatButton = document.getElementById('btn-format-json');
  const textEditor = document.getElementById('text-editor');
  const jsonEditor = document.getElementById('json-editor');
  const textValue = document.getElementById('editor-value');

  document.getElementById('editor-store-badge').textContent = selected.storeName;
  document.getElementById('editor-store-badge').className = selected.storeName === 'sessionStorage' ? 'badge badge-session' : 'badge badge-local';
  document.getElementById('editor-key').value = selected.key;

  if (json) {
    ensureJsonDraft(rawValue);
    valueType.textContent = `JSON ${json.type}`;
    valueType.className = 'value-type value-type-json';
    formatButton.style.display = 'inline-flex';
    textEditor.style.display = 'none';
    jsonEditor.style.display = 'flex';
    renderJsonTree();
  } else {
    resetJsonEditorState();
    valueType.textContent = 'text';
    valueType.className = 'value-type';
    formatButton.style.display = 'none';
    jsonEditor.style.display = 'none';
    textEditor.style.display = 'flex';
    textValue.value = rawValue;
  }
}

function ensureJsonDraft(rawValue) {
  const parsed = parseStructuredJson(rawValue);
  if (!parsed) {
    resetJsonEditorState();
    return;
  }

  if (!jsonDraft) {
    jsonDraft = cloneValue(parsed.value);
    jsonExpandState = buildDefaultExpandState(jsonDraft);
  }
}

function resetJsonEditorState() {
  jsonDraft = null;
  jsonExpandState = {};
}

function buildDefaultExpandState(value, path = 'root', depth = 0, state = {}) {
  if (!value || typeof value !== 'object') return state;
  if (depth === 0) {
    state[path] = true;
  }

  Object.entries(value).forEach(([key, child]) => {
    const childPath = `${path}.${key}`;
    if (child && typeof child === 'object') {
      buildDefaultExpandState(child, childPath, depth + 1, state);
    }
  });
  return state;
}

function isPrimitive(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function getPathSegments(path) {
  return path.split('.').slice(1);
}

function getValueByPath(root, path) {
  return getPathSegments(path).reduce((acc, segment) => acc[segment], root);
}

function setValueByPath(root, path, nextValue) {
  const segments = getPathSegments(path);
  const last = segments.pop();
  const parent = segments.reduce((acc, segment) => acc[segment], root);
  parent[last] = nextValue;
}

function getLeafValueType(value) {
  if (value === null) return 'null';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function formatLeafDisplay(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function coerceLeafValue(text, type) {
  if (type === 'null') return null;
  if (type === 'boolean') return text === 'true';
  if (type === 'number') {
    const parsed = Number(text);
    if (Number.isNaN(parsed)) throw new Error(`无效数字：${text}`);
    return parsed;
  }
  return text;
}

function renderJsonTree() {
  const container = document.getElementById('json-tree');
  if (!jsonDraft) {
    container.innerHTML = '';
    return;
  }

  const rows = [];
  const rootLabel = Array.isArray(jsonDraft) ? '[ ]' : '{ }';
  rows.push(renderJsonBranch('root', rootLabel, jsonDraft, 0, true));
  container.innerHTML = rows.join('');
}

function renderJsonBranch(path, label, value, depth, isRoot = false) {
  const expanded = Boolean(jsonExpandState[path]);
  const childrenHtml = expanded
    ? Object.entries(value).map(([key, child], index) => {
        const childPath = `${path}.${key}`;
        if (child && typeof child === 'object') {
          const childLabel = Array.isArray(value) ? `[${key}]` : key;
          return renderJsonBranch(childPath, childLabel, child, depth + 1);
        }
        return renderJsonLeaf(childPath, key, child, depth + 1, Array.isArray(value));
      }).join('')
    : '';

  const summary = Array.isArray(value) ? `Array(${value.length})` : `Object(${Object.keys(value).length})`;

  return `
    <div class="json-node">
      <div class="json-row json-branch" style="padding-left:${depth * 18}px">
        <button
          class="json-toggle"
          type="button"
          data-path="${escapeHtml(path)}"
          title="${expanded ? '收起当前节点' : '展开当前节点'}"
          aria-label="${expanded ? '收起当前节点' : '展开当前节点'}"
        >${expanded ? '▾' : '▸'}</button>
        <span class="json-label">${escapeHtml(isRoot ? summary : label)}</span>
        <span class="json-summary">${escapeHtml(summary)}</span>
      </div>
      ${childrenHtml}
    </div>
  `;
}

function renderJsonLeaf(path, key, value, depth, parentIsArray) {
  const type = getLeafValueType(value);
  const label = parentIsArray ? `[${key}]` : key;
  return `
    <div class="json-row json-leaf" style="padding-left:${depth * 18}px">
      <span class="json-spacer"></span>
      <span class="json-label">${escapeHtml(label)}</span>
      <select class="json-type-select" data-path="${escapeHtml(path)}">
        <option value="string" ${type === 'string' ? 'selected' : ''}>string</option>
        <option value="number" ${type === 'number' ? 'selected' : ''}>number</option>
        <option value="boolean" ${type === 'boolean' ? 'selected' : ''}>boolean</option>
        <option value="null" ${type === 'null' ? 'selected' : ''}>null</option>
      </select>
      <input class="json-value-input" data-path="${escapeHtml(path)}" type="text" value="${escapeHtml(formatLeafDisplay(value))}" ${type === 'null' ? 'disabled' : ''} spellcheck="false" />
    </div>
  `;
}

function persistCurrentEditor() {
  if (!selected) return true;

  const store = snapshot[selected.storeName];
  if (!Object.prototype.hasOwnProperty.call(store, selected.key)) return true;

  const nextKey = document.getElementById('editor-key').value.trim();
  let nextValue;

  if (!nextKey) {
    setStatus('Key 不能为空', 'error');
    return false;
  }

  if (jsonDraft) {
    nextValue = JSON.stringify(jsonDraft);
  } else {
    nextValue = document.getElementById('editor-value').value;
  }

  if (nextKey !== selected.key && Object.prototype.hasOwnProperty.call(store, nextKey)) {
    setStatus(`${selected.storeName} 已存在 key：${nextKey}`, 'error');
    return false;
  }

  delete store[selected.key];
  store[nextKey] = nextValue;
  selected.key = nextKey;
  return true;
}

function switchStore(storeName) {
  if (!persistCurrentEditor()) return;
  activeStoreName = storeName;

  if (selected?.storeName !== storeName) {
    const firstKey = Object.keys(snapshot[storeName]).sort()[0];
    selected = firstKey ? { storeName, key: firstKey } : null;
    resetJsonEditorState();
  }

  document.getElementById('store-search').value = '';
  renderAll();
}

function selectKey(storeName, key) {
  if (!persistCurrentEditor()) return;
  selected = { storeName, key };
  activeStoreName = storeName;
  resetJsonEditorState();
  renderAll();
}

function addEntry() {
  if (!persistCurrentEditor()) return;

  const base = activeStoreName === 'sessionStorage' ? 'session_key' : 'local_key';
  let key = base;
  let index = 1;
  while (Object.prototype.hasOwnProperty.call(snapshot[activeStoreName], key)) {
    key = `${base}_${index}`;
    index += 1;
  }

  snapshot[activeStoreName][key] = '';
  selected = { storeName: activeStoreName, key };
  resetJsonEditorState();
  document.getElementById('store-search').value = '';
  renderAll();
  document.getElementById('editor-key').select();
  setStatus('已新增，编辑后点击保存到页面');
}

function deleteCurrent() {
  if (!selected) return;
  const { storeName, key } = selected;
  delete snapshot[storeName][key];
  const nextKey = Object.keys(snapshot[storeName]).sort()[0];
  selected = nextKey ? { storeName, key: nextKey } : null;
  activeStoreName = storeName;
  resetJsonEditorState();
  renderAll();
  setStatus('已删除，点击保存到页面后生效');
}

function saveToPage() {
  if (!persistCurrentEditor()) return;

  setStatus('正在写入页面 Storage...');
  sendPageMessage({ action: 'WRITE_STORAGE', payload: snapshot }, (response, error) => {
    if (error || !response || !response.success) {
      setStatus(`保存失败：${error || response?.error || '未知错误'}`, 'error');
      return;
    }

    renderAll();
    setStatus('已保存到页面 Storage', 'success');

    if (document.getElementById('reload-after-save').checked) {
      chrome.tabs.reload(currentTabId);
      window.close();
    }
  });
}

function formatCurrentJson() {
  if (!jsonDraft) return;
  setStatus('JSON 树结构已同步', 'success');
  renderJsonTree();
}

function toggleJsonPath(path) {
  jsonExpandState[path] = !(jsonExpandState[path] !== false);
  renderJsonTree();
}

function expandAllJson() {
  if (!jsonDraft) return;
  jsonExpandState = {};
  markAllExpanded(jsonDraft);
  renderJsonTree();
}

function markAllExpanded(value, path = 'root') {
  if (!value || typeof value !== 'object') return;
  jsonExpandState[path] = true;
  Object.entries(value).forEach(([key, child]) => {
    if (child && typeof child === 'object') {
      markAllExpanded(child, `${path}.${key}`);
    }
  });
}

function collapseJsonToFirstLevel() {
  if (!jsonDraft) return;
  jsonExpandState = buildDefaultExpandState(jsonDraft);
  Object.keys(jsonExpandState).forEach((path) => {
    if (path.split('.').length > 2) {
      jsonExpandState[path] = false;
    }
  });
  renderJsonTree();
}

function updateJsonLeaf(path, rawValue, type) {
  if (!jsonDraft) return;
  try {
    setValueByPath(jsonDraft, path, coerceLeafValue(rawValue, type));
    setStatus('');
    renderKeyList();
  } catch (e) {
    setStatus(e.message, 'error');
  }
}

function updateJsonLeafType(path, type) {
  if (!jsonDraft) return;
  const current = getValueByPath(jsonDraft, path);
  let nextValue = current;

  switch (type) {
    case 'number':
      nextValue = typeof current === 'number' ? current : 0;
      break;
    case 'boolean':
      nextValue = typeof current === 'boolean' ? current : false;
      break;
    case 'null':
      nextValue = null;
      break;
    default:
      nextValue = current === null ? '' : String(current);
      break;
  }

  setValueByPath(jsonDraft, path, nextValue);
  renderJsonTree();
  renderKeyList();
}

window.addEventListener('DOMContentLoaded', () => {
  const toggleF27Button = document.getElementById('btn-toggle-f27');
  const toggleIsNeedTipsButton = document.getElementById('btn-toggle-is-need-tips');

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url) {
      showUnsupported('无法读取当前页面地址。');
      return;
    }

    currentTabId = tab.id;
    try {
      currentHostname = new URL(tab.url).hostname;
    } catch (e) {
      showUnsupported('当前页面地址无效。');
      return;
    }

    if (!/^(.*\.)?neikongyi\.com$|^localhost$|^127\.0\.0\.1$/.test(currentHostname)) {
      showUnsupported();
      return;
    }

    document.getElementById('unsupported').style.display = 'none';
    document.querySelector('.header').style.display = 'flex';
    document.querySelector('.workspace').style.display = 'flex';
    document.querySelector('.actions').style.display = 'flex';
    document.getElementById('host').textContent = currentHostname;
    readCurrentStorage();
  });

  document.getElementById('btn-reload').addEventListener('click', readCurrentStorage);
  toggleF27Button.addEventListener('click', () => {
    chrome.tabs.sendMessage(currentTabId, { action: 'TOGGLE_FUNCTIONAL_27' }, (resp) => {
      if (chrome.runtime.lastError || !resp?.success) {
        alert(`操作失败: ${chrome.runtime.lastError?.message || resp?.error || '未知错误'}`);
      } else {
        setStatus('功能位27已切换', 'success');
        // Refresh UI to reflect changes without reloading the page
        readCurrentStorage();
      }
    });
  });
  toggleIsNeedTipsButton.addEventListener('click', () => {
    chrome.tabs.sendMessage(currentTabId, { action: 'TOGGLE_CURRENT_USER_IS_NEED_TIPS' }, (resp) => {
      if (chrome.runtime.lastError || !resp?.success) {
        alert(`操作失败: ${chrome.runtime.lastError?.message || resp?.error || '未知错误'}`);
      } else {
        setStatus('isNeedTips 已切换', 'success');
        readCurrentStorage();
      }
    });
  });
  document.getElementById('btn-save').addEventListener('click', saveToPage);
  document.getElementById('btn-delete-current').addEventListener('click', deleteCurrent);
  document.getElementById('btn-format-json').addEventListener('click', formatCurrentJson);
  document.getElementById('btn-add-current').addEventListener('click', addEntry);
  document.getElementById('btn-expand-all').addEventListener('click', expandAllJson);
  document.getElementById('btn-collapse-all').addEventListener('click', collapseJsonToFirstLevel);
  document.getElementById('store-search').addEventListener('input', renderKeyList);

  document.querySelectorAll('.store-tab').forEach((button) => {
    button.addEventListener('click', () => switchStore(button.dataset.store));
  });

  document.addEventListener('click', (event) => {
    const item = event.target.closest('.key-item');
    if (item) {
      selectKey(item.dataset.store, item.dataset.key);
      return;
    }

    const toggle = event.target.closest('.json-toggle');
    if (toggle) {
      toggleJsonPath(toggle.dataset.path);
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.classList.contains('json-value-input')) {
      const path = event.target.dataset.path;
      const type = document.querySelector(`.json-type-select[data-path="${CSS.escape(path)}"]`).value;
      updateJsonLeaf(path, event.target.value, type);
    }
  });

  document.addEventListener('change', (event) => {
    if (event.target.classList.contains('json-type-select')) {
      updateJsonLeafType(event.target.dataset.path, event.target.value);
    }
  });
});

if (typeof module !== 'undefined') {
  module.exports = { escapeHtml, normalizeStore, parseStructuredJson };
}
