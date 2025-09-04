/**
 * Waits for a selector to appear in the DOM.
 * @param {string} selector The CSS selector to wait for.
 * @param {object} [options]
 * @param {Element} [options.root=document] The root element to search within.
 * @param {number} [options.timeout=5000] The timeout in milliseconds.
 * @returns {Promise<Element>} A promise that resolves with the found element.
 */
function waitForSelector(selector, { root = document, timeout = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const el = root.querySelector(selector);
    if (el) {
      resolve(el);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector);
      if (el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`waitForSelector: timed out for selector "${selector}"`));
    }, timeout);
  });
}

/**
 * Waits for an element to be enabled.
 * @param {HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement} element The element to wait for.
 * @param {number} [timeout=3000] The timeout in milliseconds.
 * @returns {Promise<void>} A promise that resolves when the element is enabled.
 */
function waitForEnabled(element, timeout = 3000) {
    return new Promise((resolve, reject) => {
        if (!element.disabled) {
            return resolve();
        }

        const observer = new MutationObserver(() => {
            if (!element.disabled) {
                observer.disconnect();
                clearTimeout(timer);
                resolve();
            }
        });

        observer.observe(element, { attributes: true, attributeFilter: ['disabled'] });

        const timer = setTimeout(() => {
            observer.disconnect();
            reject(new Error(`waitForEnabled: timed out for element ${element.id || element.className}`));
        }, timeout);
    });
}

/**
 * A simple sleep/delay function.
 * @param {number} ms The number of milliseconds to sleep.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Displays a toast notification on the page.
 * @param {string} message The message to display.
 * @param {number} [duration=3000] The duration in milliseconds.
 * @param {'info' | 'success' | 'error'} [type='info'] The type of toast.
 */
function showToast(message, duration = 3000, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `yamatan-toast yamatan-toast-${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .yamatan-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 16px;
      font-family: sans-serif;
      z-index: 9999;
      color: white;
      opacity: 0;
      transition: opacity 0.3s, transform 0.3s;
      transform: translateY(-20px);
      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    }
    .yamatan-toast-info { background-color: #3498db; }
    .yamatan-toast-success { background-color: #2ecc71; }
    .yamatan-toast-error { background-color: #e74c3c; }
  `;
  document.head.appendChild(style);

  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  // Animate out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      toast.remove();
      style.remove();
    }, 300);
  }, duration);
}

/**
 * Loads settings from chrome.storage.sync.
 * @returns {Promise<{q1: string, q2: string, q3: string, q4: string}>}
 */
function loadSettings() {
  return new Promise((resolve) => {
    const defaultSettings = {
      q1: '',
      q2: '',
      q3: '',
      q4: '',
      maleGuests: 1,
      femaleGuests: 0,
      finalizeBooking: true
    };
    chrome.storage.sync.get({ yamatanSettings: defaultSettings }, (items) => {
      // Ensure the returned settings object has all keys from the default
      const settings = { ...defaultSettings, ...items.yamatanSettings };
      resolve(settings);
    });
  });
}
