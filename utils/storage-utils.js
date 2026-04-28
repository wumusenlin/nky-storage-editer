// utils/storage-utils.js
// Helper functions for capturing and applying storage snapshots

export async function captureSnapshot() {
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
  return { localStorage: local, sessionStorage: session };
}

export async function applySnapshot(snapshot) {
  try {
    localStorage.clear();
    sessionStorage.clear();
    const { localStorage: ls = {}, sessionStorage: ss = {} } = snapshot;
    Object.entries(ls).forEach(([k, v]) => {
      try { localStorage.setItem(k, v); } catch (_) {}
    });
    Object.entries(ss).forEach(([k, v]) => {
      try { sessionStorage.setItem(k, v); } catch (_) {}
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
