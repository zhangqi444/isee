function applyFixes() {
  var SS = SpreadsheetApp.getActive();
  var log = [], writes = 0, skips = 0;
  var DATA = JSON.parse(DATA_S);
  for (var i=0;i<DATA.length;i++){
    var e=DATA[i];
    var sh=SS.getSheetByName(e.s);
    if(!sh){log.push('NO SHEET '+e.s);continue;}
    var rng=sh.getRange(e.a);
    if(e.f===1){ if(rng.getFormula()===e.n){skips++;continue;} rng.setFormula(e.n); }
    else { if(String(rng.getValue())===String(e.n)){skips++;continue;} rng.setValue(e.n); }
    writes++;
  }
  // hide backend columns on the four forms: S,T,U (19-21) and W-Z (23-26)
  ['DIAGNOSTIC','MOCK 1','MOCK 2','MOCK 3'].forEach(function(n){
    var sh=SS.getSheetByName(n);
    sh.hideColumns(19,3); sh.hideColumns(23,4);
  });
  // warning-only protections
  function protectSheetWarn(name){
    var sh=SS.getSheetByName(name);
    var has=sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length>0;
    if(!has){ sh.protect().setDescription('Backend — do not edit').setWarningOnly(true); }
  }
  protectSheetWarn('ANSWER KEY'); protectSheetWarn('SYSTEM SUMMARY');
  ['DIAGNOSTIC','MOCK 1','MOCK 2','MOCK 3'].forEach(function(n){
    var sh=SS.getSheetByName(n);
    var existing=sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).map(function(p){return p.getRange().getA1Notation();});
    [['A18:I160','Questions — do not edit'],['N18:Z160','Scoring — do not edit']].forEach(function(pair){
      if(existing.indexOf(pair[0])<0){ sh.getRange(pair[0]).protect().setDescription(pair[1]).setWarningOnly(true); }
    });
  });
  // rebuild HOME OPEN links with verified gids
  var id=SS.getId();
  var links=[['F7','DIAGNOSTIC','OPEN DIAGNOSTIC'],['F8','MOCK 1','OPEN MOCK 1'],['F9','MOCK 2','OPEN MOCK 2'],['F10','MOCK 3','OPEN MOCK 3']];
  links.forEach(function(L){
    var gid=SS.getSheetByName(L[1]).getSheetId();
    var f='=HYPERLINK("https://docs.google.com/spreadsheets/d/'+id+'/edit#gid='+gid+'","'+L[2]+'")';
    SS.getSheetByName('HOME').getRange(L[0]).setFormula(f);
  });
  var msg='DONE writes='+writes+' skips='+skips+' problems='+log.length+(log.length?' | '+log.join(' ; '):'');
  Logger.log(msg);
  SS.getSheetByName('SYSTEM SUMMARY').getRange('A15').setValue('applyFixes: '+msg+' @ '+new Date().toISOString());
}
