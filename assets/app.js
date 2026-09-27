let papers = [];
const paperCache = new Map();

const $ = s => document.querySelector(s);
const libraryEl = $("#library");
const searchInput = $("#searchInput");
const categoryFilter = $("#categoryFilter");
const bookModal = $("#bookModal");
const indexModal = $("#indexModal");

let currentPaper = null;
let currentSpread = -1;
let currentSections = [];

function escapeHTML(s=""){
  return String(s ?? "").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

function formatSectionContent(content=""){
  const lines=String(content??"").replace(/\r\n/g,"\n").split("\n");
  const out=[];
  let listType=null;
  const closeList=()=>{
    if(listType){ out.push(`</${listType}>`); listType=null; }
  };

  for(const raw of lines){
    const line=raw.trim();
    if(!line){ closeList(); continue; }

    const bullet=line.match(/^[•·\-]\s+(.*)$/);
    const numbered=line.match(/^\d+[.)]\s+(.*)$/);

    if(bullet){
      if(listType!=="ul"){ closeList(); out.push("<ul>"); listType="ul"; }
      out.push(`<li>${escapeHTML(bullet[1])}</li>`);
      continue;
    }

    if(numbered){
      if(listType!=="ol"){ closeList(); out.push("<ol>"); listType="ol"; }
      out.push(`<li>${escapeHTML(numbered[1])}</li>`);
      continue;
    }

    closeList();

    const term=line.match(/^([^:：]{1,28})[:：]\s*(.+)$/);
    if(term){
      out.push(`<p><strong>${escapeHTML(term[1])}</strong> · ${escapeHTML(term[2])}</p>`);
    }else{
      out.push(`<p>${escapeHTML(line)}</p>`);
    }
  }

  closeList();
  return out.join("");
}

function normalizePaperData(raw,meta){
  let paper=raw;

  if(Array.isArray(paper)){
    paper={...meta,sections:paper};
  }

  if(
    paper &&
    !Array.isArray(paper) &&
    Array.isArray(paper.sections) &&
    paper.sections.length===1
  ){
    const inner=paper.sections[0];
    if(
      inner &&
      typeof inner==="object" &&
      !Array.isArray(inner) &&
      Array.isArray(inner.sections)
    ){
      paper={...paper,...inner};
    }
  }

  if(!paper || typeof paper!=="object" || Array.isArray(paper)){
    throw new Error("논문 상세 JSON 구조가 올바르지 않습니다.");
  }

  paper={...meta,...paper};

  paper.sections=(paper.sections||[])
    .filter(s=>s && typeof s==="object")
    .map(s=>({
      ...s,
      title:String(s.title||"제목 없음"),
      content:
        typeof s.content==="string"
          ? s.content
          : typeof s.html==="string"
            ? s.html.replace(/<[^>]*>/g," ")
            : ""
    }))
    .filter(s=>s.content.trim());

  return paper;
}

function formatPrerequisites(value){
  if(Array.isArray(value)) return value.join(" · ");
  if(value === null || value === undefined || value === "") return "특별한 선행지식 없음";
  return String(value);
}

function init(){
  const cats=[...new Set(papers.map(p=>p.category))];
  categoryFilter.innerHTML='<option value="all">전체 분야</option>';
  cats.forEach(c=>{
    const o=document.createElement("option");
    o.value=c;
    o.textContent=c;
    categoryFilter.appendChild(o);
  });

  $("#paperCount").textContent=papers.length;
  $("#categoryCount").textContent=cats.length;
  $("#pageCount").textContent=papers.reduce((a,p)=>a+(p.sectionCount||0),0);

  renderLibrary();
  renderIndex();

  if(!window.sourceButton) setupSourceButton();
}

function filteredPapers(){
  const q=searchInput.value.trim().toLowerCase();
  const c=categoryFilter.value;
  return papers.filter(p=>{
    const hay=[p.title,p.shortTitle,p.originalTitle,p.authors,p.category,...(p.keywords||[])].join(" ").toLowerCase();
    return (!q||hay.includes(q))&&(c==="all"||p.category===c);
  });
}

