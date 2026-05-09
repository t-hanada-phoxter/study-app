const LOG_SHEET_NAME = "history_backup_log";
const BATCH_SHEET_NAME = "history_backup_batches";
const QUESTION_SHEET_NAME = "history_questions";
const DAILY_SHEET_NAME = "history_daily";
const SCRIPT_VERSION = "history-batch-backup-v3";

function doGet(e) {
  const userName = e && e.parameter ? String(e.parameter.userName || "").trim() : "";
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (userName) {
    return jsonOutput_(e, {
      ok: true,
      version: SCRIPT_VERSION,
      userName,
      history: buildHistoryForUser_(spreadsheet, userName),
    });
  }

  return jsonOutput_(e, {
    ok: true,
    version: SCRIPT_VERSION,
    sheets: [BATCH_SHEET_NAME, LOG_SHEET_NAME],
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const receivedAt = new Date();

    if (payload.type === "history_replace") {
      replaceRowsForUser_(spreadsheet, payload.userName || "");
    }

    const history = normalizeHistory_(payload.history || historyFromPayload_(payload));
    const questionCount = Object.keys(history.questions || {}).length;
    const dailyCount = Object.keys(history.daily || {}).length;
    const isMeaningfulEmpty = payload.type === "history_replace";
    if (!isMeaningfulEmpty && questionCount === 0 && dailyCount === 0) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, skipped: true, reason: "empty payload" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const historyJson = JSON.stringify(history);

    appendRows_(getSheet_(spreadsheet, BATCH_SHEET_NAME, batchHeaders_()), [[
      receivedAt,
      payload.savedAt || "",
      payload.userName || "",
      payload.deviceId || "",
      payload.appVersion || "",
      questionCount,
      dailyCount,
      historyJson,
    ]]);
    appendRows_(getSheet_(spreadsheet, LOG_SHEET_NAME, logHeaders_()), [[
      receivedAt,
      payload.savedAt || "",
      payload.type || "",
      payload.userName || "",
      payload.deviceId || "",
      payload.appVersion || "",
      questionCount,
      0,
      dailyCount,
      historyJson.slice(0, 45000),
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

function jsonOutput_(e, payload) {
  const callback = e && e.parameter ? String(e.parameter.callback || "").trim() : "";
  const json = JSON.stringify(payload);

  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeHistory_(history) {
  return {
    questions: history && typeof history.questions === "object" ? history.questions : {},
    daily: history && typeof history.daily === "object" ? history.daily : {},
  };
}

function historyFromPayload_(payload) {
  const history = { questions: {}, daily: {} };
  const snapshot = payload.fullSnapshot || null;

  if (snapshot) {
    (snapshot.questions || []).forEach((item) => {
      if (item.questionId && item.questionHistory) {
        history.questions[item.questionId] = item.questionHistory;
      }
    });
    (snapshot.daily || []).forEach((item) => {
      if (item.date) history.daily[item.date] = item.stats || {};
    });
  }

  (payload.changes || []).forEach((change) => {
    if (change.questionId && change.questionHistory) {
      history.questions[change.questionId] = change.questionHistory;
    }
    if (change.daily && change.daily.date) {
      history.daily[change.daily.date] = change.daily.stats || {};
    }
  });

  return history;
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

function replaceRowsForUser_(spreadsheet, userName) {
  if (!userName) return;
  removeRowsForUser_(getSheet_(spreadsheet, BATCH_SHEET_NAME, batchHeaders_()), userName);
  removeRowsForUser_(getSheet_(spreadsheet, QUESTION_SHEET_NAME, questionHeaders_()), userName);
  removeRowsForUser_(getSheet_(spreadsheet, DAILY_SHEET_NAME, dailyHeaders_()), userName);
}

function removeRowsForUser_(sheet, userName) {
  if (!sheet || sheet.getLastRow() < 2) return;

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const index = headerIndex_(headers);
  const kept = [headers].concat(values.slice(1).filter((row) => String(row[index.userName] || "") !== userName));

  sheet.clearContents();
  sheet.getRange(1, 1, kept.length, kept[0].length).setValues(kept);
}

function buildHistoryForUser_(spreadsheet, userName) {
  const batchHistory = buildBatchHistoryForUser_(spreadsheet, userName);
  if (Object.keys(batchHistory.questions).length || Object.keys(batchHistory.daily).length) return batchHistory;

  const resetAfter = latestResetTimeForUser_(spreadsheet, userName);
  return {
    questions: buildQuestionHistoryForUser_(spreadsheet, userName, resetAfter),
    daily: buildDailyHistoryForUser_(spreadsheet, userName, resetAfter),
  };
}

function buildBatchHistoryForUser_(spreadsheet, userName) {
  const sheet = spreadsheet.getSheetByName(BATCH_SHEET_NAME);
  const history = { questions: {}, daily: {} };
  if (!sheet || sheet.getLastRow() < 2) return history;

  const values = sheet.getDataRange().getValues();
  values.shift();

  values.forEach((row) => {
    if (String(row[2] || "").trim() !== userName) return;

    const payloadJson = String(row[7] || "");
    if (!payloadJson) return;

    let payload;
    try {
      payload = JSON.parse(payloadJson);
    } catch (error) {
      return;
    }

    if (payload.questions || payload.daily) {
      const normalized = normalizeHistory_(payload);
      history.questions = normalized.questions;
      history.daily = normalized.daily;
      return;
    }

    if (payload.history) {
      const normalized = normalizeHistory_(payload.history);
      history.questions = normalized.questions;
      history.daily = normalized.daily;
      return;
    }

    if (payload.type === "history_replace" || payload.type === "history_snapshot") {
      history.questions = {};
      history.daily = {};
    }

    const snapshot = payload.fullSnapshot || null;
    if (snapshot) {
      (snapshot.questions || []).forEach((item) => {
        if (item.questionId && item.questionHistory) {
          history.questions[item.questionId] = item.questionHistory;
        }
      });
      (snapshot.daily || []).forEach((item) => {
        if (item.date) history.daily[item.date] = item.stats || {};
      });
    }

    (payload.changes || []).forEach((change) => {
      if (change.questionId && change.questionHistory) {
        history.questions[change.questionId] = change.questionHistory;
      }
      if (change.daily && change.daily.date) {
        history.daily[change.daily.date] = change.daily.stats || {};
      }
    });
  });

  return history;
}

function buildQuestionHistoryForUser_(spreadsheet, userName, resetAfter) {
  const sheet = spreadsheet.getSheetByName(QUESTION_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return {};

  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const index = headerIndex_(headers);
  const questions = {};

  values.forEach((row) => {
    if (String(row[index.userName] || "") !== userName) return;
    if (resetAfter && dateValue_(row[index.receivedAt]) <= resetAfter) return;
    const questionId = String(row[index.questionId] || "");
    if (!questionId) return;

    questions[questionId] = {
      correct: numberValue_(row[index.correct]),
      wrong: numberValue_(row[index.wrong]),
      lastResult: String(row[index.lastResult] || ""),
      streak: numberValue_(row[index.streak]),
      bestStreak: numberValue_(row[index.bestStreak]),
      mastered: boolValue_(row[index.mastered]),
      reviewLevel: numberValue_(row[index.reviewLevel]),
      intervalDays: numberValue_(row[index.intervalDays]),
      ease: numberValue_(row[index.ease]) || 2.2,
      weakWeight: numberValue_(row[index.weakWeight]),
      nextReviewAt: dateText_(row[index.nextReviewAt]),
      firstAnsweredAt: dateText_(row[index.firstAnsweredAt]),
      lastAnsweredAt: dateText_(row[index.lastAnsweredAt]),
      answeredCount: numberValue_(row[index.answeredCount]),
      quickCount: numberValue_(row[index.quickCount]),
      slowCount: numberValue_(row[index.slowCount]),
      lastSlow: boolValue_(row[index.lastSlow]),
      hesitatedCount: numberValue_(row[index.hesitatedCount]),
      responseTimeTotalMs: numberValue_(row[index.responseTimeTotalMs]),
    };
  });

  return questions;
}

function buildDailyHistoryForUser_(spreadsheet, userName, resetAfter) {
  const sheet = spreadsheet.getSheetByName(DAILY_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return {};

  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const index = headerIndex_(headers);
  const daily = {};

  values.forEach((row) => {
    if (String(row[index.userName] || "") !== userName) return;
    if (resetAfter && dateValue_(row[index.receivedAt]) <= resetAfter) return;
    const date = dateText_(row[index.date]);
    if (!date) return;

    daily[date] = {
      studied: numberValue_(row[index.studied]),
      correct: numberValue_(row[index.correct]),
      wrong: numberValue_(row[index.wrong]),
      quick: numberValue_(row[index.quick]),
      slow: numberValue_(row[index.slow]),
      hesitated: numberValue_(row[index.hesitated]),
    };
  });

  return daily;
}

function latestResetTimeForUser_(spreadsheet, userName) {
  const sheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  const index = headerIndex_(headers);
  let latest = null;

  values.forEach((row) => {
    if (String(row[index.userName] || "") !== userName) return;
    if (String(row[index.type] || "") !== "history_snapshot") return;
    if (numberValue_(row[index.changeCount]) !== 0 || numberValue_(row[index.snapshotQuestionCount]) !== 0) return;

    const receivedAt = dateValue_(row[index.receivedAt]);
    if (receivedAt && (!latest || receivedAt > latest)) latest = receivedAt;
  });

  return latest;
}

function headerIndex_(headers) {
  return headers.reduce((index, header, column) => {
    index[String(header)] = column;
    return index;
  }, {});
}

function numberValue_(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function boolValue_(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function dateValue_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === "[object Date]") return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateText_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value);
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
    "changeCount",
    "snapshotQuestionCount",
    "snapshotDailyCount",
    "payloadJson",
  ];
}

function batchHeaders_() {
  return [
    "receivedAt",
    "savedAt",
    "userName",
    "deviceId",
    "appVersion",
    "questionCount",
    "dailyCount",
    "historyJson",
  ];
}
