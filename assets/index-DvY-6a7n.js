(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))s(n);new MutationObserver(n=>{for(const r of n)if(r.type==="childList")for(const a of r.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&s(a)}).observe(document,{childList:!0,subtree:!0});function t(n){const r={};return n.integrity&&(r.integrity=n.integrity),n.referrerPolicy&&(r.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?r.credentials="include":n.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function s(n){if(n.ep)return;n.ep=!0;const r=t(n);fetch(n.href,r)}})();const je=(i,e)=>e.some(t=>i instanceof t);let yt,bt;function bs(){return yt||(yt=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function Ss(){return bt||(bt=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const We=new WeakMap,Oe=new WeakMap,De=new WeakMap;function ws(i){const e=new Promise((t,s)=>{const n=()=>{i.removeEventListener("success",r),i.removeEventListener("error",a)},r=()=>{t(se(i.result)),n()},a=()=>{s(i.error),n()};i.addEventListener("success",r),i.addEventListener("error",a)});return De.set(e,i),e}function xs(i){if(We.has(i))return;const e=new Promise((t,s)=>{const n=()=>{i.removeEventListener("complete",r),i.removeEventListener("error",a),i.removeEventListener("abort",a)},r=()=>{t(),n()},a=()=>{s(i.error||new DOMException("AbortError","AbortError")),n()};i.addEventListener("complete",r),i.addEventListener("error",a),i.addEventListener("abort",a)});We.set(i,e)}let Ke={get(i,e,t){if(i instanceof IDBTransaction){if(e==="done")return We.get(i);if(e==="store")return t.objectStoreNames[1]?void 0:t.objectStore(t.objectStoreNames[0])}return se(i[e])},set(i,e,t){return i[e]=t,!0},has(i,e){return i instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in i}};function Yt(i){Ke=i(Ke)}function Es(i){return Ss().includes(i)?function(...e){return i.apply(Ge(this),e),se(this.request)}:function(...e){return se(i.apply(Ge(this),e))}}function Ts(i){return typeof i=="function"?Es(i):(i instanceof IDBTransaction&&xs(i),je(i,bs())?new Proxy(i,Ke):i)}function se(i){if(i instanceof IDBRequest)return ws(i);if(Oe.has(i))return Oe.get(i);const e=Ts(i);return e!==i&&(Oe.set(i,e),De.set(e,i)),e}const Ge=i=>De.get(i);function Ls(i,e,{blocked:t,upgrade:s,blocking:n,terminated:r}={}){const a=indexedDB.open(i,e),o=se(a);return s&&a.addEventListener("upgradeneeded",l=>{s(se(a.result),l.oldVersion,l.newVersion,se(a.transaction),l)}),t&&a.addEventListener("blocked",l=>t(l.oldVersion,l.newVersion,l)),o.then(l=>{r&&l.addEventListener("close",()=>r()),n&&l.addEventListener("versionchange",c=>n(c.oldVersion,c.newVersion,c))}).catch(()=>{}),o}const Rs=["get","getKey","getAll","getAllKeys","count"],$s=["put","add","delete","clear"],Ve=new Map;function St(i,e){if(!(i instanceof IDBDatabase&&!(e in i)&&typeof e=="string"))return;if(Ve.get(e))return Ve.get(e);const t=e.replace(/FromIndex$/,""),s=e!==t,n=$s.includes(t);if(!(t in(s?IDBIndex:IDBObjectStore).prototype)||!(n||Rs.includes(t)))return;const r=async function(a,...o){const l=this.transaction(a,n?"readwrite":"readonly");let c=l.store;return s&&(c=c.index(o.shift())),(await Promise.all([c[t](...o),n&&l.done]))[0]};return Ve.set(e,r),r}Yt(i=>({...i,get:(e,t,s)=>St(e,t)||i.get(e,t,s),has:(e,t)=>!!St(e,t)||i.has(e,t)}));const ks=["continue","continuePrimaryKey","advance"],wt={},Ye=new WeakMap,Xt=new WeakMap,As={get(i,e){if(!ks.includes(e))return i[e];let t=wt[e];return t||(t=wt[e]=function(...s){Ye.set(this,Xt.get(this)[e](...s))}),t}};async function*Fs(...i){let e=this;if(e instanceof IDBCursor||(e=await e.openCursor(...i)),!e)return;e=e;const t=new Proxy(e,As);for(Xt.set(t,e),De.set(t,Ge(e));e;)yield t,e=await(Ye.get(t)||e.continue()),Ye.delete(t)}function xt(i,e){return e===Symbol.asyncIterator&&je(i,[IDBIndex,IDBObjectStore,IDBCursor])||e==="iterate"&&je(i,[IDBIndex,IDBObjectStore])}Yt(i=>({...i,get(e,t,s){return xt(e,t)?Fs:i.get(e,t,s)},has(e,t){return xt(e,t)||i.has(e,t)}}));const Ds="citrus-survey",Is=1;let te=null;async function k(){if(te!==null)return te;try{return te=await Ls(Ds,Is,{upgrade(i,e,t){if(e<1){const s=i.createObjectStore("growthRecords",{keyPath:"id"});s.createIndex("by-sync","syncStatus"),s.createIndex("by-session","sessionKey");const n=i.createObjectStore("qualityRecords",{keyPath:"id"});n.createIndex("by-sync","syncStatus"),n.createIndex("by-session","sessionKey"),i.createObjectStore("settings",{keyPath:"key"});const r=i.createObjectStore("voiceLogs",{keyPath:"id"});r.createIndex("by-date","ts"),r.createIndex("by-session","session"),r.createIndex("by-status","status"),i.createObjectStore("voiceAudio",{keyPath:"id"}).createIndex("by-log","logId"),i.createObjectStore("fieldPresets",{keyPath:"id"})}},blocked(){console.warn("[DB] 이전 버전의 연결이 열려 있어 업그레이드가 차단되었습니다.")},blocking(){te?.close(),te=null},terminated(){console.warn("[DB] 브라우저가 DB 연결을 강제 종료했습니다. 다음 요청 시 재연결합니다."),te=null}}),te}catch(i){throw console.error("[DB] IndexedDB 초기화 실패:",i instanceof Error?i.message:String(i)),new Error(`IndexedDB 초기화 실패: ${i instanceof Error?i.message:String(i)}`)}}async function Cs(){await k()}class Ie{state;listeners=new Set;constructor(e){this.state=e}getState(){return Object.freeze({...this.state})}setState(e){this.state={...this.state,...e};const t=this.getState();this.listeners.forEach(s=>s(t))}subscribe(e){return this.listeners.add(e),e(this.getState()),()=>this.listeners.delete(e)}}const Ns={currentPage:"#/settings",networkStatus:navigator.onLine?"online":"offline",hasSwUpdate:!1,isInitialized:!1};class _s extends Ie{constructor(){super(Ns)}navigate(e){this.setState({currentPage:e})}setNetworkStatus(e){this.setState({networkStatus:e})}setSwUpdate(e){this.setState({hasSwUpdate:e})}setInitialized(){this.setState({isInitialized:!0})}}const Y=new _s,Bs=["일","월","화","수","목","금","토"];function Ms(i){const e=i.getFullYear(),t=String(i.getMonth()+1).padStart(2,"0"),s=String(i.getDate()).padStart(2,"0");return`${e}-${t}-${s}`}function Xe(){return Ms(new Date)}function Ze(i){if(!i||i.length<10)return i;try{const[e,t,s]=i.split("-").map(Number);if(!e||!t||!s)return i;const n=new Date(e,t-1,s),r=String(n.getMonth()+1).padStart(2,"0"),a=String(n.getDate()).padStart(2,"0"),o=Bs[n.getDay()];return`${r}/${a}(${o})`}catch{return i}}function Zt(i){return i.slice(0,10)}function ce(){return new Date().toISOString()}function Jt(){return{surveyDate:Xe(),baseDate:"",farmerName:"",label:"",treatment:"관행",treeNo:1}}const qs={surveyType:"growth",currentRecord:{},lastField:null,sessionFields:Jt(),isDirty:!1};class Ps extends Ie{constructor(){super(qs)}setSurveyType(e){this.setState({surveyType:e,currentRecord:{},isDirty:!1})}updateField(e,t){const n={...this.getState().currentRecord,[e]:t};this.recalculate(n),this.setState({currentRecord:n,lastField:e,isDirty:!0})}updateSessionFields(e){const t=this.getState();this.setState({sessionFields:{...t.sessionFields,...e}})}setLastField(e){this.setState({lastField:e})}loadSession(e){this.setState({sessionFields:e})}resetAfterSave(){const t={...this.getState().currentRecord};delete t.fruitNo,this.setState({currentRecord:t,isDirty:!1})}resetAll(){this.setState({currentRecord:{},lastField:null,sessionFields:Jt(),isDirty:!1})}applyVoiceResult(e){const t=this.getState(),s=e.isCorrection?t.lastField:e.field;if(s===null)return;const n=e.numericValue!==null?e.numericValue:e.value;this.updateField(s,n)}recalculate(e){e.pericarpThickness!=null?e.pericarpThicknessX4=Math.round(e.pericarpThickness*4*10)/10:e.pericarpThicknessX4=null,e.brix!=null&&e.acidContent!=null&&e.acidContent!==0?e.sugarAcidRatio=Math.round(e.brix/e.acidContent*100)/100:e.sugarAcidRatio=null}buildRecord(e,t,s){const n=this.getState(),r={id:e,sessionKey:t,surveyDate:n.sessionFields.surveyDate,baseDate:n.sessionFields.baseDate||null,farmerName:n.sessionFields.farmerName,label:n.sessionFields.label,treatment:n.sessionFields.treatment,treeNo:n.sessionFields.treeNo,fruitNo:n.currentRecord.fruitNo??0,width:n.currentRecord.width??null,height:n.currentRecord.height??null,remark:n.currentRecord.remark??"",syncStatus:"pending",syncedAt:null,createdAt:s,updatedAt:s};if(n.surveyType==="quality"){const a=n.currentRecord;return{...r,fruitWeight:a.fruitWeight??null,pericarpWeight:a.pericarpWeight??null,pericarpThickness:a.pericarpThickness??null,pericarpThicknessX4:a.pericarpThicknessX4??null,brix:a.brix??null,titratableAcidity:a.titratableAcidity??null,acidContent:a.acidContent??null,sugarAcidRatio:a.sugarAcidRatio??null,coloring:a.coloring??null,nonDestructive:a.nonDestructive??null}}return r}}const S=new Ps,Hs={sttStatus:"idle",isTtsSpeaking:!1,pendingField:null,pendingValue:null,interimText:"",lastEchoText:"",isCorrection:!1,errorMessage:null};class zs extends Ie{constructor(){super(Hs)}setSttStatus(e){this.setState({sttStatus:e,errorMessage:null})}setTtsSpeaking(e){this.setState({isTtsSpeaking:e})}setInterimText(e){this.setState({interimText:e})}setRecognitionResult(e){this.setState({pendingField:e.field,pendingValue:e.value,isCorrection:e.isCorrection,sttStatus:"processing",interimText:""})}setEchoText(e){this.setState({lastEchoText:e,isTtsSpeaking:!0})}setError(e){this.setState({errorMessage:e,sttStatus:"idle",interimText:""})}clearPending(){this.setState({pendingField:null,pendingValue:null,isCorrection:!1,isTtsSpeaking:!1})}}const q=new zs,Os={pendingCount:0,isSyncing:!1,lastSyncAt:null,lastSyncResult:null,syncError:null};class Vs extends Ie{constructor(){super(Os)}setPendingCount(e){this.setState({pendingCount:e})}incrementPending(){const e=this.getState();this.setState({pendingCount:e.pendingCount+1})}startSync(){this.setState({isSyncing:!0,syncError:null})}finishSync(e){this.setState({isSyncing:!1,lastSyncAt:ce(),lastSyncResult:e,syncError:null})}setSyncError(e){this.setState({isSyncing:!1,syncError:e})}async refresh(e){try{const t=await e();this.setPendingCount(t)}catch(t){console.warn("[SyncStore] 미동기화 건수 갱신 실패:",t instanceof Error?t.message:String(t))}}}const me=new Vs,Et=["강남호","양승보","이원창"],Tt=["A","B","C"],Lt=["관행","시험"],Us={min:1,max:3},Qt={farmerNames:Et,labels:Tt,treatments:Lt,treeRange:Us,defaultFarmerName:Et[0]??"",defaultLabel:Tt[0]??"A",defaultTreatment:Lt[0]??"관행"};async function Q(i,e){try{const s=await(await k()).get("settings",i);return s===void 0?e:s.value}catch(t){throw new Error(`설정 조회 실패 (key=${i}): ${t instanceof Error?t.message:String(t)}`)}}async function ge(i,e){try{await(await k()).put("settings",{key:i,value:e})}catch(t){throw new Error(`설정 저장 실패 (key=${i}): ${t instanceof Error?t.message:String(t)}`)}}async function at(){return Q("defaults",Qt)}async function js(i){return ge("defaults",i)}function es(){return{...Qt}}class fe extends Error{cause;constructor(e,t){super(e),this.cause=t,this.name="DBError"}}function Ce(i){return i==="growth"?"growthRecords":"qualityRecords"}async function Ws(i,e){try{const t=await k(),s=Ce(i),n=ce(),r={...e,syncStatus:"pending",updatedAt:n};await t.put(s,r)}catch(t){throw new fe(`레코드 저장 실패 (type=${i}, id=${e.id}): ${t instanceof Error?t.message:String(t)}`,t)}}async function Rt(i,e){try{const t=await k(),s=Ce(i);return await t.get(s,e)}catch(t){throw new fe(`레코드 조회 실패 (type=${i}, id=${e}): ${t instanceof Error?t.message:String(t)}`,t)}}async function $t(i,e){try{const t=await k(),s=Ce(i);let n;return e?.syncStatus!==void 0||e?.sessionKey!==void 0||(n=await t.getAll(s)),n}catch(t){throw new fe(`레코드 목록 조회 실패 (type=${i}): ${t instanceof Error?t.message:String(t)}`,t)}}async function Ks(i,e){try{const t=await k(),s=Ce(i);await t.delete(s,e)}catch(t){throw new fe(`레코드 삭제 실패 (type=${i}, id=${e}): ${t instanceof Error?t.message:String(t)}`,t)}}async function ts(){try{const i=await k(),[e,t]=await Promise.all([i.countFromIndex("growthRecords","by-sync","pending"),i.countFromIndex("qualityRecords","by-sync","pending")]);return e+t}catch(i){throw new fe(`미동기화 건수 조회 실패: ${i instanceof Error?i.message:String(i)}`,i)}}async function Gs(i=5){try{const e=await k(),[t,s]=await Promise.all([e.getAll("growthRecords"),e.getAll("qualityRecords")]),n=[...t,...s],r=new Map;for(const o of n){const l=r.get(o.sessionKey);(!l||o.updatedAt>l.updatedAt)&&r.set(o.sessionKey,o)}return Array.from(r.values()).sort((o,l)=>l.updatedAt.localeCompare(o.updatedAt)).slice(0,i).map(o=>({sessionKey:o.sessionKey,surveyDate:o.surveyDate,farmerName:o.farmerName,label:o.label,treatment:o.treatment,lastUpdatedAt:o.updatedAt}))}catch(e){throw new fe(`최근 세션 목록 조회 실패: ${e instanceof Error?e.message:String(e)}`,e)}}const kt=[{href:"#/settings",icon:"⚙️",label:"설정",matchPrefix:"#/settings"},{href:"#/survey/growth",icon:"📏",label:"비대조사",matchPrefix:"#/survey/growth"},{href:"#/survey/quality",icon:"🍊",label:"품질조사",matchPrefix:"#/survey/quality"},{href:"#/records",icon:"📋",label:"목록",matchPrefix:"#/records"},{href:"#/stttest",icon:"🧪",label:"STT테스트",matchPrefix:"#/stttest"},{href:"#/voicelogs",icon:"🎙️",label:"로그",matchPrefix:"#/voicelogs"}];class Ys{el=null;unsubscribe=null;mount(e){this.el=document.createElement("nav"),this.el.className="tab-bar",this.el.setAttribute("role","tablist"),this.el.setAttribute("aria-label","주요 탭"),this.renderTabs("#/survey/growth"),e.appendChild(this.el),this.unsubscribe=Y.subscribe(t=>{this.updateActiveTabs(t.currentPage)})}unmount(){this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=null),this.el&&(this.el.remove(),this.el=null)}renderTabs(e){if(this.el){this.el.innerHTML="";for(const t of kt){const s=e.startsWith(t.matchPrefix),n=document.createElement("button");n.className=`tab-bar-item${s?" active":""}`,n.setAttribute("role","tab"),n.setAttribute("aria-selected",String(s)),n.setAttribute("aria-label",t.label),n.innerHTML=`
        <span class="tab-bar-icon" aria-hidden="true">${t.icon}</span>
        <span class="tab-bar-label">${t.label}</span>
      `,n.addEventListener("click",()=>this.handleTabClick(t.href)),this.el.appendChild(n)}}}updateActiveTabs(e){if(!this.el)return;this.el.querySelectorAll(".tab-bar-item").forEach((s,n)=>{const r=kt[n];if(!r)return;const a=e.startsWith(r.matchPrefix);s.classList.toggle("active",a),s.setAttribute("aria-selected",String(a))})}handleTabClick(e){window.location.hash=e}}class Xs{el=null;unsubscribe=null;mount(e){this.el=document.createElement("div"),this.el.className="offline-banner",this.el.setAttribute("role","alert"),this.el.setAttribute("aria-live","polite"),this.el.innerHTML=`
      <span class="offline-banner-icon">📡</span>
      <span>오프라인 상태입니다. 저장은 가능하며 온라인 복구 시 자동 동기화됩니다.</span>
    `,this.el.style.display="none",e.prepend(this.el),this.unsubscribe=Y.subscribe(t=>{this.updateVisibility(t.networkStatus)})}unmount(){this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=null),this.el&&(this.el.remove(),this.el=null)}updateVisibility(e){if(!this.el)return;const t=e==="offline";this.el.style.display=t?"flex":"none"}}function de(i,e="확인",t=!1){return Zs({message:i,confirmLabel:e,isDangerous:t})}function Zs(i){return new Promise(e=>{new Js(i).show().then(s=>{e(s)})})}class Js{overlay=null;options;constructor(e){this.options={title:e.title??"",message:e.message,confirmLabel:e.confirmLabel??"확인",cancelLabel:e.cancelLabel??"취소",isDangerous:e.isDangerous??!1}}show(){return new Promise(e=>{this.overlay=document.createElement("div"),this.overlay.className="dialog-overlay",this.overlay.setAttribute("role","dialog"),this.overlay.setAttribute("aria-modal","true"),this.overlay.setAttribute("aria-label",this.options.title||this.options.message);const{title:t,message:s,confirmLabel:n,cancelLabel:r,isDangerous:a}=this.options;this.overlay.innerHTML=`
        <div class="dialog-box">
          ${t?`<h2 class="dialog-title">${this.escapeHtml(t)}</h2>`:""}
          <p class="dialog-message">${this.escapeHtml(s)}</p>
          <div class="dialog-actions">
            <button class="dialog-btn dialog-btn-cancel" type="button">${this.escapeHtml(r)}</button>
            <button class="dialog-btn ${a?"dialog-btn-danger":"dialog-btn-confirm"}" type="button">
              ${this.escapeHtml(n)}
            </button>
          </div>
        </div>
      `;const o=this.overlay.querySelector(".dialog-box"),l=this.overlay.querySelector(".dialog-btn-cancel"),c=this.overlay.querySelector(`.${a?"dialog-btn-danger":"dialog-btn-confirm"}`),d=()=>{this.close(),e(!0)},f=()=>{this.close(),e(!1)};this.overlay.addEventListener("click",h=>{h.target===this.overlay&&f()}),o?.addEventListener("click",h=>h.stopPropagation()),c?.addEventListener("click",d),l?.addEventListener("click",f);const u=h=>{h.key==="Enter"?(d(),document.removeEventListener("keydown",u)):h.key==="Escape"&&(f(),document.removeEventListener("keydown",u))};document.addEventListener("keydown",u),document.body.appendChild(this.overlay),c?.focus()})}close(){this.overlay&&(this.overlay.remove(),this.overlay=null)}escapeHtml(e){const t=document.createElement("div");return t.appendChild(document.createTextNode(e)),t.innerHTML}}const Qs={success:"✓",error:"✕",warning:"⚠",info:"ℹ"},ei={success:"rgba(46, 125, 50, 0.95)",error:"rgba(198, 40, 40, 0.95)",warning:"rgba(245, 124, 0, 0.95)",info:"rgba(33, 33, 33, 0.95)"};let re=null,pe=null;function w(i,e="info",t=2e3){re&&(re.remove(),re=null),pe!==null&&(clearTimeout(pe),pe=null);const s=document.createElement("div");s.className="toast",s.setAttribute("role","status"),s.setAttribute("aria-live","polite"),s.style.background=ei[e],s.style.animationDuration="200ms, 300ms",s.style.animationDelay=`0ms, ${t-300}ms`,s.innerHTML=`
    <span style="font-weight:600;margin-right:6px;">${Qs[e]}</span>
    <span>${ti(i)}</span>
  `,document.body.appendChild(s),re=s,pe=setTimeout(()=>{re===s&&(s.remove(),re=null),pe=null},t)}function ti(i){const e=document.createElement("div");return e.appendChild(document.createTextNode(i)),e.innerHTML}const si=["횡경 (mm)","종경 (mm)","비고"],ii=["횡경 (mm)","종경 (mm)","과중 (g)","과피중 (g)","과피두께 (mm)","과피두께×4 (자동계산)","당도 °Bx","적정산도","산함량 (%)","당산도 (자동계산)","착색","비파괴","비고"];class ni{el=null;defaults=es();ttsEnabled=!0;gemmaEnabled=!1;audioRecordEnabled=!1;voiceLogEnabled=!0;isSaving=!1;newFarmerInput=null;newLabelInput=null;newTreatmentInput=null;async mount(e){this.el=document.createElement("div"),this.el.className="page",e.appendChild(this.el),this.renderLoading(),await this.loadSettings(),this.render()}unmount(){this.el&&(this.el.remove(),this.el=null),this.newFarmerInput=null,this.newLabelInput=null,this.newTreatmentInput=null}renderLoading(){this.el&&(this.el.innerHTML=`
      <div class="page-header">
        <h1>설정</h1>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;padding:48px;gap:12px;color:var(--color-text-secondary);">
        <div class="spinner"></div>
        <span>설정 불러오는 중...</span>
      </div>
    `)}async loadSettings(){try{[this.defaults,this.ttsEnabled,this.gemmaEnabled,this.audioRecordEnabled,this.voiceLogEnabled]=await Promise.all([at(),Q("ttsEnabled",!0),Q("gemmaEnabled",!1),Q("audioRecordEnabled",!1),Q("voiceLogEnabled",!0)])}catch{w("설정을 불러오지 못했습니다.","error")}}render(){this.el&&(this.el.innerHTML=`
      <div class="page-header">
        <h1>설정</h1>
      </div>

      <div style="padding: var(--padding-mobile); padding-bottom: calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 80px);">

        <!-- 농가명 목록 -->
        <section class="settings-section" id="farmer-section">
          <h2 class="settings-section-title">농가명 목록</h2>
          <div class="farmer-name-list" id="farmer-list"></div>
          <div class="add-input-row">
            <input
              type="text"
              id="new-farmer-input"
              placeholder="새 농가명 입력"
              maxlength="20"
              autocomplete="off"
            />
            <button class="btn btn-primary" id="add-farmer-btn" type="button" style="flex-shrink:0;padding:0 16px;">
              추가
            </button>
          </div>
        </section>

        <!-- 기본값 설정 -->
        <section class="settings-section" id="defaults-section">
          <h2 class="settings-section-title">기본값 설정</h2>

          <!-- 라벨 -->
          <div class="form-group">
            <label class="form-label">라벨 목록</label>
            <div class="label-chips" id="label-chips"></div>
            <div class="add-input-row" style="margin-top:8px;">
              <input
                type="text"
                id="new-label-input"
                placeholder="새 라벨 입력 (예: D)"
                maxlength="10"
                autocomplete="off"
              />
              <button class="btn btn-primary" id="add-label-btn" type="button" style="flex-shrink:0;padding:0 16px;">
                추가
              </button>
            </div>
          </div>

          <!-- 처리 -->
          <div class="form-group">
            <label class="form-label">처리 목록</label>
            <div class="label-chips" id="treatment-chips"></div>
            <div class="add-input-row" style="margin-top:8px;">
              <input
                type="text"
                id="new-treatment-input"
                placeholder="새 처리 입력 (예: 시험2)"
                maxlength="20"
                autocomplete="off"
              />
              <button class="btn btn-primary" id="add-treatment-btn" type="button" style="flex-shrink:0;padding:0 16px;">
                추가
              </button>
            </div>
          </div>

          <!-- 조사나무 범위 -->
          <div class="form-group">
            <label class="form-label">조사나무 범위</label>
            <div class="tree-range-row">
              <input
                type="number"
                id="tree-min-input"
                class="tree-range-input"
                value="${this.defaults.treeRange.min}"
                min="1" max="100"
                placeholder="시작"
                inputmode="numeric"
              />
              <span class="tree-range-separator">~</span>
              <input
                type="number"
                id="tree-max-input"
                class="tree-range-input"
                value="${this.defaults.treeRange.max}"
                min="1" max="100"
                placeholder="끝"
                inputmode="numeric"
              />
              <span class="tree-range-separator">번</span>
            </div>
          </div>
        </section>

        <!-- 기본 항목 세트 안내 (읽기 전용) -->
        <section class="settings-section">
          <h2 class="settings-section-title">조사 항목 세트</h2>
          <p style="font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-bottom:12px;">
            기본 항목 세트는 아래와 같이 고정되어 있습니다.
          </p>

          <div class="preset-info-box" style="margin-bottom:12px;">
            <div class="preset-info-title">📏 비대조사 기본 세트</div>
            <div class="preset-info-fields">${si.join(" · ")}</div>
          </div>

          <div class="preset-info-box">
            <div class="preset-info-title">🍊 품질조사 기본 세트</div>
            <div class="preset-info-fields">${ii.join(" · ")}</div>
          </div>
        </section>

        <!-- 기능 토글 -->
        <section class="settings-section">
          <h2 class="settings-section-title">기능 설정</h2>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">TTS 음성 피드백</div>
              <div class="toggle-description">입력 결과를 음성으로 읽어줍니다</div>
            </div>
            <label class="toggle-switch" aria-label="TTS 음성 피드백">
              <input type="checkbox" id="tts-toggle" ${this.ttsEnabled?"checked":""} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-row" id="gemma-toggle-row">
            <div>
              <div class="toggle-label">AI 보조 (비고 입력)</div>
              <div class="toggle-description" id="gemma-desc"></div>
            </div>
            <label class="toggle-switch" aria-label="AI 보조 기능">
              <input type="checkbox" id="gemma-toggle" ${this.gemmaEnabled?"checked":""} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">오디오 녹음</div>
              <div class="toggle-description">발화 구간 오디오를 저장합니다</div>
            </div>
            <label class="toggle-switch" aria-label="오디오 녹음">
              <input type="checkbox" id="audio-toggle" ${this.audioRecordEnabled?"checked":""} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">STT 로그 수집</div>
              <div class="toggle-description">음성 인식 로그를 저장합니다</div>
            </div>
            <label class="toggle-switch" aria-label="STT 로그 수집">
              <input type="checkbox" id="log-toggle" ${this.voiceLogEnabled?"checked":""} />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </section>

        <!-- 저장 버튼 -->
        <div class="save-area">
          <button class="btn btn-primary btn-full" id="save-btn" type="button" style="height:52px;font-size:18px;">
            설정 저장
          </button>
        </div>

      </div>
    `,this.renderFarmerList(),this.renderLabelChips(),this.renderTreatmentChips(),this.setupGemmaToggle(),this.bindEvents())}renderFarmerList(){const e=this.el?.querySelector("#farmer-list");e&&(e.innerHTML=this.defaults.farmerNames.map(t=>`
      <div class="farmer-name-item" data-name="${this.escapeAttr(t)}">
        <span class="farmer-name-text">${this.escapeHtml(t)}</span>
        ${t===this.defaults.defaultFarmerName?'<span class="farmer-name-default-badge">기본값</span>':`<button class="btn btn-ghost" data-action="set-default-farmer" data-name="${this.escapeAttr(t)}" type="button" style="font-size:12px;height:32px;padding:0 8px;color:var(--color-primary);">기본</button>`}
        <button class="delete-btn" data-action="delete-farmer" data-name="${this.escapeAttr(t)}" type="button" aria-label="${this.escapeAttr(t)} 삭제">
          ✕
        </button>
      </div>
    `).join(""))}renderLabelChips(){const e=this.el?.querySelector("#label-chips");e&&(e.innerHTML=this.defaults.labels.map(t=>`
      <div style="display:flex;align-items:center;gap:4px;">
        <span class="label-chip${t===this.defaults.defaultLabel?" selected":""}"
              data-action="set-default-label" data-value="${this.escapeAttr(t)}">
          ${this.escapeHtml(t)}
          ${t===this.defaults.defaultLabel?" ✓":""}
        </span>
        ${this.defaults.labels.length>1?`<button class="delete-btn" data-action="delete-label" data-value="${this.escapeAttr(t)}" type="button" aria-label="${this.escapeAttr(t)} 삭제" style="width:28px;height:28px;font-size:14px;">✕</button>`:""}
      </div>
    `).join(""))}renderTreatmentChips(){const e=this.el?.querySelector("#treatment-chips");e&&(e.innerHTML=this.defaults.treatments.map(t=>`
      <div style="display:flex;align-items:center;gap:4px;">
        <span class="label-chip${t===this.defaults.defaultTreatment?" selected":""}"
              data-action="set-default-treatment" data-value="${this.escapeAttr(t)}">
          ${this.escapeHtml(t)}
          ${t===this.defaults.defaultTreatment?" ✓":""}
        </span>
        ${this.defaults.treatments.length>1?`<button class="delete-btn" data-action="delete-treatment" data-value="${this.escapeAttr(t)}" type="button" aria-label="${this.escapeAttr(t)} 삭제" style="width:28px;height:28px;font-size:14px;">✕</button>`:""}
      </div>
    `).join(""))}setupGemmaToggle(){const e=/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1,t=this.el?.querySelector("#gemma-desc"),s=this.el?.querySelector("#gemma-toggle"),n=this.el?.querySelector("#gemma-toggle-row");e?(t&&(t.textContent="이 기기에서 AI 보조 기능이 지원되지 않습니다"),s&&(s.disabled=!0,s.checked=!1),n&&(n.style.opacity="0.5")):t&&(t.textContent="Android Chrome에서 비고 입력 보조 제안 (Gemma AI)")}bindEvents(){if(!this.el)return;this.newFarmerInput=this.el.querySelector("#new-farmer-input"),this.el.querySelector("#add-farmer-btn")?.addEventListener("click",()=>this.handleAddFarmer()),this.newFarmerInput?.addEventListener("keydown",c=>{c.key==="Enter"&&this.handleAddFarmer()}),this.newLabelInput=this.el.querySelector("#new-label-input"),this.el.querySelector("#add-label-btn")?.addEventListener("click",()=>this.handleAddLabel()),this.newLabelInput?.addEventListener("keydown",c=>{c.key==="Enter"&&this.handleAddLabel()}),this.newTreatmentInput=this.el.querySelector("#new-treatment-input"),this.el.querySelector("#add-treatment-btn")?.addEventListener("click",()=>this.handleAddTreatment()),this.newTreatmentInput?.addEventListener("keydown",c=>{c.key==="Enter"&&this.handleAddTreatment()}),this.el.addEventListener("click",c=>{const f=c.target.closest("[data-action]");if(!f)return;const u=f.dataset.action,h=f.dataset.name,v=f.dataset.value;switch(u){case"delete-farmer":h&&this.handleDeleteFarmer(h);break;case"set-default-farmer":h&&this.handleSetDefaultFarmer(h);break;case"set-default-label":v&&this.handleSetDefaultLabel(v);break;case"delete-label":v&&this.handleDeleteLabel(v);break;case"set-default-treatment":v&&this.handleSetDefaultTreatment(v);break;case"delete-treatment":v&&this.handleDeleteTreatment(v);break}});const n=this.el.querySelector("#tts-toggle");n?.addEventListener("change",async()=>{this.ttsEnabled=n.checked,await ge("ttsEnabled",this.ttsEnabled)});const r=this.el.querySelector("#gemma-toggle");r?.addEventListener("change",async()=>{this.gemmaEnabled=r.checked,await ge("gemmaEnabled",this.gemmaEnabled)});const a=this.el.querySelector("#audio-toggle");a?.addEventListener("change",async()=>{this.audioRecordEnabled=a.checked,await ge("audioRecordEnabled",this.audioRecordEnabled)});const o=this.el.querySelector("#log-toggle");o?.addEventListener("change",async()=>{this.voiceLogEnabled=o.checked,await ge("voiceLogEnabled",this.voiceLogEnabled)}),this.el.querySelector("#save-btn")?.addEventListener("click",()=>this.handleSave())}handleAddFarmer(){const e=this.newFarmerInput;if(!e)return;const t=e.value.trim();if(t){if(this.defaults.farmerNames.includes(t)){w("이미 존재하는 농가명입니다.","warning");return}this.defaults={...this.defaults,farmerNames:[...this.defaults.farmerNames,t]},e.value="",this.renderFarmerList()}}async handleDeleteFarmer(e){if(this.defaults.farmerNames.length<=1){w("농가명은 최소 1개가 필요합니다.","warning");return}if(!await de(`"${e}"을 삭제하시겠습니까?`,"삭제",!0))return;const s=this.defaults.farmerNames.filter(n=>n!==e);this.defaults={...this.defaults,farmerNames:s,defaultFarmerName:this.defaults.defaultFarmerName===e?s[0]??"":this.defaults.defaultFarmerName},this.renderFarmerList()}handleSetDefaultFarmer(e){this.defaults={...this.defaults,defaultFarmerName:e},this.renderFarmerList()}handleAddLabel(){const e=this.newLabelInput;if(!e)return;const t=e.value.trim();if(t){if(this.defaults.labels.includes(t)){w("이미 존재하는 라벨입니다.","warning");return}this.defaults={...this.defaults,labels:[...this.defaults.labels,t]},e.value="",this.renderLabelChips()}}handleDeleteLabel(e){if(this.defaults.labels.length<=1){w("라벨은 최소 1개가 필요합니다.","warning");return}const t=this.defaults.labels.filter(s=>s!==e);this.defaults={...this.defaults,labels:t,defaultLabel:this.defaults.defaultLabel===e?t[0]??"":this.defaults.defaultLabel},this.renderLabelChips()}handleSetDefaultLabel(e){this.defaults={...this.defaults,defaultLabel:e},this.renderLabelChips()}handleAddTreatment(){const e=this.newTreatmentInput;if(!e)return;const t=e.value.trim();if(t){if(this.defaults.treatments.includes(t)){w("이미 존재하는 처리입니다.","warning");return}this.defaults={...this.defaults,treatments:[...this.defaults.treatments,t]},e.value="",this.renderTreatmentChips()}}handleDeleteTreatment(e){if(this.defaults.treatments.length<=1){w("처리는 최소 1개가 필요합니다.","warning");return}const t=this.defaults.treatments.filter(s=>s!==e);this.defaults={...this.defaults,treatments:t,defaultTreatment:this.defaults.defaultTreatment===e?t[0]??"":this.defaults.defaultTreatment},this.renderTreatmentChips()}handleSetDefaultTreatment(e){this.defaults={...this.defaults,defaultTreatment:e},this.renderTreatmentChips()}async handleSave(){if(this.isSaving)return;const e=this.el?.querySelector("#tree-min-input"),t=this.el?.querySelector("#tree-max-input"),s=parseInt(e?.value??"1",10),n=parseInt(t?.value??"3",10);if(isNaN(s)||isNaN(n)||s<1||n<s){w("조사나무 범위가 올바르지 않습니다.","error");return}const r={...this.defaults,treeRange:{min:s,max:n}};this.isSaving=!0;const a=this.el?.querySelector("#save-btn");a&&(a.disabled=!0,a.textContent="저장 중...");try{await js(r),this.defaults=r,w("설정이 저장되었습니다.","success")}catch{w("설정 저장에 실패했습니다.","error")}finally{this.isSaving=!1,a&&(a.disabled=!1,a.textContent="설정 저장")}}escapeHtml(e){const t=document.createElement("div");return t.appendChild(document.createTextNode(e)),t.innerHTML}escapeAttr(e){return e.replace(/"/g,"&quot;").replace(/'/g,"&#39;")}}var At={},ri=(function(i,e,t,s,n){var r=new Worker(At[e]||(At[e]=URL.createObjectURL(new Blob([i+';addEventListener("error",function(e){e=e.error;postMessage({$e$:[e.message,e.code,e.stack]})})'],{type:"text/javascript"}))));return r.onmessage=function(a){var o=a.data,l=o.$e$;if(l){var c=new Error(l[0]);c.code=l[1],c.stack=l[2],n(c,null)}else n(null,o)},r.postMessage(t,s),r}),N=Uint8Array,P=Uint16Array,Ne=Int32Array,_e=new N([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),Be=new N([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),Je=new N([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),ss=function(i,e){for(var t=new P(31),s=0;s<31;++s)t[s]=e+=1<<i[s-1];for(var n=new Ne(t[30]),s=1;s<30;++s)for(var r=t[s];r<t[s+1];++r)n[r]=r-t[s]<<5|s;return{b:t,r:n}},is=ss(_e,2),ai=is.b,ke=is.r;ai[28]=258,ke[258]=28;var oi=ss(Be,0),Qe=oi.r,Ae=new P(32768);for(var E=0;E<32768;++E){var Z=(E&43690)>>1|(E&21845)<<1;Z=(Z&52428)>>2|(Z&13107)<<2,Z=(Z&61680)>>4|(Z&3855)<<4,Ae[E]=((Z&65280)>>8|(Z&255)<<8)>>1}var le=(function(i,e,t){for(var s=i.length,n=0,r=new P(e);n<s;++n)i[n]&&++r[i[n]-1];var a=new P(e);for(n=1;n<e;++n)a[n]=a[n-1]+r[n-1]<<1;var o;if(t){o=new P(1<<e);var l=15-e;for(n=0;n<s;++n)if(i[n])for(var c=n<<4|i[n],d=e-i[n],f=a[i[n]-1]++<<d,u=f|(1<<d)-1;f<=u;++f)o[Ae[f]>>l]=c}else for(o=new P(s),n=0;n<s;++n)i[n]&&(o[n]=Ae[a[i[n]-1]++]>>15-i[n]);return o}),ee=new N(288);for(var E=0;E<144;++E)ee[E]=8;for(var E=144;E<256;++E)ee[E]=9;for(var E=256;E<280;++E)ee[E]=7;for(var E=280;E<288;++E)ee[E]=8;var ye=new N(32);for(var E=0;E<32;++E)ye[E]=5;var ns=le(ee,9,0),rs=le(ye,5,0),ot=function(i){return(i+7)/8|0},lt=function(i,e,t){return(e==null||e<0)&&(e=0),(t==null||t>i.length)&&(t=i.length),new N(i.subarray(e,t))},li=["unexpected EOF","invalid block type","invalid length/literal","invalid distance","stream finished","no stream handler",,"no callback","invalid UTF-8 data","extra field too long","date not in range 1980-2099","filename too long","stream finishing","invalid zip data"],ue=function(i,e,t){var s=new Error(e||li[i]);if(s.code=i,Error.captureStackTrace&&Error.captureStackTrace(s,ue),!t)throw s;return s},W=function(i,e,t){t<<=e&7;var s=e/8|0;i[s]|=t,i[s+1]|=t>>8},ae=function(i,e,t){t<<=e&7;var s=e/8|0;i[s]|=t,i[s+1]|=t>>8,i[s+2]|=t>>16},Ee=function(i,e){for(var t=[],s=0;s<i.length;++s)i[s]&&t.push({s,f:i[s]});var n=t.length,r=t.slice();if(!n)return{t:dt,l:0};if(n==1){var a=new N(t[0].s+1);return a[t[0].s]=1,{t:a,l:1}}t.sort(function(x,T){return x.f-T.f}),t.push({s:-1,f:25001});var o=t[0],l=t[1],c=0,d=1,f=2;for(t[0]={s:-1,f:o.f+l.f,l:o,r:l};d!=n-1;)o=t[t[c].f<t[f].f?c++:f++],l=t[c!=d&&t[c].f<t[f].f?c++:f++],t[d++]={s:-1,f:o.f+l.f,l:o,r:l};for(var u=r[0].s,s=1;s<n;++s)r[s].s>u&&(u=r[s].s);var h=new P(u+1),v=Fe(t[d-1],h,0);if(v>e){var s=0,m=0,p=v-e,R=1<<p;for(r.sort(function(T,L){return h[L.s]-h[T.s]||T.f-L.f});s<n;++s){var D=r[s].s;if(h[D]>e)m+=R-(1<<v-h[D]),h[D]=e;else break}for(m>>=p;m>0;){var A=r[s].s;h[A]<e?m-=1<<e-h[A]++-1:++s}for(;s>=0&&m;--s){var y=r[s].s;h[y]==e&&(--h[y],++m)}v=e}return{t:new N(h),l:v}},Fe=function(i,e,t){return i.s==-1?Math.max(Fe(i.l,e,t+1),Fe(i.r,e,t+1)):e[i.s]=t},et=function(i){for(var e=i.length;e&&!i[--e];);for(var t=new P(++e),s=0,n=i[0],r=1,a=function(l){t[s++]=l},o=1;o<=e;++o)if(i[o]==n&&o!=e)++r;else{if(!n&&r>2){for(;r>138;r-=138)a(32754);r>2&&(a(r>10?r-11<<5|28690:r-3<<5|12305),r=0)}else if(r>3){for(a(n),--r;r>6;r-=6)a(8304);r>2&&(a(r-3<<5|8208),r=0)}for(;r--;)a(n);r=1,n=i[o]}return{c:t.subarray(0,s),n:e}},oe=function(i,e){for(var t=0,s=0;s<e.length;++s)t+=i[s]*e[s];return t},ct=function(i,e,t){var s=t.length,n=ot(e+2);i[n]=s&255,i[n+1]=s>>8,i[n+2]=i[n]^255,i[n+3]=i[n+1]^255;for(var r=0;r<s;++r)i[n+r+4]=t[r];return(n+4+s)*8},tt=function(i,e,t,s,n,r,a,o,l,c,d){W(e,d++,t),++n[256];for(var f=Ee(n,15),u=f.t,h=f.l,v=Ee(r,15),m=v.t,p=v.l,R=et(u),D=R.c,A=R.n,y=et(m),x=y.c,T=y.n,L=new P(19),b=0;b<D.length;++b)++L[D[b]&31];for(var b=0;b<x.length;++b)++L[x[b]&31];for(var g=Ee(L,7),F=g.t,K=g.l,_=19;_>4&&!F[Je[_-1]];--_);var G=c+5<<3,I=oe(n,ee)+oe(r,ye)+a,B=oe(n,u)+oe(r,m)+a+14+3*_+oe(L,F)+2*L[16]+3*L[17]+7*L[18];if(l>=0&&G<=I&&G<=B)return ct(e,d,i.subarray(l,l+c));var H,$,V,X;if(W(e,d,1+(B<I)),d+=2,B<I){H=le(u,h,0),$=u,V=le(m,p,0),X=m;var qe=le(F,K,0);W(e,d,A-257),W(e,d+5,T-1),W(e,d+10,_-4),d+=14;for(var b=0;b<_;++b)W(e,d+3*b,F[Je[b]]);d+=3*_;for(var U=[D,x],ve=0;ve<2;++ve)for(var ie=U[ve],b=0;b<ie.length;++b){var j=ie[b]&31;W(e,d,qe[j]),d+=F[j],j>15&&(W(e,d,ie[b]>>5&127),d+=ie[b]>>12)}}else H=ns,$=ee,V=rs,X=ye;for(var b=0;b<o;++b){var M=s[b];if(M>255){var j=M>>18&31;ae(e,d,H[j+257]),d+=$[j+257],j>7&&(W(e,d,M>>23&31),d+=_e[j]);var ne=M&31;ae(e,d,V[ne]),d+=X[ne],ne>3&&(ae(e,d,M>>5&8191),d+=Be[ne])}else ae(e,d,H[M]),d+=$[M]}return ae(e,d,H[256]),d+$[256]},as=new Ne([65540,131080,131088,131104,262176,1048704,1048832,2114560,2117632]),dt=new N(0),os=function(i,e,t,s,n,r){var a=r.z||i.length,o=new N(s+a+5*(1+Math.ceil(a/7e3))+n),l=o.subarray(s,o.length-n),c=r.l,d=(r.r||0)&7;if(e){d&&(l[0]=r.r>>3);for(var f=as[e-1],u=f>>13,h=f&8191,v=(1<<t)-1,m=r.p||new P(32768),p=r.h||new P(v+1),R=Math.ceil(t/3),D=2*R,A=function(ze){return(i[ze]^i[ze+1]<<R^i[ze+2]<<D)&v},y=new Ne(25e3),x=new P(288),T=new P(32),L=0,b=0,g=r.i||0,F=0,K=r.w||0,_=0;g+2<a;++g){var G=A(g),I=g&32767,B=p[G];if(m[I]=B,p[G]=I,K<=g){var H=a-g;if((L>7e3||F>24576)&&(H>423||!c)){d=tt(i,l,0,y,x,T,b,F,_,g-_,d),F=L=b=0,_=g;for(var $=0;$<286;++$)x[$]=0;for(var $=0;$<30;++$)T[$]=0}var V=2,X=0,qe=h,U=I-B&32767;if(H>2&&G==A(g-U))for(var ve=Math.min(u,H)-1,ie=Math.min(32767,g),j=Math.min(258,H);U<=ie&&--qe&&I!=B;){if(i[g+V]==i[g+V-U]){for(var M=0;M<j&&i[g+M]==i[g+M-U];++M);if(M>V){if(V=M,X=U,M>ve)break;for(var ne=Math.min(U,M-2),vt=0,$=0;$<ne;++$){var Pe=g-U+$&32767,ys=m[Pe],pt=Pe-ys&32767;pt>vt&&(vt=pt,B=Pe)}}}I=B,B=m[I],U+=I-B&32767}if(X){y[F++]=268435456|ke[V]<<18|Qe[X];var gt=ke[V]&31,mt=Qe[X]&31;b+=_e[gt]+Be[mt],++x[257+gt],++T[mt],K=g+V,++L}else y[F++]=i[g],++x[i[g]]}}for(g=Math.max(g,K);g<a;++g)y[F++]=i[g],++x[i[g]];d=tt(i,l,c,y,x,T,b,F,_,g-_,d),c||(r.r=d&7|l[d/8|0]<<3,d-=7,r.h=p,r.p=m,r.i=g,r.w=K)}else{for(var g=r.w||0;g<a+c;g+=65535){var He=g+65535;He>=a&&(l[d/8|0]=c,He=a),d=ct(l,d+1,i.subarray(g,He))}r.i=a}return lt(o,0,s+ot(d)+n)},ci=(function(){for(var i=new Int32Array(256),e=0;e<256;++e){for(var t=e,s=9;--s;)t=(t&1&&-306674912)^t>>>1;i[e]=t}return i})(),di=function(){var i=-1;return{p:function(e){for(var t=i,s=0;s<e.length;++s)t=ci[t&255^e[s]]^t>>>8;i=t},d:function(){return~i}}},ls=function(i,e,t,s,n){if(!n&&(n={l:1},e.dictionary)){var r=e.dictionary.subarray(-32768),a=new N(r.length+i.length);a.set(r),a.set(i,r.length),i=a,n.w=r.length}return os(i,e.level==null?6:e.level,e.mem==null?n.l?Math.ceil(Math.max(8,Math.min(13,Math.log(i.length)))*1.5):20:12+e.mem,t,s,n)},ut=function(i,e){var t={};for(var s in i)t[s]=i[s];for(var s in e)t[s]=e[s];return t},Ft=function(i,e,t){for(var s=i(),n=i.toString(),r=n.slice(n.indexOf("[")+1,n.lastIndexOf("]")).replace(/\s+/g,"").split(","),a=0;a<s.length;++a){var o=s[a],l=r[a];if(typeof o=="function"){e+=";"+l+"=";var c=o.toString();if(o.prototype)if(c.indexOf("[native code]")!=-1){var d=c.indexOf(" ",8)+1;e+=c.slice(d,c.indexOf("(",d))}else{e+=c;for(var f in o.prototype)e+=";"+l+".prototype."+f+"="+o.prototype[f].toString()}else e+=c}else t[l]=o}return e},be=[],ui=function(i){var e=[];for(var t in i)i[t].buffer&&e.push((i[t]=new i[t].constructor(i[t])).buffer);return e},hi=function(i,e,t,s){if(!be[t]){for(var n="",r={},a=i.length-1,o=0;o<a;++o)n=Ft(i[o],n,r);be[t]={c:Ft(i[a],n,r),e:r}}var l=ut({},be[t].e);return ri(be[t].c+";onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage="+e.toString()+"}",t,l,ui(l),s)},fi=function(){return[N,P,Ne,_e,Be,Je,ke,Qe,ns,ee,rs,ye,Ae,as,dt,le,W,ae,Ee,Fe,et,oe,ct,tt,ot,lt,os,ls,ht,cs]},cs=function(i){return postMessage(i,[i.buffer])},vi=function(i,e,t,s,n,r){var a=hi(t,s,n,function(o,l){a.terminate(),r(o,l)});return a.postMessage([i,e],e.consume?[i.buffer]:[]),function(){a.terminate()}},C=function(i,e,t){for(;t;++e)i[e]=t,t>>>=8};function pi(i,e,t){return t||(t=e,e={}),typeof t!="function"&&ue(7),vi(i,e,[fi],function(s){return cs(ht(s.data[0],s.data[1]))},0,t)}function ht(i,e){return ls(i,e||{},0,0)}var ds=function(i,e,t,s){for(var n in i){var r=i[n],a=e+n,o=s;Array.isArray(r)&&(o=ut(s,r[1]),r=r[0]),r instanceof N?t[a]=[r,o]:(t[a+="/"]=[new N(0),o],ds(r,a,t,s))}},Dt=typeof TextEncoder<"u"&&new TextEncoder,gi=typeof TextDecoder<"u"&&new TextDecoder,mi=0;try{gi.decode(dt,{stream:!0}),mi=1}catch{}function st(i,e){var t;if(Dt)return Dt.encode(i);for(var s=i.length,n=new N(i.length+(i.length>>1)),r=0,a=function(c){n[r++]=c},t=0;t<s;++t){if(r+5>n.length){var o=new N(r+8+(s-t<<1));o.set(n),n=o}var l=i.charCodeAt(t);l<128||e?a(l):l<2048?(a(192|l>>6),a(128|l&63)):l>55295&&l<57344?(l=65536+(l&1047552)|i.charCodeAt(++t)&1023,a(240|l>>18),a(128|l>>12&63),a(128|l>>6&63),a(128|l&63)):(a(224|l>>12),a(128|l>>6&63),a(128|l&63))}return lt(n,0,r)}var it=function(i){var e=0;if(i)for(var t in i){var s=i[t].length;s>65535&&ue(9),e+=s+4}return e},It=function(i,e,t,s,n,r,a,o){var l=s.length,c=t.extra,d=o&&o.length,f=it(c);C(i,e,a!=null?33639248:67324752),e+=4,a!=null&&(i[e++]=20,i[e++]=t.os),i[e]=20,e+=2,i[e++]=t.flag<<1|(r<0&&8),i[e++]=n&&8,i[e++]=t.compression&255,i[e++]=t.compression>>8;var u=new Date(t.mtime==null?Date.now():t.mtime),h=u.getFullYear()-1980;if((h<0||h>119)&&ue(10),C(i,e,h<<25|u.getMonth()+1<<21|u.getDate()<<16|u.getHours()<<11|u.getMinutes()<<5|u.getSeconds()>>1),e+=4,r!=-1&&(C(i,e,t.crc),C(i,e+4,r<0?-r-2:r),C(i,e+8,t.size)),C(i,e+12,l),C(i,e+14,f),e+=16,a!=null&&(C(i,e,d),C(i,e+6,t.attrs),C(i,e+10,a),e+=14),i.set(s,e),e+=l,f)for(var v in c){var m=c[v],p=m.length;C(i,e,+v),C(i,e+2,p),i.set(m,e+4),e+=4+p}return d&&(i.set(o,e),e+=d),e},yi=function(i,e,t,s,n){C(i,e,101010256),C(i,e+8,t),C(i,e+10,t),C(i,e+12,s),C(i,e+16,n)};function bi(i,e,t){t||(t=e,e={}),typeof t!="function"&&ue(7);var s={};ds(i,"",s,e);var n=Object.keys(s),r=n.length,a=0,o=0,l=r,c=new Array(r),d=[],f=function(){for(var p=0;p<d.length;++p)d[p]()},u=function(p,R){Ct(function(){t(p,R)})};Ct(function(){u=t});var h=function(){var p=new N(o+22),R=a,D=o-a;o=0;for(var A=0;A<l;++A){var y=c[A];try{var x=y.c.length;It(p,o,y,y.f,y.u,x);var T=30+y.f.length+it(y.extra),L=o+T;p.set(y.c,L),It(p,a,y,y.f,y.u,x,o,y.m),a+=16+T+(y.m?y.m.length:0),o=L+x}catch(b){return u(b,null)}}yi(p,a,c.length,D,R),u(null,p)};r||h();for(var v=function(p){var R=n[p],D=s[R],A=D[0],y=D[1],x=di(),T=A.length;x.p(A);var L=st(R),b=L.length,g=y.comment,F=g&&st(g),K=F&&F.length,_=it(y.extra),G=y.level==0?0:8,I=function(B,H){if(B)f(),u(B,null);else{var $=H.length;c[p]=ut(y,{size:T,crc:x.d(),c:H,f:L,m:F,u:b!=R.length||F&&g.length!=K,compression:G}),a+=30+b+_+$,o+=76+2*(b+_)+(K||0)+$,--r||h()}};if(b>65535&&I(ue(11,0,1),null),!G)I(null,A);else if(T<16e4)try{I(null,ht(A,y))}catch(B){I(B,null)}else d.push(pi(A,y,I))},m=0;m<l;++m)v(m);return f}var Ct=typeof queueMicrotask=="function"?queueMicrotask:typeof setTimeout=="function"?setTimeout:function(i){i()};function us(){return crypto.randomUUID()}async function Te(i){try{const e=await k(),t=us(),s={id:t,...i};return await e.add("voiceLogs",s),t}catch(e){throw new Error(`음성 로그 저장 실패: ${e instanceof Error?e.message:String(e)}`)}}async function Le(i){try{const e=await k(),t=us(),s={id:t,...i};return await e.add("voiceAudio",s),t}catch(e){throw new Error(`오디오 저장 실패: ${e instanceof Error?e.message:String(e)}`)}}async function Re(i,e){try{const t=await k(),s=await t.get("voiceLogs",i);if(!s){await t.delete("voiceAudio",e).catch(()=>{});return}await t.put("voiceLogs",{...s,audioFileId:e})}catch(t){try{await(await k()).delete("voiceAudio",e)}catch{}throw new Error(`audioFileId 업데이트 실패 (logId=${i}): ${t instanceof Error?t.message:String(t)}`)}}async function Me(i){try{const e=await k();let t;return i?.kind!==void 0?(t=await e.getAll("voiceLogs"),t=t.filter(s=>s.kind===i.kind)):t=await e.getAll("voiceLogs"),(i?.dateFrom!==void 0||i?.dateTo!==void 0)&&(t=t.filter(s=>{const n=Zt(s.ts);return!(i.dateFrom!==void 0&&n<i.dateFrom||i.dateTo!==void 0&&n>i.dateTo)})),i?.session!==void 0&&(t=t.filter(s=>s.session===i.session)),t.sort((s,n)=>n.ts.localeCompare(s.ts)),t}catch(e){throw new Error(`음성 로그 조회 실패: ${e instanceof Error?e.message:String(e)}`)}}async function Si(i){try{const e=await k(),t=await e.get("voiceLogs",i);if(!t)return;t.audioFileId!==null&&await e.delete("voiceAudio",t.audioFileId),await e.delete("voiceLogs",i)}catch(e){throw new Error(`음성 로그 삭제 실패 (id=${i}): ${e instanceof Error?e.message:String(e)}`)}}async function wi(){try{const i=await k();await Promise.all([i.clear("voiceLogs"),i.clear("voiceAudio")])}catch(i){throw new Error(`전체 로그 삭제 실패: ${i instanceof Error?i.message:String(i)}`)}}async function xi(i){try{const e=await Me(i);return JSON.stringify({exportedAt:ce(),count:e.length,logs:e},null,2)}catch(e){throw new Error(`로그 JSON 내보내기 실패: ${e instanceof Error?e.message:String(e)}`)}}async function Ei(i){try{const e=await k(),t=await Me(i),s={},n=JSON.stringify({exportedAt:ce(),count:t.length,logs:t},null,2);s["voice-logs.json"]=st(n);for(const a of t)if(a.audioFileId!==null){const o=await e.get("voiceAudio",a.audioFileId);if(o){const l=o.mimeType.includes("mp4")?"mp4":"webm",c=`audio/${a.id}.${l}`,d=await o.blob.arrayBuffer();s[c]=new Uint8Array(d)}}return await new Promise((a,o)=>{bi(s,{level:0},(l,c)=>{l?o(new Error(`ZIP 압축 실패: ${l.message}`)):a(c)})})}catch(e){throw new Error(`ZIP 내보내기 실패: ${e instanceof Error?e.message:String(e)}`)}}async function Ti(){try{const e=await(await k()).getAll("voiceLogs"),t=new Map;for(const s of e){const n=Zt(s.ts);t.has(n)||t.set(n,{totalCount:0,okCount:0,warnCount:0,failCount:0,audioIds:new Set});const r=t.get(n);r.totalCount++,s.kind==="ok"?r.okCount++:s.kind==="warn"?r.warnCount++:s.kind==="fail"&&r.failCount++,s.audioFileId!==null&&r.audioIds.add(s.audioFileId)}return Array.from(t.entries()).map(([s,n])=>({date:s,totalCount:n.totalCount,okCount:n.okCount,warnCount:n.warnCount,failCount:n.failCount,hasAudio:n.audioIds.size>0})).sort((s,n)=>n.date.localeCompare(s.date))}catch(i){throw new Error(`로그 통계 조회 실패: ${i instanceof Error?i.message:String(i)}`)}}async function Nt(){try{const i=await k(),[e,t]=await Promise.all([i.count("voiceLogs"),i.getAll("voiceAudio")]);let s=0;for(const n of t)s+=n.blob.size;return{logCount:e,audioCount:t.length,estimatedBytes:s}}catch(i){throw new Error(`저장소 통계 조회 실패: ${i instanceof Error?i.message:String(i)}`)}}const Li="ko-KR",Ri=300,$i=/iPad|iPhone|iPod/;function ki(){return $i.test(navigator.userAgent)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1}function _t(){const i=window;return i.SpeechRecognition??i.webkitSpeechRecognition??null}class hs{onResult=null;onInterim=null;onStateChange=null;onError=null;onSpeechStart=null;_isRunning=!1;_recognition=null;_cachedStream=null;_restartTimer=null;_lang;_isIOS;constructor(e={}){this._lang=e.lang??Li,this._isIOS=ki()}get isRunning(){return this._isRunning}get stream(){return this._cachedStream}start(){if(this._isRunning)return;if(!_t()){this._emitError("STT를 지원하지 않는 브라우저입니다");return}this._isRunning=!0,this._emitState("listening"),this._ensureStream().then(()=>{this._startRecognition()}).catch(t=>{this._isRunning=!1,this._emitState("idle");const s=t instanceof Error?t.message:String(t);this._emitError(`마이크 권한 획득 실패: ${s}`)})}stop(){if(this._isRunning=!1,this._clearRestartTimer(),this._recognition){try{this._recognition.abort()}catch{}this._recognition=null}this._emitState("idle")}restart(){if(!this._isRunning){this.start();return}if(this._clearRestartTimer(),this._recognition)try{this._recognition.abort()}catch{}this._scheduleRestart()}async _ensureStream(){if(this._cachedStream)return this._cachedStream;const e=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!0}});return this._cachedStream=e,e}_startRecognition(){const e=_t();if(!e||!this._isRunning)return;const t=new e;t.lang=this._lang,t.interimResults=!0,t.maxAlternatives=3,t.continuous=!this._isIOS,t.onresult=s=>{this._handleResult(s)},t.onspeechstart=()=>{this.onSpeechStart?.()},t.onend=()=>{this._isRunning&&this._scheduleRestart()},t.onerror=s=>{this._handleError(s)},this._recognition=t;try{t.start()}catch(s){const n=s instanceof Error?s.message:String(s);console.warn("[SttService] recognition.start() 오류:",n)}}_handleResult(e){const t=e.results,s=t[t.length-1];if(!s)return;const n=s.isFinal,r=s[0]?.transcript??"",a=s[0]?.confidence??0;if(n){const o=[];for(let c=0;c<s.length;c++){const d=s[c]?.transcript;d&&o.push(d)}const l={transcript:r,isFinal:!0,alternatives:o,confidence:a};if(this.onResult?.(l),this._emitState("processing"),this._isIOS&&this._isRunning){this._clearRestartTimer();try{this._recognition?.abort()}catch{}this._scheduleRestart()}}else this.onInterim?.(r),this._emitState("listening")}_handleError(e){const t=e.error??"";if(t==="not-allowed"){this.stop(),this._emitError("마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해주세요.");return}t!=="aborted"&&this._isRunning&&this._scheduleRestart()}_scheduleRestart(){this._clearRestartTimer(),this._restartTimer=setTimeout(()=>{this._isRunning&&this._startRecognition()},Ri)}_clearRestartTimer(){this._restartTimer!==null&&(clearTimeout(this._restartTimer),this._restartTimer=null)}_emitState(e){this.onStateChange?.(e)}_emitError(e){this.onError?.(e)}}const Ai="ko-KR",Fi=50,Di=/iPad|iPhone|iPod/;function Ii(){return Di.test(navigator.userAgent)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1}class fs{onStart=null;onEnd=null;_isSpeaking=!1;_isUnlocked=!1;_isSupported;_isIOS;constructor(){this._isSupported=typeof window<"u"&&"speechSynthesis"in window,this._isIOS=Ii()}get isSpeaking(){return this._isSpeaking}get isSupported(){return this._isSupported}unlock(){if(!(!this._isSupported||this._isUnlocked))try{const e=new SpeechSynthesisUtterance("");e.volume=0,window.speechSynthesis.speak(e),window.speechSynthesis.cancel(),this._isUnlocked=!0}catch{}}speak(e,t){this._isSupported&&e.trim()&&(window.speechSynthesis.cancel(),this._isIOS?setTimeout(()=>{this._doSpeak(e,t)},Fi):this._doSpeak(e,t))}cancel(){this._isSupported&&(window.speechSynthesis.cancel(),this._isSpeaking=!1)}_doSpeak(e,t){const s=new SpeechSynthesisUtterance(e);s.lang=t?.lang??Ai,t?.rate!==void 0&&(s.rate=t.rate),t?.pitch!==void 0&&(s.pitch=t.pitch),t?.volume!==void 0&&(s.volume=t.volume),s.onstart=()=>{this._isSpeaking=!0,this.onStart?.()},s.onend=()=>{this._isSpeaking=!1,this.onEnd?.()},s.onerror=()=>{this._isSpeaking=!1,this.onEnd?.()},window.speechSynthesis.speak(s)}}const Ci=["audio/webm;codecs=opus","audio/mp4;codecs=mp4a.40.2","audio/mp4","audio/aac"];function Bt(){return typeof MediaRecorder>"u"?"":Ci.find(i=>MediaRecorder.isTypeSupported(i))??""}class he{_mediaRecorder=null;_chunks=[];_startTime=0;_isRecording=!1;_resolveStop=null;_rejectStop=null;static isSupported(){return typeof MediaRecorder<"u"&&Bt()!==""}get isRecording(){return this._isRecording}startRecording(e){if(!he.isSupported()){console.warn("[MediaRecorderService] 이 브라우저는 녹음을 지원하지 않습니다.");return}if(this._isRecording&&this._mediaRecorder)try{this._mediaRecorder.stop()}catch{}const t=Bt();this._chunks=[],this._startTime=Date.now();try{const s=t?{mimeType:t}:{},n=new MediaRecorder(e,s);n.ondataavailable=r=>{r.data.size>0&&this._chunks.push(r.data)},n.onstop=()=>{const r=Date.now()-this._startTime,o={blob:new Blob(this._chunks,{type:t||"audio/mp4"}),mimeType:t||"audio/mp4",durationMs:r};this._isRecording=!1,this._chunks=[],this._resolveStop?.(o),this._resolveStop=null,this._rejectStop=null},n.onerror=()=>{this._isRecording=!1,this._rejectStop?.(new Error("MediaRecorder 오류가 발생했습니다.")),this._resolveStop=null,this._rejectStop=null},this._mediaRecorder=n,this._isRecording=!0,n.start()}catch(s){this._isRecording=!1;const n=s instanceof Error?s.message:String(s);console.error("[MediaRecorderService] startRecording 오류:",n)}}stopRecording(){return new Promise((e,t)=>{if(!this._isRecording||!this._mediaRecorder){t(new Error("녹음이 시작되지 않았습니다."));return}this._resolveStop=e,this._rejectStop=t;try{this._mediaRecorder.stop()}catch(s){this._isRecording=!1,this._resolveStop=null,this._rejectStop=null;const n=s instanceof Error?s.message:String(s);t(new Error(`녹음 중지 실패: ${n}`))}})}}const Mt={영:0,일:1,이:2,삼:3,사:4,오:5,육:6,칠:7,팔:8,구:9},qt={십:10,백:100,천:1e3},Ni=["번호는","번호가","번호를","번호의","이에요","입니다","이고요","이고","이에","에서","으로","에게","한테","이다","에요","이야","한데","보다","마다","만큼","처럼","부터","까지","이랑","이나","이며","에는","에도","에만","에서","이는","이를","이가","이와","이로","이번","에서는","에서도","으로는","으로도","한테서","는","은","시","이","가","을","를","의","와","과","로","으","도","만","나","야","아"];function _i(i){return/\d/.test(i)?i:i.replace(/[영일이삼사오육칠팔구십백천]+/g,e=>{const t=nt(e);return t!==null?String(t):e})}function nt(i){if(!i)return null;let e=0,t=0;for(const s of i)if(s in Mt)t=Mt[s];else if(s in qt){const n=qt[s];e+=(t===0?1:t)*n,t=0}else return null;return e+=t,e>0?e:null}function Bi(i){let e=i;return e=e.replace(/(\d+)\s*[점쩜]\s*(\d+)/g,"$1.$2"),e=e.replace(/([영일이삼사오육칠팔구십백천]+)\s*[점쩜]\s*([영일이삼사오육칠팔구십백천]+)/g,(t,s,n)=>{const r=nt(s),a=nt(n);return r!==null&&a!==null?`${r}.${a}`:t}),e}function Mi(i){let e=i.trim();for(const t of Ni)if(e.endsWith(t)&&e.length>t.length){e=e.slice(0,e.length-t.length);break}return e}const qi=9999,Pi=5;function Pt(i){if(!i)return"";let e=i.trim().toLowerCase();e=e.replace(/\d{1,3}(,\d{3})+(\.\d+)?/g,s=>{const n=s.split(","),r=n.at(-1)??s,a=n.slice(1,-1);return n.length>=3&&a.length>0&&a.every(l=>l==="000")&&/^\d+(?:\.\d+)?$/.test(r)&&parseFloat(r)<=qi?r:s.replace(/,/g,"")});const t=new RegExp(`^\\d{${Pi},}\\s+`);return e=e.replace(t,""),e=Bi(e),e=e.replace(/나무\s*다(?=\s|$)/g,"나무 4"),e=e.replace(/(^|\s)이\s+(?=\d)/g,"$1"),e=_i(e),e=e.replace(/\s+/g," ").trim(),e}const vs={width:["횡경","형경","황경","횡 경","생경","빙빙경","변경","안경","챙겨","행경","행정","인경","행병"],height:["종경","중경","종 경","존경","동경","은경","신경","홍경","민경","보경","성경","진경","용경"],treeNo:["조사나무","나무","나무번호","조사 나무","나무가","나무는","나무를","나무번"],fruitNo:["조사과실","과실","과실번호","거실","마실사","사실","과실이","과실을","과실은","과실의","과실번","과일"],farmerName:["농가","농가명"],surveyDate:["조사일자","조사일","날짜"],baseDate:["기준일자","기준일"],label:["라벨"],treatment:["처리","처리구"],fruitWeight:["과중","과일 무게","과일무게"],pericarpWeight:["과피중","껍질 무게","껍질무게"],pericarpThickness:["과피두께","껍질두께","과피 두께","껍질 두께"],brix:["당도","브릭스","브릭","당"],titratableAcidity:["적정","적정산도"],acidContent:["산함량","산","산도"],coloring:["착색"],nonDestructive:["비파괴"],remark:["비고","메모","노트"]},ft=new Map;for(const[i,e]of Object.entries(vs))for(const t of e)ft.set(t,i);function Ht(i){return ft.get(i)??i}function zt(i){return ft.has(i)}const J=9999,Hi=1,zi=.9,Oi=.8,Vi=.7,Ui=.5,Ot=0;function Se(i){const e=i.match(/\d+(?:\.\d+)?/);return e?e[0]:null}function ji(i){return/^\d+(?:\.\d+)?$/.test(i.trim())}function Vt(i){const e=i.match(/^(.*?)\s*(\d+(?:\.\d+)?)\s*$/);return e?{fieldPart:e[1]?.trim()??"",valuePart:e[2]??""}:{fieldPart:i.trim(),valuePart:""}}function Ut(i){for(const e of i){const t=Mi(e);if(zt(t))return{fieldKey:Ht(t),score:zi,method:"alias"};if(t in vs)return{fieldKey:t,score:Hi,method:"exact"};const s=t.toLowerCase();if(zt(s))return{fieldKey:Ht(s),score:Vi,method:"normalized"}}return null}function ps(i,e,t=[]){const{lastField:s}=e,n=Pt(i);if(!n)return{field:null,value:null,numericValue:null,score:Ot,method:"unknown",isCorrection:!1,warning:null};if(ji(n)){const u=Se(n),h=u!==null?parseFloat(u):null,v=h!==null&&h>J?`인식된 값 ${h}이 ${J}을 초과합니다. 음성 오인식을 확인하세요.`:null;return{field:s,value:u,numericValue:h,score:Ui,method:"value-only",isCorrection:s!==null,warning:v}}const{fieldPart:r,valuePart:a}=Vt(n),o=r.split(/\s+/).filter(u=>u.length>0),l=Ut(o);if(l===null){for(const m of t.slice(0,3)){if(m===i)continue;const p=Pt(m);if(!p)continue;const{fieldPart:R,valuePart:D}=Vt(p),A=R.split(/\s+/).filter(x=>x.length>0),y=Ut(A);if(y!==null){const x=D!==""?D:Se(p),T=x!==null?parseFloat(x):null,L=T!==null&&T>J?`인식된 값 ${T}이 ${J}을 초과합니다.`:null;return{field:y.fieldKey,value:x,numericValue:T,score:Oi,method:"alt-fallback",isCorrection:!1,warning:L}}}const u=Se(n),h=u!==null?parseFloat(u):null,v=h!==null&&h>J?`인식된 값 ${h}이 ${J}을 초과합니다.`:null;return{field:null,value:u??n,numericValue:h,score:Ot,method:"unknown",isCorrection:!1,warning:v}}const c=a!==""?a:Se(n),d=c!==null?parseFloat(c):null,f=d!==null&&d>J?`인식된 값 ${d}이 ${J}을 초과합니다. 음성 오인식을 확인하세요.`:null;return{field:l.fieldKey,value:c,numericValue:d,score:l.score,method:l.method,isCorrection:!1,warning:f}}class Wi{el=null;unsubscribe=null;fadeTimer=null;removeTimer=null;onEditRequest=null;mount(e){this.unsubscribe=q.subscribe(t=>{t.lastEchoText&&this.showEcho(t.lastEchoText,t.isCorrection,t.pendingField)})}unmount(){this.unsubscribe&&(this.unsubscribe(),this.unsubscribe=null),this.clearTimers(),this.el&&(this.el.remove(),this.el=null)}showEcho(e,t,s){if(this.clearTimers(),this.el&&(this.el.remove(),this.el=null),!e)return;const n=e.split(" ");let r="",a=e;t&&n.length>=3&&n[0]==="수정"?(r=`수정 ${n[1]??""}`,a=n.slice(2).join(" ")):n.length>=2&&(r=n[0]??"",a=n.slice(1).join(" ")),this.el=document.createElement("div"),this.el.className="tts-echo-display",this.el.setAttribute("role","status"),this.el.setAttribute("aria-live","polite"),this.el.setAttribute("aria-label",`인식 결과: ${e}`),this.el.innerHTML=`
      <div class="tts-echo-card">
        ${r?`<div class="tts-echo-label${t?" correction":""}">${this.escapeHtml(r)}</div>`:""}
        <div class="tts-echo-value">${this.escapeHtml(a)}</div>
        ${s?'<div class="tts-echo-hint">탭하여 수정</div>':""}
      </div>
    `,s&&this.el.addEventListener("click",()=>{this.onEditRequest&&s&&this.onEditRequest(s),this.hide()}),document.body.appendChild(this.el),this.fadeTimer=setTimeout(()=>{this.el&&this.el.classList.add("fading")},2500),this.removeTimer=setTimeout(()=>{this.hide()},3e3)}hide(){this.clearTimers(),this.el&&(this.el.remove(),this.el=null)}clearTimers(){this.fadeTimer!==null&&(clearTimeout(this.fadeTimer),this.fadeTimer=null),this.removeTimer!==null&&(clearTimeout(this.removeTimer),this.removeTimer=null)}escapeHtml(e){const t=document.createElement("div");return t.appendChild(document.createTextNode(e)),t.innerHTML}}class gs{el=null;unsubscribers=[];syncTrigger=null;setSyncTrigger(e){this.syncTrigger=e}mount(e){this.el=document.createElement("div"),this.el.className="sync-status-bar",e.appendChild(this.el),this.unsubscribers.push(me.subscribe(t=>{const s=Y.getState();this.updateUI(t,s)})),this.unsubscribers.push(Y.subscribe(t=>{const s=me.getState();this.updateUI(s,t)}))}unmount(){this.unsubscribers.forEach(e=>e()),this.unsubscribers=[],this.el&&(this.el.remove(),this.el=null)}updateUI(e,t){if(!this.el)return;const{pendingCount:s,isSyncing:n,lastSyncAt:r,syncError:a}=e,o=t.networkStatus==="online";if(s===0&&!a){this.el.style.display="none";return}this.el.style.display="flex",this.el.classList.toggle("synced",s===0&&!a);let l="",c="";if(n)c='<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span>',l="동기화 중...";else if(a)c="⚠️",l=`동기화 실패: ${a}`;else if(c="⏳",l=`미동기화 ${s}건`,r){const u=new Date(r),h=`${u.getHours()}:${String(u.getMinutes()).padStart(2,"0")}`;l+=` (마지막: ${h})`}const d=o&&!n&&s>0;this.el.innerHTML=`
      <span class="sync-status-text">
        ${c}
        <span>${l}</span>
      </span>
      <button
        class="sync-btn"
        type="button"
        ${d?"":"disabled"}
        aria-label="수동 동기화 시작"
      >
        ${n?'<span class="spinner" style="width:12px;height:12px;border-width:2px;margin-right:4px;"></span>':""}
        ${o?"동기화":"오프라인"}
      </button>
    `,this.el.querySelector(".sync-btn")?.addEventListener("click",()=>this.handleSyncClick())}async handleSyncClick(){if(this.syncTrigger)try{await this.syncTrigger()}catch{}}}const Ki={width:[33.4,84.5],height:[30.4,68.6],fruitWeight:[27,228.9],pericarpThickness:[1.3,4],brix:[7.2,16.4],acidContent:[.54,3.94]},jt=9999,Ue={width:"횡경",height:"종경",fruitWeight:"과중",pericarpThickness:"과피두께",brix:"당도",acidContent:"산함량"},Gi={width:"mm",height:"mm",fruitWeight:"g",pericarpThickness:"mm",brix:"°Bx",acidContent:"%"};function rt(i,e){if(!isFinite(e)||isNaN(e))return{valid:!1,warning:!1,message:`${Ue[i]??i}: 유효한 숫자가 아닙니다.`};if(e>jt)return{valid:!0,warning:!0,message:`${Ue[i]??i}: 값이 ${jt}을 초과합니다. 음성 오인식을 확인하세요.`};const t=Ki[i];if(t===void 0)return{valid:!0,warning:!1,message:""};const[s,n]=t,r=Gi[i]??"",a=Ue[i]??i;return e<s||e>n?{valid:!0,warning:!0,message:`${a}: 정상 범위(${s}~${n}${r})를 벗어난 값입니다. 확인 후 저장하세요.`}:{valid:!0,warning:!1,message:""}}function Yi(i){const e=[],t=[],s=[{key:"surveyDate",label:"조사일자"},{key:"farmerName",label:"농가명"},{key:"treatment",label:"처리"},{key:"treeNo",label:"조사나무"},{key:"fruitNo",label:"조사과실"}];for(const{key:r,label:a}of s){const o=i[r];(o==null||o==="")&&e.push(`${a}은(는) 필수 입력 항목입니다.`)}const n=["width","height","fruitWeight","pericarpThickness","brix","acidContent"];for(const r of n){const a=i[r];if(a!=null&&typeof a=="number"){const o=rt(r,a);o.valid?o.warning&&t.push(o.message):e.push(o.message)}}return{isValid:e.length===0,hasWarning:t.length>0,errors:e,warnings:t}}const ms="_";function Xi(i){const{surveyDate:e,farmerName:t,label:s,treatment:n,treeNo:r,fruitNo:a}=i;return[e,t,s,n,String(r),String(a)].join(ms)}function Zi(i){const{surveyDate:e,farmerName:t,label:s,treatment:n}=i;return[e,t,s,n].join(ms)}function $e(){const i=navigator.userAgent;return{userAgent:i,platform:navigator.platform??"",language:navigator.language??"",isIOS:/iPad|iPhone|iPod/.test(i)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1,isAndroid:/Android/.test(i),screenWidth:screen.width,screenHeight:screen.height,pixelRatio:window.devicePixelRatio??1}}const Ji=[{key:"width",label:"횡경",unit:"mm",inputType:"decimal1",required:!1,placeholder:"예: 35.1"},{key:"height",label:"종경",unit:"mm",inputType:"decimal1",required:!1,placeholder:"예: 32.0"},{key:"remark",label:"비고",unit:"",inputType:"text",required:!1,placeholder:"자유 입력"}],Qi=[{key:"width",label:"횡경",unit:"mm",inputType:"decimal1",required:!1},{key:"height",label:"종경",unit:"mm",inputType:"decimal1",required:!1},{key:"fruitWeight",label:"과중",unit:"g",inputType:"decimal1",required:!1},{key:"pericarpWeight",label:"과피중",unit:"g",inputType:"decimal1",required:!1},{key:"pericarpThickness",label:"과피두께",unit:"mm",inputType:"decimal1",required:!1},{key:"pericarpThicknessX4",label:"과피두께×4",unit:"mm",inputType:"auto",required:!1},{key:"brix",label:"당도",unit:"°Bx",inputType:"decimal1",required:!1},{key:"titratableAcidity",label:"적정산도",unit:"",inputType:"decimal1",required:!1},{key:"acidContent",label:"산함량",unit:"%",inputType:"decimal1",required:!1},{key:"sugarAcidRatio",label:"당산도",unit:"",inputType:"auto",required:!1},{key:"coloring",label:"착색",unit:"",inputType:"integer",required:!1},{key:"nonDestructive",label:"비파괴",unit:"",inputType:"decimal1",required:!1},{key:"remark",label:"비고",unit:"",inputType:"text",required:!1}];class Wt{el=null;surveyType;defaults=es();unsubscribers=[];ttsEchoDisplay=null;syncStatusBar=null;isSaving=!1;sttService=null;ttsService=null;mediaRecorderService=null;voiceBtnEl=null;isVoiceActive=!1;voiceLogEnabled=!1;audioRecordEnabled=!1;ttsEnabled=!0;sessionFields={surveyDate:Xe(),baseDate:"",farmerName:"",label:"",treatment:"관행",treeNo:1};fieldValues={};constructor(e){this.surveyType=e}async mount(e){this.el=document.createElement("div"),e.appendChild(this.el);const t=this.getEditParamFromHash();t||S.setSurveyType(this.surveyType),await this.loadDefaults(),t&&await this.prefillEditRecord(t);const s=S.getState();this.sessionFields={...s.sessionFields},this.syncFieldValuesFromStore(s),this.render(),this.mountSubComponents(),this.unsubscribers.push(S.subscribe(n=>{this.onSurveyStoreUpdate(n)})),this.unsubscribers.push(q.subscribe(n=>{this.onVoiceStoreUpdate(n)})),await this.initVoiceServices()}unmount(){this.sttService&&(this.sttService.stop(),this.sttService=null),this.ttsService&&(this.ttsService.cancel(),this.ttsService=null),this.mediaRecorderService?.isRecording&&this.mediaRecorderService.stopRecording().catch(()=>{}),this.mediaRecorderService=null,this.voiceBtnEl=null,this.isVoiceActive=!1,this.unsubscribers.forEach(e=>e()),this.unsubscribers=[],this.ttsEchoDisplay?.unmount(),this.ttsEchoDisplay=null,this.syncStatusBar?.unmount(),this.syncStatusBar=null,this.el&&(this.el.remove(),this.el=null)}async loadDefaults(){try{this.defaults=await at(),!this.sessionFields.farmerName&&this.defaults.defaultFarmerName&&(this.sessionFields.farmerName=this.defaults.defaultFarmerName),!this.sessionFields.label&&this.defaults.defaultLabel&&(this.sessionFields.label=this.defaults.defaultLabel),!this.sessionFields.treatment&&this.defaults.defaultTreatment&&(this.sessionFields.treatment=this.defaults.defaultTreatment)}catch{}}getEditParamFromHash(){const e=window.location.hash,t=e.indexOf("?");if(t===-1)return null;const s=e.slice(t+1);return new URLSearchParams(s).get("edit")}async prefillEditRecord(e){try{const t=await Rt(this.surveyType,e);if(!t)return;const s=t;S.setSurveyType(this.surveyType),S.updateSessionFields({surveyDate:s.surveyDate,farmerName:s.farmerName,label:s.label,treatment:s.treatment,treeNo:s.treeNo});const n=this.getActiveFields(),r=t;for(const a of n){const o=r[a.key];o!=null&&S.updateField(a.key,o)}S.updateField("fruitNo",s.fruitNo)}catch{}}syncFieldValuesFromStore(e){const t=e.currentRecord,s=this.getActiveFields();for(const n of s){const r=t[n.key];r!=null&&(this.fieldValues[n.key]=String(r))}}render(){if(!this.el)return;const t=this.surveyType==="growth"?"비대조사":"품질조사";this.el.innerHTML=`
      <div class="page" id="survey-page-inner" style="padding-top:0;">

        <!-- 페이지 헤더 -->
        <div class="page-header" style="position:sticky;top:0;z-index:20;">
          <h1>${t}</h1>
          <button class="btn btn-ghost" id="load-session-btn" type="button" style="font-size:14px;color:var(--color-primary);">
            세션 불러오기
          </button>
        </div>

        <div style="padding:var(--padding-mobile);padding-bottom:calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 100px);">

          <!-- 동기화 상태 바 -->
          <div id="sync-status-container"></div>

          <!-- 세션 헤더 입력 -->
          <section class="session-header" id="session-header">
            ${this.renderSessionHeaderHTML()}
          </section>

          <!-- 측정값 입력 -->
          <section class="measurement-section">
            <div class="measurement-section-title">측정값</div>
            <div id="field-list">
              ${this.renderFieldListHTML()}
            </div>
          </section>

          <!-- 음성 입력 영역 (항상 표시, 기본 입력 수단) -->
          <div class="voice-primary-area" id="voice-primary-area">
            <button class="btn-voice-primary" id="voice-btn" type="button">
              <span class="voice-btn-icon">🎤</span>
              <span class="voice-btn-label">음성 입력</span>
              <span class="voice-btn-sub">탭하여 시작</span>
            </button>
          </div>
          <!-- 저장 버튼 -->
          <div class="save-area" style="margin-top:12px;">
            <button class="btn btn-primary btn-full" id="save-btn" type="button" style="height:52px;font-size:18px;">
              저장
            </button>
          </div>

        </div>
      </div>

      <!-- 최근 세션 바텀 시트 (숨김) -->
      <div id="recent-session-sheet" style="display:none;"></div>
    `,this.bindEvents()}renderSessionHeaderHTML(){const{surveyDate:e,farmerName:t,label:s,treatment:n,treeNo:r}=this.sessionFields,{farmerNames:a,labels:o,treatments:l,treeRange:c}=this.defaults,d=a.map(v=>`<option value="${this.escapeAttr(v)}" ${v===t?"selected":""}>${this.escapeHtml(v)}</option>`).join(""),f=o.map(v=>`<option value="${this.escapeAttr(v)}" ${v===s?"selected":""}>${this.escapeHtml(v)}</option>`).join(""),u=l.map(v=>`<option value="${this.escapeAttr(v)}" ${v===n?"selected":""}>${this.escapeHtml(v)}</option>`).join(""),h=[];for(let v=c.min;v<=c.max;v++)h.push(`<option value="${v}" ${v===r?"selected":""}>${v}번</option>`);return`
      <div class="session-header-row">
        <span class="session-header-label">조사일자</span>
        <div class="session-header-value">
          <input
            type="date"
            id="session-date"
            class="session-header-input"
            value="${e}"
          />
        </div>
      </div>
      <div class="session-header-row">
        <span class="session-header-label">농가명</span>
        <div class="session-header-value">
          <select id="session-farmer" class="session-header-select">
            ${d}
          </select>
        </div>
      </div>
      <div class="session-header-row">
        <span class="session-header-label">라벨</span>
        <div class="session-header-value">
          <select id="session-label" class="session-header-select">
            ${f}
          </select>
        </div>
      </div>
      <div class="session-header-row">
        <span class="session-header-label">처리</span>
        <div class="session-header-value">
          <select id="session-treatment" class="session-header-select">
            ${u}
          </select>
        </div>
      </div>
      <div class="session-header-row">
        <span class="session-header-label">조사나무</span>
        <div class="session-header-value">
          <select id="session-tree" class="session-header-select">
            ${h}
          </select>
        </div>
      </div>
      <div class="session-header-row">
        <span class="session-header-label">조사과실</span>
        <div class="session-header-value">
          <input
            type="number"
            id="session-fruit"
            class="session-header-input"
            value="${S.getState().currentRecord.fruitNo??""}"
            min="1" max="5"
            placeholder="1~5"
            inputmode="numeric"
          />
        </div>
      </div>
    `}renderFieldListHTML(e){const t=this.getActiveFields(),s=S.getState().currentRecord;return t.map(n=>{const r=n.inputType==="auto",a=e===n.key,o=this.fieldValues[n.key]??(s[n.key]!=null?String(s[n.key]):""),l=parseFloat(o);let c=!1;return!isNaN(l)&&!r&&(c=rt(n.key,l).warning),`
        <div class="field-row${a?" highlighted":""}" data-field="${this.escapeAttr(n.key)}">
          <span class="field-row-label">
            ${this.escapeHtml(n.label)}
            ${c?'<span class="field-warning-dot" title="이상치 범위"></span>':""}
          </span>
          <div class="field-row-input-wrap">
            <input
              type="${n.inputType==="text"?"text":"number"}"
              class="field-row-input${c?" has-warning":""}"
              data-field-key="${this.escapeAttr(n.key)}"
              value="${this.escapeAttr(o)}"
              placeholder="${n.placeholder??""}"
              ${n.inputType==="decimal1"?'step="0.1" inputmode="decimal"':""}
              ${n.inputType==="integer"?'step="1" inputmode="numeric"':""}
              ${r?'readonly tabindex="-1"':""}
              ${r?'style="background:var(--color-border-light);color:var(--color-text-secondary);"':""}
            />
            ${n.unit?`<span class="field-row-unit">${this.escapeHtml(n.unit)}</span>`:'<span class="field-row-unit"></span>'}
          </div>
        </div>
      `}).join("")}mountSubComponents(){if(!this.el)return;const e=this.el.querySelector("#sync-status-container");e&&(this.syncStatusBar=new gs,this.syncStatusBar.mount(e)),this.ttsEchoDisplay=new Wi,this.ttsEchoDisplay.onEditRequest=t=>{this.focusField(t)},this.ttsEchoDisplay.mount(document.body)}bindEvents(){if(!this.el)return;const e=this.el.querySelector("#session-date"),t=this.el.querySelector("#session-farmer"),s=this.el.querySelector("#session-label"),n=this.el.querySelector("#session-treatment"),r=this.el.querySelector("#session-tree"),a=this.el.querySelector("#session-fruit");e?.addEventListener("change",()=>{this.sessionFields.surveyDate=e.value,S.updateSessionFields({surveyDate:e.value})}),t?.addEventListener("change",()=>{this.sessionFields.farmerName=t.value,S.updateSessionFields({farmerName:t.value})}),s?.addEventListener("change",()=>{this.sessionFields.label=s.value,S.updateSessionFields({label:s.value})}),n?.addEventListener("change",()=>{this.sessionFields.treatment=n.value,S.updateSessionFields({treatment:n.value})}),r?.addEventListener("change",()=>{this.sessionFields.treeNo=parseInt(r.value,10),S.updateSessionFields({treeNo:this.sessionFields.treeNo})}),a?.addEventListener("input",()=>{const f=parseInt(a.value,10);isNaN(f)||S.updateField("fruitNo",f)});const o=this.el.querySelector("#field-list");o?.addEventListener("input",f=>{const u=f.target,h=u.dataset.fieldKey;if(h){if(this.fieldValues[h]=u.value,u.type==="text")S.updateField(h,u.value);else if(u.value==="")S.updateField(h,void 0);else{const v=parseFloat(u.value);isNaN(v)?S.updateField(h,void 0):S.updateField(h,v)}this.updateWarningBadge(h,u)}}),o?.addEventListener("focus",f=>{const h=f.target.dataset.fieldKey;h&&S.setLastField(h)},!0),this.el.querySelector("#load-session-btn")?.addEventListener("click",()=>this.handleLoadSession()),this.el.querySelector("#save-btn")?.addEventListener("click",()=>this.handleSave());const d=this.el.querySelector("#voice-btn");d&&(this.voiceBtnEl=d,d.addEventListener("click",()=>this.toggleVoice()))}onSurveyStoreUpdate(e){const t=e.currentRecord,s=this.getActiveFields().filter(n=>n.inputType==="auto");for(const n of s){const r=t[n.key],a=this.el?.querySelector(`[data-field-key="${n.key}"]`);a&&r!=null?(a.value=String(r),this.fieldValues[n.key]=String(r)):a&&r==null&&(a.value="",this.fieldValues[n.key]="")}}onVoiceStoreUpdate(e){const{pendingField:t}=e;if(this.el?.querySelectorAll(".field-row")?.forEach(n=>{const r=n.dataset.field;n.classList.toggle("highlighted",r===t&&t!==null)}),t){const r=S.getState().currentRecord[t],a=this.el?.querySelector(`[data-field-key="${t}"]`);a&&r!=null&&(a.value=String(r),this.fieldValues[t]=String(r))}}async handleSave(){if(this.isSaving)return;const e=this.readSessionFields(),t=this.el?.querySelector("#session-fruit"),s=parseInt(t?.value??"",10);if(!e.farmerName){w("농가명을 선택하세요.","error");return}if(isNaN(s)||s<1||s>5){w("조사과실 번호를 1~5 범위로 입력하세요.","error"),this.el?.querySelector("#session-fruit")?.focus();return}const n=Xi({surveyDate:e.surveyDate,farmerName:e.farmerName,label:e.label,treatment:e.treatment,treeNo:e.treeNo,fruitNo:s}),r=Zi(e),a=await Rt(this.surveyType,n);if(a&&!await de(`조사나무 ${e.treeNo}번, 과실 ${s}번 데이터가 이미 존재합니다. 덮어쓰시겠습니까?`,"덮어쓰기",!1))return;const o=new Date().toISOString(),l=S.buildRecord(n,r,o);l.fruitNo=s;const c=Yi(l);if(c.hasWarning&&!await de(`이상치가 포함되어 있습니다:
${c.warnings.join(`
`)}

그래도 저장하시겠습니까?`,"저장",!1))return;this.isSaving=!0;const d=this.el?.querySelector("#save-btn");d&&(d.disabled=!0,d.innerHTML='<span class="spinner" style="width:18px;height:18px;border-width:2px;margin-right:6px;"></span>저장 중...');try{await Ws(this.surveyType,l),a||me.incrementPending(),S.resetAfterSave(),this.clearFruitNumberField(),w("저장 완료","success"),this.isVoiceActive&&this.ttsEnabled&&this.ttsService?.speak("저장 완료"),t?.focus()}catch(f){const u=f instanceof Error?f.message:"저장에 실패했습니다.";w(u,"error")}finally{this.isSaving=!1,d&&(d.disabled=!1,d.textContent="저장")}}clearFruitNumberField(){const e=this.el?.querySelector("#session-fruit");e&&(e.value=""),delete this.fieldValues.fruitNo}updateWarningBadge(e,t){const s=parseFloat(t.value);let n=!1;isNaN(s)||(n=rt(e,s).warning);const r=t.closest(".field-row");if(!r)return;const a=r.querySelector(".field-row-label");if(!a)return;const o=a.querySelector(".field-warning-dot");if(n&&!o){const l=document.createElement("span");l.className="field-warning-dot",l.title="이상치 범위",a.appendChild(l)}else!n&&o&&o.remove();t.classList.toggle("has-warning",n)}async handleLoadSession(){try{const e=await Gs(5);if(e.length===0){w("저장된 세션이 없습니다.","info");return}this.showSessionPicker(e)}catch{w("세션 목록을 불러오지 못했습니다.","error")}}showSessionPicker(e){document.getElementById("session-picker-overlay")?.remove(),document.getElementById("session-picker-sheet")?.remove();const t=document.createElement("div");t.id="session-picker-overlay",t.className="bottom-sheet-overlay";const s=document.createElement("div");s.id="session-picker-sheet",s.className="bottom-sheet",s.innerHTML=`
      <div class="bottom-sheet-handle"></div>
      <div class="bottom-sheet-header">
        <div class="bottom-sheet-title">최근 세션 불러오기</div>
      </div>
      <div class="bottom-sheet-list">
        ${e.map(n=>`
          <div class="bottom-sheet-item" data-session-key="${this.escapeAttr(n.sessionKey)}"
               data-survey-date="${this.escapeAttr(n.surveyDate)}"
               data-farmer-name="${this.escapeAttr(n.farmerName)}"
               data-label="${this.escapeAttr(n.label)}"
               data-treatment="${this.escapeAttr(n.treatment)}">
            <div class="bottom-sheet-item-main">
              <div class="bottom-sheet-item-title">${this.escapeHtml(n.farmerName)} · ${this.escapeHtml(n.label)} · ${this.escapeHtml(n.treatment)}</div>
              <div class="bottom-sheet-item-meta">${Ze(n.surveyDate)}</div>
            </div>
            <span style="color:var(--color-text-secondary);font-size:20px;">›</span>
          </div>
        `).join("")}
      </div>
    `,t.addEventListener("click",()=>{t.remove(),s.remove()}),s.addEventListener("click",n=>{n.stopPropagation();const r=n.target.closest(".bottom-sheet-item");if(!r)return;const a={surveyDate:r.dataset.surveyDate??"",farmerName:r.dataset.farmerName??"",label:r.dataset.label??"",treatment:r.dataset.treatment??""};this.applySession(a),t.remove(),s.remove()}),document.body.appendChild(t),document.body.appendChild(s)}applySession(e){e.surveyDate&&(this.sessionFields.surveyDate=e.surveyDate),e.farmerName&&(this.sessionFields.farmerName=e.farmerName),e.label&&(this.sessionFields.label=e.label),e.treatment&&(this.sessionFields.treatment=e.treatment),S.updateSessionFields(this.sessionFields);const t=this.el?.querySelector("#session-header");t&&(t.innerHTML=this.renderSessionHeaderHTML(),this.rebindSessionHeaderEvents()),w("세션이 불러와졌습니다.","success")}readSessionFields(){const e=this.el?.querySelector("#session-date")?.value??Xe(),t=this.el?.querySelector("#session-farmer")?.value??"",s=this.el?.querySelector("#session-label")?.value??"",n=this.el?.querySelector("#session-treatment")?.value??"",r=parseInt(this.el?.querySelector("#session-tree")?.value??"1",10);return{surveyDate:e,baseDate:"",farmerName:t,label:s,treatment:n,treeNo:isNaN(r)?1:r}}rebindSessionHeaderEvents(){const e=this.el?.querySelector("#session-date"),t=this.el?.querySelector("#session-farmer"),s=this.el?.querySelector("#session-label"),n=this.el?.querySelector("#session-treatment"),r=this.el?.querySelector("#session-tree"),a=this.el?.querySelector("#session-fruit");e?.addEventListener("change",()=>{this.sessionFields.surveyDate=e.value,S.updateSessionFields({surveyDate:e.value})}),t?.addEventListener("change",()=>{this.sessionFields.farmerName=t.value,S.updateSessionFields({farmerName:t.value})}),s?.addEventListener("change",()=>{this.sessionFields.label=s.value,S.updateSessionFields({label:s.value})}),n?.addEventListener("change",()=>{this.sessionFields.treatment=n.value,S.updateSessionFields({treatment:n.value})}),r?.addEventListener("change",()=>{this.sessionFields.treeNo=parseInt(r.value,10),S.updateSessionFields({treeNo:this.sessionFields.treeNo})}),a?.addEventListener("input",()=>{const o=parseInt(a.value,10);isNaN(o)||S.updateField("fruitNo",o)})}async initVoiceServices(){try{this.ttsEnabled=await Q("ttsEnabled",!0),this.voiceLogEnabled=await Q("voiceLogEnabled",!0),this.audioRecordEnabled=await Q("audioRecordEnabled",!1)}catch{}this.sttService=new hs,this.sttService.onResult=s=>{this.handleSttResult(s)},this.sttService.onInterim=s=>{if(q.setInterimText(s),this.audioRecordEnabled&&this.mediaRecorderService&&!this.mediaRecorderService.isRecording){const n=this.sttService?.stream;n&&this.mediaRecorderService.startRecording(n)}},this.sttService.onStateChange=s=>{q.setSttStatus(s)},this.sttService.onError=s=>{q.setError(s),this.isVoiceActive=!1,this.updateVoiceBtnUI(!1)},this.ttsService=new fs,this.ttsService.onStart=()=>{q.setTtsSpeaking(!0)},this.ttsService.onEnd=()=>{q.setTtsSpeaking(!1)},this.audioRecordEnabled&&he.isSupported()&&(this.mediaRecorderService=new he,this.sttService.onSpeechStart=()=>{const s=this.sttService?.stream;s&&this.mediaRecorderService&&!this.mediaRecorderService.isRecording&&this.mediaRecorderService.startRecording(s)});const e=window;if(!("SpeechRecognition"in e||"webkitSpeechRecognition"in e)&&this.voiceBtnEl){this.voiceBtnEl.disabled=!0,this.voiceBtnEl.classList.add("unsupported");const s=this.voiceBtnEl.querySelector(".voice-btn-sub");s&&(s.textContent="이 브라우저는 음성 인식을 지원하지 않습니다")}}handleSttResult(e){this.surveyType;const t={treeNo:"나무번호",fruitNo:"과실번호",width:"횡경",height:"종경",fruitWeight:"과중",pericarpWeight:"과피중",pericarpThickness:"과피두께",brix:"당도",titratableAcidity:"적정산도",acidContent:"산함량",coloring:"착색",nonDestructive:"비파괴",remark:"비고"},s=S.getState(),n=ps(e.transcript,{lastField:s.lastField,surveyType:this.surveyType},e.alternatives??[]),r=new Date().toISOString();if(n.field!==null&&n.score>=.5&&!n.isCorrection){const o=n.field,l=n.numericValue!==null?n.numericValue:n.value??"";S.updateField(o,l);const c=this.el?.querySelector(`[data-field-key="${o}"]`);c&&(c.value=n.value??"",this.fieldValues[o]=n.value??"",this.updateWarningBadge(o,c));const f=`${t[o]??o} ${n.value??""}`;if(q.setEchoText(f),this.ttsEnabled&&this.ttsService?.speak(f),q.setRecognitionResult(n),setTimeout(()=>q.clearPending(),2e3),this.voiceLogEnabled){const u=this.mediaRecorderService,h=u?.isRecording??!1,v=this.audioRecordEnabled&&h&&u?u.stopRecording().catch(m=>(console.warn("[MediaRecorder] stopRecording 실패:",m),null)):Promise.resolve(null);(async()=>{try{const m=await Te({ts:r,kind:"ok",rawText:e.transcript,alternatives:e.alternatives,parse:{field:n.field,value:n.value,score:n.score,method:n.method},status:"accepted",message:f,audioFileId:null,session:s.sessionFields?`${s.sessionFields.surveyDate}_${s.sessionFields.farmerName}`:void 0,device:$e()}),p=await v;if(p){const R=await Le({logId:m,blob:p.blob,mimeType:p.mimeType,durationMs:p.durationMs,ts:r});await Re(m,R)}}catch{}})()}return}if(n.isCorrection&&n.field!==null){const o=n.field,l=n.numericValue!==null?n.numericValue:n.value??"";S.updateField(o,l);const c=this.el?.querySelector(`[data-field-key="${o}"]`);c&&(c.value=n.value??"",this.fieldValues[o]=n.value??"",this.updateWarningBadge(o,c));const f=`수정 ${t[o]??o} ${n.value??""}`;if(q.setEchoText(f),this.ttsEnabled&&this.ttsService?.speak(f),q.setRecognitionResult(n),setTimeout(()=>q.clearPending(),2e3),this.voiceLogEnabled){const u=this.mediaRecorderService,h=u?.isRecording??!1,v=this.audioRecordEnabled&&h&&u?u.stopRecording().catch(m=>(console.warn("[MediaRecorder] stopRecording 실패:",m),null)):Promise.resolve(null);(async()=>{try{const m=await Te({ts:r,kind:"ok",rawText:e.transcript,alternatives:e.alternatives,parse:{field:n.field,value:n.value,score:n.score,method:n.method},status:"corrected",message:f,audioFileId:null,session:s.sessionFields?`${s.sessionFields.surveyDate}_${s.sessionFields.farmerName}`:void 0,device:$e()}),p=await v;if(p){const R=await Le({logId:m,blob:p.blob,mimeType:p.mimeType,durationMs:p.durationMs,ts:r});await Re(m,R)}}catch{}})()}return}const a="다시 말씀해 주세요";if(q.setEchoText(a),this.ttsEnabled&&this.ttsService?.speak(a),q.setError("인식 실패"),this.voiceLogEnabled){const o=this.mediaRecorderService,l=o?.isRecording??!1,c=this.audioRecordEnabled&&l&&o?o.stopRecording().catch(()=>null):Promise.resolve(null);(async()=>{try{const d=await Te({ts:r,kind:"fail",rawText:e.transcript,alternatives:e.alternatives,parse:{field:n.field,value:n.value,score:n.score,method:n.method},status:"rejected",message:a,audioFileId:null,session:s.sessionFields?`${s.sessionFields.surveyDate}_${s.sessionFields.farmerName}`:void 0,device:$e()}),f=await c;if(f){const u=await Le({logId:d,blob:f.blob,mimeType:f.mimeType,durationMs:f.durationMs,ts:r});await Re(d,u)}}catch{}})()}}toggleVoice(){this.sttService&&(this.isVoiceActive?(this.mediaRecorderService?.isRecording&&this.mediaRecorderService.stopRecording().catch(()=>{}),this.sttService.stop(),this.isVoiceActive=!1,this.updateVoiceBtnUI(!1),this.ttsEnabled&&this.ttsService?.speak("음성 입력 종료")):(this.ttsService?.unlock(),this.sttService.start(),this.isVoiceActive=!0,this.updateVoiceBtnUI(!0),this.ttsEnabled&&this.ttsService?.speak("음성 입력 시작")))}updateVoiceBtnUI(e){if(this.voiceBtnEl)if(e){this.voiceBtnEl.classList.add("active"),this.voiceBtnEl.classList.remove("unsupported");const t=this.voiceBtnEl.querySelector(".voice-btn-icon"),s=this.voiceBtnEl.querySelector(".voice-btn-sub");t&&(t.textContent="🔴"),s&&(s.textContent="듣는 중... (탭하여 중지)")}else{this.voiceBtnEl.classList.remove("active");const t=this.voiceBtnEl.querySelector(".voice-btn-icon"),s=this.voiceBtnEl.querySelector(".voice-btn-sub");t&&(t.textContent="🎤"),s&&(s.textContent="탭하여 시작")}}getActiveFields(){return this.surveyType==="growth"?Ji:Qi}focusField(e){const t=this.el?.querySelector(`[data-field-key="${e}"]`);t&&(t.focus(),t.select(),t.closest(".field-row")?.scrollIntoView({behavior:"smooth",block:"center"}))}escapeHtml(e){const t=document.createElement("div");return t.appendChild(document.createTextNode(e)),t.innerHTML}escapeAttr(e){return String(e).replace(/"/g,"&quot;").replace(/'/g,"&#39;")}}class en{el=null;syncStatusBar=null;allRecords=[];expandedRecordId=null;activeFilter="all";isLoading=!1;async mount(e){this.el=document.createElement("div"),e.appendChild(this.el),this.renderSkeleton(),await this.loadRecords(),this.render()}unmount(){this.syncStatusBar?.unmount(),this.syncStatusBar=null,this.el&&(this.el.remove(),this.el=null)}async loadRecords(){this.isLoading=!0;try{const[e,t]=await Promise.all([$t("growth"),$t("quality")]),s=e.map(r=>({...r,_type:"growth"})),n=t.map(r=>({...r,_type:"quality"}));this.allRecords=[...s,...n].sort((r,a)=>a.updatedAt.localeCompare(r.updatedAt))}catch{w("레코드를 불러오지 못했습니다.","error")}finally{this.isLoading=!1}}renderSkeleton(){this.el&&(this.el.innerHTML=`
      <div class="page" style="padding-top:0;">
        <div class="page-header" style="position:sticky;top:0;z-index:20;">
          <h1>목록</h1>
        </div>
        <div style="padding:var(--padding-mobile);">
          ${Array.from({length:3}).map(()=>`
            <div class="skeleton" style="height:72px;margin-bottom:8px;border-radius:var(--radius);"></div>
          `).join("")}
        </div>
      </div>
    `)}render(){if(!this.el)return;const e=this.getFilteredRecords(),t=this.groupRecords(e);this.el.innerHTML=`
      <div class="page" style="padding-top:0;">

        <!-- 헤더 -->
        <div class="page-header" style="position:sticky;top:0;z-index:20;">
          <h1>목록</h1>
          <button class="btn btn-ghost" id="refresh-btn" type="button" style="font-size:14px;color:var(--color-primary);">
            새로고침
          </button>
        </div>

        <div style="padding:var(--padding-mobile);padding-bottom:calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 24px);">

          <!-- 동기화 상태 바 -->
          <div id="sync-status-container"></div>

          <!-- 필터 탭 -->
          <div class="filter-bar">
            <button class="filter-chip${this.activeFilter==="all"?" active":""}" data-filter="all" type="button">전체</button>
            <button class="filter-chip${this.activeFilter==="growth"?" active":""}" data-filter="growth" type="button">비대조사</button>
            <button class="filter-chip${this.activeFilter==="quality"?" active":""}" data-filter="quality" type="button">품질조사</button>
          </div>

          <!-- 통계 요약 -->
          <div style="display:flex;gap:8px;margin-bottom:16px;">
            ${this.renderStatBadge(e)}
          </div>

          <!-- 레코드 목록 -->
          <div id="record-groups">
            ${t.length===0?this.renderEmptyState():t.map(s=>this.renderSessionGroup(s)).join("")}
          </div>

        </div>
      </div>
    `,this.mountSyncStatusBar(),this.bindEvents()}renderStatBadge(e){const t=e.length,s=e.filter(r=>r.syncStatus==="pending").length,n=e.filter(r=>r.syncStatus==="synced").length;return`
      <div class="badge badge-success" style="font-size:13px;">전체 ${t}건</div>
      <div class="badge badge-warning" style="font-size:13px;">미동기화 ${s}건</div>
      <div class="badge" style="background:var(--color-primary-bg);color:var(--color-primary);font-size:13px;">완료 ${n}건</div>
    `}renderEmptyState(){return`
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">저장된 레코드가 없습니다</div>
        <div class="empty-state-sub">비대조사 또는 품질조사 탭에서 데이터를 입력하세요</div>
      </div>
    `}renderSessionGroup(e){const t=Ze(e.surveyDate),s=e.pendingCount>0?`<span style="font-size:12px;color:var(--color-warning);">⏳ ${e.pendingCount}건 미동기화</span>`:'<span style="font-size:12px;color:var(--color-primary);">✓ 모두 동기화</span>',n=e.surveyType==="growth"?"비대":"품질";return`
      <div class="session-group" data-session-key="${this.escapeAttr(e.sessionKey)}">
        <div class="session-group-header">
          <div class="session-group-info">
            <div class="session-group-title">
              ${this.escapeHtml(e.farmerName)} · ${this.escapeHtml(e.label)} · ${this.escapeHtml(e.treatment)}
              <span style="font-size:11px;background:var(--color-primary);color:white;padding:1px 6px;border-radius:99px;margin-left:6px;">${n}</span>
            </div>
            <div class="session-group-meta">${t} · ${s}</div>
          </div>
          <span class="session-group-count">${e.records.length}건</span>
        </div>

        <div class="session-group-records">
          ${e.records.map(r=>this.renderRecordCard(r,e.surveyType)).join("")}
        </div>
      </div>
    `}renderRecordCard(e,t){const s=this.expandedRecordId===e.id,n=this.getSyncIcon(e.syncStatus),r=e,a=e,o=t==="growth"?`횡경 ${r.width??"-"} · 종경 ${r.height??"-"}`:`횡경 ${r.width??"-"} · 당도 ${a.brix??"-"}`,l=s?this.renderRecordDetail(e,t):"";return`
      <div class="record-card" data-record-id="${this.escapeAttr(e.id)}" data-survey-type="${t}">
        <div class="record-card-header" data-action="toggle-detail" data-record-id="${this.escapeAttr(e.id)}">
          <div class="record-card-main">
            <div class="record-card-id">나무 ${r.treeNo}번 · 과실 ${r.fruitNo}번</div>
            <div class="record-card-values">${o}</div>
          </div>
          <div class="record-card-actions">
            <span class="${this.getSyncIconClass(e.syncStatus)}" aria-label="${this.getSyncLabel(e.syncStatus)}">${n}</span>
            <span style="color:var(--color-text-secondary);font-size:18px;transition:transform 200ms;">${s?"▲":"▼"}</span>
          </div>
        </div>
        ${l}
      </div>
    `}renderRecordDetail(e,t){const s=e,n=e,r=[{label:"조사일자",value:Ze(e.surveyDate)},{label:"농가명",value:e.farmerName},{label:"라벨",value:e.label},{label:"처리",value:e.treatment},{label:"나무번호",value:`${s.treeNo}번`},{label:"과실번호",value:`${s.fruitNo}번`},{label:"횡경",value:s.width!=null?`${s.width} mm`:"-"},{label:"종경",value:s.height!=null?`${s.height} mm`:"-"}],a=t==="quality"?[{label:"과중",value:n.fruitWeight!=null?`${n.fruitWeight} g`:"-"},{label:"과피중",value:n.pericarpWeight!=null?`${n.pericarpWeight} g`:"-"},{label:"과피두께",value:n.pericarpThickness!=null?`${n.pericarpThickness} mm`:"-"},{label:"과피두께×4",value:n.pericarpThicknessX4!=null?`${n.pericarpThicknessX4} mm`:"-"},{label:"당도",value:n.brix!=null?`${n.brix} °Bx`:"-"},{label:"산함량",value:n.acidContent!=null?`${n.acidContent} %`:"-"},{label:"당산도",value:n.sugarAcidRatio!=null?String(n.sugarAcidRatio):"-"},{label:"착색",value:n.coloring!=null?String(n.coloring):"-"},{label:"비파괴",value:n.nonDestructive!=null?String(n.nonDestructive):"-"}]:[],o=[...r,...a];s.remark&&o.push({label:"비고",value:s.remark});const l=e.syncedAt?new Date(e.syncedAt).toLocaleString("ko-KR",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):null;return`
      <div class="record-card-detail">
        <div class="record-detail-grid">
          ${o.map(c=>`
            <div class="record-detail-item">
              <span class="record-detail-label">${this.escapeHtml(c.label)}</span>
              <span class="record-detail-value">${this.escapeHtml(c.value)}</span>
            </div>
          `).join("")}
        </div>
        ${l?`<div style="font-size:11px;color:var(--color-text-secondary);margin-top:8px;">동기화: ${l}</div>`:""}
        <div class="record-detail-actions">
          <button class="btn btn-secondary" data-action="edit-record" data-record-id="${this.escapeAttr(e.id)}" data-survey-type="${t}" type="button" style="flex:1;height:40px;font-size:14px;">
            수정
          </button>
          <button class="btn btn-danger" data-action="delete-record" data-record-id="${this.escapeAttr(e.id)}" data-survey-type="${t}" type="button" style="flex:1;height:40px;font-size:14px;">
            삭제
          </button>
        </div>
      </div>
    `}mountSyncStatusBar(){const e=this.el?.querySelector("#sync-status-container");e&&(this.syncStatusBar?.unmount(),this.syncStatusBar=new gs,this.syncStatusBar.mount(e))}bindEvents(){if(!this.el)return;this.el.querySelector("#refresh-btn")?.addEventListener("click",()=>this.handleRefresh()),this.el.querySelector(".filter-bar")?.addEventListener("click",n=>{const r=n.target.closest("[data-filter]");if(!r)return;const a=r.dataset.filter;this.handleFilterChange(a)}),this.el.querySelector("#record-groups")?.addEventListener("click",async n=>{const a=n.target.closest("[data-action]");if(!a)return;const o=a.dataset.action,l=a.dataset.recordId,c=a.dataset.surveyType??"growth";o==="toggle-detail"&&l?this.handleToggleDetail(l):o==="delete-record"&&l?await this.handleDeleteRecord(l,c):o==="edit-record"&&l&&this.handleEditRecord(l,c)})}handleToggleDetail(e){this.expandedRecordId=this.expandedRecordId===e?null:e,this.rerenderGroups()}async handleDeleteRecord(e,t){if(await de("레코드를 삭제하면 복구할 수 없습니다. 삭제하시겠습니까?","삭제",!0))try{await Ks(t,e),this.allRecords=this.allRecords.filter(n=>n.id!==e),this.expandedRecordId=null,await me.refresh(()=>ts()),this.rerenderGroups(),w("레코드가 삭제되었습니다.","success")}catch{w("삭제에 실패했습니다.","error")}}handleEditRecord(e,t){const s=t==="growth"?"#/survey/growth":"#/survey/quality";window.location.hash=`${s}?edit=${encodeURIComponent(e)}`}handleFilterChange(e){this.activeFilter=e,this.rerenderGroups(),this.el?.querySelectorAll("[data-filter]")?.forEach(s=>{s.classList.toggle("active",s.dataset.filter===e)})}async handleRefresh(){const e=this.el?.querySelector("#refresh-btn");e&&(e.disabled=!0,e.textContent="로딩 중..."),await this.loadRecords(),this.expandedRecordId=null,this.rerenderGroups(),e&&(e.disabled=!1,e.textContent="새로고침"),w("새로고침 완료","success")}rerenderGroups(){const e=this.el?.querySelector("#record-groups");if(!e)return;const t=this.getFilteredRecords(),s=this.groupRecords(t);e.innerHTML=s.length===0?this.renderEmptyState():s.map(r=>this.renderSessionGroup(r)).join("");const n=e.previousElementSibling;n&&n instanceof HTMLElement&&(n.innerHTML=this.renderStatBadge(t))}getFilteredRecords(){return this.activeFilter==="all"?this.allRecords:this.allRecords.filter(e=>e._type===this.activeFilter)}groupRecords(e){const t=new Map;for(const s of e){const r=s._type??"growth",a=`${s.sessionKey}_${r}`;t.has(a)||t.set(a,{sessionKey:s.sessionKey,surveyDate:s.surveyDate,farmerName:s.farmerName,label:s.label,treatment:s.treatment,records:[],surveyType:r,syncedCount:0,pendingCount:0});const o=t.get(a);o.records.push(s),s.syncStatus==="synced"?o.syncedCount++:o.pendingCount++}for(const s of t.values())s.records.sort((n,r)=>{const a=n,o=r;return a.treeNo!==o.treeNo?a.treeNo-o.treeNo:a.fruitNo-o.fruitNo});return Array.from(t.values()).sort((s,n)=>n.surveyDate.localeCompare(s.surveyDate))}getSyncIcon(e){switch(e){case"pending":return"⏳";case"synced":return"✓";case"error":return"⚠️";default:return"?"}}getSyncIconClass(e){switch(e){case"pending":return"sync-icon-pending";case"synced":return"sync-icon-synced";case"error":return"sync-icon-error";default:return""}}getSyncLabel(e){switch(e){case"pending":return"미동기화";case"synced":return"동기화 완료";case"error":return"동기화 오류";default:return""}}escapeHtml(e){if(e==null)return"-";const t=document.createElement("div");return t.appendChild(document.createTextNode(String(e))),t.innerHTML}escapeAttr(e){return String(e??"").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}}const tn={ok:"badge-ok",warn:"badge-warn",fail:"badge-fail"},sn={ok:"성공",warn:"경고",fail:"실패"};function nn(i){return i===0?"0 B":i<1024?`${i} B`:i<1024*1024?`${(i/1024).toFixed(1)} KB`:`${(i/(1024*1024)).toFixed(1)} MB`}function z(i){const e=document.createElement("div");return e.appendChild(document.createTextNode(i)),e.innerHTML}function rn(i){try{const e=new Date(i),t=String(e.getHours()).padStart(2,"0"),s=String(e.getMinutes()).padStart(2,"0"),n=String(e.getSeconds()).padStart(2,"0");return`${t}:${s}:${n}`}catch{return i}}class an{el=null;expandedDate=null;logCache=new Map;activeAudioUrls=[];mount(e){this.el=document.createElement("div"),this.el.className="page voice-log-page",this.el.innerHTML=this.renderSkeleton(),e.appendChild(this.el),this.injectStyles(),this.loadAndRender()}unmount(){this.revokeAudioUrls(),this.el&&(this.el.remove(),this.el=null),this.logCache.clear(),this.expandedDate=null}async loadAndRender(){if(this.el)try{const[e,t]=await Promise.all([Nt(),Ti()]);this.renderStorage(e),this.renderDateList(t)}catch(e){this.renderError(e instanceof Error?e.message:String(e))}}renderSkeleton(){return`
      <div class="page-header">
        <h1 class="page-title">음성 로그</h1>
      </div>
      <div class="vl-storage-section" id="vl-storage">
        <div class="vl-loading">불러오는 중…</div>
      </div>
      <div class="vl-date-list" id="vl-date-list">
        <div class="vl-loading">불러오는 중…</div>
      </div>
      <div class="vl-detail-section" id="vl-detail"></div>
    `}renderStorage(e){const t=this.el?.querySelector("#vl-storage");t&&(t.innerHTML=`
      <div class="vl-storage-card">
        <div class="vl-storage-stats">
          <span class="vl-stat-item">
            <span class="vl-stat-label">로그</span>
            <span class="vl-stat-value">${e.logCount}건</span>
          </span>
          <span class="vl-stat-divider">·</span>
          <span class="vl-stat-item">
            <span class="vl-stat-label">오디오</span>
            <span class="vl-stat-value">${e.audioCount}개</span>
          </span>
          <span class="vl-stat-divider">·</span>
          <span class="vl-stat-item">
            <span class="vl-stat-label">크기</span>
            <span class="vl-stat-value">${nn(e.estimatedBytes)}</span>
          </span>
        </div>
        <div class="vl-storage-actions">
          <button class="btn btn-sm btn-secondary" id="vl-btn-export-json">JSON 내보내기</button>
          <button class="btn btn-sm btn-secondary" id="vl-btn-export-zip">ZIP 내보내기</button>
          <button class="btn btn-sm btn-danger" id="vl-btn-delete-all">전체 삭제</button>
        </div>
      </div>
    `,t.querySelector("#vl-btn-export-json")?.addEventListener("click",()=>{this.handleExportJson()}),t.querySelector("#vl-btn-export-zip")?.addEventListener("click",()=>{this.handleExportZip()}),t.querySelector("#vl-btn-delete-all")?.addEventListener("click",()=>{this.handleDeleteAll()}))}renderDateList(e){const t=this.el?.querySelector("#vl-date-list");if(!t)return;if(e.length===0){t.innerHTML=`
        <div class="empty-state" style="padding: 40px 0;">
          <div class="empty-state-icon">🎙</div>
          <div class="empty-state-text">저장된 음성 로그가 없습니다</div>
        </div>
      `;return}const s=e.map(n=>this.renderDateCard(n)).join("");t.innerHTML=`<div class="vl-date-cards">${s}</div>`,t.querySelectorAll(".vl-date-card").forEach(n=>{n.addEventListener("click",()=>{const r=n.dataset.date;r&&this.handleDateCardClick(r)})})}renderDateCard(e){const t=this.expandedDate===e.date,s=e.hasAudio?'<span class="vl-audio-icon" title="오디오 포함">🎵</span>':"";return`
      <div class="vl-date-card ${t?"is-expanded":""}" data-date="${z(e.date)}" role="button" tabindex="0" aria-expanded="${t}">
        <div class="vl-date-card-header">
          <span class="vl-date-label">${z(e.date)}</span>
          ${s}
          <span class="vl-date-total">${e.totalCount}건</span>
          <span class="vl-expand-icon">${t?"▲":"▼"}</span>
        </div>
        <div class="vl-date-card-badges">
          <span class="badge badge-ok">성공 ${e.okCount}</span>
          <span class="badge badge-warn">경고 ${e.warnCount}</span>
          <span class="badge badge-fail">실패 ${e.failCount}</span>
        </div>
      </div>
    `}renderDetail(e,t){const s=this.el?.querySelector("#vl-detail");if(!s)return;if(t.length===0){s.innerHTML='<div class="vl-detail-empty">해당 날짜의 로그가 없습니다.</div>';return}const n=t.map(r=>this.renderLogItem(r)).join("");s.innerHTML=`
      <div class="vl-detail-header">
        <span class="vl-detail-title">${z(e)} 로그 상세</span>
      </div>
      <div class="vl-log-list">${n}</div>
    `,s.querySelectorAll(".vl-btn-delete-log").forEach(r=>{r.addEventListener("click",a=>{a.stopPropagation();const o=r.dataset.logId;o&&this.handleDeleteLog(o,e)})}),s.querySelectorAll(".vl-btn-play-audio").forEach(r=>{r.addEventListener("click",a=>{a.stopPropagation();const o=r.dataset.audioId;o&&this.handlePlayAudio(o,r)})})}renderLogItem(e){const t=tn[e.kind]??"badge-fail",s=sn[e.kind]??e.kind,n=rn(e.ts);let r='<span class="vl-parse-none">파싱 결과 없음</span>';if(e.parse){const o=e.parse.field??"-",l=e.parse.value??"-",c=(e.parse.score*100).toFixed(0);r=`
        <span class="vl-parse-field">${z(o)}</span>
        <span class="vl-parse-sep"> → </span>
        <span class="vl-parse-value">${z(l)}</span>
        <span class="vl-parse-score">(${c}%)</span>
      `}const a=e.audioFileId?`<button class="btn btn-xs btn-secondary vl-btn-play-audio" data-audio-id="${z(e.audioFileId)}" title="오디오 재생">▶</button>`:"";return`
      <div class="vl-log-item" data-log-id="${z(e.id)}">
        <div class="vl-log-row vl-log-header-row">
          <span class="vl-log-time">${z(n)}</span>
          <span class="badge ${t}">${z(s)}</span>
          <div class="vl-log-actions">
            ${a}
            <button class="btn btn-xs btn-danger vl-btn-delete-log" data-log-id="${z(e.id)}" title="삭제">✕</button>
          </div>
        </div>
        <div class="vl-log-raw">${z(e.rawText)}</div>
        <div class="vl-log-parse">${r}</div>
      </div>
    `}renderError(e){const t=this.el?.querySelector("#vl-date-list");t&&(t.innerHTML=`<div class="vl-error">데이터를 불러오지 못했습니다: ${z(e)}</div>`)}async handleDateCardClick(e){if(this.expandedDate===e){this.expandedDate=null,this.clearDetail(),this.refreshDateCards();return}this.expandedDate=e,this.refreshDateCards();try{let t=this.logCache.get(e);t||(t=await Me({dateFrom:e,dateTo:e}),this.logCache.set(e,t)),this.renderDetail(e,t)}catch(t){w(`로그 조회 실패: ${t instanceof Error?t.message:String(t)}`,"error")}}clearDetail(){const e=this.el?.querySelector("#vl-detail");e&&(e.innerHTML="")}refreshDateCards(){const e=this.el?.querySelector("#vl-date-list");e&&e.querySelectorAll(".vl-date-card").forEach(t=>{const n=t.dataset.date===this.expandedDate;t.classList.toggle("is-expanded",n),t.setAttribute("aria-expanded",String(n));const r=t.querySelector(".vl-expand-icon");r&&(r.textContent=n?"▲":"▼")})}async handleExportJson(){try{const e=await xi(),t=new Blob([e],{type:"application/json"});this.triggerDownload(t,`voice-logs-${this.todayStr()}.json`),w("JSON 내보내기 완료","success")}catch(e){w(`내보내기 실패: ${e instanceof Error?e.message:String(e)}`,"error")}}async handleExportZip(){try{w("ZIP 생성 중…","info",6e4);const e=await Ei(),t=new Blob([e.buffer],{type:"application/zip"});this.triggerDownload(t,`voice-logs-${this.todayStr()}.zip`),w("ZIP 내보내기 완료","success")}catch(e){w(`ZIP 내보내기 실패: ${e instanceof Error?e.message:String(e)}`,"error")}}triggerDownload(e,t){const s=URL.createObjectURL(e),n=document.createElement("a");n.href=s,n.download=t,document.body.appendChild(n),n.click(),document.body.removeChild(n),setTimeout(()=>URL.revokeObjectURL(s),1e3)}async handleDeleteAll(){if(await de("모든 음성 로그와 오디오 파일을 삭제합니다. 되돌릴 수 없습니다.","전체 삭제",!0))try{await wi(),this.logCache.clear(),this.expandedDate=null,w("전체 로그가 삭제되었습니다","success"),this.loadAndRender()}catch(t){w(`삭제 실패: ${t instanceof Error?t.message:String(t)}`,"error")}}async handleDeleteLog(e,t){if(await de("이 로그를 삭제하시겠습니까?","삭제",!0))try{await Si(e);const n=this.logCache.get(t);if(n){const r=n.filter(a=>a.id!==e);this.logCache.set(t,r),this.renderDetail(t,r)}w("로그가 삭제되었습니다","success");try{const r=await Nt();this.renderStorage(r)}catch{}}catch(n){w(`삭제 실패: ${n instanceof Error?n.message:String(n)}`,"error")}}async handlePlayAudio(e,t){try{const n=await(await k()).get("voiceAudio",e);if(!n){w("오디오 파일을 찾을 수 없습니다","warning");return}const r=URL.createObjectURL(n.blob);this.activeAudioUrls.push(r);const a=new Audio(r);t.textContent="■",t.disabled=!0,a.addEventListener("ended",()=>{t.textContent="▶",t.disabled=!1,URL.revokeObjectURL(r),this.activeAudioUrls=this.activeAudioUrls.filter(o=>o!==r)}),a.addEventListener("error",()=>{t.textContent="▶",t.disabled=!1,URL.revokeObjectURL(r),this.activeAudioUrls=this.activeAudioUrls.filter(o=>o!==r),w("오디오 재생 실패","error")}),await a.play()}catch(s){w(`오디오 재생 실패: ${s instanceof Error?s.message:String(s)}`,"error")}}revokeAudioUrls(){this.activeAudioUrls.forEach(e=>URL.revokeObjectURL(e)),this.activeAudioUrls=[]}todayStr(){return new Date().toISOString().slice(0,10)}injectStyles(){const e="voice-log-page-styles";if(document.getElementById(e))return;const t=document.createElement("style");t.id=e,t.textContent=`
      /* ── VoiceLogPage 레이아웃 ── */
      .voice-log-page {
        display: flex;
        flex-direction: column;
        gap: 0;
        padding-bottom: 80px;
      }

      /* ── 저장소 통계 카드 ── */
      .vl-storage-card {
        background: var(--surface, #fff);
        border-bottom: 1px solid var(--border, #e0e0e0);
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .vl-storage-stats {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
      }
      .vl-stat-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .vl-stat-label {
        font-size: 12px;
        color: var(--text-secondary, #666);
      }
      .vl-stat-value {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary, #212121);
      }
      .vl-stat-divider {
        color: var(--text-secondary, #aaa);
        margin: 0 4px;
      }
      .vl-storage-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      /* ── 날짜별 카드 목록 ── */
      .vl-date-cards {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      .vl-date-card {
        background: var(--surface, #fff);
        border-bottom: 1px solid var(--border, #e0e0e0);
        padding: 12px 16px;
        cursor: pointer;
        user-select: none;
        transition: background 0.15s;
      }
      .vl-date-card:hover,
      .vl-date-card.is-expanded {
        background: var(--surface-hover, #f5f5f5);
      }
      .vl-date-card-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .vl-date-label {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary, #212121);
        flex: 1;
      }
      .vl-audio-icon {
        font-size: 13px;
      }
      .vl-date-total {
        font-size: 13px;
        color: var(--text-secondary, #666);
      }
      .vl-expand-icon {
        font-size: 11px;
        color: var(--text-secondary, #999);
        margin-left: 4px;
      }
      .vl-date-card-badges {
        display: flex;
        gap: 6px;
        margin-top: 6px;
      }

      /* ── 배지 ── */
      .badge {
        display: inline-block;
        padding: 2px 7px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.4;
      }
      .badge-ok {
        background: #e8f5e9;
        color: #2e7d32;
      }
      .badge-warn {
        background: #fff3e0;
        color: #e65100;
      }
      .badge-fail {
        background: #ffebee;
        color: #c62828;
      }

      /* ── 로그 상세 섹션 ── */
      .vl-detail-section {
        background: var(--surface-alt, #fafafa);
      }
      .vl-detail-header {
        padding: 10px 16px 4px;
        border-bottom: 1px solid var(--border, #e0e0e0);
      }
      .vl-detail-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary, #555);
      }
      .vl-detail-empty {
        padding: 20px 16px;
        font-size: 13px;
        color: var(--text-secondary, #888);
      }

      /* ── 로그 항목 ── */
      .vl-log-list {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      .vl-log-item {
        padding: 10px 16px;
        border-bottom: 1px solid var(--border, #ececec);
        background: var(--surface, #fff);
      }
      .vl-log-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .vl-log-header-row {
        margin-bottom: 4px;
      }
      .vl-log-time {
        font-size: 12px;
        color: var(--text-secondary, #888);
        font-variant-numeric: tabular-nums;
        min-width: 56px;
      }
      .vl-log-actions {
        margin-left: auto;
        display: flex;
        gap: 4px;
        align-items: center;
      }
      .vl-log-raw {
        font-size: 14px;
        color: var(--text-primary, #212121);
        margin-bottom: 2px;
        word-break: break-all;
      }
      .vl-log-parse {
        font-size: 12px;
        color: var(--text-secondary, #666);
      }
      .vl-parse-field { font-weight: 600; color: #1565c0; }
      .vl-parse-value { color: #2e7d32; }
      .vl-parse-score { color: #999; }
      .vl-parse-none  { color: #bbb; font-style: italic; }

      /* ── 버튼 크기 변형 ── */
      .btn-xs {
        padding: 2px 7px;
        font-size: 11px;
        border-radius: 4px;
        min-height: 24px;
      }
      .btn-sm {
        padding: 5px 12px;
        font-size: 13px;
        border-radius: 6px;
      }
      .btn-danger {
        background: #c62828;
        color: #fff;
        border: none;
        cursor: pointer;
      }
      .btn-danger:hover { background: #b71c1c; }
      .btn-secondary {
        background: var(--surface, #fff);
        color: var(--text-primary, #333);
        border: 1px solid var(--border, #ccc);
        cursor: pointer;
      }
      .btn-secondary:hover { background: var(--surface-hover, #f0f0f0); }

      /* ── 로딩/에러 ── */
      .vl-loading {
        padding: 24px 16px;
        font-size: 14px;
        color: var(--text-secondary, #999);
        text-align: center;
      }
      .vl-error {
        padding: 24px 16px;
        font-size: 14px;
        color: #c62828;
      }
    `,document.head.appendChild(t)}}const Kt=20,we={treeNo:"나무번호",fruitNo:"과실번호",width:"횡경",height:"종경",fruitWeight:"과중",pericarpWeight:"과피중",pericarpThickness:"과피두께",brix:"당도",titratableAcidity:"적정산도",acidContent:"산함량",coloring:"착색",nonDestructive:"비파괴",remark:"비고"};class on{el=null;sttService=null;ttsService=null;mediaRecorderService=null;isVoiceActive=!1;voiceBtnEl=null;lastField=null;mount(e){this.el=document.createElement("div"),e.appendChild(this.el),this.render(),this.initVoiceServices(),this.loadAndRenderLogs()}unmount(){this.sttService?.stop(),this.sttService=null,this.ttsService?.cancel(),this.ttsService=null,this.mediaRecorderService?.isRecording&&this.mediaRecorderService.stopRecording().catch(()=>{}),this.mediaRecorderService=null,this.voiceBtnEl=null,this.isVoiceActive=!1,this.el&&(this.el.remove(),this.el=null)}render(){if(!this.el)return;this.el.innerHTML=`
      <div class="page" style="padding-top:0;">

        <!-- 헤더 -->
        <div class="page-header" style="position:sticky;top:0;z-index:20;">
          <h1>STT 테스트</h1>
        </div>

        <div style="padding:var(--padding-mobile);padding-bottom:calc(var(--tab-bar-height) + env(safe-area-inset-bottom) + 24px);">

          <!-- 음성 인식 영역 -->
          <section style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:16px;margin-bottom:16px;">
            <div style="font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);color:var(--color-text-secondary);margin-bottom:12px;">음성 인식</div>

            <!-- 큰 마이크 버튼 -->
            <div class="voice-primary-area" style="margin-bottom:12px;">
              <button class="btn-voice-primary" id="stt-test-voice-btn" type="button">
                <span class="voice-btn-icon">🎤</span>
                <span class="voice-btn-label">음성 입력</span>
                <span class="voice-btn-sub">탭하여 시작</span>
              </button>
            </div>

            <!-- 중간 텍스트 (interim) 실시간 표시 -->
            <div id="stt-interim-area" style="
              background:var(--color-bg);
              border:1px solid var(--color-border-light);
              border-radius:var(--radius-sm);
              padding:12px;
              min-height:56px;
              margin-bottom:8px;
              font-size:var(--font-size-md);
              color:var(--color-text-secondary);
              line-height:1.5;
            ">
              <span id="stt-interim-text" style="color:var(--color-text-disabled);">...</span>
            </div>

            <!-- 최종 인식 결과 -->
            <div id="stt-final-area" style="
              background:#e8f5e9;
              border:1px solid rgba(46,125,50,0.3);
              border-radius:var(--radius-sm);
              padding:12px;
              min-height:56px;
              font-size:var(--font-size-md);
              font-weight:var(--font-weight-semibold);
              color:var(--color-primary);
              line-height:1.5;
            ">
              <span id="stt-final-text" style="color:var(--color-text-disabled);font-weight:normal;">인식 결과가 여기에 표시됩니다</span>
            </div>
          </section>

          <!-- 파서 결과 -->
          <section style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:16px;margin-bottom:16px;">
            <div style="font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);color:var(--color-text-secondary);margin-bottom:12px;">파서 결과</div>
            <div id="stt-parse-result" style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">
              아직 인식 결과가 없습니다.
            </div>
          </section>

          <!-- 통계 -->
          <section style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:16px;margin-bottom:16px;">
            <div style="font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);color:var(--color-text-secondary);margin-bottom:12px;">통계</div>
            <div id="stt-stats" style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">
              로그 로딩 중...
            </div>
          </section>

          <!-- 최근 로그 20건 -->
          <section style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:16px;">
            <div style="font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);color:var(--color-text-secondary);margin-bottom:12px;">최근 로그 (최대 ${Kt}건)</div>
            <div id="stt-log-list">
              <div style="color:var(--color-text-disabled);font-size:var(--font-size-sm);">로딩 중...</div>
            </div>
          </section>

        </div>
      </div>
    `;const e=this.el.querySelector("#stt-test-voice-btn");e&&(this.voiceBtnEl=e,e.addEventListener("click",()=>this.handleToggleVoice()))}initVoiceServices(){this.sttService=new hs,this.ttsService=new fs,this.sttService.onInterim=s=>{if(this.updateInterimText(s),this.mediaRecorderService&&!this.mediaRecorderService.isRecording){const n=this.sttService?.stream;n&&this.mediaRecorderService.startRecording(n)}},this.sttService.onResult=s=>{this.handleSttResult(s)},this.sttService.onStateChange=()=>{},this.sttService.onError=s=>{this.isVoiceActive=!1,this.updateVoiceBtnUI(!1),this.updateInterimText(`오류: ${s}`)},he.isSupported()&&(this.mediaRecorderService=new he,this.sttService.onSpeechStart=()=>{const s=this.sttService?.stream;s&&this.mediaRecorderService&&!this.mediaRecorderService.isRecording&&this.mediaRecorderService.startRecording(s)});const e=window;if(!("SpeechRecognition"in e||"webkitSpeechRecognition"in e)&&this.voiceBtnEl){this.voiceBtnEl.disabled=!0,this.voiceBtnEl.classList.add("unsupported");const s=this.voiceBtnEl.querySelector(".voice-btn-sub");s&&(s.textContent="이 브라우저는 음성 인식을 지원하지 않습니다")}}handleToggleVoice(){this.sttService&&(this.isVoiceActive?(this.mediaRecorderService?.isRecording&&this.mediaRecorderService.stopRecording().catch(e=>{console.warn("[MediaRecorder] stopRecording 실패:",e)}),this.sttService.stop(),this.isVoiceActive=!1,this.updateVoiceBtnUI(!1),this.updateInterimText(""),this.ttsService?.speak("음성 입력 종료")):(this.ttsService?.unlock(),this.sttService.start(),this.isVoiceActive=!0,this.updateVoiceBtnUI(!0),this.ttsService?.speak("음성 입력 시작")))}handleSttResult(e){const t=e.transcript;this.updateFinalText(t);const s=ps(t,{lastField:this.lastField},e.alternatives??[]);if(s.field&&(this.lastField=s.field),this.renderParseResult(t,s),s.field&&s.score>=.5){const o=we[s.field]??s.field,l=s.isCorrection?"수정 ":"";this.ttsService?.speak(`${l}${o} ${s.value??""}`)}else this.ttsService?.speak("다시 말씀해 주세요");const n=s.field&&s.score>=.5?"ok":"fail",r=this.mediaRecorderService,a=r?.isRecording?r.stopRecording().catch(o=>(console.warn("[MediaRecorder] stopRecording 실패:",o),null)):Promise.resolve(null);(async()=>{try{const o=await Te({ts:ce(),kind:n,rawText:t,alternatives:e.alternatives,parse:s.field!==null?{field:s.field,value:s.value,score:s.score,method:s.method}:null,status:n==="ok"?"accepted":"rejected",message:s.field?`${we[s.field]??s.field} ${s.value??""}`:"다시 말씀해 주세요",audioFileId:null,session:"stt-test",device:$e()}),l=await a;if(l){const c=await Le({logId:o,blob:l.blob,mimeType:l.mimeType,durationMs:l.durationMs,ts:ce()});await Re(o,c)}}catch{}this.loadAndRenderLogs()})()}renderParseResult(e,t){const s=this.el?.querySelector("#stt-parse-result");if(!s)return;const n=t.field?we[t.field]??t.field:"—",r=t.score>=.8?"var(--color-primary)":t.score>=.5?"var(--color-warning)":"var(--color-error)",a=t.isCorrection?" (수정 모드)":"";s.innerHTML=`
      <div style="display:grid;gap:6px;">
        <div style="display:flex;gap:8px;align-items:baseline;">
          <span style="flex:0 0 72px;color:var(--color-text-secondary);">rawText</span>
          <span style="font-weight:var(--font-weight-medium);color:var(--color-text);">"${this.escapeHtml(e)}"</span>
        </div>
        <div style="display:flex;gap:8px;align-items:baseline;">
          <span style="flex:0 0 72px;color:var(--color-text-secondary);">필드</span>
          <span style="font-weight:var(--font-weight-medium);color:var(--color-text);">${this.escapeHtml(n)}${this.escapeHtml(a)}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:baseline;">
          <span style="flex:0 0 72px;color:var(--color-text-secondary);">값</span>
          <span style="font-weight:var(--font-weight-medium);color:var(--color-text);">${this.escapeHtml(t.value??"—")}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:baseline;">
          <span style="flex:0 0 72px;color:var(--color-text-secondary);">신뢰도</span>
          <span style="font-weight:var(--font-weight-semibold);color:${r};">${(t.score*100).toFixed(0)}%</span>
        </div>
        <div style="display:flex;gap:8px;align-items:baseline;">
          <span style="flex:0 0 72px;color:var(--color-text-secondary);">method</span>
          <span style="color:var(--color-text);">${this.escapeHtml(t.method)}</span>
        </div>
        ${t.warning?`
        <div style="display:flex;gap:8px;align-items:baseline;">
          <span style="flex:0 0 72px;color:var(--color-text-secondary);">경고</span>
          <span style="color:var(--color-warning);">${this.escapeHtml(t.warning)}</span>
        </div>
        `:""}
      </div>
    `}async loadAndRenderLogs(){try{const e=await Me(),t=e.slice(0,Kt);this.renderLogList(t),this.renderStats(e)}catch{const e=this.el?.querySelector("#stt-log-list");e&&(e.innerHTML='<div style="color:var(--color-error);font-size:var(--font-size-sm);">로그 로딩 실패</div>')}}renderLogList(e){const t=this.el?.querySelector("#stt-log-list");if(t){if(e.length===0){t.innerHTML='<div style="color:var(--color-text-disabled);font-size:var(--font-size-sm);">로그가 없습니다.</div>';return}t.innerHTML=e.map(s=>{const n=s.kind==="ok"?"var(--color-primary)":s.kind==="warn"?"var(--color-warning)":"var(--color-error)",r=s.kind==="ok"?"✓ ok":s.kind==="warn"?"⚠ warn":"✗ fail",a=s.parse?.field?`${we[s.parse.field]??s.parse.field} → ${s.parse.value??"?"}`:"—",o=s.parse?.score!==void 0?`${(s.parse.score*100).toFixed(0)}%`:"—",l=s.ts.slice(11,19);return`
        <div style="
          padding:10px 0;
          border-bottom:1px solid var(--color-border-light);
          font-size:var(--font-size-xs);
          display:grid;
          grid-template-columns:52px 1fr auto;
          gap:6px;
          align-items:start;
        ">
          <span style="color:var(--color-text-secondary);padding-top:1px;">${this.escapeHtml(l)}</span>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <span style="font-weight:var(--font-weight-medium);color:var(--color-text);font-size:var(--font-size-sm);">"${this.escapeHtml(s.rawText)}"</span>
            <span style="color:var(--color-text-secondary);">${this.escapeHtml(a)} · ${this.escapeHtml(o)}</span>
          </div>
          <span style="color:${n};font-weight:var(--font-weight-semibold);padding-top:1px;white-space:nowrap;">${r}</span>
        </div>
      `}).join("")}}renderStats(e){const t=this.el?.querySelector("#stt-stats");if(!t)return;const s=e.length,n=e.filter(c=>c.kind==="ok").length,r=e.filter(c=>c.kind==="fail").length,a=s>0?(n/s*100).toFixed(1):"0.0",o=e.slice(0,50).filter(c=>c.kind==="fail").slice(0,5),l=o.length>0?`<div style="margin-top:8px;color:var(--color-text-secondary);">최근 실패 패턴:</div>
         <ul style="margin-top:4px;padding-left:0;display:flex;flex-direction:column;gap:2px;">
           ${o.map(c=>`<li style="color:var(--color-error);">"${this.escapeHtml(c.rawText)}"</li>`).join("")}
         </ul>`:"";t.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;margin-bottom:8px;">
        <div>
          <div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);color:var(--color-text);">${s}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">전체</div>
        </div>
        <div>
          <div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);color:var(--color-primary);">${a}%</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">ok 비율</div>
        </div>
        <div>
          <div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);color:var(--color-error);">${r}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-secondary);">실패</div>
        </div>
      </div>
      ${l}
    `}updateVoiceBtnUI(e){if(this.voiceBtnEl)if(e){this.voiceBtnEl.classList.add("active"),this.voiceBtnEl.classList.remove("unsupported");const t=this.voiceBtnEl.querySelector(".voice-btn-icon"),s=this.voiceBtnEl.querySelector(".voice-btn-sub");t&&(t.textContent="🔴"),s&&(s.textContent="듣는 중... (탭하여 중지)")}else{this.voiceBtnEl.classList.remove("active");const t=this.voiceBtnEl.querySelector(".voice-btn-icon"),s=this.voiceBtnEl.querySelector(".voice-btn-sub");t&&(t.textContent="🎤"),s&&(s.textContent="탭하여 시작")}}updateInterimText(e){const t=this.el?.querySelector("#stt-interim-text");t&&(e?(t.style.color="var(--color-text)",t.textContent=e):(t.style.color="var(--color-text-disabled)",t.textContent="..."))}updateFinalText(e){const t=this.el?.querySelector("#stt-final-text");t&&(t.style.color="var(--color-primary)",t.style.fontWeight="var(--font-weight-semibold)",t.textContent=e,this.updateInterimText(""))}escapeHtml(e){const t=document.createElement("div");return t.appendChild(document.createTextNode(e)),t.innerHTML}}let xe=null,O=null;async function Gt(i){if(!O)return;xe&&(xe.unmount(),xe=null),O.innerHTML="";let e;if(i.startsWith("#/settings")){const t=new ni;await t.mount(O),e=t}else if(i.startsWith("#/survey/quality")){const t=new Wt("quality");await t.mount(O),e=t}else if(i.startsWith("#/survey/growth")||i==="#/survey"||i===""){const t=new Wt("growth");await t.mount(O),e=t}else if(i.startsWith("#/records")){const t=new en;await t.mount(O),e=t}else if(i.startsWith("#/voicelogs")){const t=new an;t.mount(O),e=t}else if(i.startsWith("#/stttest")){const t=new on;t.mount(O),e=t}else{window.location.hash="#/survey/growth";return}xe=e}async function ln(){const i=document.getElementById("app");if(!i){console.error("[main] #app 요소를 찾을 수 없습니다.");return}try{await Cs();const e=await at();S.updateSessionFields({farmerName:e.defaultFarmerName,label:e.defaultLabel,treatment:e.defaultTreatment});const t=await ts();me.setPendingCount(t),window.addEventListener("online",()=>{Y.setNetworkStatus("online")}),window.addEventListener("offline",()=>{Y.setNetworkStatus("offline")}),window.addEventListener("hashchange",()=>{const o=location.hash||"#/survey/growth";Y.navigate(o),Gt(o)});const s=document.getElementById("loading");s&&s.remove(),i.innerHTML="",new Xs().mount(i),O=document.createElement("div"),O.id="page-container",O.style.cssText=`
      min-height: 100vh;
      padding-bottom: calc(var(--tab-bar-height) + env(safe-area-inset-bottom));
    `,i.appendChild(O),new Ys().mount(i);const a=location.hash||"#/survey/growth";if(location.hash?(Y.navigate(a),await Gt(a)):window.location.hash="#/survey/growth",Y.setInitialized(),"serviceWorker"in navigator)try{const l=await navigator.serviceWorker.register("./sw.js",{scope:"./"})}catch{}}catch(e){const t=e instanceof Error?e.message:String(e);console.error("[main] 앱 초기화 실패:",t);const s=document.getElementById("app");s&&(s.innerHTML=`
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: sans-serif;
          color: #c62828;
          padding: 24px;
          text-align: center;
          gap: 16px;
        ">
          <div style="font-size: 48px;">⚠️</div>
          <div style="font-size: 18px; font-weight: 600;">앱 초기화에 실패했습니다</div>
          <div style="font-size: 14px; color: #757575;">${t}</div>
          <button onclick="location.reload()" style="
            height: 44px;
            padding: 0 24px;
            background: #2e7d32;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 8px;
          ">
            새로고침
          </button>
        </div>
      `)}}ln();
//# sourceMappingURL=index-DvY-6a7n.js.map
