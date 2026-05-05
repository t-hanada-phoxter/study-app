const LOG_SHEET_NAME = "history_backup_log";
const QUESTION_SHEET_NAME = "history_questions";
const DAILY_SHEET_NAME = "history_daily";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const receivedAt = new Date();

    const questionRows = buildQuestionRows_(payload, receivedAt);
    const dailyRows = buildDailyRows_(payload, receivedAt);

    appendRows_(getSheet_(spreadsheet, QUESTION_SHEET_NAME, questionHeaders_()), questionRows);
    appendRows_(getSheet_(spreadsheet, DAILY_SHEET_NAME, dailyHeaders_()), dailyRows);
    appendRows_(getSheet_(spreadsheet, LOG_SHEET_NAME, logHeaders_()), [[
      receivedAt,
      payload.savedAt || "",
      payload.type || "",
      payload.userName || "",
      payload.deviceId || "",
      payload.appVersion || "",
      questionRows.length,
      dailyRows.length,
    ]]);

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

function buildQuestionRows_(payload, receivedAt) {
  const rows = [];
  const changes = payload.changes || [];
  const snapshotQuestions = payload.fullSnapshot ? payload.fullSnapshot.questions || [] : [];

  changes.forEach((change) => {
    if (change.questionId && change.questionHistory) {
      rows.push(questionRow_(payload, receivedAt, change.questionId, change.questionHistory, change.answer || null));
    }
  });

  snapshotQuestions.forEach((item) => {
    if (item.questionId && item.questionHistory) {
      rows.push(questionRow_(payload, receivedAt, item.questionId, item.questionHistory, null));
    }
  });

  return rows;
}

function buildDailyRows_(payload, receivedAt) {
  const rows = [];
  const seen = {};
  const changes = payload.changes || [];
  const snapshotDaily = payload.fullSnapshot ? payload.fullSnapshot.daily || [] : [];

  changes.forEach((change) => {
    if (change.daily && change.daily.date) seen[change.daily.date] = change.daily.stats || {};
  });

  snapshotDaily.forEach((item) => {
    if (item.date) seen[item.date] = item.stats || {};
  });

  Object.keys(seen).forEach((date) => {
    const stats = seen[date] || {};
    rows.push([
      receivedAt,
      payload.savedAt || "",
      payload.userName || "",
      payload.deviceId || "",
      date,
      stats.studied || 0,
      stats.correct || 0,
      stats.wrong || 0,
      stats.quick || 0,
      stats.slow || 0,
      stats.hesitated || 0,
    ]);
  });

  return rows;
}

function questionRow_(payload, receivedAt, questionId, item, answer) {
  return [
    receivedAt,
    payload.savedAt || "",
    payload.userName || "",
    payload.deviceId || "",
    questionId,
    item.correct || 0,
    item.wrong || 0,
    item.lastResult || "",
    item.streak || 0,
    item.bestStreak || 0,
    item.mastered === true,
    item.reviewLevel || 0,
    item.intervalDays || 0,
    item.ease || 0,
    item.weakWeight || 0,
    item.nextReviewAt || "",
    item.firstAnsweredAt || "",
    item.lastAnsweredAt || "",
    item.answeredCount || 0,
    item.quickCount || 0,
    item.slowCount || 0,
    item.lastSlow === true,
    item.hesitatedCount || 0,
    item.responseTimeTotalMs || 0,
    answer ? answer.isCorrect === true : "",
    answer ? answer.responseTimeMs || 0 : "",
    answer ? answer.hesitated === true : "",
  ];
}

function getSheet_(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;
}

function appendRows_(sheet, rows) {
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function questionHeaders_() {
  return [
    "receivedAt",
    "savedAt",
    "userName",
    "deviceId",
    "questionId",
    "correct",
    "wrong",
    "lastResult",
    "streak",
    "bestStreak",
    "mastered",
    "reviewLevel",
    "intervalDays",
    "ease",
    "weakWeight",
    "nextReviewAt",
    "firstAnsweredAt",
    "lastAnsweredAt",
    "answeredCount",
    "quickCount",
    "slowCount",
    "lastSlow",
    "hesitatedCount",
    "responseTimeTotalMs",
    "answerIsCorrect",
    "answerResponseTimeMs",
    "answerHesitated",
  ];
}

function dailyHeaders_() {
  return [
    "receivedAt",
    "savedAt",
    "userName",
    "deviceId",
    "date",
    "studied",
    "correct",
    "wrong",
    "quick",
    "slow",
    "hesitated",
  ];
}

function logHeaders_() {
  return [
    "receivedAt",
    "savedAt",
    "type",
    "userName",
    "deviceId",
    "appVersion",
    "questionRows",
    "dailyRows",
  ];
}