function renderLibrary(){
  const list=filteredPapers();
  $("#resultText").textContent=`${list.length}개 결과`;
  libraryEl.innerHTML="";

  if(!list.length){
    libraryEl.innerHTML='<div class="paper-card" style="grid-column:span 12;min-height:170px;display:grid;place-items:center;color:#7b8495">조건에 맞는 논문이 없습니다.</div>';
    return;
  }

  list.forEach((p,i)=>{
    const card=document.createElement("article");
    card.className="paper-card";
    card.innerHTML=`
      <button data-id="${escapeHTML(p.id)}" aria-label="${escapeHTML(p.title)} 열기"></button>
      <div class="paper-card-content">
        <span class="paper-chip">${escapeHTML(p.category)} ${p.verified?"· REAL":""}</span>
        <h4>${escapeHTML(p.title)}</h4>
        <div class="paper-meta-row">
          ${p.difficulty?`<span>${escapeHTML(p.difficulty)}</span>`:""}
          ${p.readingTime?`<span>${escapeHTML(p.readingTime)}</span>`:""}
          ${p.sectionCount?`<span>${p.sectionCount}개 섹션</span>`:""}
        </div>
        <p>${escapeHTML(p.summary)}</p>
      </div>
      <div class="paper-card-footer">
        <span>${escapeHTML(p.authors)}</span>
        <span>${escapeHTML(p.year)}</span>
      </div>
      <div class="paper-glow" style="background:${escapeHTML(p.color||"#56627a")}"></div>
    `;
    card.style.animation=`cardIn .42s ease ${i*.04}s both`;
    libraryEl.appendChild(card);
  });

  document.querySelectorAll(".paper-card button[data-id]").forEach(b=>{
    b.addEventListener("click",()=>{
      document.querySelectorAll(".paper-card").forEach(c=>c.classList.remove("selected"));
      b.closest(".paper-card")?.classList.add("selected");
      openPaper(b.dataset.id);
    });
  });
}

