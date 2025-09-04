// == STATE & CONFIG ==
let isProcessing = false;
const RETRY_COUNT = 2;
const RETRY_DELAY = 500;

// == CORE LOGIC ==

/**
 * Retries a promise-returning function.
 * @param {() => Promise<any>} fn The function to retry.
 * @param {number} retries Number of retries left.
 * @param {number} delay Milliseconds to wait before retrying.
 * @returns {Promise<any>}
 */
async function retry(fn, retries = RETRY_COUNT, delay = RETRY_DELAY) {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0) {
      console.warn(`[Yamatan] Retrying... attempts left: ${retries}`, err.message);
      await sleep(delay);
      return retry(fn, retries - 1, delay);
    } else {
      console.error('[Yamatan] All retries failed.', err);
      throw err;
    }
  }
}

/**
 * Checks if the user is logged in by looking for the logout link.
 * @returns {boolean} True if logged in, false otherwise.
 */
function isLoggedIn() {
  const logoutLink = document.querySelector('li.SideNavMenuHut_nav__item__Pe6Js a');
  return logoutLink?.textContent?.trim() === 'ログアウト';
}

/**
 * Automates the booking dialog: plan selection, guest count.
 */
async function handleDialogFlow() {
  console.info('[Yamatan] Starting dialog flow...');
  const form = await waitForSelector('div[role="dialog"][data-state="open"] form', { timeout: 8000 });

  // 1. Select the plan (2nd option)
  const planSelectId = 'ReservationToPlan\\[0\\]\\.planIdSlect';
  const planSelect = form.querySelector(`#${planSelectId}`);
  if (planSelect) {
    planSelect.selectedIndex = Math.min(1, planSelect.options.length - 1);
    planSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(120 + Math.random() * 60);
    console.info('[Yamatan] Plan selected.');
  } else {
    console.warn('[Yamatan] Plan selection dropdown not found.');
  }

  // 2. Add 4 adult males
  const plusButtonId = 'ReservationToPlan\\[0\\]\\.guests\\[0\\]\\.maleGuestNum-plus';
  const plusButton = form.querySelector(`#${plusButtonId}`);
  if (!plusButton) throw new Error('Guest increment button not found.');

  console.info('[Yamatan] Adding 4 guests...');
  for (let i = 0; i < 4; i++) {
    await waitForEnabled(plusButton, 3000);
    plusButton.click();
    console.info(`[Yamatan] Guest ${i + 1} added.`);
    await sleep(90 + Math.random() * 60);
  }

  // 3. Submit to confirmation page
  const submitButton = form.querySelector('#submitBtn');
  if (!submitButton) throw new Error('Dialog submit button not found.');

  await waitForEnabled(submitButton, 5000);
  console.info('[Yamatan] Clicking "Proceed to reservation"...');
  submitButton.click();
}

/**
 * Automates the confirmation page: fills in answers and submits.
 * @param {{q1: string, q2: string, q3: string, q4: string}} settings
 */
async function handleConfirmPage(settings) {
  console.info('[Yamatan] Starting confirmation page flow...');

  // Wait for the first textarea to ensure the page is loaded
  await waitForSelector('textarea[data-test-id="answer-0"]', { timeout: 10000 });

  const textareas = {
    q1: document.querySelector('textarea[data-test-id="answer-0"]'),
    q2: document.querySelector('textarea[data-test-id="answer-1"]'),
    q3: document.querySelector('textarea[data-test-id="answer-2"]'),
    q4: document.querySelector('textarea[data-test-id="answer-3"]'),
  };

  if (!textareas.q1 || !textareas.q2 || !textareas.q3) {
    throw new Error('One or more textareas not found on confirmation page.');
  }

  console.info('[Yamatan] Filling in answers...');
  textareas.q1.value = settings.q1;
  textareas.q2.value = settings.q2;
  textareas.q3.value = settings.q3;
  if(textareas.q4) textareas.q4.value = settings.q4;

  // Dispatch 'input' event to make sure frontend frameworks detect the change
  Object.values(textareas).forEach(el => el?.dispatchEvent(new Event('input', { bubbles: true })));

  // Click the final confirmation button
  const finalButton = await waitForSelector('button[type="submit"].mx-4.mt-4', { timeout: 8000 });
  await waitForEnabled(finalButton, 5000);

  if (settings.finalizeBooking) {
    console.info('[Yamatan] Finalize booking is enabled. Clicking final confirmation button.');
    finalButton.click();
  } else {
    console.info('[Yamatan] Finalize booking is disabled. Skipping final submission.');
    showToast('デバッグモード: 最終予約はスキップされました。', 4000, 'info');
  }
}


