const HISTORY_SHEET_NAME = "history_backups";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const sheet = getHistorySheet_();
    const history = payload.history || {};
    const questions = history.questions || {};
    const daily = history.daily || {};

    sheet.appendRow([
      new Date(),
      payload.savedAt || "",
      payload.userName || "",
      payload.deviceId || "",
      payload.appVersion || "",
      Object.keys(questions).length,
      Object.keys(daily).length,
      JSON.stringify(history),
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getHistorySheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(HISTORY_SHEET_NAME) || spreadsheet.insertSheet(HISTORY_SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "receivedAt",
      "savedAt",
      "userName",
      "deviceId",
      "appVersion",
      "questionCount",
      "dailyCount",
      "historyJson",
    ]);
  }

  return sheet;
}