function renderIndex(){
  $("#indexList").innerHTML=papers.map(p=>`
    <div class="index-item">
      <div class="tag">${escapeHTML(p.category)} ${p.verified?"· 실제 논문":""}</div>
      <div>
        <strong>${escapeHTML(p.title)}</strong>
        <small>${escapeHTML(p.authors)} · ${escapeHTML(p.year)}${p.difficulty?` · ${escapeHTML(p.difficulty)}`:""}${p.readingTime?` · ${escapeHTML(p.readingTime)}`:""}</small>
      </div>
      <button data-open="${escapeHTML(p.id)}">열기 →</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-open]").forEach(b=>{
    b.addEventListener("click",()=>{
      closeIndex();
      openPaper(b.dataset.open);
    });
  });
}

async function loadPaper(meta){
  if(paperCache.has(meta.id)) return paperCache.get(meta.id);

  const path = meta.file || `papers/${meta.id}.json`;
  const response = await fetch(`./data/${path}`, {cache:"no-store"});
  if(!response.ok) throw new Error(`논문 파일 로드 실패: ${response.status}`);

  const rawPaper = await response.json();
  const fullPaper = normalizePaperData(rawPaper, meta);
  paperCache.set(meta.id, fullPaper);
  return fullPaper;
}

async function openPaper(id){
  const meta=papers.find(p=>p.id===id);
  if(!meta)return;

  try{
    currentPaper=await loadPaper(meta);
  }catch(error){
    console.error(error);
    alert("논문 본문을 불러오지 못했습니다.");
    return;
  }

  currentSections=[
    {
      kicker:"BOOK NOTE",
      title:"이 논문을 한 문장으로",
      html:`<div class="quote">${escapeHTML(currentPaper.summary)}</div>
      <div class="meta-grid">
        <b>분야</b><span>${escapeHTML(currentPaper.category)}</span>
        <b>원문 제목</b><span>${escapeHTML(currentPaper.originalTitle)}</span>
        <b>저자</b><span>${escapeHTML(currentPaper.authors)}</span>
        <b>연도</b><span>${escapeHTML(currentPaper.year)}</span>
        <b>저널</b><span>${escapeHTML(currentPaper.journal)}</span>
        <b>DOI</b><span>${escapeHTML(currentPaper.doi)}</span>
        <b>난이도</b><span>${escapeHTML(currentPaper.difficulty||"미표기")}</span>
        <b>예상 읽기시간</b><span>${escapeHTML(currentPaper.readingTime||"미표기")}</span>
        <b>선행지식</b><span>${escapeHTML(formatPrerequisites(currentPaper.prerequisites))}</span>
      </div>`
    },
    ...(currentPaper.sections||[]).map(section=>({
      ...section,
      html: section.html || formatSectionContent(section.content || "")
    }))
  ];

  currentSpread=-1;

  $("#coverCategory").textContent=(currentPaper.category||"").toUpperCase();
  $("#coverTitle").textContent=currentPaper.title||"";
  $("#coverOriginal").textContent=currentPaper.originalTitle||"";
  $("#coverAuthor").textContent=currentPaper.authors||"";
  $("#coverYear").textContent=currentPaper.year||"";
  $(".cover-shell").style.setProperty("--cover-color",currentPaper.color||"#4d5b8b");

  $("#miniCover").style.background=`linear-gradient(145deg,rgba(255,255,255,.12),rgba(255,255,255,.02)),${currentPaper.color||"#4d5b8b"}`;
  $("#miniCategory").textContent=currentPaper.category||"";
  $("#miniTitle").textContent=currentPaper.shortTitle||currentPaper.title||"";
  $("#miniYear").textContent=(currentPaper.year||"")+(currentPaper.verified?" · 실제 논문":"");

  buildToc();
  renderReader();

  bookModal.classList.add("open");
  bookModal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}

function closePaper(){
  bookModal.classList.remove("open");
  bookModal.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
}

function buildToc(){
  $("#toc").innerHTML=currentSections.map((s,i)=>`
    <button data-section="${i}">
      <span>${String(i+1).padStart(2,"0")}</span>${escapeHTML(s.title)}
    </button>
  `).join("");

  document.querySelectorAll("#toc button").forEach(b=>{
    b.addEventListener("click",()=>{
      currentSpread=Math.floor(Number(b.dataset.section)/2);
      renderReader();
    });
  });
}

function fillPage(side,section,index){
  const prefix=side==="left"?"left":"right";
  $(`#${prefix}Kicker`).textContent=section?.kicker||"";
  $(`#${prefix}SectionNum`).textContent=section?String(index+1).padStart(2,"0"):"";
  $(`#${prefix}Title`).textContent=section?.title||"";
  $(`#${prefix}Content`).innerHTML=section?.html||"";
  $(`#${prefix}PageNumber`).textContent=section?index+1:"";
  const card=$(`#${prefix}Content`)?.closest(".reading-card");
  if(card) card.scrollTop=0;
}

function renderReader(){
  const isCover=currentSpread<0;
  $("#closedBook").classList.toggle("hidden",!isCover);
  $("#openBook").classList.toggle("visible",!isCover);

  if(isCover){
    $("#progressText").textContent="표지";
    $("#progressBar").style.width="0%";
    $("#prevBtn").disabled=true;
    $("#nextBtn").disabled=false;
    $("#nextBtn").textContent="책 열기 →";
    document.querySelectorAll("#toc button").forEach(b=>b.classList.remove("active"));
    if(window.sourceButton)sourceButton.style.display=currentPaper?.sourceUrl?"block":"none";
    return;
  }

  const li=currentSpread*2;
  const ri=li+1;
  fillPage("left",currentSections[li],li);
  fillPage("right",currentSections[ri],ri);

  const total=Math.ceil(currentSections.length/2);
  $("#progressText").textContent=`${currentSpread+1} / ${total}`;
  $("#progressBar").style.width=`${((currentSpread+1)/total)*100}%`;
  $("#prevBtn").disabled=false;
  $("#nextBtn").disabled=currentSpread>=total-1;
  $("#nextBtn").textContent="다음 →";

  document.querySelectorAll("#toc button").forEach((b,i)=>{
    b.classList.toggle("active",Math.floor(i/2)===currentSpread);
  });

  if(window.sourceButton)sourceButton.style.display=currentPaper?.sourceUrl?"block":"none";
}

function next(){
  if(currentSpread<0){
    currentSpread=0;
    renderReader();
    return;
  }
  const max=Math.ceil(currentSections.length/2)-1;
  if(currentSpread<max){
    currentSpread++;
    renderReader();
  }
}

function prev(){
  if(currentSpread===0){
    currentSpread=-1;
    renderReader();
    return;
  }
  if(currentSpread>0){
    currentSpread--;
    renderReader();
  }
}

function openIndex(){
  indexModal.classList.add("open");
  indexModal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}

function closeIndex(){
  indexModal.classList.remove("open");
  indexModal.setAttribute("aria-hidden","true");
  if(!bookModal.classList.contains("open"))document.body.classList.remove("modal-open");
}

function setupSourceButton(){
  window.sourceButton=document.createElement("button");
  sourceButton.className="source-btn";
  sourceButton.textContent="원문 / DOI 보기 ↗";
  sourceButton.addEventListener("click",()=>{
    if(currentPaper?.sourceUrl)window.open(currentPaper.sourceUrl,"_blank","noopener,noreferrer");
  });
  document.querySelector(".reader-main").appendChild(sourceButton);
}

searchInput.addEventListener("input",renderLibrary);
categoryFilter.addEventListener("change",renderLibrary);
$("#randomBtn").addEventListener("click",()=>{
  if(!papers.length) return;
  openPaper(papers[Math.floor(Math.random()*papers.length)].id);
});
$("#openIndexBtn").addEventListener("click",openIndex);
$("#closeIndexBtn").addEventListener("click",closeIndex);
$("#closeBookBtn").addEventListener("click",closePaper);
$("#nextBtn").addEventListener("click",next);
$("#prevBtn").addEventListener("click",prev);

bookModal.addEventListener("click",e=>{
  if(e.target.classList.contains("reader-backdrop"))closePaper();
});
indexModal.addEventListener("click",e=>{
  if(e.target.classList.contains("reader-backdrop"))closeIndex();
});

document.addEventListener("keydown",e=>{
  if(bookModal.classList.contains("open")){
    if(e.key==="Escape")closePaper();
    if(e.key==="ArrowRight")next();
    if(e.key==="ArrowLeft")prev();
  }else if(indexModal.classList.contains("open")&&e.key==="Escape"){
    closeIndex();
  }
});

const style=document.createElement("style");
style.textContent=`
@keyframes cardIn{
  from{opacity:0;transform:translateY(12px) scale(.988)}
  to{opacity:1;transform:translateY(0) scale(1)}
}
.paper-card.selected{
  border-color:rgba(123,114,255,.28);
  box-shadow:0 18px 46px rgba(0,0,0,.16),0 0 0 1px rgba(123,114,255,.05) inset;
}
.page-content p{
  margin:0 0 1em;
  line-height:1.85;
}
.page-content ul,.page-content ol{
  margin:.35em 0 1.1em;
  padding-left:1.35em;
}
.page-content li{
  margin:.38em 0;
  line-height:1.72;
}
.page-content strong{
  font-weight:700;
}`;
document.head.appendChild(style);

async function boot(){
  try{
    const response=await fetch("./data/index.json",{cache:"no-store"});
    if(!response.ok) throw new Error(`index.json 로드 실패: ${response.status}`);

    papers=await response.json();
    if(!Array.isArray(papers)) throw new Error("index.json 형식이 배열이 아닙니다.");

    init();
  }catch(error){
    console.error(error);
    const library=document.querySelector("#library");
    const resultText=document.querySelector("#resultText");
    if(resultText) resultText.textContent="데이터 로드 오류";
    if(library){
      library.innerHTML=`
        <div class="paper-card" style="grid-column:span 12;min-height:220px;display:flex;align-items:center;justify-content:center;padding:30px;text-align:center;">
          <div>
            <h4 style="margin:0 0 12px;">논문 목록을 불러오지 못했습니다.</h4>
            <p style="margin:0;color:#7e8798;line-height:1.7;">잠시 후 새로고침해 주세요.</p>
          </div>
        </div>`;
    }
  }
}

boot();
