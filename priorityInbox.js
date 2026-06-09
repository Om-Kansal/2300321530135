const API_URL = "http://4.224.186.213/evaluation-service/notifications";
const TOP_N = 10;

const AUTH_TOKEN = "YOUR_ACTUAL_TOKEN_HERE";

const TYPE_WEIGHTS = {
  "Placement": 3,
  "Result": 2,
  "Event": 1
};


function parseTimestamp(timestampStr) {
  if (!timestampStr) return 0;
  const isoString = timestampStr.replace(" ", "T");
  const timeMs = Date.parse(isoString);
  return isNaN(timeMs) ? 0 : timeMs;
}

function compareNotifications(a, b) {
  const weightA = TYPE_WEIGHTS[a.Type] || 0;
  const weightB = TYPE_WEIGHTS[b.Type] || 0;

  if (weightB !== weightA) {
    return weightB - weightA;
  }

  // 2. Secondary tie-breaker: Recency (Newest Timestamp Descending)
  return parseTimestamp(b.Timestamp) - parseTimestamp(a.Timestamp);
}


async function getTopPriorityNotifications(n = 10) {
  console.log("Fetching notifications from API...");
  try {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${AUTH_TOKEN}`,
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const payload = await response.json();
    return payload.notifications || [];

  } catch (error) {
    console.error(`\n[API Red Flag] Failed to fetch live data: ${error.message}`);
    console.log("Switching to mock data pipeline for local validation...\n");
    
    // Fallback Mock Dataset from your exact specification pages to guarantee execution works
    return [
      { "ID": "notif_01", "Type": "Result", "Message": "mid-sem", "Timestamp": "2026-04-22 17:51:30" },
      { "ID": "notif_02", "Type": "Placement", "Message": "CSX Corporation hiring", "Timestamp": "2026-04-22 17:51:18" },
      { "ID": "notif_03", "Type": "Event", "Message": "farewell", "Timestamp": "2026-04-22 17:51:06" },
      { "ID": "notif_04", "Type": "Result", "Message": "mid-sem", "Timestamp": "2026-04-22 17:50:54" },
      { "ID": "notif_05", "Type": "Result", "Message": "project-review", "Timestamp": "2026-04-22 17:50:42" },
      { "ID": "notif_06", "Type": "Result", "Message": "external", "Timestamp": "2026-04-22 17:50:30" },
      { "ID": "notif_07", "Type": "Result", "Message": "project-review", "Timestamp": "2026-04-22 17:50:18" },
      { "ID": "notif_08", "Type": "Event", "Message": "tech-fest", "Timestamp": "2026-04-22 17:50:06" },
      { "ID": "notif_09", "Type": "Result", "Message": "project-review", "Timestamp": "2026-04-22 17:49:54" },
      { "ID": "notif_10", "Type": "Placement", "Message": "Advanced Micro Devices Inc. hiring", "Timestamp": "2026-04-22 17:49:42" }
    ];
  }
}

// Execution block
(async () => {
  const notifications = await getTopPriorityNotifications(TOP_N);

  notifications.sort(compareNotifications);

  const topNotifications = notifications.slice(0, TOP_N);

  console.log(`--- TOP ${topNotifications.length} PRIORITY NOTIFICATIONS ---`);
  topNotifications.forEach((notif, index) => {
    console.log(`${index + 1}. [${notif.Type}] (Time: ${notif.Timestamp}) -> ${notif.Message}`);
  });
})();