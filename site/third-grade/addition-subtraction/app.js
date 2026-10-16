import { LESSONS } from './lessons.js';
import { values, digits, modelValue, answerFor, createModel, combine, validTrade, trade, removePlace, modelReady, checkGuided, checkIndependent } from './math.js';
import { mountScratchpad, normalizeStrokes } from '../area/scratchpad.js';

const $ = selector => document.querySelector(selector);
const names = ['ones','tens','hundreds','thousands'];
const singles = ['one','ten','hundred','thousand'];
const stages = ['Addition','Subtraction','Thousands','Independent practice'];
const storageKey = 'kid-learning-arithmetic-v1';
const activityTitle = document.title;
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const format = number => Number(number).toLocaleString('en-US');
const expression = problem => `${format(problem.a)} ${problem.operation === 'add' ? '+' : '−'} ${format(problem.b)}`;
let storageAvailable = true;
let progress = {current:0,completed:{},draft:null,drafts:{}};
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved === 'object') {
    progress.current = Number.isInteger(saved.current) ? Math.max(0,Math.min(LESSONS.length-1,saved.current)) : 0;
    progress.completed = saved.completed && typeof saved.completed === 'object' ? saved.completed : {};
    progress.draft = saved.draft && typeof saved.draft === 'object' ? saved.draft : null;
    progress.drafts = saved.drafts && typeof saved.drafts === 'object' ? saved.drafts : {};
    if (progress.draft?.lessonId && !progress.drafts[progress.draft.lessonId]) progress.drafts[progress.draft.lessonId]=progress.draft;
  }
} catch { storageAvailable = false; }
let index;
let lesson;
let state;
let scratchpad;
let drag;
let suppressClickUntil = 0;
let suppressClickTarget;
const problems = () => lesson.problems ?? [lesson];
const modelProblem = () => problems()[state.helpProblem];
const completedCount = () => LESSONS.filter(item => progress.completed[item.id]).length;
const hasWork = () => Boolean(state.text.trim() || scratchpad?.hasInk());

function save() {
  try {localStorage.setItem(storageKey,JSON.stringify(progress));storageAvailable=true;}
  catch {storageAvailable=false;}
  const note = $('.chapter-save-note');
  if (note) note.textContent = storageAvailable ? 'Work is saved on this device.' : 'Work could not be saved. Keep this page open, and print completed results before closing it.';
}

function saveDraft() {
  progress.draft = {lessonId:lesson.id,model:state.model,help:state.help,helpProblem:state.helpProblem,supported:state.supported,hints:state.hints,corrections:state.corrections,digitAnswers:state.digitAnswers,answers:state.answers,operation:state.operation,text:state.text,strokes:state.strokes};
  progress.drafts[lesson.id]=progress.draft;
  save();
}

function validSavedModel(model, problem) {
  if (!model || !Array.isArray(model.counts) || model.counts.length !== 4 || !model.counts.every(value => Number.isInteger(value) && value >= 0 && value <= 19) || !Array.isArray(model.removed) || model.removed.length !== 4 || !model.removed.every(value => typeof value === 'boolean') || !Array.isArray(model.log) || typeof model.combined !== 'boolean') return false;
  const expected = problem.operation === 'add' ? problem.a + (model.combined ? problem.b : 0) : problem.a-digits(problem.b).reduce((sum,count,place) => sum+(model.removed[place] ? count*values[place] : 0),0);
  return modelValue(model.counts) === expected;
}

