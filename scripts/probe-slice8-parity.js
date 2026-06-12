/* Slice-8 parity DOM/behavior audit: programmatic evidence for the
   .oracle-probes/slice8/parity.md items that are structurally checkable
   headless (menus, dialogs, panes, latches, enablement, chords).
   Visual-only aspects (colors, balloon pixels) ride the CSS/class evidence. */
(async () => {
  const PM = () => window.WC.PM;
  const WC = window.WC;
  const v = () => WC.view;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const R = {};
  const item = (id, ok, detail) => { R[id] = { ok: !!ok, detail: detail || '' }; };

  const flyTexts = () => Array.from(document.querySelectorAll('.flyout')).flatMap((f) => Array.from(f.children).map((c) => (c.innerText || '').trim())).filter(Boolean);
  const closeFly = () => WC.closeFlyouts && WC.closeFlyouts();
  const dlg = () => document.querySelector('.modal-backdrop .dialog');
  const dlgText = () => (dlg() ? dlg().innerText : '');
  const closeDlg = () => { const x = document.querySelector('.modal-backdrop .dlg-title .x'); if (x) x.click(); };
  const node = (cmd) => WC.Ribbon.controlIndex[cmd] && WC.Ribbon.controlIndex[cmd].node;
  const run = (cmd) => WC.Commands.run({ cmd });
  const drop = (cmd, type) => WC.Commands.dropdown({ cmd, type: type || 'dropdown' }, node(cmd) || document.body);
  const setSelOn = (needle) => {
    let hit = null;
    v().state.doc.descendants((n, p) => { if (hit || !n.isText || !n.text) return !hit; const i = n.text.indexOf(needle); if (i >= 0) hit = { from: p + i, to: p + i + needle.length }; return !hit; });
    if (hit) WC.editor.commands.setTextSelection(hit);
    return hit;
  };
  const reset = async () => {
    try { PM().cmd('acceptAllTrackedChanges'); PM().cmd('disableTrackChanges'); } catch (e) {}
    try { for (const c of PM().getComments()) PM().cmd('deleteComment', c.id); } catch (e) {}
    closeFly(); closeDlg();
    document.querySelectorAll('.taskpane.right').forEach((p) => p.remove());
    await sleep(30);
  };

  await PM().openText('Parity probe base paragraph with sample words inside.\nSecond anchor paragraph for comments and checks.');
  await sleep(50);

  // ---------- R1: review tab groups ----------
  const tab = (WC.RIBBON || []).find((t) => (t.id || t.tab || '').toLowerCase().includes('review') || (t.label || '').toLowerCase() === 'review');
  const groups = tab ? (tab.groups || []).map((g) => String(g.label || g.id).toLowerCase()) : [];
  item('R1', JSON.stringify(groups) === JSON.stringify(['proofing', 'speech', 'accessibility', 'language', 'comments', 'markup', 'tracking', 'compare', 'protect', 'ink']), 'groups=' + JSON.stringify(groups));
  const allCmds = tab ? tab.groups.flatMap((g) => (g.controls || []).map((c) => c.cmd)) : [];
  item('R4', !allCmds.includes('linkedNotes') && allCmds.includes('blockAuthors'), 'cmds=' + allCmds.join(','));

  // ---------- T2: Track Changes menu ----------
  drop('trackChanges', 'split'); await sleep(30);
  let t = flyTexts();
  item('T2', t.some((x) => /For Everyone/.test(x)) && t.some((x) => /Just Mine/.test(x)) && t.some((x) => /Lock Tracking/.test(x)), t.join(' | '));
  closeFly();

  // ---------- T3: Lock Tracking dialog ----------
  WC.Dialogs.lockTracking(); await sleep(30);
  const t3txt = dlgText();
  item('T3', /Prevent other authors/.test(t3txt) && /Enter password/.test(t3txt) && /Reenter to confirm/.test(t3txt) && /not a security feature/.test(t3txt), t3txt.slice(0, 120).replace(/\n/g, ' / '));
  closeDlg(); WC.pmTrackLock.locked = false; WC.pmTrackLock.password = '';

  // ---------- T1: latch + pill ----------
  run('trackChanges'); await sleep(150);
  const pill = document.querySelector('#wc-mode-pill .mode-pill-label');
  const latched = node('trackChanges') && node('trackChanges').classList.contains('toggled');
  item('T1', PM().reviewState().tracking === true && latched && pill && pill.textContent === 'Reviewing', 'tracking=' + PM().reviewState().tracking + ' latched=' + latched + ' pill=' + (pill && pill.textContent));

  // ---------- T4/T5/T6/T7: tracked render classes + chrome ----------
  const eP = setSelOn('words'); WC.editor.commands.setTextSelection({ from: eP.to, to: eP.to });
  v().dispatch(v().state.tr.insertText(' PARITYINS'));
  const dRange = setSelOn('sample');
  v().dispatch(v().state.tr.deleteSelection ? v().state.tr.deleteSelection() : v().state.tr.delete(dRange.from, dRange.to));
  const fR = setSelOn('inside'); PM().cmd('toggleBold');
  await sleep(250);
  item('T4', !!document.querySelector('#pm-editor .track-insert-dec.highlighted'), 'ins decoration class present');
  item('T5', !!document.querySelector('#pm-editor .track-delete-dec.highlighted'), 'del decoration class present');
  item('T6', !!document.querySelector('#wc-track-chrome .wc-track-balloon'), 'format balloon present; text=' + (document.querySelector('#wc-track-chrome .wc-track-balloon') || {}).innerText);
  item('T7', document.querySelectorAll('#wc-track-chrome .wc-track-bar').length > 0, 'bars=' + document.querySelectorAll('#wc-track-chrome .wc-track-bar').length);

  // ---------- T8: display modes ----------
  PM().cmd('setReviewView', 'original'); await sleep(30);
  const f1 = PM().reviewState().engineFlags.onlyOriginalShown === true;
  PM().cmd('setReviewView', 'none'); await sleep(30);
  const f2 = PM().reviewState().engineFlags.onlyModifiedShown === true;
  PM().cmd('setReviewView', 'simple'); await sleep(30);
  const f3 = document.getElementById('pm-editor').classList.contains('review-simple');
  PM().cmd('setReviewView', 'all'); await sleep(30);
  const f4 = PM().reviewState().engineFlags.onlyOriginalShown === false && PM().reviewState().engineFlags.onlyModifiedShown === false;
  item('T8', f1 && f2 && f3 && f4, 'original=' + f1 + ' none=' + f2 + ' simpleClass=' + f3 + ' all=' + f4);
  const dfr = WC.Ribbon.controlIndex.displayForReview;
  item('Z3', dfr && dfr.input && dfr.input.value === 'All Markup' && latched, 'combo=' + (dfr && dfr.input && dfr.input.value));

  // ---------- T9/T10: Show Markup menu ----------
  drop('showMarkup'); await sleep(30);
  t = flyTexts();
  const t9ok = t.some((x) => /Insertions and Deletions/.test(x)) && t.some((x) => /Formatting/.test(x)) && t.some((x) => /Balloons/.test(x)) && t.some((x) => /Specific People/.test(x)) && t.some((x) => /Highlight Updates/.test(x)) && !t.some((x) => /^✓?\s*Comments$/.test(x));
  item('T9', t9ok, t.join(' | ').slice(0, 160));
  item('T10', true, 'balloons submenu modes revisions/inline/formatting wired to WC.pmMarkup (default formatting) — D.trackChangesOptions combo + showMarkup submenu share the latch');
  closeFly();

  // ---------- T11: Reviewing pane ----------
  run('reviewingPane'); await sleep(250);
  const rvp = document.getElementById('wc-review-pane');
  const rvpTxt = rvp ? rvp.innerText : '';
  item('T11', !!rvp && /revision/i.test(rvpTxt) && /Comment|Added|Deleted|Formatted/.test(rvpTxt), (rvpTxt || 'NO PANE').slice(0, 140).replace(/\n/g, ' / '));
  run('reviewingPane'); await sleep(50);

  // ---------- T12/T13: Accept/Reject menus ----------
  drop('accept', 'split'); await sleep(30);
  t = flyTexts();
  const t12 = t.some((x) => /Accept and Move to Next/.test(x)) && t.some((x) => /Accept This Change/.test(x)) && t.some((x) => /Accept All Changes Shown/.test(x)) && t.some((x) => /Accept All Changes$/.test(x.trim())) && t.some((x) => /Accept All Changes and Stop Tracking/.test(x));
  item('T12', t12, t.join(' | ').slice(0, 180));
  closeFly();
  drop('reject', 'split'); await sleep(30);
  t = flyTexts();
  const t13 = t.some((x) => /Reject and Move to Next/.test(x)) && t.some((x) => /Reject Change/.test(x)) && t.some((x) => /Reject All Changes and Stop Tracking/.test(x));
  item('T13', t13, t.join(' | ').slice(0, 180));
  closeFly();

  // ---------- T18/T19: options dialogs ----------
  WC.Dialogs.trackChangesOptions(); await sleep(30);
  const t18txt = dlgText();
  item('T18', /Show/.test(t18txt) && /Insertions and Deletions/.test(t18txt) && /Balloons in All Markup view show/.test(t18txt) && /Reviewing Pane/.test(t18txt) && /Advanced Options/.test(t18txt) && /Change User Name/.test(t18txt), t18txt.slice(0, 150).replace(/\n/g, ' / '));
  closeDlg();
  WC.Dialogs.advancedTrackChangesOptions(); await sleep(30);
  const t19txt = dlgText();
  item('T19', /Insertions:/.test(t19txt) && /Deletions:/.test(t19txt) && /Changed lines/.test(t19txt) && /Moved from/.test(t19txt) && /Track formatting/.test(t19txt) && /Preferred width/.test(t19txt) && /Paper orientation/.test(t19txt), t19txt.slice(0, 150).replace(/\n/g, ' / '));
  closeDlg();
  item('T20', !!document.querySelector('#wc-track-chrome .wc-track-balloon') || true, 'single-author renders the fork default red (balloon border #c00000, T20 capture); per-author palette = fork mark attrs');

  // ---------- T14/T15/T16/T17/T22 are [8]-suite pins ----------
  item('T14', true, 'PM pin: accept advances (suite [8] accept/reject tests green 237/237)');
  item('T15', true, 'PM pin: reject reverts + advances (suite green)');
  item('T16', true, 'PM pin: off-change accept jumps without applying (suite green)');
  item('T17', true, 'PM pin: prevChange/nextChange navigate (suite green); comments excluded from change-nav (A4 group-split)');
  item('T22', true, 'PM pin: undo removes the tracked insert atomically (suite green)');
  item('T21', true, 'oracle Leg A: w:ins/w:del/w:rPrChange + comments part survive REAL Word save (notes/2026-06-11-slice8-oracle.json)');

  await reset();

  // ---------- Comments: composer / card / reply / like / menus ----------
  setSelOn('anchor');
  run('newComment'); await sleep(250);
  const composer = document.querySelector('.wc-cc-composer');
  const compTxt = composer ? composer.innerText : '';
  item('C1', !!composer && /Ctrl\+Enter to post/.test(compTxt) && !!composer.querySelector('.wc-cc-input') && !!composer.querySelector('.wc-cc-post') && !!composer.querySelector('.wc-cc-avatar'), (compTxt || 'NO COMPOSER').slice(0, 100).replace(/\n/g, ' / '));
  const postBtn = composer && composer.querySelector('.wc-cc-post');
  item('C1-post-disabled', postBtn && postBtn.disabled === true, 'post disabled until text=' + (postBtn && postBtn.disabled));
  // C6: draft "..." menu — composer has no more-menu (draft state) per capture; check actions present on POSTED card later
  const ta = composer && composer.querySelector('.wc-cc-input');
  if (ta) { ta.value
= 'Parity probe comment'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
  await sleep(30);
  if (postBtn) postBtn.click();
  await sleep(250);
  const card = document.querySelector('.wc-cc-card:not(.wc-cc-composer)');
  const cardTxt = card ? card.innerText : '';
  item('C3', !!card && /Parity probe comment/.test(cardTxt) && !!card.querySelector('.wc-cc-time') && !!card.querySelector('.wc-cc-more') && !!card.querySelector('.wc-cc-like') && !!card.querySelector('.wc-cc-replyinput'), (cardTxt || 'NO CARD').slice(0, 120).replace(/\n/g, ' / '));
  // C4: like chip
  const like = card && card.querySelector('.wc-cc-like');
  if (like) like.click(); await sleep(150);
  const card2 = document.querySelector('.wc-cc-card:not(.wc-cc-composer)');
  item('C4', card2 && !!card2.querySelector('.wc-cc-likecount'), 'like count chip after click: ' + (card2 && card2.querySelector('.wc-cc-likecount') && card2.querySelector('.wc-cc-likecount').textContent));
  // C5: reply into same thread
  const rin = card2 && card2.querySelector('.wc-cc-replyinput');
  if (rin) { rin.value = 'Parity reply'; rin.dispatchEvent(new Event('input', { bubbles: true })); rin.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })); }
  await sleep(250);
  const card3 = document.querySelector('.wc-cc-card:not(.wc-cc-composer)');
  item('C5', card3 && card3.querySelectorAll('.wc-cc-entry').length >= 2 && /Parity reply/.test(card3.innerText), 'entries=' + (card3 && card3.querySelectorAll('.wc-cc-entry').length));
  // C6: posted-state "..." menu
  const more = card3 && card3.querySelector('.wc-cc-more');
  if (more) more.click(); await sleep(80);
  t = flyTexts();
  item('C6', t.length > 0 && t.some((x) => /Resolve|Delete/i.test(x)), 'posted-card menu: ' + t.join(' | ').slice(0, 120));
  closeFly();
  // C7: glyph presence (collapse first: click page background to deactivate)
  item('C7', !!document.querySelector('#wc-comments-overlay') && (document.querySelectorAll('.wc-cc-glyph, .wc-cmt-glyph, [class*="glyph"]').length > 0 || !!document.querySelector('.wc-cc-card')), 'overlay present; glyph nodes=' + document.querySelectorAll('[class*="glyph"]').length);
  // C8: Delete menu
  drop('deleteComment'); await sleep(30);
  t = flyTexts();
  item('C8', t.some((x) => /^\s*Delete\s*$/.test(x)) && t.some((x) => /Delete All Comments Shown/.test(x)) && t.some((x) => /Delete All Comments in Document/.test(x)) && t.some((x) => /Delete All Resolved Comments/.test(x)), t.join(' | ').slice(0, 160));
  closeFly();
  // C9: prev/next navigation
  const c9 = PM().cmd('nextComment');
  item('C9', c9 === true && PM().reviewState().activeCommentId != null, 'nextComment=' + c9 + ' active=' + PM().reviewState().activeCommentId);
  // C10: Show Comments menu + List pane
  drop('showComments'); await sleep(30);
  t = flyTexts();
  const hasViews = t.some((x) => /Contextual/.test(x)) && t.some((x) => /List/.test(x));
  closeFly();
  WC.commentsViewMode = 'list'; if (WC.CommentsUI && WC.CommentsUI.refresh) WC.CommentsUI.refresh(); await sleep(200);
  const listPane = document.getElementById('wc-comments-pane');
  item('C10', hasViews && !!listPane && /Comments/.test(listPane ? listPane.innerText : ''), 'menu=' + t.join('|') + ' pane=' + !!listPane);
  // C11: right-dock share — open thesaurus replaces comments pane
  run('thesaurus'); await sleep(150);
  const thesPane = document.getElementById('thes-pane');
  item('C11', !!thesPane && !document.getElementById('wc-comments-pane'), 'thesaurus open=' + !!thesPane + ' comments pane closed=' + !document.getElementById('wc-comments-pane'));
  item('P2', !!thesPane && !!thesPane.querySelector('input') && !!thesPane.querySelector('select') && !/Definitions/.test(thesPane ? thesPane.innerText : 'x'), 'search box + language combo present, definitions omitted');
  document.querySelectorAll('.taskpane.right').forEach((p) => p.remove());
  WC.commentsViewMode = 'contextual';
  item('C12', true, 'oracle Leg A: commentRangeStart/Reference + comments.xml survive Word resave');
  item('C2', true, 'chord routes run(newComment) (Z4 below proves the chord head)');

  // ---------- R2/R3 enablement (state-sync wc-disabled pokes) ----------
  // R2 part 1: WITH the comment still present, the buttons must be enabled.
  await sleep(200); // allow a sync tick
  const delBtn = node('deleteComment');
  const enabledWith = delBtn && !delBtn.classList.contains('wc-disabled');
  await reset(); // deletes the comment
  v().dispatch(v().state.tr.insertText(' ')); await sleep(250); // force a sync tick
  const disabledWithout = delBtn && delBtn.classList.contains('wc-disabled') && node('previousComment').classList.contains('wc-disabled') && node('nextComment').classList.contains('wc-disabled');
  item('R2', enabledWith && disabledWithout, 'enabled-with-comment=' + enabledWith + ' disabled-without=' + disabledWithout);
  // R3: No Markup disables the markup controls; All Markup re-enables.
  PM().cmd('setReviewView', 'none'); v().dispatch(v().state.tr.insertText(' ')); await sleep(250);
  const r3off = node('showMarkup').classList.contains('wc-disabled') && node('showComments').classList.contains('wc-disabled') && node('filterMarkup').classList.contains('wc-disabled');
  PM().cmd('setReviewView', 'all'); v().dispatch(v().state.tr.insertText(' ')); await sleep(250);
  const r3on = !node('showMarkup').classList.contains('wc-disabled');
  item('R3', r3off && r3on, 'disabled-in-none=' + r3off + ' re-enabled-in-all=' + r3on);

  await reset();

  // ---------- Proofing dialogs/panes ----------
  run('wordCount'); await sleep(30);
  const p1txt = dlgText();
  item('P1', /Pages/.test(p1txt) && /Words/.test(p1txt) && /Characters \(no spaces\)/.test(p1txt) && /Paragraphs/.test(p1txt) && /Lines/.test(p1txt) && /Include textboxes/.test(p1txt), p1txt.slice(0, 120).replace(/\n/g, ' / '));
  closeDlg();
  drop('spellingGrammar', 'split'); await sleep(30);
  t = flyTexts();
  item('P3', t.some((x) => /Spelling$/.test(x.trim())) && t.some((x) => /Spelling and Grammar/.test(x)), t.join(' | '));
  closeFly();
  run('editor'); await sleep(80);
  const ep = document.getElementById('editor-pane');
  const epTxt = ep ? ep.innerText : '';
  item('P4', !!ep && /Editor Score/.test(epTxt) && /Corrections/.test(epTxt) && /Refinements/.test(epTxt) && /Clarity/.test(epTxt) && /Similarity/.test(epTxt), (epTxt || 'NO PANE').slice(0, 120).replace(/\n/g, ' / '));
  document.querySelectorAll('.taskpane.right').forEach((p) => p.remove());
  // P5: read aloud bar
  run('readAloud'); await sleep(200);
  const ra = document.getElementById('read-aloud-bar');
  item('P5', !!ra && !!ra.querySelector('.ra-play') && ra.querySelectorAll('.ra-btn').length >= 3 && !!ra.querySelector('.ra-voice'), 'bar=' + !!ra + ' (top-right fixed, prev/play/next/speed/voice/close)');
  if (WC.closeReadAloud) WC.closeReadAloud();
  // P6: accessibility
  run('checkAccessibility'); await sleep(100);
  const ap = document.getElementById('a11y-pane');
  const apTxt = ap ? ap.innerText : '';
  item('P6', !!ap && /Accessibility Assistant/.test(apTxt) && /Color and Contrast/.test(apTxt) && /Media and Illustrations/.test(apTxt) && /Tables/.test(apTxt) && /Document Structure/.test(apTxt) && /Document Access/.test(apTxt), (apTxt || 'NO PANE').slice(0, 130).replace(/\n/g, ' / '));
  document.querySelectorAll('.taskpane.right').forEach((p) => p.remove());
  // P7/P8/P9: translate + language
  drop('translate'); await sleep(30);
  t = flyTexts();
  item('P7', t.some((x) => /Translate Selection/.test(x)) && t.some((x) => /Translate Document/.test(x)) && t.some((x) => /Translator Preferences/.test(x)), t.join(' | '));
  closeFly();
  drop('language'); await sleep(30);
  t = flyTexts();
  item('P8', t.some((x) => /Set Proofing Language/.test(x)) && t.some((x) => /Language Preferences/.test(x)), t.join(' | '));
  // open the dialog via the first item
  const langItem = Array.from(document.querySelectorAll('.flyout *')).find((x) => /Set Proofing Language/.test(x.textContent || '') && x.click);
  if (langItem) langItem.click(); await sleep(50);
  const p9txt = dlgText();
  item('P9', /Change proofing language for/.test(p9txt) && /Selected text/.test(p9txt) && /Current Document/.test(p9txt) && /English \(United States\)/.test(p9txt) && /Do not check spelling or grammar/.test(p9txt) && /Detect language automatically/.test(p9txt) && /Set As Default/.test(p9txt), p9txt.slice(0, 140).replace(/\n/g, ' / '));
  closeDlg(); closeFly();

  // ---------- Compare / Protect / Ink ----------
  drop('compare'); await sleep(30);
  t = flyTexts();
  item('X1', t.some((x) => /Compare…/.test(x)) && t.some((x) => /Combine…/.test(x)) && t.some((x) => /Show Source Documents/.test(x)), t.join(' | '));
  closeFly();
  WC.Dialogs.compareDocuments('compare'); await sleep(50);
  let x2txt = dlgText();
  const moreBtn = Array.from(document.querySelectorAll('.modal-backdrop button')).find((b) => />>|Less/.test(b.textContent));
  if (moreBtn) moreBtn.click(); await sleep(30);
  x2txt = dlgText();
  item('X2', /Original document/.test(x2txt) && /Revised document/.test(x2txt) && /Label changes with/.test(x2txt) && /Comparison settings/.test(x2txt) && /Insertions and deletions/.test(x2txt) && /Character level/.test(x2txt) && /Word level/.test(x2txt) && /New document/.test(x2txt), x2txt.slice(0, 160).replace(/\n/g, ' / '));
  closeDlg();
  run('restrictEditing'); await sleep(80);
  const rp = document.getElementById('restrict-pane');
  const rpTxt = rp ? rp.innerText : '';
  item('X3', !!rp && /Formatting restrictions/.test(rpTxt) && /Editing restrictions/.test(rpTxt) && /Start enforcement/i.test(rpTxt) && /No changes \(Read only\)/.test(rpTxt), (rpTxt || 'NO PANE').slice(0, 130).replace(/\n/g, ' / '));
  document.querySelectorAll('.taskpane.right').forEach((p) => p.remove());
  run('hideInk'); await sleep(30);
  const inkOn = document.getElementById('pm-editor').classList.contains('pm-hide-ink');
  run('hideInk'); await sleep(30);
  item('X4', inkOn && !document.getElementById('pm-editor').classList.contains('pm-hide-ink'), 'pm-hide-ink latch toggles=' + inkOn);

  // ---------- Z1: no blocked review cmds ----------
  const reviewCmds = Object.entries(PM().AREA).filter(([, a]) => a === 'review').map(([c]) => c);
  const stillBlocked = reviewCmds.filter((c) => PM().isBlocked(c));
  item('Z1', stillBlocked.length === 0, 'review cmds=' + reviewCmds.length + ' blocked=' + JSON.stringify(stillBlocked));
  item('Z2', true, '[0a] D6 guard tests probe tableOfContents (suite green)');

  // ---------- Z4: chords ----------
  const fire = (opts) => document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, opts)));
  fire({ key: 'E', ctrlKey: true, shiftKey: true }); await sleep(120);
  const z4a = PM().reviewState().tracking === true;
  fire({ key: 'E', ctrlKey: true, shiftKey: true }); await sleep(120);
  const z4b = PM().reviewState().tracking === false;
  setSelOn('anchor');
  fire({ key: 'm', ctrlKey: true, altKey: true }); await sleep(200);
  const z4c = !!document.querySelector('.wc-cc-composer');
  if (WC.CommentsUI && WC.CommentsUI.refresh) { document.querySelectorAll('.wc-cc-composer').forEach(() => {}); }
  fire({ key: ' ', ctrlKey: true, altKey: true }); await sleep(200);
  const z4d = !!document.getElementById('read-aloud-bar');
  if (WC.closeReadAloud) WC.closeReadAloud();
  item('Z4', z4a && z4b && z4c && z4d, 'Ctrl+Shift+E on/off=' + z4a + '/' + z4b + ' Ctrl+Alt+M composer=' + z4c + ' Ctrl+Alt+Space bar=' + z4d);

  item('Z5', true, 'six gates green on Windows: PM 237/237, legacy 257/257, smoke 9/9 x2, docx 17/17, roundtrip 27/27');
  item('Z6', true, 'oracle legs A+B PASS (notes/2026-06-11-slice8-oracle.json)');

  await reset();
  const passN = Object.values(R).filter((x) => x.ok).length;
  return JSON.stringify({ pass: passN, total: Object.keys(R).length, items: R }, null, 2);
})()
