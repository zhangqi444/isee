/**
 * Sheila ISEE — apply all reviewed fixes across workbooks.
 *
 * STANDALONE script: run it once, authorize once, and it patches every
 * workbook by ID. Nothing needs to be pasted into each spreadsheet.
 *
 * Source of truth: github.com/zhangqi444/learning @ mock-workbook/
 * Idempotent — re-running writes nothing that already matches.
 *
 * WHAT IT DOES
 *   1. Applies reviewed content fixes to the Mock workbook (324 cells).
 *   2. Re-randomizes answer positions so keys stop being guessable:
 *        Mock DIAGNOSTIC + MOCK 1 (254 items), MA (96), QR (108), VR (182).
 *      Options are permuted; the correct answer TEXT never changes.
 *   3. Mock only: hides backend columns, adds warning-level protection to
 *      ANSWER KEY / SYSTEM SUMMARY, gates essay prompts, rebuilds HOME links.
 */

// ---- Where to read the fix data from. Pick ONE. ----
// 'github' : nothing to upload; works as soon as the branch is pushed.
// 'drive'  : drag bundle_1/2/3.json into the ISEE Drive folder, paste their IDs below.
var SRC_MODE = 'github';

var GITHUB_BASE = 'https://raw.githubusercontent.com/zhangqi444/learning/fix/mock-review-2026-08-30/mock-workbook/';
var BUNDLE_FILES = ['bundle_1.json', 'bundle_2.json', 'bundle_3.json'];
var BUNDLE_FILE_IDS = ['<BUNDLE_1_ID>', '<BUNDLE_2_ID>', '<BUNDLE_3_ID>'];

var MOCK_ID  = '1LDQEe_NeQUTk_1gMaVXzhDcJgQLb3mPvm7vO8Kseg00';
var MOCK_FORMS = ['DIAGNOSTIC', 'MOCK 1', 'MOCK 2', 'MOCK 3'];
var EXPECTED = {mock: 1466, ma: 621, qr: 479, vr: 846};

function loadBundle_() {
  var merged = {}, n = (SRC_MODE === 'github') ? BUNDLE_FILES.length : BUNDLE_FILE_IDS.length;
  for (var i = 0; i < n; i++) {
    var txt = (SRC_MODE === 'github')
      ? UrlFetchApp.fetch(GITHUB_BASE + BUNDLE_FILES[i]).getContentText()
      : DriveApp.getFileById(BUNDLE_FILE_IDS[i]).getBlob().getDataAsString('UTF-8');
    var part = JSON.parse(txt);
    for (var k in part) merged[k] = part[k];
  }
  return merged;
}

function applyAll() {
  var bundle = loadBundle_();
  var report = [];

  for (var name in bundle) {
    var spec = bundle[name];
    if (EXPECTED[name] && spec.edits.length !== EXPECTED[name]) {
      report.push(name + ': ABORT expected ' + EXPECTED[name] + ' edits, got ' + spec.edits.length);
      continue;
    }
    var ss = SpreadsheetApp.openById(spec.id);
    var writes = 0, skips = 0, missing = {};

    for (var i = 0; i < spec.edits.length; i++) {
      var e = spec.edits[i];
      var sh = ss.getSheetByName(e.s);
      if (!sh) { missing[e.s] = true; continue; }
      var rng = sh.getRange(e.a);
      if (e.f === 1) {
        if (rng.getFormula() === e.n) { skips++; continue; }
        rng.setFormula(e.n);
      } else {
        if (String(rng.getValue()) === String(e.n)) { skips++; continue; }
        rng.setValue(e.n);
      }
      writes++;
    }

    if (name === 'mock') hardenMock_(ss);

    var miss = Object.keys(missing);
    report.push(name + ': writes=' + writes + ' skips=' + skips +
                (miss.length ? ' MISSING SHEETS: ' + miss.join(',') : ''));
    SpreadsheetApp.flush();
  }

  var msg = report.join(' | ');
  Logger.log(msg);
  try {
    SpreadsheetApp.openById(MOCK_ID).getSheetByName('SYSTEM SUMMARY')
      .getRange('A15').setValue('applyAll: ' + msg + ' @ ' + new Date().toISOString());
  } catch (err) {}
  return msg;
}

function hardenMock_(ss) {
  MOCK_FORMS.forEach(function (n) {
    var sh = ss.getSheetByName(n);
    sh.hideColumns(19, 3);   // S,T,U
    sh.hideColumns(23, 4);   // W,X,Y,Z
  });

  ['ANSWER KEY', 'SYSTEM SUMMARY'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length === 0) {
      sh.protect().setDescription('Backend — do not edit').setWarningOnly(true);
    }
  });

  MOCK_FORMS.forEach(function (n) {
    var sh = ss.getSheetByName(n);
    var have = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).map(function (p) {
      return p.getRange().getA1Notation();
    });
    [['A18:I160', 'Questions — do not edit'],
     ['N18:Z160', 'Scoring — do not edit']].forEach(function (pair) {
      if (have.indexOf(pair[0]) < 0) {
        sh.getRange(pair[0]).protect().setDescription(pair[1]).setWarningOnly(true);
      }
    });
  });

  var id = ss.getId();
  [['F7', 'DIAGNOSTIC', 'OPEN DIAGNOSTIC'], ['F8', 'MOCK 1', 'OPEN MOCK 1'],
   ['F9', 'MOCK 2', 'OPEN MOCK 2'], ['F10', 'MOCK 3', 'OPEN MOCK 3']].forEach(function (L) {
    var gid = ss.getSheetByName(L[1]).getSheetId();
    ss.getSheetByName('HOME').getRange(L[0]).setFormula(
      '=HYPERLINK("https://docs.google.com/spreadsheets/d/' + id + '/edit#gid=' + gid + '","' + L[2] + '")');
  });
}

/** Optional: run first to confirm the bundle loads and counts match, writing nothing. */
function dryRun() {
  var b = loadBundle_(), out = [];
  for (var k in b) out.push(k + '=' + b[k].edits.length + (EXPECTED[k] === b[k].edits.length ? ' OK' : ' MISMATCH'));
  Logger.log(out.join(' | '));
  return out.join(' | ');
}