function startLesson(next, fresh = false, focus = false) {
  scratchpad?.destroy();scratchpad=null;
  suppressClickUntil=0;
  suppressClickTarget=null;
  index = Math.max(0,Math.min(LESSONS.length-1,next));
  lesson = LESSONS[index];
  const draft = !fresh ? progress.drafts[lesson.id] : null;
  state = {model:null,help:draft?.help === true,helpProblem:0,supported:draft?.supported === true,hints:0,corrections:0,digitAnswers:['','','',''],answers:problems().map(()=>''),operation:'',text:'',strokes:[],done:false};
  if (draft) {
    state.helpProblem = Number.isInteger(draft.helpProblem) && draft.helpProblem >= 0 && draft.helpProblem < problems().length ? draft.helpProblem : 0;
    for (const field of ['hints','corrections']) state[field] = Number.isInteger(draft[field]) && draft[field] >= 0 ? draft[field] : 0;
    for (const field of ['digitAnswers','answers']) if (Array.isArray(draft[field])) state[field] = state[field].map((value,i) => typeof draft[field][i] === 'string' ? draft[field][i] : value);
    state.operation = ['add','subtract'].includes(draft.operation) ? draft.operation : '';
    state.text = typeof draft.text === 'string' ? draft.text : '';
    state.strokes = normalizeStrokes(draft.strokes);
  }
  state.model = validSavedModel(draft?.model,modelProblem()) ? draft.model : createModel(modelProblem());
  progress.current = index;
  $('#grade-sheet').hidden=true;$('#activity-shell').hidden=false;document.title=activityTitle;
  $('#feedback').textContent='';$('#hint-text').textContent='';
  renderHeader();renderTask();renderModel();saveDraft();
  if (focus) $('#lesson-title').focus({preventScroll:true});
}

function renderHeader() {
  const count = completedCount();
  $('#progress-text').textContent=`${count} of ${LESSONS.length} complete`;
  $('#progress-percent').textContent=`${Math.round(count/LESSONS.length*100)}%`;
  $('#progress-fill').style.width=`${count/LESSONS.length*100}%`;
  $('#lesson-nav').innerHTML=stages.map((title,stage)=>`<div class="chapter"><div class="chapter-heading"><span>${stage+1}</span>${title}</div>${LESSONS.map((item,i)=>item.stage===stage ? `<button class="lesson-link ${i===index?'active':''} ${progress.completed[item.id]?'completed':''}" data-lesson="${i}" ${i===index?'aria-current="step"':''} aria-label="Lesson ${i+1}: ${escape(item.title)}${progress.completed[item.id]?', complete':''}"><span class="lesson-status">${progress.completed[item.id]?'✓':i+1}</span><span class="lesson-name">${escape(item.title)}</span></button>`:'').join('')}</div>`).join('');
  $('#lesson-meta').textContent=`${stages[lesson.stage]} · Lesson ${index+1} of ${LESSONS.length}`;
  $('#lesson-title').textContent=lesson.title;
  $('#lesson-prompt').textContent=lesson.prompt;
  $('#lesson-badge').textContent=lesson.independent?'ON YOUR OWN':'PLACE VALUE';
  $('#big-idea').textContent=lesson.independent?'Line up the place values and use the opposite operation to check your answer.':lesson.operation==='add'?'Ten ones = one ten. Ten tens = one hundred. Ten hundreds = one thousand.':'Exchanging blocks keeps their value. Subtract in the original order.';
}

function blockSvg(place, secondary=false) {
  const color = secondary ? '#c25c47' : ['#d18d21','#32766c','#588272','#536b9a'][place];
  let drawing;
  if(place===0) drawing=`<rect x="5" y="5" width="20" height="20" rx="2" fill="${color}"/>`;
  else if(place===1) drawing=`<rect x="1" y="1" width="12" height="42" rx="1" fill="${color}"/>${Array.from({length:9},(_,i)=>`<path d="M1 ${5.2+i*4.2}h12" stroke="#fffef9" stroke-width=".7"/>`).join('')}`;
  else {
    const grid=Array.from({length:9},(_,i)=>`<path d="M${3.2+i*2.6} 1v26 M1 ${3.2+i*2.6}h26" stroke="#fffef9" stroke-width=".35"/>`).join('');
    drawing=place===2 ? `<rect x="1" y="1" width="26" height="26" fill="${color}"/>${grid}` : `<path d="M2 7L9 1h19v24l-7 7H2Z" fill="${color}"/><path d="M2 7h19v25 M21 7l7-6" fill="none" stroke="#fffef9" stroke-width="1"/><text x="11" y="21" font-size="7" text-anchor="middle" fill="white">1000</text>`;
  }
  return `<svg class="place-token ${names[place]} ${secondary?'second-group':''}" viewBox="0 0 ${place===1?14:30} ${place===1?44:place===3?34:30}" aria-hidden="true">${drawing}</svg>`;
}

