/**
 * Sheila ISEE Mock Exams — apply reviewed fixes.
 * Source of truth: github.com/zhangqi444/learning @ mock-workbook/manifest_slim.json
 *
 * SRC_MODE 'github' is preferred once the branch is pushed (single source of truth).
 * SRC_MODE 'drive'  reads the same JSON uploaded beside the workbook (works today).
 *
 * Idempotent: re-running writes nothing that already matches.
 */
var SRC_MODE = 'drive';
var DRIVE_FILE_IDS = ['<PART_A_ID>', '<PART_B_ID>'];
var GITHUB_RAW = 'https://raw.githubusercontent.com/zhangqi444/learning/fix/mock-review-2026-08-30/mock-workbook/manifest_slim.json';

var FORMS = ['DIAGNOSTIC', 'MOCK 1', 'MOCK 2', 'MOCK 3'];

function loadManifest_() {
  if (SRC_MODE === 'github') {
    return JSON.parse(UrlFetchApp.fetch(GITHUB_RAW).getContentText());
  }
  var all = [];
  for (var i = 0; i < DRIVE_FILE_IDS.length; i++) {
    var t = DriveApp.getFileById(DRIVE_FILE_IDS[i]).getBlob().getDataAsString('UTF-8');
    all = all.concat(JSON.parse(t));
  }
  return all;
}

function applyFixes() {
  var ss = SpreadsheetApp.getActive();
  var data = loadManifest_();
  var writes = 0, skips = 0, problems = [];

  for (var i = 0; i < data.length; i++) {
    var e = data[i];
    var sh = ss.getSheetByName(e.s);
    if (!sh) { problems.push('NO SHEET ' + e.s); continue; }
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

  // Backend columns: S,T,U (19-21) and W,X,Y,Z (23-26)
  FORMS.forEach(function (n) {
    var sh = ss.getSheetByName(n);
    sh.hideColumns(19, 3);
    sh.hideColumns(23, 4);
  });

  // Warning-level protection (deterrent, not a lock — keeps editing possible)
  function protectSheetWarn(name) {
    var sh = ss.getSheetByName(name);
    if (sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length === 0) {
      sh.protect().setDescription('Backend — do not edit').setWarningOnly(true);
    }
  }
  protectSheetWarn('ANSWER KEY');
  protectSheetWarn('SYSTEM SUMMARY');

  FORMS.forEach(function (n) {
    var sh = ss.getSheetByName(n);
    var have = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).map(function (p) {
      return p.getRange().getA1Notation();
    });
    [['A18:I160', 'Questions — do not edit'], ['N18:Z160', 'Scoring — do not edit']].forEach(function (pair) {
      if (have.indexOf(pair[0]) < 0) {
        sh.getRange(pair[0]).protect().setDescription(pair[1]).setWarningOnly(true);
      }
    });
  });

  // HOME OPEN links rebuilt from real sheet gids
  var id = ss.getId();
  [['F7', 'DIAGNOSTIC', 'OPEN DIAGNOSTIC'],
   ['F8', 'MOCK 1', 'OPEN MOCK 1'],
   ['F9', 'MOCK 2', 'OPEN MOCK 2'],
   ['F10', 'MOCK 3', 'OPEN MOCK 3']].forEach(function (L) {
    var gid = ss.getSheetByName(L[1]).getSheetId();
    ss.getSheetByName('HOME').getRange(L[0]).setFormula(
      '=HYPERLINK("https://docs.google.com/spreadsheets/d/' + id + '/edit#gid=' + gid + '","' + L[2] + '")'
    );
  });

  if (data.length !== 1211) { problems.push('EXPECTED 1211 ENTRIES, GOT ' + data.length); }
  var msg = 'entries=' + data.length + ' writes=' + writes + ' skips=' + skips +
            ' problems=' + problems.length + (problems.length ? ' | ' + problems.join(' ; ') : '');
  Logger.log(msg);
  ss.getSheetByName('SYSTEM SUMMARY').getRange('A15')
    .setValue('applyFixes: ' + msg + ' @ ' + new Date().toISOString());
  return msg;
}
