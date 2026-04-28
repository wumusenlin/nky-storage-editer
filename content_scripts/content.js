// Content Script for NKY-Storage-Editor
// Handles READ_STORAGE and WRITE_STORAGE messages from popup

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'READ_STORAGE') {
    try {
      const local = {};
      const session = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        local[key] = localStorage.getItem(key);
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        session[key] = sessionStorage.getItem(key);
      }
      sendResponse({ localStorage: local, sessionStorage: session });
    } catch (e) {
      sendResponse({ error: e.message });
    }
    return true; // keep channel open for async response
  }

  if (msg.action === 'WRITE_STORAGE') {
    try {
      const payload = msg.payload || {};
      // Clear existing storage
      localStorage.clear();
      sessionStorage.clear();
      const { localStorage: ls = {}, sessionStorage: ss = {} } = payload;
      // Write new values, let any exception propagate to outer catch
      Object.entries(ls).forEach(([k, v]) => {
        localStorage.setItem(k, v);
      });
      Object.entries(ss).forEach(([k, v]) => {
        sessionStorage.setItem(k, v);
      });
      sendResponse({ success: true });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }

  if (msg.action === 'TOGGLE_FUNCTIONAL_27') {
    try {
      const raw = sessionStorage.getItem('CurrentUser');
      if (!raw) throw new Error('sessionStorage 中未找到 CurrentUser');
      const user = JSON.parse(raw);
      if (!user.functionals || user.functionals.length < 27) throw new Error('functionals 格式不正确或长度不足 27 位');
      const chars = user.functionals.split('');
      chars[26] = chars[26] === '0' ? '1' : '0';
      user.functionals = chars.join('');
      sessionStorage.setItem('CurrentUser', JSON.stringify(user));
      sendResponse({ success: true });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }

  if (msg.action === 'TOGGLE_CURRENT_USER_IS_NEED_TIPS') {
    try {
      const raw = sessionStorage.getItem('CurrentUser');
      if (!raw) throw new Error('sessionStorage 中未找到 CurrentUser');
      const user = JSON.parse(raw);
      if (!Array.isArray(user.accounts) || !user.accounts[0]) {
        throw new Error('CurrentUser.accounts[0] 不存在');
      }
      if (typeof user.accounts[0].isNeedTips !== 'boolean') {
        throw new Error('CurrentUser.accounts[0].isNeedTips 不是布尔值');
      }
      user.accounts[0].isNeedTips = !user.accounts[0].isNeedTips;
      sessionStorage.setItem('CurrentUser', JSON.stringify(user));
      sendResponse({ success: true });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }

  // For any other action, still return true to keep channel open (no response needed)
  return true;
});