function renderModel() {
  const visible = !lesson.independent || state.help;
  $('#model-card').hidden=!visible;
  $('#arithmetic-workbench').classList.toggle('independent-workbench',lesson.independent);
  if (!visible) return;
  const problem=modelProblem();
  const model=state.model;
  const active=problem.operation==='subtract'?model.removed.findIndex(value=>!value):model.combined?model.counts.findIndex(count=>count>=10):-1;
  $('#model-problem').textContent=expression(problem);
  $('#place-blocks').innerHTML=[3,2,1,0].map(place=>{
    const other=problem.operation==='add' && !model.combined ? digits(problem.b)[place] : 0;
    const canExchange=validTrade(model,problem,place);
    const exchange=problem.operation==='add'?`10 ${names[place]}<br>←<br>1 ${singles[place+1]}`:`1 ${singles[place]}<br>→<br>10 ${names[place-1]}`;
    const exchangeable=problem.operation==='add'?place<3:place>0;
    const caption=problem.operation==='subtract' ? model.removed[place]?'Subtracted':`Take away ${digits(problem.b)[place]}` : other ? `${model.counts[place]} + ${other} ${names[place]}` : names[place];
    return `<div class="place-column ${active===place?'active-place':''}" data-place="${place}"><h3>${names[place][0].toUpperCase()+names[place].slice(1)}</h3><div class="block-count">${model.counts[place]}${other?` + ${other}`:''}</div><div class="block-caption">${caption}</div><div class="block-group" aria-label="${model.counts[place]} ${names[place]}${other?` and ${other} more`:''}">${Array.from({length:model.counts[place]},()=>blockSvg(place)).join('')}${Array.from({length:other},()=>blockSvg(place,true)).join('')}</div>${exchangeable?`<button class="exchange-button" data-trade="${place}" aria-label="Exchange ${problem.operation==='add'?`10 ${names[place]} for 1 ${singles[place+1]}`:`1 ${singles[place]} for 10 ${names[place-1]}`}" ${canExchange?'':'disabled'}>${exchange}</button>`:'<div class="block-caption">No exchange</div>'}</div>`;
  }).join('');
  if(problem.operation==='add') $('#model-actions').innerHTML=!model.combined?'<button id="combine" class="primary-button">Combine the blocks</button>':'';
  else {
    const amount=active>=0?digits(problem.b)[active]:0;
    $('#model-actions').innerHTML=active>=0?`<button id="subtract-place" class="primary-button" ${model.counts[active]>=amount?'':'disabled'}>Subtract ${amount} ${amount===1?singles[active]:names[active]}</button>`:'';
  }
  const ready=modelReady(model,problem);
  $('#model-caption').textContent=ready?'The blocks are ready. Write the answer in its place-value columns.':problem.operation==='add'?!model.combined?'Combine the two groups first.':`Exchange 10 ${names[active]} for 1 ${singles[active+1]}.` : model.counts[active]<digits(problem.b)[active]?`There are not enough ${names[active]} to subtract. Exchange a larger block first.`:`Subtract the ${names[active]} next.`;
  if (lesson.independent && ready) $('#model-caption').textContent='Use the blocks to check your calculation. Record your work and final answer in the notebook.';
  $('#exchange-log').innerHTML=model.log.map(entry=>`<li>${escape(entry)}</li>`).join('');
}

function scratchMarkup() {
  return `<div id="scratchpad"><div class="scratch-toolbar" role="group" aria-label="Drawing tools"><button type="button" data-scratch-action="pen" aria-pressed="true">Pen</button><button type="button" data-scratch-action="eraser" aria-pressed="false">Eraser</button><button type="button" data-scratch-action="undo">Undo</button><button type="button" data-scratch-action="clear">Clear drawing</button></div><canvas id="scratch-canvas" tabindex="0" aria-label="Scratchpad. Draw your calculations here.">Type calculations in the work box below.</canvas><label class="field-label scratch-text-label" for="scratch-text">Or type your calculations</label><textarea id="scratch-text" rows="4" spellcheck="false">${escape(state.text)}</textarea></div>`;
}

