// This is a placeholder for the scraper functions that will be defined in the next step.
// I'm including them here to make the code runnable.
const scrapeFunctions = {
  checkProfile: () => {
    const requiredInputs = Array.from(document.querySelectorAll('input[required], select[required]'));
    const passportInput = document.querySelector('input[name="passport"]');
    let isProfileComplete = true;
    const missingFields = [];

    requiredInputs.forEach(input => {
      if (input === passportInput) return; // Skip passport as requested
      if (!input.value) {
        isProfileComplete = false;
        missingFields.push(input.name);
      }
    });
    return { isProfileComplete, missingFields };
  },
  checkCard: () => {
    // This function is injected into the target page, so it must be self-contained.
    // It includes its own waitForSelector to handle dynamically loaded content.
    return (async () => {
        const waitForSelector = (selector, { root = document, timeout = 3000 } = {}) => {
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
                observer.observe(root, { childList: true, subtree: true });
                const timer = setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`waitForSelector: timed out for selector "${selector}"`));
                }, timeout);
            });
        };

        try {
            // Wait for the element to appear in the DOM before checking
            await waitForSelector('.LabelValueList_value__oFMk5');

            const cardValues = Array.from(document.querySelectorAll('.LabelValueList_value__oFMk5'));
            const hasCardNumber = cardValues.some(el => el.textContent.includes('****'));
            return { hasCard: hasCardNumber };
        } catch (e) {
            // If waitForSelector times out, it means no card info was found.
            console.warn(`[Yamatan] Card check failed: ${e.message}`);
            return { hasCard: false };
        }
    })();
  }
};


/**
 * Injects a scraper function into a new, temporary tab and returns the result.
 * @param {string} url The URL of the page to open.
 * @param {Function} scraperFn The function to inject and execute.
 * @returns {Promise<any>} The result of the scraper function.
 */
async function scrapePage(url, scraperFn) {
  let tab;
  try {
    tab = await chrome.tabs.create({ url, active: false });

    // Wait for the tab to finish loading
    await new Promise(resolve => {
      const listener = (tabId, changeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scraperFn,
    });

    // executeScript returns an array of results, we want the first one
    return results[0].result;
  } catch (error) {
    console.error(`[Yamatan] Error scraping ${url}:`, error);
    throw error; // Re-throw to be caught by the message listener
  } finally {
    if (tab) {
      await chrome.tabs.remove(tab.id);
    }
  }
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkPrerequisites') {
    (async () => {
      try {
        const [profileResult, cardResult] = await Promise.all([
          scrapePage('https://www.yamatan.net/user/mypage/profile', scrapeFunctions.checkProfile),
          scrapePage('https://www.yamatan.net/user/mypage/card', scrapeFunctions.checkCard)
        ]);

        sendResponse({ success: true, profile: profileResult, card: cardResult });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Indicates that the response is sent asynchronously
  }
});