/**
 * Handles the click event for the "Instant Book" button.
 * This is the entry point for the main automation flow.
 * @param {MouseEvent} ev The click event.
 */
async function onInstantReserveClick(ev) {
  ev.preventDefault();
  ev.stopPropagation();

  if (isProcessing) {
    showToast('現在、別の予約処理が進行中です。', 3000, 'info');
    return;
  }
  isProcessing = true;

  const button = ev.currentTarget;
  const originalText = button.textContent;
  button.textContent = '処理中...';
  button.style.backgroundColor = '#7f8c8d';

  try {
    const settings = await loadSettings();
    if (!settings.q1 || !settings.q2 || !settings.q3) {
      throw new Error('予約設定が不完全です。オプションページでQ1〜Q3を設定してください。');
    }

    // Click the original calendar link to open the dialog
    const harness = button.closest('.fc-daygrid-event-harness');
    harness?.querySelector('a.fc-event')?.click();

    await retry(async () => {
        await handleDialogFlow();
        await handleConfirmPage(settings);
    });

    showToast('予約リクエストが正常に送信されました！', 5000, 'success');
  } catch (e) {
    console.error('[Yamatan] Automation failed:', e);
    showToast(`自動処理に失敗: ${e.message}`, 5000, 'error');
  } finally {
    button.textContent = originalText;
    button.style.backgroundColor = '#e74c3c';
    isProcessing = false;
  }
}

/**
 * Finds available calendar slots and injects the "Instant Book" button.
 */
function tryInjectInstantButtons() {
  console.log('[Yamatan Debug] Running tryInjectInstantButtons...');

  if (!isLoggedIn()) {
    console.log('[Yamatan Debug] Not logged in. Aborting.');
    return;
  }
  console.log('[Yamatan Debug] User is logged in.');

  const eventHarnesses = document.querySelectorAll('.fc-daygrid-event-harness');
  console.log(`[Yamatan Debug] Found ${eventHarnesses.length} event harnesses.`);

  if (eventHarnesses.length === 0) {
    console.log('[Yamatan Debug] No event harnesses found on the page.');
  }

  eventHarnesses.forEach((harness, index) => {
    const logPrefix = `[Yamatan Debug] Harness #${index}:`;

    if (harness.querySelector('.yamatan-instant-reserve-btn')) {
      console.log(`${logPrefix} Button already exists. Skipping.`);
      return;
    }

    const titleEl = harness.querySelector('.fc-event-title.fc-sticky');
    if (!titleEl) {
      console.log(`${logPrefix} No title element found. Skipping.`);
      return;
    }

    const titleText = titleEl.textContent?.trim() ?? '';
    console.log(`${logPrefix} Found title text: "${titleText}"`);

    if (titleText.startsWith('○/')) {
      console.log(`${logPrefix} Title matches "○/". Injecting button.`);

      harness.style.position = 'relative';

      const btn = document.createElement('a');
      btn.textContent = '即予約';
      btn.href = '#';
      btn.className = 'yamatan-instant-reserve-btn';
      btn.dataset.yamatanInstant = '1';

      Object.assign(btn.style, {
        position: 'absolute',
        top: '1px',
        right: '1px',
        zIndex: '10',
        padding: '1px 4px',
        backgroundColor: 'rgba(231, 76, 60, 0.9)',
        color: 'white',
        borderRadius: '3px',
        fontSize: '10px',
        fontWeight: 'bold',
        textDecoration: 'none',
        cursor: 'pointer',
        border: '1px solid rgba(255, 255, 255, 0.5)'
      });

      btn.addEventListener('click', onInstantReserveClick);

      harness.appendChild(btn);
      console.log(`${logPrefix} Button injected successfully.`);
    } else {
      console.log(`${logPrefix} Title does not match. No action taken.`);
    }
  });
  console.log('[Yamatan Debug] Finished tryInjectInstantButtons run.');
}

// == MAIN EXECUTION & OBSERVER ==
function main() {
    console.log('Yamatan-Bakusoku: Content script loaded and observing.');

    // Initial check when the script loads
    tryInjectInstantButtons();

    // Set up a MutationObserver to watch for DOM changes
    const observer = new MutationObserver(() => {
        tryInjectInstantButtons();
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

main();