function renderTask() {
  scratchpad?.destroy();scratchpad=null;
  $('#note-count').textContent=state.done?'COMPLETE':lesson.independent?'INDEPENDENT':'RECORD';
  if (state.done) {
    const answers=progress.completed[lesson.id].result.answers;
    $('#task-panel').innerHTML=`<div class="support-tag">${state.supported?'COMPLETED WITH HELP':'COMPLETED WITHOUT HELP'}</div><h3 id="notebook-title">${lesson.final?'Both answers are correct.':'Answer correct.'}</h3><div class="result-answer">${answers.map(format).join(' · ')}</div>${lesson.independent?'<p class="completed-work-note">Your submitted work is on the grade sheet. Review the calculations with a parent or teacher.</p>':''}<div class="completion-actions"><button id="show-grade-sheet" class="primary-button">View grade sheet</button><button id="next-lesson" class="secondary-button">${index===LESSONS.length-1?'Practice again':'Next lesson'} →</button><button id="replay" class="text-button">Try this lesson again</button></div><p class="chapter-save-note"></p>`;
    return;
  }
  if (!lesson.independent) {
    const places=Math.max(2,String(Math.max(lesson.a,lesson.b,answerFor(lesson))).length);
    const columns=Array.from({length:places},(_,i)=>places-i-1);
    $('#task-panel').innerHTML=`<h3 id="notebook-title">Write the answer.</h3><p class="task-description">Use the blocks, then write one digit in each place.</p><form id="guided-form"><div class="written-sum" style="--places:${places}"><span></span>${columns.map(place=>`<span class="place-label">${names[place][0].toUpperCase()+names[place].slice(1)}</span>`).join('')}<span></span>${columns.map(place=>`<span class="sum-digit">${place>=String(lesson.a).length?'':digits(lesson.a)[place]}</span>`).join('')}<span class="sum-operator">${lesson.operation==='add'?'+':'−'}</span>${columns.map(place=>`<span class="sum-digit">${place>=String(lesson.b).length?'':digits(lesson.b)[place]}</span>`).join('')}<div class="sum-line"></div><span></span>${columns.map(place=>`<input id="digit-${place}" class="answer-input" aria-label="${names[place]} digit" type="text" inputmode="numeric" autocomplete="off" maxlength="2" value="${escape(state.digitAnswers[place])}">`).join('')}</div><button class="primary-button" type="submit">Check answer</button></form><p class="chapter-save-note"></p>`;
  } else {
    $('#task-panel').innerHTML=`<h3 id="notebook-title">Write your calculations.</h3><p class="task-description">Show each regrouping.</p>${lesson.final?`<ol class="practice-problems">${problems().map(problem=>`<li>${expression(problem)}</li>`).join('')}</ol>`:''}<form id="independent-form"><div class="independent-layout"><div>${scratchMarkup()}</div><div class="independent-answers">${lesson.word?`<fieldset id="operation" class="operation-choice"><legend>Which operation will you use?</legend><div class="operation-options"><label><input type="radio" name="operation" value="add" ${state.operation==='add'?'checked':''}> Add</label><label><input type="radio" name="operation" value="subtract" ${state.operation==='subtract'?'checked':''}> Subtract</label></div></fieldset>`:''}${problems().map((problem,i)=>`<label class="field-label" for="answer-${i}">${lesson.final?`Problem ${i+1} answer`:'Final answer'}</label><input id="answer-${i}" class="answer-input" type="text" inputmode="numeric" autocomplete="off" value="${escape(state.answers[i])}">`).join('')}<button class="primary-button" type="submit">Check ${lesson.final?'answers':'answer'}</button><button id="model-help" class="secondary-button full-width" type="button">${state.help?'Hide place-value blocks':'Use place-value blocks'}</button>${lesson.final&&state.help?`<label class="field-label scratch-text-label" for="help-problem">Blocks for</label><select id="help-problem" class="unit-select">${problems().map((problem,i)=>`<option value="${i}" ${state.helpProblem===i?'selected':''}>Problem ${i+1}: ${expression(problem)}</option>`).join('')}</select>`:''}<p class="chapter-save-note"></p></div></div></form>`;
    scratchpad=mountScratchpad($('#scratchpad'),{strokes:state.strokes,onChange(strokes){state.strokes=strokes;saveDraft();}});
  }
}

