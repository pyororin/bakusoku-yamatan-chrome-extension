/**
 * Saves options to chrome.storage.sync.
 */
const saveOptions = () => {
  const q1 = document.getElementById('q1').value;
  const q2 = document.getElementById('q2').value;
  const q3 = document.getElementById('q3').value;
  const q4 = document.getElementById('q4').value;
  const maleGuests = parseInt(document.getElementById('male-guests').value, 10);
  const femaleGuests = parseInt(document.getElementById('female-guests').value, 10);
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
      yamatanSettings: { q1, q2, q3, q4, maleGuests, femaleGuests, finalizeBooking }
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
  const defaultSettings = {
    q1: '', q2: '', q3: '', q4: '',
    maleGuests: 1, femaleGuests: 0,
    finalizeBooking: true
  };
  chrome.storage.sync.get({ yamatanSettings: defaultSettings }, (items) => {
    const settings = { ...defaultSettings, ...items.yamatanSettings };
    document.getElementById('q1').value = settings.q1;
    document.getElementById('q2').value = settings.q2;
    document.getElementById('q3').value = settings.q3;
    document.getElementById('q4').value = settings.q4;
    document.getElementById('male-guests').value = settings.maleGuests;
    document.getElementById('female-guests').value = settings.femaleGuests;
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
        document.getElementById('male-guests').value = settings.maleGuests || 1;
        document.getElementById('female-guests').value = settings.femaleGuests || 0;
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
        document.getElementById('male-guests').value = 1;
        document.getElementById('female-guests').value = 0;
        document.getElementById('finalize').checked = true; // Reset to default

        saveOptions(); // This will save the cleared/default values

        const status = document.getElementById('status');
        status.textContent = '全設定をクリアしました。';
        status.style.color = '#3498db';
        setTimeout(() => {
            status.textContent = '';
            status.style.color = '';
        }, 2000);
    }
};


/**
 * Handles the prerequisite check button click.
 */
const handlePrerequisiteCheck = () => {
  const checkButton = document.getElementById('check-prerequisites');
  const resultsArea = document.getElementById('prerequisites-results');

  // Disable button and show checking status
  checkButton.disabled = true;
  checkButton.textContent = 'チェック中...';
  resultsArea.style.display = 'block';
  resultsArea.innerHTML = `<p class="result-checking">マイページを確認しています...</p>`;

  chrome.runtime.sendMessage({ action: 'checkPrerequisites' }, (response) => {
    // Re-enable button
    checkButton.disabled = false;
    checkButton.textContent = '登録状況を再チェック';

    if (response && response.success) {
      const { profile, card } = response;
      let resultsHTML = '';

      // Profile check result
      if (profile.isProfileComplete) {
        resultsHTML += `<p><span class="result-icon result-ok">✔</span> プロフィール: 必須項目はすべて登録済みです。</p>`;
      } else {
        resultsHTML += `<p><span class="result-icon result-error">✖</span> プロフィール: 未入力の項目があります。(不足項目: ${profile.missingFields.join(', ') || '不明'})</p>`;
      }

      // Card check result
      if (card.hasCard) {
        resultsHTML += `<p><span class="result-icon result-ok">✔</span> クレジットカード: 登録済みです。</p>`;
      } else {
        resultsHTML += `<p><span class="result-icon result-error">✖</span> クレジットカード: 未登録です。</p>`;
      }
      resultsArea.innerHTML = resultsHTML;

    } else {
      // Handle errors, e.g., if the user is not logged in
      const errorMessage = response?.error || '不明なエラーが発生しました。やまたんのサイトにログインしているか確認してください。';
      resultsArea.innerHTML = `<p class="result-error">✖ チェックに失敗しました: ${errorMessage}</p>`;
    }
  });
};


document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('export-settings').addEventListener('click', exportSettings);
document.getElementById('import-settings-input').addEventListener('change', importSettings);
document.getElementById('clear-settings').addEventListener('click', clearSettings);
document.getElementById('check-prerequisites').addEventListener('click', handlePrerequisiteCheck);
