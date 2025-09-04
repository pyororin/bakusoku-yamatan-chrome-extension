/**
 * Saves options to chrome.storage.sync.
 */
const saveOptions = () => {
  const q1 = document.getElementById('q1').value;
  const q2 = document.getElementById('q2').value;
  const q3 = document.getElementById('q3').value;
  const q4 = document.getElementById('q4').value;
  const finalizeBooking = document.getElementById('finalize').checked;

  if (!q1 || !q2 || !q3) {
    const status = document.getElementById('status');
    status.textContent = 'エラー: Q1, Q2, Q3 は必須です。';
    status.style.color = '#e74c3c';
    setTimeout(() => {
      status.textContent = '';
      status.style.color = ''; // Reset color
    }, 3000);
    return;
  }

  chrome.storage.sync.set(
    {
      yamatanSettings: { q1, q2, q3, q4, finalizeBooking }
    },
    () => {
      // Update status to let user know options were saved.
      const status = document.getElementById('status');
      status.textContent = '設定を保存しました。';
      status.style.color = '#27ae60';
      setTimeout(() => {
        status.textContent = '';
        status.style.color = ''; // Reset color
      }, 2000);
    }
  );
};

/**
 * Restores select box and checkbox state using the preferences
 * stored in chrome.storage.
 */
const restoreOptions = () => {
  const defaultSettings = { q1: '', q2: '', q3: '', q4: '', finalizeBooking: true };
  chrome.storage.sync.get({ yamatanSettings: defaultSettings }, (items) => {
    const settings = items.yamatanSettings;
    document.getElementById('q1').value = settings.q1;
    document.getElementById('q2').value = settings.q2;
    document.getElementById('q3').value = settings.q3;
    document.getElementById('q4').value = settings.q4;
    document.getElementById('finalize').checked = settings.finalizeBooking;
  });
};

/**
 * Exports the current settings to a JSON file.
 */
const exportSettings = () => {
  chrome.storage.sync.get({ yamatanSettings: {} }, (items) => {
    const settings = items.yamatanSettings;
    const result = JSON.stringify(settings, null, 2);
    const url = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(result)));
    const a = document.createElement('a');
    a.href = url;
    a.download = `yamatan-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
};

/**
 * Imports settings from a user-selected JSON file.
 */
const importSettings = (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const settings = JSON.parse(e.target.result);
      if (settings && typeof settings.q1 !== 'undefined') {
        document.getElementById('q1').value = settings.q1 || '';
        document.getElementById('q2').value = settings.q2 || '';
        document.getElementById('q3').value = settings.q3 || '';
        document.getElementById('q4').value = settings.q4 || '';
        // Handle finalizeBooking with a default if it's missing from the imported file
        document.getElementById('finalize').checked = typeof settings.finalizeBooking === 'boolean' ? settings.finalizeBooking : true;
        saveOptions(); // Save imported settings directly
      } else {
        throw new Error('Invalid settings file format.');
      }
    } catch (error) {
      const status = document.getElementById('status');
      status.textContent = 'インポート失敗: 無効なファイルです。';
      status.style.color = '#e74c3c';
      setTimeout(() => {
        status.textContent = '';
        status.style.color = '';
      }, 3000);
    }
  };
  reader.readAsText(file);
  // Reset file input so the same file can be loaded again
  event.target.value = '';
};

/**
 * Clears all settings from the form and storage.
 */
const clearSettings = () => {
    if (confirm('本当にすべての設定を削除しますか？この操作は元に戻せません。')) {
        document.getElementById('q1').value = '';
        document.getElementById('q2').value = '';
        document.getElementById('q3').value = '';
        document.getElementById('q4').value = '';
        document.getElementById('finalize').checked = true; // Reset to default

        // The saveOptions function will clear storage effectively
        saveOptions();

        const status = document.getElementById('status');
        status.textContent = '全設定をクリアしました。';
        status.style.color = '#3498db';
        setTimeout(() => {
            status.textContent = '';
            status.style.color = '';
        }, 2000);
    }
};


document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('export-settings').addEventListener('click', exportSettings);
document.getElementById('import-settings-input').addEventListener('change', importSettings);
document.getElementById('clear-settings').addEventListener('click', clearSettings);