function feedback(message) {
  $('#feedback').textContent=message;state.supported=true;state.corrections++;saveDraft();
}

function complete() {
  const answers=lesson.independent?state.answers.map(value=>String(Number(value.replaceAll(',','')))):[String(answerFor(lesson))];
  progress.completed[lesson.id]={completedAt:new Date().toISOString(),result:{answers,supported:state.supported,hints:state.hints,corrections:state.corrections,operation:lesson.operation,steps:[...state.model.log],work:lesson.independent?{text:state.text,image:scratchpad.hasInk()?$('#scratch-canvas').toDataURL('image/png'):null}:null}};
  state.done=true;save();renderHeader();renderTask();
  $('#feedback').textContent='';$('#hint-text').textContent='';
  if (completedCount()===LESSONS.length) showGradeSheet();
  else {$('#notebook-title').tabIndex=-1;$('#notebook-title').focus({preventScroll:true});}
}

document.addEventListener('submit',event=>{
  if (!['guided-form','independent-form'].includes(event.target.id)) return;
  event.preventDefault();
  const checked=lesson.independent?checkIndependent(lesson,{answers:state.answers,operation:state.operation,hasWork:hasWork()}):checkGuided(lesson,state.model,state.digitAnswers.map((value,place)=>$(`#digit-${place}`)?value:'0'));
  if (!checked.correct) feedback(checked.message); else complete();
});

document.addEventListener('input',event=>{
  const id=event.target.id;
  if(id==='scratch-text')state.text=event.target.value;
  else if(id.startsWith('digit-'))state.digitAnswers[Number(id.slice(6))]=event.target.value;
  else if(id.startsWith('answer-'))state.answers[Number(id.slice(7))]=event.target.value;
  else if(event.target.name==='operation')state.operation=event.target.value;
  else return;
  saveDraft();
});
document.addEventListener('change',event=>{
  if(event.target.id==='help-problem'){
    state.helpProblem=Number(event.target.value);state.model=createModel(modelProblem());renderModel();saveDraft();
  }
});

function modelAction(action, place) {
  const restoreFocus=$('#model-card').contains(document.activeElement);
  const previous=state.model;
  state.model=action==='combine'?combine(previous,modelProblem()):action==='trade'?trade(previous,modelProblem(),place):removePlace(previous,modelProblem());
  if (state.model===previous) return;
  $('#feedback').textContent='';renderModel();saveDraft();
  if(restoreFocus) ($('#combine, .exchange-button:not(:disabled), #subtract-place:not(:disabled)') || $('#digit-0, #scratch-text'))?.focus({preventScroll:true});
}

document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.lesson!==undefined){saveDraft();startLesson(Number(button.dataset.lesson),false,true);return;}
  if(button.dataset.trade!==undefined){if(button!==suppressClickTarget || event.detail===0 || performance.now()>=suppressClickUntil)modelAction('trade',Number(button.dataset.trade));return;}
  switch(button.id){
    case 'combine':modelAction('combine');break;
    case 'subtract-place':modelAction('remove');break;
    case 'restart-lesson':case 'replay':startLesson(index,true,true);break;
    case 'next-lesson':startLesson(index<LESSONS.length-1?index+1:13,true,true);$('#workspace').scrollIntoView({block:'start'});break;
    case 'hint-button':state.supported=true;state.hints++;$('#hint-text').textContent=lesson.tip;saveDraft();break;
    case 'model-help':
      state.help=!state.help;if(state.help)state.supported=true;
      renderTask();renderModel();saveDraft();$('#model-help').focus({preventScroll:true});break;
    case 'view-grade-sheet':case 'show-grade-sheet':showGradeSheet();break;
    case 'close-grade-sheet':hideGradeSheet();break;
    case 'print-grade-sheet':window.print();break;
    case 'grownups':renderParent();$('#parent-dialog').showModal();break;
    case 'reset-progress':
      if(button.dataset.confirm!=='true'){button.dataset.confirm='true';button.textContent='Yes, reset this chapter';$('#reset-status').textContent='This clears addition/subtraction progress, grade-sheet results, and written work on this device. Click again to confirm.';}
      else {progress={current:0,completed:{},draft:null,drafts:{}};startLesson(0,true);renderParent();button.textContent='Reset this chapter';delete button.dataset.confirm;$('#reset-status').textContent=storageAvailable?'This chapter’s saved progress was reset.':'Progress cleared for this session. Saved progress could not be removed; it may return after reloading.';}
      break;
  }
});

// Exchanges can be dragged between adjacent columns, or activated as ordinary buttons.
document.addEventListener('pointerdown',event=>{
  const button=event.target.closest('[data-trade]');
  if(!button || button.disabled || event.button!==0)return;
  drag={button,place:Number(button.dataset.trade),x:event.clientX,y:event.clientY,id:event.pointerId,moved:false};
  button.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>10){
    drag.moved=true;drag.button.classList.add('dragging');
    const destination=drag.place+(modelProblem().operation==='add'?1:-1);
    $(`[data-place="${destination}"]`)?.classList.add('drag-target');
  }
});
document.addEventListener('pointerup',event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const current=drag;drag=null;
  current.button.classList.remove('dragging');
  const destination=current.place+(modelProblem().operation==='add'?1:-1);
  const column=$(`[data-place="${destination}"]`);
  column?.classList.remove('drag-target');
  if(!current.moved)return;
  suppressClickUntil=performance.now()+400;
  suppressClickTarget=current.button;
  const bounds=column?.getBoundingClientRect();
  if(bounds&&event.clientX>=bounds.left&&event.clientX<=bounds.right&&event.clientY>=bounds.top&&event.clientY<=bounds.bottom)modelAction('trade',current.place);
});
document.addEventListener('pointercancel',()=>{drag?.button.classList.remove('dragging');document.querySelectorAll('.drag-target').forEach(element=>element.classList.remove('drag-target'));drag=null;});

$('.dialog-close').addEventListener('click',()=>$('#parent-dialog').close());
$('#parent-dialog').addEventListener('close',()=>{delete $('#reset-progress').dataset.confirm;$('#reset-progress').textContent='Reset this chapter';$('#reset-status').textContent='';});

function renderParent(){
  const independent=LESSONS.filter(item=>item.independent);
  const without=independent.filter(item=>progress.completed[item.id]?.result?.supported===false).length;
  $('#parent-progress').innerHTML=`<div class="progress-report"><p><strong>${completedCount()} of ${LESSONS.length} lessons complete.</strong></p><p>${without} of ${independent.length} independent lessons completed without in-app help in the latest completed attempts.</p><p>${storageAvailable?'Results and work are saved on this device.':'Storage is unavailable. Print the grade sheet to keep the completed results.'}</p></div>`;
}

function reportHtml(){
  const completed=LESSONS.map(item=>({lesson:item,record:progress.completed[item.id]}));
  const recorded=completed.filter(item=>item.record?.result);
  const independent=LESSONS.filter(item=>item.independent);
  const without=recorded.filter(item=>item.lesson.independent&&item.record.result.supported===false).length;
  const corrections=recorded.reduce((sum,item)=>sum+item.record.result.corrections,0);
  const hints=recorded.reduce((sum,item)=>sum+item.record.result.hints,0);
  const date=new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
  const written=completed.filter(item=>item.lesson.independent&&item.record?.result);
  return `<div class="grade-actions"><button id="close-grade-sheet">Back to lessons</button><button id="print-grade-sheet">Print / Save PDF</button></div><header><h1 id="grade-sheet-title" tabindex="-1">Grade sheet</h1><h2>Third grade · Addition and subtraction</h2><p class="grade-student">Name: <span class="grade-line"></span></p><p class="grade-prepared">Prepared: ${escape(date)}</p></header><div class="grade-summary"><div class="grade-metric"><strong>${completedCount()} of ${LESSONS.length}</strong><span>lessons complete</span></div><div class="grade-metric"><strong>${without} of ${independent.length}</strong><span>independent lessons completed without in-app help</span></div><div class="grade-metric"><strong>${corrections}</strong><span>recorded corrections</span></div><div class="grade-metric"><strong>${hints}</strong><span>recorded hints</span></div></div><p>Results describe the latest completed attempt. Hints, corrections, and optional blocks on independent problems count as in-app help. Help from another person is not recorded.</p><p>Corrections count requests to change an answer or operation. They are not a percentage grade. Written calculations need parent or teacher review.</p><p class="grade-table-hint">Swipe the table to see all results.</p><div class="grade-table-wrap" tabindex="0" role="region" aria-label="Lesson results, scroll sideways for more columns"><table class="grade-table"><caption>Lesson results</caption><thead><tr><th scope="col">Lesson</th><th scope="col">Result</th><th scope="col">Answer</th><th scope="col">Corrections</th><th scope="col">Hints</th></tr></thead><tbody>${completed.map(({lesson:item,record},i)=>`<tr data-grade-lesson="${item.id}"><th scope="row">${i+1}. ${escape(item.title)}</th><td>${!record?'Not completed':!record.result?'Complete (details unavailable)':record.result.supported?'Complete with help':'Complete without help'}</td><td>${record?.result?record.result.answers.map(answer=>escape(format(answer))).join('<br>'):'—'}</td><td>${record?.result?.corrections??'—'}</td><td>${record?.result?.hints??'—'}</td></tr>`).join('')}</tbody></table></div><section class="grade-section" aria-labelledby="grade-written-title"><h2 id="grade-written-title">Independent calculations</h2>${written.length?written.map(({lesson:item,record})=>`<article class="grade-calculations" data-grade-work="${item.id}"><h3>${escape(item.title)}</h3>${item.word?`<p>${escape(item.prompt)}</p>`:''}${(item.problems??[item]).map((problem,i)=>`<p class="grade-problem-line">${expression(problem)} = ${escape(format(record.result.answers[i]))}</p>`).join('')}<div class="grade-work-layout">${record.result.work?.text.trim()?`<div><h3>Typed calculations</h3><pre class="grade-written-work">${escape(record.result.work.text)}</pre></div>`:''}${record.result.work?.image?.startsWith('data:image/png;base64,')?`<div><h3>Written calculations</h3><img class="grade-drawing" src="${escape(record.result.work.image)}" alt="Submitted calculations for ${escape(item.title)}"></div>`:''}</div></article>`).join(''):'<p>No independent problems have been completed yet.</p>'}</section><section class="grade-section grade-review"><h2>Parent or teacher review</h2><p>☐ Place values are lined up and each exchange keeps the number’s value.</p><p>☐ Written calculations match the chosen operation and final answers.</p><p>☐ The child can explain a regrouping step and check with the opposite operation.</p><p>Comments: <span class="grade-line"></span></p><div class="grade-signatures"><p>Reviewed by: <span class="grade-line"></span></p><p>Date: <span class="grade-line"></span></p></div></section><p class="grade-save-status">${storageAvailable?'Saved on this device. Print or save a PDF to keep a copy.':'These results are available only while this page is open. Print or save a PDF before closing it.'}</p>`;
}
function showGradeSheet(){
  $('#grade-sheet').innerHTML=reportHtml();$('#activity-shell').hidden=true;$('#grade-sheet').hidden=false;document.title='Grade sheet · Addition and subtraction · Kid Learning';$('#grade-sheet-title').focus();window.scrollTo(0,0);
}
function hideGradeSheet(){
  $('#grade-sheet').hidden=true;$('#activity-shell').hidden=false;document.title=activityTitle;$('#view-grade-sheet').focus({preventScroll:true});
}
window.addEventListener('beforeprint',()=>{$('#grade-sheet').innerHTML=reportHtml();});
startLesson(progress.current);
