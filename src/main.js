import {SoundVisuals} from './sound-visuals.js';
import {inventoryDropTarget} from './inventory-drag.js';
import {gateBuildFire} from './field-refinement.js';
import {watchersFor,spectatorMessage,spectatorTargets} from './spectator-status.js';
import {recordSeasonEvent,masteryRewards} from './season-progress.js';
import {careerMarkup} from './career-ui.js';
import {recordCareerReceipt} from './career.js';
import {lobbyNavigation} from './lobby-ui.js';
import './menu-hub.css';
import {crosshairRadius} from './combat.js';
import {showWelcomeBack} from './welcome-back.js';
import {loadingMarkup,showLoading,hideLoading,waitForLoading,waitUntilLoadingHidden} from './loading-screen.js';
import {predictionCorrection} from './network-stats.js';
import {InputClock} from './input-clock.js';
import {RemoteSimulation} from './remote-simulation.js';
import {canFight} from './stance.js';
import {StreakUI} from './streak-ui.js';
import {PartyClient} from './party-client.js';
import {lobbyMarkup,publicRoyaleMarkup,modeMarkup,socialMarkup,EXPERIENCES} from './lobby-ui.js';
import {teammates,wonRoyale,isTeamRoyale} from './teams.js';
import {arrangeSettings} from './settings-layout.js';
import {eggsMarkup,formatEggs} from './currency-ui.js';
import {GuestPresentation} from './guest-presentation.js';
import {predictMovement} from './guest-movement.js';
import {GuestFire} from './guest-fire.js';
const guestFire=new GuestFire();
const guestPresentation=new GuestPresentation();
import {applyBuildState} from './building.js';
import {BuildingUI} from './building-ui.js';
import {snappedFacing} from './building-rules.js';
import {arenaBonuses,BONUS_NAMES,bonusStatus} from './streaks.js';
import { connectionReport } from './connection-report.js';
import {RoyaleSimulation} from './royale.js';
import {RoyaleUI} from './royale-ui.js';
import {SLIDERS, SLIDER_DEFAULTS, resetSliders, royalePanelAction} from './settings.js';
import {queueCandidates,ITEMS,itemInfo} from './royale-data.js';
import { ChatPanel } from "./chat-ui.js";
import { moderateText, safeName } from "./moderation.js";
import {matchOptions, targetLabel} from "./match-options.js";
import "./style.css";
import "./lobby.css";
import './settings-layout.css';
import {PerformanceHUD,PERFORMANCE_DEFAULTS} from './performance-hud.js';
import './performance-hud.css';
import {LobbyStatus} from './lobby-status.js';
import './lobby-status.css';
import './egg-shop.css';
import './ravelfront.css';
import {EggShop} from './egg-shop.js';
import {EggWallet,ownedLoadout} from './egg-wallet.js';
import {KeybindEditor} from "./keybind-editor.js";
import './field-update.css';
import './frontier-ui.css';
import './field-refinement.css';
import {OwnerConsole,startAnonymousVisits} from './owner-console.js';
import { CONTROLS, normalizeBindings, bindingDown, bindingLabel, wheelIntent } from "./keybinds.js";
import { RELEASES, RELEASE } from "./releases.js";
import { UpdateWatcher } from "./updates.js";
import {
  WEAPONS, BOT_DIFFICULTIES, nameKey,
  MODES,
  COLORS,
  HATS, PATTERNS, FINISHES, EYEWEAR, NO_EYEWEAR,
  gun,
  weapon,
  mode,
  safeProfile,
  clamp,
} from "./data.js";
import { MAPS, getMap } from "./maps.js";
import { movePlayer } from "./physics.js";
import { Simulation } from "./simulation.js";
import { Network, cleanCode, formatCode } from "./network.js";
import {MAX_SPECTATORS,MAX_HUMANS,MAX_CONTESTANTS,WARMUP_SECONDS} from './royale-phases.js';
import { directory } from "./directory.js";
import { View } from "./view.js";
import { Sound } from "./audio.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  },
  save = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {}
  };
let profile = safeProfile(
  read("yolk-profile", { name: "Player", weapon: "sprinter", hat: 0, eyewear: NO_EYEWEAR }),
);
const settings = {
  ...SLIDER_DEFAULTS,
  ...PERFORMANCE_DEFAULTS,
  quality: "high",
  invert: false,
  visualSoundEffects: true,
  centerDot: true,
  hitMarkers: true,
  chatMode: "all",
  ...read("yolk-settings", {}),
};
// Migrate the former alternate aim key to dedicated sprint exactly once.
if(!settings.royaleBindings){if(settings.keybinds?.aim)settings.keybinds.aim=settings.keybinds.aim.map(k=>k==='ShiftLeft'?null:k);settings.royaleBindings=true;}
settings.keybinds = normalizeBindings(settings.keybinds);
settings.chatMode = ["all", "quick", "off"].includes(settings.chatMode) ? settings.chatMode : "all";
save("yolk-profile", profile);
delete settings.dragLook;
save("yolk-settings", settings);
settings.sensitivity = clamp(Number(settings.sensitivity) || 1, 0.2, 3);
settings.scopeSensitivity = clamp(Number(settings.scopeSensitivity) || 0.65, 0.1, 2);
settings.fov = clamp(Number(settings.fov) || 85, 65, 110);
settings.volume = clamp(Number(settings.volume) || 0, 0, 1);
let stats = read("yolk-stats", { matches: 0, kills: 0, wins: 0 }),
  options = matchOptions({map:"yard", mode:"ffa", fill:true});
const eggWallet=new EggWallet({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)},stats.eggs||0),matchEarnings={total:0,status:'Match verification pending'};
let progressMatch='';
let menuSection=['locker','shop','career'].includes(location.hash.slice(1))?location.hash.slice(1):'play',careerMode='all';
const menuShopStates={};
Object.assign(profile,ownedLoadout(eggWallet.value,profile));
let eggShop,party,activeLaunch=null,lastEarnAction=-Infinity,earnMatch=0;
let view,
  sim = null,
  net = null,
  state = null,
  screen = "menu",
  paused = true,
  dialogType = "",
  localId = "host",
  predicted = null,
  pendingInputs = [],
  seq = 0,
  lastEvent = 0,
  lastPhase = "",
  lastHealth = 100,
  roundSaved = -1,
  busy = false,
  scoreHeld = false,
  noticeUntil = 0,
  toastUntil = 0,
  hitUntil = 0,
  damageFlash = 0;
const sound = new Sound();
sound.setVolumes(settings);
const keys = new Set();
const actionDown = action => bindingDown(settings.keybinds, keys, action);
const controlLabel = action => settings.keybinds[action].filter(Boolean).map(bindingLabel).join(' / ') || 'Unbound';
let bindingEditor = null;
// Preserve brief actions until a simulation tick consumes them, even after a slow frame.
const queuedActions = new Set();
const input = {
  yaw: 0,
  pitch: 0,
  forward: 0,
  strafe: 0,
  jump: false,
  fire: false,
  aim: false,
  reload: false,
  popper: false,
  slot: 0,
};
const touch = {
  x: 0,
  y: 0,
  jump: false,
  fire: false,
  aim: false,
  reload: false,
  popper: false,
};
$("#app").innerHTML =
  `<div id="menu"></div><div id="lobby" hidden></div><div id="hud"><div class="scope" id="scope"><i id="scope-spread" aria-hidden="true"></i><span id="scope-label"></span></div><div class="hud-top"><div class="match-label"><span id="hud-mode"></span><strong id="hud-map"></strong><span id="hud-network"></span></div><div class="match-center"><div class="score-pair"><b class="blue-score" id="score-blue"></b><b id="timer">5:00</b><b class="coral-score" id="score-coral"></b></div><small id="objective"></small></div><div class="hud-buttons"><button data-action="scores" aria-label="Scoreboard">Scores</button><button data-action="pause" aria-label="Pause menu">Ⅱ</button></div></div><div class="killfeed" id="feed"></div><div class="crosshair" id="crosshair"><i class="crosshair-arm left"></i><i class="crosshair-arm right"></i><i class="crosshair-arm top"></i><i class="crosshair-arm bottom"></i><span class="center-dot" id="center-dot"></span></div><div id="hit-marker" class="hit-marker" hidden></div><div class="hit-flash" id="damage"></div><div id="damage-directions" aria-hidden="true"></div><div id="round-banner" role="status" hidden></div><div class="notice" id="notice"></div><div class="respawn" id="respawn"><div class="eyebrow" id="spawn-heading">OPERATOR ELIMINATED</div><h2 id="spawn-status">Ready when you are</h2><button class="primary" id="spawn-button" data-action="enter-yard">Respawn</button><p class="small" id="respawn-by"></p><p class="small" id="spectator-stats"></p><button class="plain" data-action="loadout">Change loadout</button></div><div class="hud-bottom"><div class="health-card"><div id="arena-stamina" hidden><span>TACTICAL SPRINT</span><progress id="arena-stamina-fill" max="100" value="100"></progress></div><div class="vital-row shield-row"><span class="vital-icon" aria-hidden="true">◆</span><span class="vital-value" id="shield">0</span><div class="vital-bar shield-bar"><span id="shield-fill"></span></div></div><div class="vital-row health-row"><span class="vital-icon" aria-hidden="true">＋</span><span class="vital-value" id="health">100</span><div class="vital-bar health-bar"><span id="health-fill"></span></div></div><div class="ammo-extra" id="streak">Field ready</div></div><div class="quick-controls"><span><kbd>W A S D</kbd> Move</span><span><kbd>R</kbd> Reload</span><span><kbd>E</kbd> Popper</span><span><kbd>1 / 2</kbd> Swap</span><span><kbd>Esc</kbd> Menu</span></div><div class="ammo-card"><div class="eyebrow" id="gun-name"></div><div class="ammo-count"><b id="ammo">30</b> <span>/ <span id="reserve">150</span></span></div><div class="ammo-extra" id="ammo-extra"></div></div></div><div id="spectate-panel" hidden><div class="eyebrow">SPECTATING</div><p id="spectate-info"></p><div class="split-actions"><button data-action="spectate-prev">← Previous</button><button data-action="spectate-next">Next →</button><button data-action="rejoin">Join game</button></div></div><div class="scoreboard" id="scoreboard"></div><div class="mobile-controls"><div class="touch-stick" id="touch-stick" aria-label="Movement joystick"><span></span></div><div class="touch-look" id="touch-look" aria-label="Drag to look"></div><div class="touch-buttons"><button data-touch="crouch">CROUCH / SLIDE</button><button data-touch="jump">JUMP</button><button data-touch="fire">FIRE</button><button data-touch="reload">LOAD</button><button data-touch="aim">AIM</button><button data-touch="popper">POP</button></div></div></div><dialog id="dialog"></dialog><div class="toast" id="toast" role="status"></div>`;
const dialog = $("#dialog");
const ownerConsole=new OwnerConsole({wallet:eggWallet,onWalletChange:()=>{if(screen==='menu')renderMenu();},modal:(...args)=>modal(...args),screen:()=>screen,dialog});
startAnonymousVisits(()=>screen==='game'?(state?.royale?'royale':state?.options?.mode==='teams'?'teams':'ffa'):screen==='lobby'?'lobby':'menu');
eggWallet.subscribe(wallet=>{for(const node of document.querySelectorAll('[data-eggs-balance]'))node.textContent=formatEggs(wallet.balance);});
window.addEventListener('storage',e=>{if(e.key==='yolk-egg-shop-v1'){eggWallet.value=eggWallet.read();for(const node of document.querySelectorAll('[data-eggs-balance]'))node.textContent=formatEggs(eggWallet.value.balance);if(eggShop?.root?.isConnected)eggShop.render();if(screen==='menu'&&menuSection==='career')renderMenu(true);}});
const streakUI=new StreakUI(document.querySelector('#hud'));
const royaleUI = new RoyaleUI(item=>view.itemPreview(item));
const buildControls={buildMode:false,buildType:'wall',buildMaterial:'wood',buildRotation:0,editing:false};
document.addEventListener('build-edit-close',()=>{if(screen==='game'&&!paused&&!matchMedia('(pointer:coarse)').matches)view.renderer.domElement.requestPointerLock?.();});
const buildUI=new BuildingUI(royaleUI.root,buildControls,action=>{if(sim)sim.playerAction(localId,action);else net?.send({type:'player-action',action});});
let resultAt=0;const damageSources=[];
let matchRequest=0, autoQueue=false, swapSlot=-1;
const chat = new ChatPanel($("#app"), {
  context: () => ({state, localId, preference:settings.chatMode, connected:!!net?.ready && !net.closed && screen!=="menu", host:!!net?.isHost, enabled:net?.chatEnabled, roomMuted:net?.chatMuted||[]}),
  setPreference: value => {settings.chatMode=value;save("yolk-settings",settings);},
  send: payload => net?.chat(payload) || {ok:false,reason:"disconnected"},
  report: (id,reason) => net?.reportChat(id,reason),
  silence: (id,value) => net?.setChatMuted(id,value),
  enable: value => net?.setChatEnabled(value),
  remove: id => net?.kick(id),
  open: () => {
    keys.clear();queuedActions.clear();scoreHeld=false;
    input.fire=false;input.aim=false;
    Object.assign(touch,{x:0,y:0,jump:false,fire:false,aim:false,reload:false,popper:false,sprint:false,interact:false});
    if(document.pointerLockElement)document.exitPointerLock();
  },
  close: (controls) => {
    keys.clear();queuedActions.clear();
    if(controls&&screen==="game"){pauseMenu();return;}
    if(net?.ready && !net.closed && screen==="game" && state?.phase==="playing" && !dialog.open)void resume();
  },
});
function remember() {
  save("yolk-profile", profile);
  party?.updateProfile(profile);
  if (sim) {if(sim.setProfile(localId, profile)===false)renamePrompt();}
  else net?.profile(profile);
}
function titleBar() {
  return `<div class="topbar"><button class="brand" type="button" aria-label="Ravelfront">RAVEL<br><span>FRONT</span></button><div class="top-actions"><button class="pill" data-action="updates">QUALITY UPDATE · ${RELEASE}</button><button class="icon-btn" data-action="help">How to play</button><button class="icon-btn" data-action="settings" aria-label="Settings">Settings</button></div></div>`;
}
function menuModel(){return {profile,party:party?.party,id:party?.id,online:!!party?.ready,balance:eggWallet.value.balance,publicMatch:party?.publicMatch,publicMatchElapsed:party?.publicMatchAt?performance.now()-party.publicMatchAt:Infinity};}
function refreshPublicMatch(){
 if(screen!=='menu'||menuSection!=='play')return;
 const card=$('#menu .public-royale-card');if(!card)return;
 const focused=card.contains(document.activeElement)?document.activeElement.dataset.action:null;
 card.innerHTML=publicRoyaleMarkup(menuModel());if(focused)card.querySelector(`[data-action="${focused}"]`)?.focus({preventScroll:true});
}
function renderMenu(force=false) {
 const root=$('#menu'),model=menuModel();
 view?.setParty(party?.party?.members.filter(m=>m.id!==party.id).map(m=>m.profile)||[]);
 if(!force&&menuSection!=='play'&&root.dataset.section===menuSection&&root.querySelector('.hub-page')){
  const shell=document.createElement('template');shell.innerHTML=lobbyNavigation({...model,section:menuSection});root.querySelector('.yard-nav')?.replaceWith(shell.content.querySelector('.yard-nav'));return;
 }
 root.dataset.section=menuSection;
 if(menuSection==='play'){root.innerHTML=lobbyMarkup(model);return;}
 root.innerHTML=lobbyNavigation({...model,section:menuSection})+`<main class="hub-page hub-${menuSection}" aria-label="${menuSection==='shop'?'Item Shop':menuSection==='locker'?'Locker':'Career'}" tabindex="-1">${menuSection==='career'?careerMarkup({stats,wallet:eggWallet.value,profile,selected:careerMode,portrait:view.shopPortrait({id:'career-operator',slot:'outfit',characterInspection:true,starter:true,profile,previewKey:'career:'+JSON.stringify(profile)})}):'<div id="egg-shop"></div>'}</main>`;
 if(menuSection==='career')$('#career-mode').onchange=e=>{careerMode=e.target.value;renderMenu(true);$('#career-mode').focus();};
 else {
  eggShop??=new EggShop({wallet:eggWallet,view,getProfile:()=>profile,setProfile:next=>{profile=next;remember();view.preview(profile);}});
  eggShop.embedded=true;eggShop.onTab=tab=>selectMenuSection(tab==='locker'?'locker':'shop');eggShop.tab=menuSection==='locker'?'locker':'shop';
  Object.assign(eggShop,{category:'all',search:'',sort:'featured',page:0},menuShopStates[menuSection]||{});
  if(menuSection==='locker'&&!eggWallet.value.owned.includes(eggShop.selected))eggShop.selected=eggWallet.value.owned[0]||null;
  eggShop.open($('#egg-shop'));
 }
}
function selectMenuSection(section,push=true){
 if(screen!=='menu')return;
 if(eggShop?.pending){toast('Your purchase is saving. Please wait.');return;}
 if(['shop','locker'].includes(menuSection)&&eggShop)menuShopStates[menuSection]=Object.fromEntries(['category','search','sort','page','selected'].map(k=>[k,eggShop[k]]));
 if(dialog.open)closeDialog();menuSection=['play','locker','shop','career'].includes(section)?section:'play';
 if(push&&location.hash!=='#'+menuSection)history.pushState({menuSection},'',location.pathname+location.search+'#'+menuSection);
 renderMenu(true);$('#menu .hub-page')?.focus({preventScroll:true});
}
window.addEventListener('popstate',()=>{if(screen==='menu')selectMenuSection(location.hash.slice(1)||'play',false);});

function profileMenu(){
  modal('Player details',`<label for="player-name">YOUR NAME</label><input class="field" id="player-name" maxlength="18" value="${esc(profile.name)}" autocomplete="off"><p id="name-safety" role="status"></p><button class="primary" data-action="close">DONE</button>`,'profile');
  $('#player-name').onchange=e=>{const checked=moderateText(e.target.value,{kind:'name'});profile.name=safeName(e.target.value);e.target.value=profile.name;$('#name-safety').textContent=checked.ok?'':'That name was filtered. Choose a friendly nickname.';remember();renderMenu();};
}
function modal(title, body, type = "generic") {
  if(type==="error")sound.cue("ui-error");
  bindingEditor = null;
  dialogType = type;
  dialog.dataset.kind=type;
  keys.clear();
  scoreHeld = false;
  queuedActions.clear();
  input.fire = false;
  input.aim = false;
  paused = true;
  if (document.pointerLockElement) document.exitPointerLock();
  if(type==='error')hideLoading(true);
  const connectingArt=type==='connecting'?showLoading('ESTABLISHING MATCH UPLINK','Connecting to the room service.',{kind:'connect'}):null;
  dialog.innerHTML = type==='connecting'?loadingMarkup('ESTABLISHING MATCH UPLINK','Connecting to the room service. You can cancel at any time.',true,{kind:'connect',art:connectingArt}):`<div class="dialog-head"><h2>${title}</h2><button class="close-btn" data-action="close" aria-label="Close dialog">×</button></div><div class="dialog-body">${body}</div>`;
  if (!dialog.open) dialog.showModal();
}
function closeDialog() {
  if(dialogType==='egg-shop'&&screen==='menu')renderMenu();
  if(dialogType==='settings'&&bindingEditor?.dirty){bindingEditor.message='Apply or Discard your keybind changes before closing.';bindingEditor.render();dialog.querySelector('.dialog-body').dispatchEvent(new Event('settings-show-bindings'));dialog.querySelector('.binding-footer')?.scrollIntoView({block:'nearest'});return;}
  if(dialogType==='rename'){toast('Choose an available name to continue, or leave the match.');return;}
  if(['royale-inventory','royale-map'].includes(dialogType)){void resume();return;}
  sound.cue('ui-back');
  bindingEditor = null;
  dialog.close();
  dialogType = "";
  if (screen === "game") {
    if (state?.phase === "playing") pauseMenu();
    else if (state?.phase === "results") resultsMenu();
  }
}
function toast(text) {
  $("#toast").textContent = text;
  toastUntil = performance.now() + 4500;
}
function notice(text) {
  $("#notice").textContent = text;
  noticeUntil = performance.now() + 2600;
}
function settingsMenu() {
  modal(
    "Settings",
    `<p>Settings are saved on this browser.</p><button class="slider-reset-all" data-reset-slider="all">Reset all sliders</button>${SLIDERS
      .map(
        ([id, label, min, max, step]) =>
          `<div class="setting-row"><label class="setting-label" for="${id}">${label} <output id="out-${id}">${settings[id]}</output></label><div class="slider-controls"><input type="range" id="${id}" data-setting="${id}" min="${min}" max="${max}" step="${step}" value="${settings[id]}"><button class="slider-reset" data-reset-slider="${id}" aria-label="Reset ${label}">Reset</button></div></div>`,
      )
      .join(
        "",
      )}<div class="setting-row"><label for="quality" class="setting-label">Graphics</label><select id="quality" data-setting="quality"><option value="high" ${settings.quality === "high" ? "selected" : ""}>High · shadows</option><option value="low" ${settings.quality === "low" ? "selected" : ""}>School laptop · faster</option></select></div><div class="setting-row"><label for="invert" class="setting-label">Invert vertical look</label><input id="invert" data-setting="invert" type="checkbox" ${settings.invert ? "checked" : ""}></div><h3 style="margin-top:22px">Crosshair</h3>${[["visualSoundEffects", "Visualize Sound Effects"], ["centerDot", "Center Dot"], ["hitMarkers", "Hit Markers"], ["showFps", "Show FPS"], ["netDebugStats", "Net Debug Stats"], ["connectionWarnings", "Connection Warnings"]].map(([id, label]) => `<div class="setting-row"><label for="${id}" class="setting-label">${label}</label><input id="${id}" data-setting="${id}" type="checkbox" ${settings[id] ? "checked" : ""}></div>`).join("")}<h3>Chat & privacy</h3><div class="setting-row"><label for="chatMode" class="setting-label">Chat messages</label><select id="chatMode" data-setting="chatMode"><option value="all" ${settings.chatMode === "all" ? "selected" : ""}>Filtered messages</option><option value="quick" ${settings.chatMode === "quick" ? "selected" : ""}>Quick messages only</option><option value="off" ${settings.chatMode === "off" ? "selected" : ""}>Off</option></select></div><p class="small">The safety filter stays on in every room. Use Pause → Player controls to mute or report a player.</p><h3>Building & editing</h3><div class="setting-row"><label for="confirmEditOnRelease" class="setting-label">Confirm edit on selection release</label><input id="confirmEditOnRelease" data-setting="confirmEditOnRelease" type="checkbox" ${settings.confirmEditOnRelease ? "checked" : ""}></div><p class="small">Manual editing: aim at tiles and hold your Fire binding to select. Your Reset edit binding resets. Edit confirms; Esc cancels. Assign the same scroll direction to Edit and Reset edit for a single-scroll reset.</p><h3>Keybinds</h3><div class="keybind-list"></div><button class="primary" data-action="close" style="margin-top:22px">Done</button>`,
    "settings",
  );
  bindingEditor=new KeybindEditor(dialog.querySelector(".keybind-list"),settings.keybinds,bindings=>{settings.keybinds=bindings;keys.clear();queuedActions.clear();input.fire=input.aim=false;save("yolk-settings",settings);});
  arrangeSettings(dialog);
}
function loadoutMenu() {
  modal(
    "Choose your weapon",
    `<p>${screen === "game" ? "Your selection takes effect on your next respawn." : "Every primary includes a P-9 Sidearm and two frag grenades."}</p><div class="selection-grid">${WEAPONS.filter(
      (w) => !w.secondary,
    )
      .map(
        (w) =>
          `<button class="weapon-card ${profile.weapon === w.id ? "selected" : ""}" data-weapon="${w.id}" aria-pressed="${profile.weapon === w.id}"><img class="weapon-portrait" src="${view.weaponPreview(w.id)}" alt="${w.name} weapon model"><span class="eyebrow">${w.role}</span><strong>${w.name}</strong><small>${w.desc}</small><small style="margin-top:8px">${w.magazine} shots · ${w.automatic ? "Automatic" : w.burst ? "3-shot burst" : "Semi-auto"} · ${w.reload.toFixed(2)}s reload · ${w.optic === "scope" ? "Precision scope" : w.optic === "prism" ? "Prism optic" : w.optic === "reflex" ? "Reflex sight" : "Open sights"}</small></button>`,
      )
      .join(
        "",
      )}</div><button class="primary" data-action="close">Done</button>`,
    "loadout",
  );
}
let customTab = "shell";
function customizeMenu(tab='shop') {
  if(screen==='menu'){selectMenuSection(tab==='locker'?'locker':'shop');return;}
  modal('Outfitter','<div id="egg-shop"></div>','egg-shop');
  eggShop??=new EggShop({wallet:eggWallet,view,getProfile:()=>profile,setProfile:next=>{profile=next;remember();view.preview(profile);}});
  eggShop.embedded=false;eggShop.tab=tab;eggShop.category='all';eggShop.page=0;eggShop.open($('#egg-shop'));
}
function helpMenu() {
  modal(
    "How to play",
    `<p>Move, aim, and tag the other operators. Arena modes allow respawns. Frontier Royale gives each contestant one life: in Duos or Squads, revive and watch your teammates after elimination and share your team’s final placement.</p><p>Head hits receive a critical bonus on most weapons. The reticle shows your current spread; a mint reticle marks a settled first shot. ADS improves accuracy, while each weapon has its own recoil, range and recovery. Scopes keep grounded aiming stable; sliding and airborne shots widen the scope accuracy ring. Explosive weapons have no critical bonus.</p><table class="controls-table">${[
      ...CONTROLS.map(([id, label]) => [controlLabel(id), label]),
      ["Mouse", "Look"],
      ["Escape", "Menu"],
    ]
      .map(([a, b]) => `<tr><td><kbd>${a}</kbd></td><td>${b}</td></tr>`)
      .join(
        "",
      )}</table><p>Tactical sprint uses stamina and lowers your weapon; release sprint to raise it. Use doors to open or close them, or sprint through. At Aster Command, defeat Voss and equip his keycard to follow the route to the underground vault. Hold Use at its reader. Use marked zip lines and ascenders, and jump to release.</p><p>Collect white crosses for health, gold boxes for ammo, and grenade canisters. Blue and coral are teammates in team modes; friendly fire is off.</p><p class="hint">Mac: click inside the arena to capture your mouse. Escape releases it. Touch devices use a left joystick, drag-to-look area, and action buttons.</p>`,
    "help",
  );
}
function ruleSummary(o) {
  if(o.mode==='royale')return `${o.teamSize===4?'Squads':o.teamSize===2?'Duos':'Solo'} · ${o.capacity} contestants · ${o.fill?"Fill with bots":o.bots+" bots"} · ${o.storm==='quick'?'Quick':'Normal'} storm · One life`;
  return `${o.minutes} min · ${o.scoreLimit} eliminations to win · ${o.bots} bots · ${BOT_DIFFICULTIES[o.difficulty-1]}`;
}
function setupMenu(editing = false, draft = null) {
  if (editing && (!sim || state?.phase === "playing")) return;
  const o = draft || (editing ? state.options : options);
  const nextRound = editing && state.phase === "results";
  const select = (id,label,items,value) => `<label>${label}<select class="field" id="setup-${id}">${items.map(([key,text])=>`<option value="${key}" ${key === value ? "selected" : ""}>${text}</option>`).join("")}</select></label>`;
  modal(nextRound ? "Set up the next round" : editing ? "Match settings" : "Custom Private Match",
    `<p>${editing ? "The host sets the rules for everyone. Changes apply before the next round starts." : "Choose your rules and invite friends. This private match runs on your computer; keep this tab open."}</p><div class="split-actions"><button data-match-preset="quick">QUICK ROYALE</button><button data-match-preset="zero">ZERO BUILD</button><button data-match-preset="precision">PRECISION ARENA</button></div><div class="form-grid match-rules">${select("visibility","VISIBILITY",net?.serverAuthority?[["public","Public matchmaking"]]:[["private","Private · invite code only"]],net?.serverAuthority?"public":"private")}${select("map","ARENA",(o.mode==='royale'?[getMap('sunnybreak')]:MAPS).map(m=>[m.id,m.name]),o.map)}${select("mode","GAME MODE",MODES.map(m=>[m.id,m.name]),o.mode)}${select("teamSize","ROYALE TEAM MODE",[[1,"Solo"],[2,"Duos"],[4,"Squads"]],o.teamSize||1)}${select("teamFill","TEAMMATES",[["on","Fill"],["off","No Fill"]],o.teamFill===false?"off":"on")}${select("bots","BOTS",Array.from({length:o.mode==='royale'?MAX_CONTESTANTS:8},(_,n)=>[n,String(n)]),o.bots)}${select("difficulty","BOT DIFFICULTY",BOT_DIFFICULTIES.map((name,i)=>[i+1,name]),o.difficulty)}<label>TIME LIMIT (MINUTES)<input class="field" id="setup-minutes" type="number" min="1" max="60" step="1" required value="${o.minutes}"></label><label><span id="target-label">${targetLabel(o.mode)}</span><input class="field" id="setup-scoreLimit" type="number" min="1" max="1000" step="1" required value="${o.scoreLimit}"></label>${select("capacity","ROYALE CONTESTANTS",[[48,"48 · empty seats filled by bots"]],o.capacity||MAX_CONTESTANTS)}${select("building","BUILDING",[["on","Building enabled"],["off","Zero Build"]],o.building===false?"off":"on")}${select("weaponPool","ARENA WEAPONS",[["all","All weapons"],["precision","Precision practice"],["close","Close quarters"]],o.weaponPool||"all")}${select("storm","STORM PACE",[["normal","Normal"],["quick","Quick"]],o.storm||"normal")}${select("fill","FILL EMPTY SEATS",[["off","Use chosen bot count"],["on","Fill to contestant limit"]],o.fill?"on":"off")}</div><p class="hint">${o.mode==='royale'?`${o.teamSize===4?'Last squad standing wins. Eight contestant positions minimum.':o.teamSize===2?'Last Duo standing wins. Four contestant positions minimum.':'Last operator standing wins. Two contestants minimum.'} All loot is found on Ravel Coast.`:'The round ends at the time limit or score target.'} ${o.mode==='royale'?'48 contestants in every private Royale; friends replace bots. Fill teams get bot teammates in any remaining positions at departure. Spawn Island waits up to 30 seconds, departing early when humans fill every contestant seat. Arrivals after departure spectate.':'Up to 8 players including bots; friends replace bots when full.'}</p><button class="primary" style="margin-top:22px" data-action="${nextRound ? "apply-rematch" : editing ? "save-match-settings" : "create-room"}">${nextRound ? "START NEXT ROUND" : editing ? "SAVE SETTINGS" : "CREATE MATCH"}</button>${!editing?'<button class="plain" data-action="join" style="margin-top:10px">JOIN AN EXISTING CUSTOM MATCH</button>':""}`, "setup");
  $('#setup-visibility').disabled=true;
  const royale=o.mode==='royale';
  if(!editing)$('#setup-mode').disabled=false;
  if(royale){for(const option of $('#setup-capacity').options)option.disabled=Number(option.value)<(o.teamSize||1)*2;if(o.capacity<(o.teamSize||1)*2)$('#setup-capacity').value=String((o.teamSize||1)*2);for(const option of $('#setup-teamSize').options)option.disabled=Number(option.value)<(party?.party?.members.length||1);$('#setup-teamSize').onchange=()=>{const next={...getOptions(),visibility:$('#setup-visibility').value};setupMenu(editing,next);};}
  for(const key of ['minutes','scoreLimit']){$(`#setup-${key}`).closest('label').hidden=royale;$(`#setup-${key}`).disabled=royale;}
  if(royale){$('#setup-capacity').value='48';$('#setup-fill').value='on';$('#setup-bots').value='47';$('#setup-fill').disabled=true;$('#setup-bots').disabled=true;}
  for(const key of ['capacity','storm','teamSize','teamFill','building'])$(`#setup-${key}`).closest('label').hidden=!royale;
  $('#setup-map').disabled=royale;$('#setup-weaponPool').closest('label').hidden=royale;
  for(const b of dialog.querySelectorAll('[data-match-preset]'))b.onclick=()=>{const presets={quick:{mode:'royale',teamSize:1,capacity:48,bots:47,fill:true,storm:'quick',building:true},zero:{mode:'royale',teamSize:1,capacity:48,bots:47,fill:true,storm:'normal',building:false},precision:{mode:'ffa',map:'yard',bots:3,fill:false,minutes:5,scoreLimit:25,weaponPool:'precision'}};setupMenu(editing,matchOptions({...o,...presets[b.dataset.matchPreset]}));};
  $('#setup-mode').onchange=e=>{
    const visibility=$('#setup-visibility').value;
    const next={...matchOptions({...o,...getOptions(),mode:e.target.value,map:e.target.value==='royale'?'sunnybreak':'yard',bots:e.target.value==='royale'?MAX_CONTESTANTS-1:0,scoreLimit:mode(e.target.value).limit}),visibility};
    if(editing){options=next;setupMenu(editing,next);}else{options=next;setupMenu(false);}
  };

}
function getOptions() {
  if (![...document.querySelectorAll('#dialog input[type="number"]')].every(input=>input.disabled||input.reportValidity())) return null;
  return matchOptions({...options,...party?.party?.selection,building:$('#setup-building')?.value!=='off',weaponPool:$('#setup-weaponPool')?.value||'all',...Object.fromEntries(["map","mode","bots","difficulty","minutes","scoreLimit","capacity","storm","fill"].map(key=>[key,$(`#setup-${key}`).value])),teamSize:Number($("#setup-teamSize").value),teamFill:$("#setup-teamFill").value==='on',fill:$("#setup-fill").value==='on',session:net?'online':sim?.options.session});
}
function saveMatchSettings(start = false) {
  if (!sim || state?.phase === "playing") return;
  const next=getOptions();
  if(!next)return;
  const humans=[...sim.players.values()].filter(p=>!p.bot&&(next.mode!=='royale'||!p.lateSpectator)).length;
  if(humans>(next.mode==='royale'?next.capacity:8)){toast('Choose enough contestant seats for everyone in this room.');return;}
  if(sim.remote){sim.configure(next);if(start)sim.startRound();closeDialog();return;}
  if((sim.options.mode==='royale')!==(next.mode==='royale')){
    const old=sim;sim=next.mode==='royale'?new RoyaleSimulation(next):new Simulation(next);
    for(const p of old.players.values())if(!p.bot)sim.admitPlayer(p.id,p,p.friendSpectator?{...p,spectator:true}:null);sim.round=old.round;sim.phase=old.phase;
  }else if(!sim.configure(next))return;
  if(net)net.maxConnections=(next.mode==='royale'?Math.min(next.capacity,MAX_HUMANS):8)-1+MAX_SPECTATORS;
  if(autoQueue&&next.mode==='royale'&&!start)sim.queueEnds=sim.time+WARMUP_SECONDS;
  options=sim.options;
  net?.setVisibility($("#setup-visibility").value);
  state=sim.snapshot();
  net?.broadcast(state);
  if(start) {launchRound();}
  else {closeDialog();renderLobby();}
}
function visibilityLabel() {
  return `Room: ${net?.visibility === "public" ? "public" : "private"} · Make ${net?.visibility === "public" ? "private" : "public"}`;
}
function visibilityButton() {
  return ''; // Custom rooms stay private; public rooms belong to matchmaking.
}

let checkingConnection = false;
const connectionButton = '<button class="plain" data-action="connection-report" style="margin-top:12px">Check connection</button>';
function showConnectionReport() {
  modal('Connection report', `<p>Check matchmaking and public discovery here. To test another computer, join its room normally, then return here. Keep the host’s tab open.</p>
    <div role="status" aria-live="polite">${checkingConnection ? '<p>Checking… This can take about 35 seconds.</p>' : ''}</div>
    <p><a href="./server-check.html">Test the new server connection</a></p>
    <label for="connection-report-text">Latest results</label>
    <textarea id="connection-report-text" class="field" readonly rows="12" style="width:100%;font-size:.85rem;white-space:pre-wrap">${esc(connectionReport.text(__BUILD_ID__))}</textarea>
    <button class="primary" data-action="run-connection-check" ${checkingConnection ? 'disabled' : ''}>RUN SERVICE & DIRECTORY CHECK</button>
    <button class="secondary" data-action="copy-connection-report">COPY REPORT</button>
    <button class="plain" data-action="join">Test a host: join by code</button>
    <p class="hint">Results stay in this tab. Copy the report or take a screenshot. A timeout alone does not prove a firewall block.</p>`, 'connection-report');
}
async function runConnectionCheck() {
  if(checkingConnection || busy)return;
  checkingConnection=true;
  showConnectionReport();
  const probe=new Network();
  try { await probe.makePeer(undefined); } catch { /* Network records the stage. */ }
  finally { probe.destroy(); }
  if(dialogType==='connection-report')showConnectionReport();
  try { await directory.list(); } catch { /* Directory records the stage. */ }
  finally {
    checkingConnection=false;
    if(dialogType==='connection-report')showConnectionReport();
  }
}
async function copyConnectionReport() {
  const field=$('#connection-report-text');
  try { await navigator.clipboard.writeText(field.value); toast('Connection report copied.'); }
  catch { field.focus();field.select();toast('Select and copy the report, or take a screenshot.'); }
}

let roomListRequest = 0;
async function publicRooms() {
  const request = ++roomListRequest;
  modal("Public matches", '<p>Finding arenas…</p>', "public-rooms");
  try {
    const result = await directory.list();
    if (dialogType !== "public-rooms" || request !== roomListRequest) return;
    modal("Public matches", `<p>Open to everyone. Private rooms are only reachable by invite code.</p>${connectionButton}<button class="icon-btn" data-action="refresh-rooms" aria-label="Refresh public matches">↻</button><div class="public-room-list">${result.rooms.map(r => `<article class="public-room"><div><strong>${esc(r.host)}’s room</strong><p>${esc(getMap(r.map).name)} · ${esc(mode(r.mode).name)}</p><span class="hint">${r.players}/${r.capacity} players · ${r.phase === "playing" ? "In progress" : r.phase === "results" ? "Between rounds" : "In lobby"}</span></div><button class="secondary" data-join-room="${esc(r.code)}" ${r.players >= r.capacity && !(r.mode==='royale'&&r.phase!=='lobby') ? "disabled" : ""}>${r.mode==='royale'&&r.phase!=='lobby'?"Spectate":r.players >= r.capacity ? "Full" : "Join"}</button></article>`).join('') || '<p class="empty-rooms">No public matches yet. Create a room and set it to public.</p>'}</div><button class="primary" data-action="setup">CREATE A ROOM</button>`, "public-rooms");
  } catch(e) {
    if (dialogType === "public-rooms" && request === roomListRequest) modal("Public matches", `<p class="error-box">${esc(e.message)}</p>${connectionButton}<button class="primary" data-action="refresh-rooms">Try again</button>`, "public-rooms");
  }
}
function joinMenu(code = "") {
  modal(
    "Join your friends",
    `<p>Ask the host for the 8-character room code.</p><label class="setting-label" for="join-code" style="margin:22px 0 8px">ROOM CODE</label><input class="field" id="join-code" placeholder="ABCD-EFGH" value="${esc(code)}" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" style="font-size:1.6rem;letter-spacing:.16em;text-align:center;text-transform:uppercase"><button class="primary" style="margin-top:20px" data-action="join-room">JOIN ROOM</button><p class="hint">Private rooms require an invite code. No account is needed.</p>`,
    "join",
  );
  $("#join-code").onkeydown = (e) => {
    if (e.key === "Enter") joinRoom();
  };
}
function renamePrompt(){
  if(dialogType==='rename'&&dialog.open){
    const button=dialog.querySelector('[data-action="save-room-name"]');button.disabled=false;button.textContent='USE THIS NAME';
    toast('That name is still taken. Choose another one.');return;
  }
  modal('That name is already in this match',`<p>Choose an unused player name to continue.</p><label for="room-name">Player name</label><input id="room-name" class="field" maxlength="18" value="${esc(profile.name)}" autocomplete="off"><button class="primary" data-action="save-room-name">USE THIS NAME</button><button class="plain" data-action="leave">Leave match</button>`,'rename');
  $('#room-name').focus();$('#room-name').select();$('#room-name').onkeydown=e=>{if(e.key==='Enter')actions['save-room-name']();};
}
function roundIntro(){
  if(!state)return;
  dialog.close();dialogType='';paused=true;keys.clear();queuedActions.clear();input.fire=input.aim=false;
  const p=state.players.find(p=>p.id===localId),ranked=state.players.filter(p=>!p.spectating||p.place).sort((a,b)=>b.kills-a.kills||a.deaths-b.deaths||b.points-a.points);
  const place=state.royale?p?.place:p?1+ranked.filter(other=>other.kills>p.kills||other.kills===p.kills&&other.deaths<p.deaths).length:0;
  const win=state.royale?wonRoyale(state,localId):mode(state.options.mode).teams?state.scores[p?.team]>state.scores[1-p?.team]:place===1;
  const title=state.royale?(win?'FRONTIER SECURED':place?'YOU PLACED #'+place:'ROUND COMPLETE'):mode(state.options.mode).teams?(state.scores[0]===state.scores[1]?'TEAM DRAW':win?'TEAM VICTORY':'ROUND COMPLETE'):'YOU PLACED #'+place;
  const banner=$('#round-banner');banner.className=win?'victory':'placement';banner.innerHTML=`<span>${state.royale?(state.options.teamSize===4?'LAST SQUAD STANDING':isTeamRoyale(state.options)?'LAST DUO STANDING':'LAST OPERATOR STANDING'):mode(state.options.mode).name.toUpperCase()}</span><strong>${esc(title)}</strong><p>${!state.royale&&place?'YOUR PLACE #'+place+' · ':''}${p?.kills||0} ELIMINATIONS</p>`;banner.hidden=false;
  if(!state.royale)sound.cue(win?'victory':'round-start');
  resultAt=performance.now()+4200;
}
function callbacks() {
  return {
    onProgress:(type,event)=>{
      if(type==='reward'){
        const r=event.receipt;if(!r||eggWallet.value.receipts.includes(r.id))return;
        void eggWallet.awardVerified(r).then(({applied})=>{
          if(!applied)return;
          matchEarnings.total=r.amount;matchEarnings.status=r.reason;
          stats=recordCareerReceipt(stats,r);
          stats.eggs=eggWallet.value.earned;save('yolk-stats',stats);if(r.amount)toast('+'+r.amount+' Marks · '+r.label);if(dialogType==='results')resultsMenu();if(screen==='menu'&&menuSection==='career')renderMenu(true);
        }).catch(e=>toast(e.message));
      }else if(type==='afk'&&event.remaining<=0){leave(false,false);modal('Removed for inactivity','<p>No meaningful input was detected for 59 seconds. This match awards no Marks.</p><button class="primary" data-action="close">BACK TO LOBBY</button>','afk');}
      else if(type==='afk-enforce'&&sim&&!sim.remote){const p=sim.players.get(event.player);if(p){p.afkRemoved=true;p.health=0;p.spectating=true;p.contestant=false;sim.emit('afk-removed',{player:p.id});}}
      else if(type==='afk'&&state){const p=state.players.find(p=>p.id===localId);if(p)p.afkRemaining=event.remaining;}
    },
    getChatState: () => sim ? sim.snapshot() : state,
    onChat: message => chat.receive(message),
    onChatStatus: result => chat.feedback(result),
    onChatReport: report => {
      const text=`${report.reporter} reported ${report.target}: ${report.reason}. Open Pause → Player controls to review.`;
      chat.status.textContent=text;toast(text);
    },
    getCheckpoint:()=>sim?.checkpoint(),
    onHost:(checkpoint,departed)=>{
      sim=(checkpoint.options.mode==='royale'?new RoyaleSimulation(checkpoint.options):new Simulation(checkpoint.options)).restore(checkpoint);
      if(sim instanceof RoyaleSimulation)for(const p of sim.players.values())if(!p.bot)p.connected=p.id===net.id;
      for(const id of departed)sim.leavePlayer(id);
      state=sim.snapshot();localId=net.id;pendingInputs=[];predicted=null;
      const me=sim.players.get(localId);if(me){input.slot=me.slot;input.yaw=me.yaw;input.pitch=me.pitch;}
      autoQueue=!!sim.queueEnds;lobbyRenderKey='';handleState();
    },
    onNameRequired:()=>renamePrompt(),
    onNameAccepted:()=>{if(dialogType==='rename'){dialog.close();dialogType='';if(screen==='game')void resume();}},
    onJoin: (id, p, admission) => !!sim?.admitPlayer(id,p,admission),
    onLeave: (id) => sim?.leavePlayer(id),
    onRoster: ids => sim?.setConnectedHumans?.(ids),
    onPlayerAction: (id, action) => sim?.playerAction(id, action),
    onInput: (id, i) => sim?.setInput(id, i, true),
    onProfile: (id, p) => sim?.setProfile(id, p),
    onAuthorityOwner:()=>{sim=net.isHost?new RemoteSimulation(net,()=>state):null;toast(net.isHost?'You now lead this room. The match continues on the server.':'Room leadership updated.');},
    onState: (s) => {
      const updateStarted=performance.now(),previousPrediction=predicted,previousState=state;
      if(s.royale&&!s.royale.builds&&state?.royale)s.royale={...s.royale,builds:state.royale.builds,worldDamage:state.royale.worldDamage};
      if(s.royale)applyBuildState(getMap(s.options.map),s.royale);
      if(s.royale&&!s.royale.loot&&state?.royale)s.royale={...s.royale,loot:state.royale.loot,chests:state.royale.chests};
      state = s;
      const me = s.players.find((p) => p.id === localId);
      if (!me) return;
      pendingInputs = pendingInputs.filter((i) => i.seq > me.ack);
      predicted = { ...me, ammo: [...me.ammo], reserve: [...me.reserve], traversal:me.traversal?{...me.traversal}:null,fall:me.fall?{...me.fall}:null, launchVelocity:me.launchVelocity?{...me.launchVelocity}:null };
      for (const i of pendingInputs)
        predictMovement(predicted, i, getMap(s.options.map), 1 / 60, s.royale);
      if (me.health > 0 && lastHealth <= 0) {
        input.yaw = me.yaw;
        input.pitch = me.pitch;
        input.slot = s.royale?me.slot:0;
        pendingInputs = [];
      }
      guestPresentation.receive(s,previousPrediction,predicted,performance.now());
      connectionReport.network.update({now:performance.now(),time:s.time,ack:me.ack,rtt:net?.latency||null,relayRtt:net?.peer?.relayLatency,received:net?.peer?.receivedBytes||0,sent:net?.peer?.sentBytes||0,queued:net?.peer?.bufferedAmount||0,batches:net?.peer?.unacked?.size||0,hostQueue:me.inputQueue,serverTiming:s.network?.timing,correction:predictionCorrection(previousPrediction,predicted,previousState,s)});
      lastHealth = me.health;
      handleState();
      processEvents();
      connectionReport.performance.update(performance.now()-updateStarted,pendingInputs.length);
    },
    onError: async (message) => {
      leave(false);
      modal(
        "Connection ended",
        `<div class="error-box">${esc(message)}</div><button class="primary" data-action="close">Back to arena</button>`,
        "error",
      );
    },
    onStatus: (message) => toast(message),
  };
}
function beginSim() {
  chat.reset();
  sim = options.mode==='royale'?new RoyaleSimulation(options):new Simulation(options);
  sim.addPlayer("host", profile);
  localId = "host";
  lastEvent = 0;
  roundSaved = -1;
  lastPhase = "";
  state = sim.snapshot();
  pendingInputs = [];
  seq = 0;
  predicted = null;
}
async function createRoom(preset = null, visibilityOverride = null, automatic = false, launch = null) {
  if (busy) return;
  const next = preset?.mode ? matchOptions(preset) : getOptions();
  if (!next) return;
  options=matchOptions({...next,session:'online',recurring:false});autoQueue=false;
  if(launch?.hostRun||!launch){matchEarnings.total=0;matchEarnings.status='Player-hosted match · No verified Marks';progressMatch='';}
  const visibility=launch?.hostRun||!launch?'private':visibilityOverride||'public';
  beginSim();
  if(launch?.admission)sim.assignTeam?.(sim.players.get("host"),launch.admission);
  busy = true;
  modal(
    "Opening your room",
    `<div class="spinner"></div><p>Connecting to the room service…</p><button class="plain" data-action="cancel-connect" style="margin-top:18px">Cancel</button>`,
    "connecting",
  );
  const attempt = new Network(callbacks());
  attempt.maxConnections=(options.mode==='royale'?Math.min(options.capacity,MAX_HUMANS):8)-1+MAX_SPECTATORS;
  net = attempt;
  try {
    await attempt.host(launch?.code);
    if (attempt !== net) return;
    attempt.setVisibility(visibility);
    state=sim.snapshot();attempt.broadcast(state);attempt.publishRoom();
    localId = attempt.id;
    await waitForLoading();
    if(attempt!==net)return;
    screen = "lobby";
    paused = true;
    dialog.close();
    dialogType = "";
    $("#menu").hidden = true;
    $("#lobby").hidden = false;
    if(state?.phase==='playing')enterGame(true);else renderLobby();
    if(launch?.capacityNotice)toast(launch.capacityNotice);
    return true;
  } catch (e) {
    if (attempt !== net) return;
    attempt.destroy();
    net = null;
    sim = null;
    state = null;
    modal(
      "Room could not open",
      `<div class="error-box">${esc(e.message)}</div>${connectionButton}<button class="primary" data-action="find-public">CUSTOM PRIVATE MATCH</button><button class="plain" data-action="setup" style="margin-top:12px">Try creating a room again</button>`,
      "error",
    );
  } finally {
    busy = false;
  }
}
async function joinRoom(publicCode, quiet=false, ticket=null) {
  if(!ticket&&party?.ready){await queueParty(false,cleanCode(publicCode||$("#join-code")?.value));return;}
  if (checkingConnection) { toast('Wait for the connection check to finish.'); return; }
  if (busy) return;
  const code = cleanCode(typeof publicCode === "string" ? publicCode : $("#join-code")?.value);
  if (code.length !== 8) {
    toast("Enter all 8 characters of the room code.");
    return;
  }
  busy = true;
  modal(
    "Joining the room",
    `<div class="spinner"></div><p>Looking for ${formatCode(code)}…</p><button class="plain" data-action="cancel-connect" style="margin-top:18px">Cancel</button>`,
    "connecting",
  );
  chat.reset();
  const attempt = new Network(callbacks());
  net = attempt;
  sim = null;
  state = null;
  lastEvent = 0;
  lastPhase = "";
  roundSaved = -1;
  seq = 0;
  pendingInputs = [];
  try {
    localId = await attempt.join(code, profile, ticket);
    await waitForLoading();
    if (attempt !== net) return;
    screen = "lobby";
    paused = true;
    dialog.close();
    dialogType = "";
    $("#menu").hidden = true;
    $("#lobby").hidden = false;
    if(state?.phase==='playing')enterGame(true);else renderLobby();
    return true;
  } catch (e) {
    if (attempt !== net) return;
    attempt.destroy();
    net = null;
    if(quiet)return false;
    modal(
      "Could not join",
      `<div class="error-box">${esc(e.message)}</div>${connectionButton}<button class="primary" data-action="join">Check the code & retry</button><button class="plain" data-action="setup" style="margin-top:12px">Create a match</button>`,
      "error",
    );
  } finally {
    busy = false;
  }
}
let lobbyRenderKey = "";
function renderLobby() {
  if (screen !== "lobby") return;
  const roster = state?.players || [],
    o = state?.options || options;
  const queueEnds = state?.royale?.queueEnds || 0;
  const queueText = queueEnds
    ? `KESTREL DEPARTS IN ${Math.max(0, Math.ceil(queueEnds - state.time))}s`
    : "Drop in together. Last operator standing wins.";
  const key = JSON.stringify([net?.code, net?.visibility, net?.isHost, localId, o, !!queueEnds, roster.map(p => [p.id,p.name,p.team,p.weapon,p.bot])]);
  const queue = $("#royale-queue");
  if (queue) queue.textContent = queueText;
  if (key === lobbyRenderKey) return;
  const scrollTop = $("#lobby .lobby-panel")?.scrollTop || 0;
  lobbyRenderKey = key;
  $("#lobby").innerHTML =
    `${titleBar()}<section class="panel lobby-panel"><div class="eyebrow">${net?.visibility === "public" ? "PUBLIC" : "PRIVATE"} ROOM</div><h2 style="margin-top:8px">${o.mode==='royale'?'Next stop: Ravel Coast.':'SQUAD ASSEMBLED.'}</h2>${o.mode==='royale'?`<p class="royale-queue" id="royale-queue">${queueText}</p>`:''}<div class="room-code">${formatCode(net?.code || "--------")}</div><div class="split-actions"><button class="plain" data-action="copy-code">Copy code</button><button class="plain" data-action="copy-link">Copy invite link</button></div><div class="lobby-meta"><strong>${getMap(o.map).name}</strong><span>·</span><span>${mode(o.mode).name}</span></div><div class="roster">${roster.map((p) => `<div class="roster-row"><b><span class="team-dot ${p.team === 1 ? "coral" : ""}"></span>${esc(p.name)}${p.id === localId ? " (you)" : ""}</b><span>${p.bot ? "BOT" : weapon(p.weapon).name}</span>${net?.isHost && p.id !== localId && !p.bot ? `<button data-kick="${esc(p.id)}">Remove</button>` : ""}</div>`).join("")}</div><p class="hint" style="margin-bottom:18px">${net?.isHost ? `${o.bots} bots will fill available spots. The next player takes over if the host disconnects.` : "Waiting for the host to start. You can choose your loadout while you wait."}</p><p class="hint">${ruleSummary(o)}</p>${net?.isHost ? '<button class="secondary" data-action="match-settings">EDIT MATCH SETTINGS</button>' : ""}${visibilityButton()}<button class="plain" data-action="chat-controls">Player controls & quick chat</button><div class="room-bottom">${net?.isHost ? '<button class="primary" data-action="start-match">START MATCH</button>' : '<button class="primary" data-action="loadout">Choose loadout</button>'}<button class="plain" data-action="leave">Leave</button></div></section>`;
  $("#lobby .lobby-panel").scrollTop = scrollTop;
}
function launchRound(){
  buildControls.buildMode=false;buildUI.cancel();
  if(sim.startRound()===false){toast('Invite another operator or add a bot before launching.');return false;}
  state=sim.snapshot();net?.broadcast(state);enterGame(true);return true;
}
function enterGame(capture = false) {
  const entering=state.players.find(p=>p.id===localId),watching=!!(entering?.friendSpectator||entering?.lateSpectator);
  showLoading(watching?'PREPARING SPECTATOR VIEW':'DEPLOYING TO THE FRONT',watching?'Connecting to the action. Spectators cannot affect the match.':'Preparing the battlefield and your operator.',{kind:watching?'spectate':'enter'});
  guestFire.reset();
  connectionReport.network.reset();
  resultAt=0;$("#round-banner").hidden=true;
  screen = "game";
  $("#menu").hidden = true;
  $("#lobby").hidden = true;
  document.body.classList.add("in-game");
  lastPhase = "playing";
  const p = state.players.find((p) => p.id === localId);
  if (p) {
    input.yaw = p.yaw;
    input.pitch = p.pitch;
    input.slot = p.slot;
    lastHealth = p.health;
    predicted = null;
  }
  dialog.close();
  dialogType = "";
  // Join the match as an inactive operator; only the entry button requests a spawn.
  resume(state.options.mode==='royale');

}
function mouseCapturePrompt() {
  if(screen==='game' && !document.pointerLockElement && state?.royale)
    modal("Enter Battle Royale", `<p>Click to capture your mouse and look around.</p><button class="primary" data-action="resume">ENTER GAME</button>`, "ready");
}
document.addEventListener('pointerlockerror',mouseCapturePrompt);
async function resume(capture = true) {
  dialog.close();
  dialogType = "";
  paused = false;
  keys.clear();
  scoreHeld = false;
  queuedActions.clear();
  // Returning from a chat input must restore keyboard focus as well as mouse
  // capture; otherwise the hidden input can keep swallowing menu/move keys.
  $("#world").tabIndex = -1;
  $("#world").focus({preventScroll:true});
  sound.unlock();
  if (capture && !state?.players.find(p => p.id === localId)?.spectating && !matchMedia("(pointer:coarse)").matches) {
    try {
      const result = $("#world").requestPointerLock();
      if (result?.catch) await result;
    } catch {
      if(state?.royale)mouseCapturePrompt();
      else pauseMenu();
    }
  }
}
let spectateTarget = null,watchSent=null,watchSentAt=0,watcherIds=[],watcherRound=null;
function updateSpectatorStatus(me,now){
 const target=me?.spectating?spectateTarget:me?.health<=0?me.killerId:null;
 if(me&&(target!==watchSent||now-watchSentAt>1500)){const action='watch:'+(target||'');if(sim&&!sim.remote)sim.playerAction(localId,action);else net?.send({type:'player-action',action});watchSent=target;watchSentAt=now;}
 let node=document.getElementById('spectator-status');if(!node){node=document.createElement('div');node.id='spectator-status';node.setAttribute('role','status');document.getElementById('hud').append(node);}
 const round=(state?.royale?.matchId||'')+':'+state?.round;if(watcherRound!==round){watcherRound=round;watcherIds=[];}
 const people=screen==='game'&&me?.health>0&&!me.spectating?watchersFor(state,localId):[];
 const message=spectatorMessage(watcherIds,people);if(message)notice(message);watcherIds=people.map(p=>p.id);
 const text=people.length?'◉ '+people.length+' WATCHING · '+people.map(p=>p.name).join(', '):'';if(node.textContent!==text)node.textContent=text;node.hidden=!text;
 const eye=document.getElementById('royale-watch-count');if(eye){eye.textContent=String(people.length);eye.parentElement.hidden=!people.length;eye.parentElement.setAttribute('aria-label',people.length+' spectators watching you');}
}

let spawnIntentUntil = 0;
function switchSpectator(step) {
  sound.cue('spectator-switch');
  const players=spectatorTargets(state,localId);
  const index = players.findIndex(p => p.id === spectateTarget);
  spectateTarget = players.length ? players[(index + step + players.length) % players.length].id : null;
}
function chooseTeam() {
  const counts=[0,0];
  for(const p of state?.players||[]) if(p.id!==localId&&!p.spectating) counts[p.team]++;
  modal('Choose your team', `<p>Pick a team before entering Team Scramble. When a team leads by two players, join the smaller team.</p><div class="split-actions">${['BLUE','RED'].map((name,team)=>`<button class="primary" data-action="team-entry-${team}" ${counts[team]-counts[1-team]>=2?'disabled':''}>${name} · ${counts[team]} players</button>`).join('')}</div>`, 'team-choice');
}
function sendMarker(kind,point=null){
 if(!state?.royale||screen!=='game')return;
 const action=kind==='clear'?'ping-clear':'ping-'+JSON.stringify({kind,...point});
 if(sim)sim.playerAction(localId,action);else net?.send({type:'player-action',action});
}
function playerAction(action) {
  if(state?.players.find(p=>p.id===localId)?.friendSpectator)return;
  if(state?.options.mode==='teams' && action==='rejoin') {chooseTeam();return;}
  spawnIntentUntil = action === "spectate" ? 0 : performance.now() + 5000;
  if (sim) { sim.playerAction(localId, action); state = sim.snapshot(); }
  else net?.send({type: "player-action", action});
  pendingInputs = [];
  predicted = null;
  resume(action !== "spectate");
}
function pauseMenu() {
  if(screen!=='game')return;
  if(state?.royale){modal('FIELD MENU',`<p>${net?'The match keeps running while this menu is open.':'The local match is paused.'} One life per round. Eliminated players spectate the survivors.</p><button class="primary" data-action="resume">RESUME</button><div class="split-actions"><button data-action="royale-map">Island map</button><button data-action="royale-inventory">Inventory</button><button data-action="settings">Settings</button></div>${net?'<button class="plain" data-action="chat-controls">Player controls & quick chat</button>':''}${visibilityButton()}<button class="secondary" data-action="leave-confirm">Leave match</button>`,'pause');return;}

  modal(
    "Take a breather",
    `<p>${net ? "The multiplayer match keeps running while this menu is open." : "The local match is paused."}</p><button class="primary" data-action="resume" style="margin-top:22px">RESUME</button><div class="split-actions"><button class="plain" data-action="respawn-player">Respawn</button><button class="plain" data-action="spectate">Spectate</button></div><div class="split-actions"><button class="plain" data-action="loadout">Loadout</button><button class="plain" data-action="settings">Settings</button></div>${net ? '<button class="plain" data-action="chat-controls" style="margin-top:12px">Player controls & quick chat</button>' : ""}${visibilityButton()}${net ? '<button class="plain" data-action="copy-link" style="margin-top:12px">Copy invite link</button>' : ""}<button class="secondary" data-action="leave-confirm" style="margin-top:12px">Leave match</button>`,
    "pause",
  );
}
function leave(confirm = false,notifyParty=true) {
  const returningFromMatch=screen==='game';
  if(returningFromMatch)showLoading('RETURNING TO LOBBY','Closing the match connection and preparing your operator in the lobby.',{kind:'exit'});else hideLoading(true);
  if(notifyParty){activeLaunch=null;void partyRequest("returned");}
  earnMatch++;
  buildControls.buildMode=false;buildUI.cancel();
  resultAt=0;$("#round-banner").hidden=true;damageSources.length=0;
  matchRequest++;autoQueue=false;sound.stopWorld();royaleUI.waypoint=null;royaleUI.root.hidden=true;document.body.classList.remove('in-royale','in-spawn-island','in-duos');
  net?.destroy();
  net = null;
  chat.reset();
  sim = null;
  state = null;
  predicted = null;
  screen = "menu";
  paused = true;
  busy = false;
  keys.clear();
  scoreHeld = false;
  queuedActions.clear();
  pendingInputs = [];
  input.fire = false;
  input.aim = false;
  $("#lobby").hidden = true;
  $("#menu").hidden = false;
  document.body.classList.remove("in-game");
  if (document.pointerLockElement) document.exitPointerLock();
  dialog.close();
  dialogType = "";
  $("#feed").innerHTML = "";
  renderMenu();
  updates.apply();
  void updates.check();
}
function scoresHTML(s = state) {
  if(s?.royale)return `<table class="scores"><thead><tr><th>Place</th><th>Operator</th><th>Eliminations</th><th>Status</th></tr></thead><tbody>${[...s.players].sort((a,b)=>(a.place||999)-(b.place||999)).map(p=>`<tr class="${p.id===localId?'local':''}"><td>${p.place?'#'+p.place:'—'}</td><td>${esc(p.name)}${p.bot?' · BOT':''}</td><td>${p.kills}</td><td>${p.lateSpectator?'Spectator':p.health>0?'Alive':isTeamRoyale(s.options)&&!p.place?'Watching teammate':'Eliminated'}</td></tr>`).join('')}</tbody></table>`;

  return `<table class="scores"><thead><tr><th>Operator</th><th>Elims</th><th>Downs</th><th>Score</th></tr></thead><tbody>${[
    ...(s?.players || []),
  ]
    .sort((a, b) => b.points - a.points || b.kills - a.kills)
    .map(
      (p) =>
        `<tr class="${p.id === localId ? "local" : ""}"><td>${mode(s.options.mode).teams ? `<span class="team-dot ${p.team === 1 ? "coral" : ""}"></span>` : ""}${esc(p.name)}${p.bot ? " · BOT" : ""}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${Math.floor(p.points)}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}
function resultsMenu() {
  const p = state.players.find((p) => p.id === localId);

  modal(
    state.royale ? wonRoyale(state,localId) ? "FRONTIER SECURED!" : "Round complete" : "That’s a wrap.",
    `<div class="results"><div class="eyebrow">${state.royale?`YOUR PLACEMENT ${p?.place?'#'+p.place:'SPECTATOR'} · ${p?.kills||0} ELIMINATIONS`:`ROUND ${state.round} COMPLETE`}</div><h2 style="margin:12px 0">${esc(state.winner)}</h2><p class="hint">${net?`${matchEarnings.total||0} Marks · ${esc(matchEarnings.status)}`:'Practice · No currency rewards'} · Wallet: ${eggWallet.value.balance} Marks</p>${scoresHTML()}${net ? '<button class="plain" data-action="chat-controls">Player controls & quick chat</button>' : ""}<p class="hint">${ruleSummary(state.options)}</p>${state.options.recurring?'<p>Next public round starts automatically in 10 seconds.</p>':sim&&!sim.remote || net?.isHost ? '<button class="primary" data-action="quick-rematch">REMATCH · SAME RULES</button><button data-action="rematch">CHANGE RULES</button>' : "<p>Waiting for the host to start another round.</p>"}<div class="split-actions">${state.royale?'<button class="plain" data-action="royale-queue">BACK TO LOBBY</button>':'<button class="plain" data-action="loadout">Change loadout</button>'}<button class="plain" data-action="leave-confirm">Leave match</button></div></div>`,
    "results",
  );
}
let lastWorldKey="";
function handleState() {
  if (!state) return;
  const worldKey=(state.royale?.matchId||'')+':'+state.round+':'+state.options.map;
  if(state.royale&&lastWorldKey!==worldKey){lastWorldKey=worldKey;pendingInputs=[];predicted=null;keys.clear();queuedActions.clear();guestFire.reset();const me=state.players.find(p=>p.id===localId);if(me){input.slot=me.slot;input.yaw=me.yaw;input.pitch=me.pitch;}buildControls.buildMode=false;buildUI.cancel();}
  if (state.phase === "playing" && lastPhase !== "playing") {
    lastPhase = "playing";
    enterGame(false);
  }
  if (state.phase === "results" && lastPhase !== "results") {
    lastPhase = "results";
    roundIntro();
  }
  if (screen === "lobby") renderLobby();
  for (const toggle of document.querySelectorAll('[data-action="toggle-visibility"]')) toggle.textContent = visibilityLabel();
}
function processEvents() {
  if (!state) return;
  for (const e of state.events) {
    if (e.id <= lastEvent) continue;
    lastEvent = e.id;
    if (state.time - e.time > 1.6) continue;
    const echoed=(!sim||sim.remote)&&e.player===localId&&guestFire.confirm(e,performance.now()/1000);
    if(echoed)e.echoed=true;
    if(e.type==='afk-removed'){if(e.player===localId){leave(false,false);modal('Removed for inactivity','<p>No meaningful input was detected for 59 seconds. This match awards no Marks.</p><button class="primary" data-action="close">BACK TO LOBBY</button>','afk');return;}if(net?.isHost)net.kick(e.player);}
    if(e.type==='duo-marker'&&e.player!==localId&&e.team!==state.players.find(p=>p.id===localId)?.team)continue;
    view.event(e, localId);
    recordSeasonEvent(e,state,localId);if(['boss-defeated','relay-captured','rig-used','elimination','hit'].includes(e.type)&&e.player===localId){const earned=masteryRewards().filter(id=>!eggWallet.value.owned.includes(id));if(earned.length)eggWallet.change(w=>({...w,owned:[...new Set([...w.owned,...earned])]})).then(()=>toast('Season 1 cosmetic reward unlocked · Locker')).catch(()=>{});}
    if(e.type==='vault-open')notice('VOSS VAULT UNLOCKED · Epic requisitions secured',3500);if(e.type==='boss-defeated')notice('VOSS DEFEATED · Keycard, legendary rifle & mythic Jump Rig dropped',4500);if(e.type==='relay-captured'&&e.player===localId)notice('SIGNAL LIVE · Contacts revealed. Your location is exposed.',3500);
    const me = state.players.find((p) => p.id === localId);
    sound.event(e,me,state);
    if(e.type==='duo-marker')sound.cue(e.kind==='danger'?'danger-ping':'world-ping',null,.75);
    if(e.type==='knocked'&&teammates(state.options,me,state.players.find(p=>p.id===e.target)))notice(`Teammate downed · ${e.targetName}`,1800);
    if(e.type==='revived'&&(e.player===localId||e.target===localId))notice(e.target===localId?'Back in the fight · 30 health':'Teammate revived',2200);
    if(e.type==='streak-bonus'&&e.player===localId){streakUI.announce(e,state.options.mode);sound.pickup();}
    if(e.type==='royale-eliminated'&&e.player===localId){spectateTarget=state.players.find(p=>teammates(state.options,me,p)&&p.health>0)?.id||me?.killerId;pendingInputs=[];predicted=null;}
    if (e.type === "shot"&&!echoed) {
      const distance = me
        ? Math.hypot(e.origin.x - me.x, e.origin.z - me.z)
        : 0;
      sound.shot(e.weapon, distance, e.origin);
    }
    if (e.type === "launch"&&!echoed) sound.shot(e.popper?"pip":e.weapon, me&&e.origin?Math.hypot(me.x-e.origin.x,me.z-e.origin.z):0,e.origin);
    if (e.type === "explosion")
      sound.pop(me ? Math.hypot(me.x - e.x, me.z - e.z) : 0,e);
    if (e.type === "hit") {
      if (e.player === localId) {
        sound.hit();
        hitUntil = performance.now() + 150;
      }
      if (e.target === localId) {
        damageFlash=Math.max(damageFlash,.5+Math.min(.35,e.amount/100));
        if(Number.isFinite(e.sourceX)&&Number.isFinite(e.sourceZ)){damageSources.push({x:e.sourceX,z:e.sourceZ,until:performance.now()+1400});if(damageSources.length>5)damageSources.shift();}
      }
    }
    if (e.type === "reload" && e.player === localId) sound.reload(Math.max(.3,(me?.reloadEnd||state.time+1.2)-state.time),e.weapon||gun(me).id);
    if (e.type === "pickup" && e.player === localId) {
      sound.pickup();
      notice(
        e.kind === "ammo"
          ? "Ammo restocked"
          : e.kind === "health"
            ? "Health restored"
            : "Popper collected",
      );
    }
    if(e.type==='build-result'&&e.player===localId)buildUI.result(e);
    if (e.type === "notice") notice(e.text);
    if (e.type === "elimination") {
      sound.death(me ? Math.hypot(me.x-e.x, me.z-e.z) : 0,e);
      const row = document.createElement("div");
      row.className = "kill-line" + (e.player === localId ? " me" : "");
      const ally=id=>teammates(state.options,me,state.players.find(p=>p.id===id))?"◆ ":"";
      row.innerHTML = `${ally(e.player)}${esc(e.name)} <span>${esc(e.weapon)}</span> ${ally(e.target)}${esc(e.targetName)}`;
      row.dataset.expire = String(performance.now() + 5500);
      $("#feed").prepend(row);
      while ($("#feed").children.length > 4) $("#feed").lastChild.remove();
      if (e.player === localId && e.target !== localId) {
        sound.eliminate();
        notice(
          e.streak >= 3 ? `${e.streak} in a row!` : `Tagged ${e.targetName}`,
        );
      }
      if (e.target === localId)
        $("#respawn-by").textContent = `Tagged by ${e.name} · ${e.weapon}`;
    }
    if (e.type === "player-action" && e.player === localId) {
      $("#respawn-by").textContent = e.action === "respawn" ? "Returning to a fresh spawn" : "";
    }
    if (e.type === "spawn" && e.player === localId) {
      input.slot = 0;
      const p = state.players.find((p) => p.id === localId);
      if (p) {
        if (p.health > 0 && performance.now() < spawnIntentUntil && !dialog.open) void resume();
        spawnIntentUntil = 0;
        input.yaw = p.yaw;
        input.pitch = 0;
      }
      pendingInputs = [];
      predicted = null;
    }
  }
}
function hud() {
  if (screen !== "game" || !state) return;
  const p = state.players.find((p) => p.id === localId);
  if (!p) return;
  let afk=document.querySelector('#afk-warning');if(!afk){afk=document.createElement('div');afk.id='afk-warning';afk.className='afk-warning';afk.setAttribute('role','alert');document.body.append(afk);}
  afk.hidden=!(p.afkRemaining<=12&&p.health>0&&!p.spectating);afk.textContent=`You are about to be removed for inactivity. ${p.afkRemaining}s remaining.`;
  const m = mode(state.options.mode);
  const watched=p.spectating?state.players.find(k=>k.id===spectateTarget):null;
  if(state?.royale){const me=state.players.find(p=>p.id===localId);if(me)buildUI.update(state,me,view.buildMap,controlLabel);}
  royaleUI.update(state,p,watched,controlLabel,paused);
  view.waypoint=royaleUI.waypoint;
  $("#hud-mode").textContent = m.name.toUpperCase();
  $("#hud-map").textContent = getMap(state.options.map).name;
  $("#hud-network").textContent = net
    ? (net.isHost ? "HOST · " : net.latency + " ms · ") + formatCode(net.code)
    : "LOCAL MATCH";
  $("#timer").textContent =
    Math.floor(Math.ceil(state.remaining) / 60) +
    ":" +
    String(Math.ceil(state.remaining) % 60).padStart(2, "0");
  $("#score-blue").textContent = m.teams ? state.scores[0] : "";
  $("#score-coral").textContent = m.teams ? state.scores[1] : "";
  $("#objective").textContent =
    m.id==='royale'&&state.royale.practice?`SPAWN ISLAND · ${state.royale.contestants} CONTESTANTS` : m.id==='royale' ? `${state.royale.alive} ALIVE · ${p.kills} ELIMS · ${p.place?'#'+p.place:'LAST OPERATOR STANDING'}` :
    `FIRST TO ${state.options.scoreLimit} ELIMINATIONS`;
  const vitals=state.royale&&watched?watched:p;
  royaleUI.project=point=>view.projectMarker(point);
  $("#shield").textContent = Math.ceil(vitals.shield || 0);
  $("#shield-fill").style.width = Math.max(0, Math.min(100, vitals.shield || 0)) + "%";
  $("#arena-stamina").hidden=!!state.royale;$("#arena-stamina-fill").value=vitals.stamina??100;$("#arena-stamina").classList.toggle("exhausted",!!vitals.exhausted);
  $("#health").textContent = Math.ceil(vitals.health);
  $("#health-fill").style.width = Math.max(0, Math.min(100, vitals.health)) + "%";
  $("#streak").textContent =
    state.time < p.shieldUntil
      ? "Spawn shield · firing ends it"
      : p.streak > 1
          ? p.streak + " elimination streak"
          : "Field ready";
  streakUI.update(state,p);
  let bonusPanel=$('#streak-bonuses');
  if(!bonusPanel){bonusPanel=document.createElement('div');bonusPanel.id='streak-bonuses';bonusPanel.hidden=true;$('#streak').after(bonusPanel);}
  bonusPanel.hidden=true;
  bonusPanel.textContent=bonusStatus(p,state.time).join(' • ');
  if(arenaBonuses(state.options.mode)&&p.health>0)$('#streak').textContent+=` · ${5-p.streak%5} to bonus`;
  $('#crosshair').classList.toggle('damage-boost',arenaBonuses(state.options.mode)&&p.damageUntil>state.time);
  $('.quick-controls').innerHTML = [['forward','Move'],['crouch','Crouch / slide'],['reload','Reload'],['swap','Swap']].map(([id,label]) => `<span><kbd>${esc(controlLabel(id))}</kbd> ${label}</span>`).join('') + '<span><kbd>Esc</kbd> Menu</span>';
  $("#gun-name").textContent = gun(p).name;
  $("#ammo").textContent = p.ammo[p.slot];
  $("#reserve").textContent = p.reserve[p.slot];
  $("#ammo-extra").textContent =
    p.reloadEnd > state.time
      ? "RELOADING…"
      : `${p.poppers} poppers · ${p.slot === 0 ? `${controlLabel("sidearm")} → sidearm` : `${controlLabel("primary")} → primary`}`;
  $("#respawn").style.display =
    p.health <= 0 && !p.spectating && state.phase === "playing" ? "block" : "none";
  const killer = p.health <= 0 && state.players.find(k => k.id === p.killerId);
  $("#spectator-stats").textContent = killer
    ? `${killer.health > 0 ? "Spectating" : "Eliminated"} ${killer.name} · Health ${Math.ceil(killer.health)} · ${gun(killer).name} · ${killer.kills} K / ${killer.deaths} D · ${Math.floor(killer.points)} pts`
    : "";
  const watching = !!p.spectating && state.phase === "playing";
  $("#spectate-panel").hidden = !watching;
  $("#hud").classList.toggle("spectating", watching);
  $('#spectate-panel [data-action=rejoin]').hidden=!!p.friendSpectator||!!state.royale;
  const target = state.players.find(k => k.id === spectateTarget);
  $("#spectate-info").textContent = target && watching
    ? `${target.name} · Health ${Math.ceil(target.health)} · ${state.royale?itemInfo(target.inventory?.[target.slot]).name:gun(target).name} · ${target.kills} K / ${target.deaths} D`
    : "Waiting for a player to spawn…";
  const delay = Math.max(0, Math.ceil(p.respawnAt - state.time));
  $("#spawn-heading").textContent = p.awaitingEntry ? "OPERATOR READY" : "OPERATOR ELIMINATED";
  $("#spawn-status").textContent = p.spawnRequested
    ? (delay ? `Entering in ${delay}…` : "Entering the arena…")
    : delay ? `Respawn available in ${delay}` : "Ready when you are";
  $("#spawn-button").textContent = p.awaitingEntry ? "DEPLOY" : "Respawn";
  $("#spawn-button").disabled = !!p.spawnRequested || delay > 0;
  if (p.health > 0) spawnIntentUntil = 0;
  if (p.health <= 0 && !p.spawnRequested && performance.now() > spawnIntentUntil && document.pointerLockElement)
    document.exitPointerLock();
  const armed=canFight(p)&&(!state.royale||p.flight==='ground'&&!!p.inventory?.[p.slot]?.weapon);
  const aiming = armed &&
    (actionDown("aim") || touch.aim) &&
    p.health > 0 &&
    !paused &&
    p.reloadEnd <= state.time;
  $("#crosshair").style.display =
    p.health > 0 && armed && !paused && !(aiming&&['scope','prism'].includes(gun(p).optic)) ? "block" : "none";
  // Convert the host's current angular shot spread to a screen-space radius.
  $('#crosshair').classList.toggle('weapon-lowered',!!(p.tacticalSprint||p.sprintRecovery>0||p.traversal));
  const spread = (!sim||sim.remote?predicted?.shotSpread:null)??p.shotSpread??gun(p).spread;
  const radius=crosshairRadius(spread,$('#world').clientHeight,view.camera.projectionMatrix.elements[5]);
  $("#crosshair").style.setProperty("--crosshair-gap", `${Math.max(0,radius)}px`);
  $('#crosshair').classList.toggle('accuracy-ready',!!(((!sim||sim.remote)&&predicted?.firstShot)||p.firstShot));
  $('#crosshair').dataset.category=gun(p).category;
  $('#scope-spread').style.width=$('#scope-spread').style.height=`${2*radius}px`;$('#scope-spread').hidden=radius<2;
  $('#crosshair').classList.toggle('pellet-reticle',gun(p).pellets>1);
  $("#center-dot").hidden = !settings.centerDot || aiming;
  $("#hit-marker").hidden = !settings.hitMarkers || p.health <= 0 || paused || performance.now() >= hitUntil;
  const scoped =
    aiming && (gun(p).optic === "scope" || gun(p).optic === "prism");
  $("#scope").style.display = scoped && view.aimBlend>.8 ? "block" : "none";
  $("#scope").dataset.reticle=gun(p).ads?.reticle||"mil-dot";
  $("#scope").dataset.overlay=gun(p).ads?.overlay||"precision";
  $("#scope-label").textContent = scoped
    ? `${gun(p).name.toUpperCase()} / OPTIC ${gun(p).magnification||2.5}×`
    : "";
  $("#scoreboard").style.display = scoreHeld && !dialog.open ? "block" : "none";
  if (scoreHeld)
    $("#scoreboard").innerHTML =
      `<h2>${m.name} · ${getMap(state.options.map).name}</h2>${scoresHTML()}`;
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied. Send it to your friends.");
  } catch {
    modal(
      "Copy your invite",
      `<p>Select and copy the text below.</p><input class="field" readonly value="${esc(text)}" style="margin-top:16px">`,
      "copy",
    );
  }
}
async function partyRequest(type,data={}){
 try{return await party.request(type,data);}catch(error){toast(error.message);return null;}
}
function playMenu(){modal('Choose your experience',modeMarkup(party?.party?.selection,party?.party?.leader!==party?.id),'play');}
async function selectExperience(id){
 const e=EXPERIENCES.find(e=>e.id===id);if(!e)return;
 if(await partyRequest('select',{mode:e.mode,teamSize:e.teamSize,teamFill:party.party.selection.teamFill})){closeDialog();renderMenu();}
}
let socialTab='friends',socialModel=null,socialOffset=0,socialRefreshTimer=null,socialFetching=false;
async function socialMenu(){
 if(party?.identityBlocked){modal('Restore Friend Code',`<p>${esc(party.identityBlocked)}</p><p>Retry to reconnect to your saved identity. Creating a new code starts a separate friend list.</p><div class="actions"><button class="primary" data-action="social-retry-identity">RETRY RESTORATION</button><button data-action="social-new-identity">CREATE A NEW FRIEND CODE…</button><button data-action="close">CLOSE</button></div>`,'social-recovery');return;}
 if(!party?.ready){toast('Social is connecting. Try again in a moment.');return;}
 if(socialFetching)return;socialFetching=true;
 const model=await partyRequest('social',{offset:socialOffset});socialFetching=false;if(!model)return;
 socialModel=model;modal('Social & Party',socialMarkup(party.party,party.id,model,socialTab),'social');
}
function scheduleSocialRefresh(){clearTimeout(socialRefreshTimer);if(dialogType==='social')socialRefreshTimer=setTimeout(()=>{if(dialogType==='social')void socialMenu();},750);}
function addFriendMenu(){modal('Add Friend',`<p>Enter another player’s public Friend Code. You can send a request even when they are offline.</p><form id="friend-find-form"><label for="friend-code">FRIEND CODE</label><input class="field" id="friend-code" placeholder="AB7KQ-4M2QX" maxlength="16" autocomplete="off" spellcheck="false"><button class="primary" type="submit">FIND PLAYER</button></form><div id="friend-lookup" role="status"></div>`,'add-friend');$('#friend-code').focus();$('#friend-find-form').onsubmit=async e=>{e.preventDefault();const node=$('#friend-lookup');node.textContent='Finding player…';try{const found=await party.request('lookup',{code:$('#friend-code').value});if(!node.isConnected)return;node.innerHTML=`<article class="social-person"><div><strong>${esc(found.name)}</strong><small>${esc(found.code)} · ${esc(found.presence.replaceAll('-',' '))}</small></div>${found.relationship==='none'?`<button class="primary" data-social-action="friend-send" data-player-id="${found.id}">SEND FRIEND REQUEST</button>`:found.relationship==='incoming'?`<button data-social-action="friend-accept" data-player-id="${found.id}">ACCEPT REQUEST</button>`:`<span class="social-pending">${found.relationship==='friends'?'Already friends':'Request already pending'}</span>`}</article>`;}catch(error){node.textContent=error.message;node.className='social-error';}};}
function receiveInvite(invite){
 if(document.querySelector(`[data-invitation-id="${invite.id}"]`))return;
 let tray=document.querySelector('.social-notifications');if(!tray){tray=document.createElement('div');tray.className='social-notifications';document.body.append(tray);}
 const node=document.createElement('aside');node.className='party-invitation';node.dataset.invitationId=invite.id;node.setAttribute('role','status');
 node.innerHTML=`<small>PARTY INVITATION · ${invite.size} / 4</small><strong>${esc(invite.name)} invited you</strong><button data-party-accept="${invite.id}">ACCEPT</button><button data-party-decline="${invite.id}">DECLINE</button>`;
 tray.append(node);while(tray.children.length>3)tray.firstChild.remove();setTimeout(()=>node.remove(),Math.max(0,invite.expires-Date.now()));sound.cue('queue-found');
}
async function queueParty(custom=false,code=null){
 if(state){toast('Return to the lobby before finding another match.');return;}
 const selected=custom?getOptions():matchOptions({...party?.party?.selection,fill:true,bots:party?.party?.selection.mode==='royale'?31:7});
 if(!selected)return;
 // The custom launch applies its selection atomically, retaining party readiness.
 if(await partyRequest('queue',{custom,code,options:selected,visibility:custom?'private':'public'})){dialog.close();dialogType='';renderMenu();}
}
async function queuePublicRoyale(spectate=false){
 if(state)return;
 if(await partyRequest('queue',{publicRoyale:true,spectate})){dialog.close();dialogType='';renderMenu();}
}
async function launchParty(launch){
 if(activeLaunch===launch.id)return;activeLaunch=launch.id;
 if(net||state)leave(false,false);
 let ok=false;
 try{
  if(launch.host)ok=await createRoom(launch.options,launch.visibility,!launch.hostRun,launch);
  else {spectateTarget=launch.watchId||null;ok=await joinRoom(launch.code,false,launch.ticket);}
  if(activeLaunch!==launch.id)return;
  if(!ok)throw Error('Your party could not enter that match together.');
  if(launch.host)await party.request('host-ready',{id:launch.id});
  await party.request('joined',{id:launch.id});
 }catch(error){await partyRequest('failed',{id:launch.id,reason:error.message});if(activeLaunch===launch.id)activeLaunch=null;}
}
function initializeParty(){
 party=new PartyClient(profile,{
  status:status=>{if(screen==='menu')renderMenu();if(status==='Connected'&&screen==='menu'&&!net&&!activeLaunch)void partyRequest('returned');},
  change:p=>{if(screen==='menu')renderMenu();scheduleSocialRefresh();if(p.state==='playing'&&autoQueue&&sim&&sim.options.mode!=='royale'&&sim.phase==='lobby')launchRound();},
  invite:receiveInvite,launch:launchParty,
  'public-match':refreshPublicMatch,
  'social-changed':scheduleSocialRefresh,
  'party-notice':m=>toast(m.message),
  'friend-request':m=>{toast(m.name+' sent a friend request. Open Social to accept or decline.');sound.cue('queue-found');scheduleSocialRefresh();},
  cancel:m=>{const wasJoining=busy||party?.party?.state==='queueing'||activeLaunch&&m.launchId===activeLaunch;activeLaunch=null;if(wasJoining&&(screen!=='menu'||net))leave(false,false);toast(m.message);if(screen==='menu')renderMenu();}
 });
}
function royaleMap(){if(!state?.royale)return;modal('Ravel Coast',royaleUI.mapHTML(),'royale-map');royaleUI.drawMap($('#royale-fullmap'),state,state.players.find(p=>p.id===localId),true);}
function royaleInventory(){if(!state?.royale)return;const p=state.players.find(p=>p.id===localId);royaleUI.inventoryKey='';modal('INVENTORY',royaleUI.inventoryHTML(p),'royale-inventory');royaleUI.updateInventory(p);}
function inventoryAction(action,index,from){
 const p=state?.players.find(p=>p.id===localId);if(!state?.royale||!p||p.health<=0)return;
 const selected=Number.isInteger(from)?from:action==='drop'&&Number.isInteger(index)?index:input.slot;
 if(action==='slot'){input.slot=index;buildControls.buildMode=false;buildUI.cancel();}
 if(action!=='slot'&&(selected===0||index===0))return;
 if(action==='swap'){if(input.slot===selected)input.slot=index;else if(input.slot===index)input.slot=selected;}
 const command=action==='slot'?`inventory-select-${index}`:action==='swap'?`inventory-swap-${selected}-${index}`:`inventory-${action}-${selected}`;
 if(sim){sim.playerAction(localId,command);state=sim.snapshot();}else net?.send({type:'player-action',action:command});
 if(dialogType==='royale-inventory')royaleUI.updateInventory(state.players.find(p=>p.id===localId));
}
const actions = {
 'owner-refresh':()=>ownerConsole.refresh(),
 'owner-logout':()=>ownerConsole.logout(),
 'play':()=>playMenu(),
 'lobby-home':()=>selectMenuSection('play'),
 'profile':profileMenu,
 'locker':()=>customizeMenu('locker'),
 'item-shop':()=>customizeMenu('shop'),
 'social':socialMenu,
 'add-friend':addFriendMenu,
 'copy-friend-code':()=>copy(party.code),
 'social-retry-identity':()=>{party.retryIdentity();closeDialog();},
 'social-new-identity':()=>modal('Create New Friend Code?',`<p>This creates a separate identity with an empty friend list. It does not restore your old friendships. Your previous browser credential will be kept for recovery.</p><div class="actions"><button class="primary" data-action="social-confirm-new-identity">CREATE NEW CODE</button><button data-action="social">GO BACK</button></div>`,'social-new-identity'),
 'social-confirm-new-identity':()=>{party.newIdentity();closeDialog();},
 'season-guide':()=>showWelcomeBack({force:true}),
 'quick-rematch':()=>{if(sim&&!sim.remote&&state?.phase==='results'&&(!net||net.isHost)){closeDialog();launchRound();}},
 'training':()=>{modal('FIELD TRAINING','<p>A private offline exercise. Choose weapons, practice on moving targets, build and edit. No currency or mastery rewards.</p><button class="primary" data-action="start-training">START TRAINING</button>','training');},
 'start-training':()=>{if(net)leave(false,false);options=matchOptions({mode:'royale',session:'offline',training:true,bots:3,capacity:4,fill:false});beginSim();launchRound();closeDialog();},
 'career':()=>selectMenuSection('career'),
 'find-public':()=>setupMenu(),
 'public-join':()=>queuePublicRoyale(false),
 'public-spectate':()=>queuePublicRoyale(true),
 'play-custom':()=>{options=matchOptions({...party?.party?.selection,fill:true});setupMenu();},
 'duo-fill':()=>partyRequest('select',{...party.party.selection,teamFill:true,duoFill:true}),
 'duo-no-fill':()=>partyRequest('select',{...party.party.selection,teamFill:false,duoFill:false}),
 'party-ready':()=>partyRequest('ready',{value:!party.party.members.find(m=>m.id===party.id)?.ready}),
 'party-cancel':()=>partyRequest('cancel'),
 'party-leave':()=>partyRequest('leave'),
 'party-privacy':()=>partyRequest('privacy',{value:party.party.privacy==='open'?'invite':'open'}),
  'connection-report': showConnectionReport,
  'run-connection-check': runConnectionCheck,
  'copy-connection-report': copyConnectionReport,
 'royale-home':playMenu,
 'royale-queue':()=>leave(false),
 'royale-map':royaleMap,
 'royale-inventory':royaleInventory,
 'royale-clear-marker':()=>{sendMarker('clear');royaleUI.waypoint=null;},
 'duo-marker':()=>sendMarker('normal'), 'duo-danger':()=>sendMarker('danger'),
 'royale-close-flight':()=>royaleUI.dismissFlight(),
 'royale-jump':()=>{if(paused)resume(false);queuedActions.add('jump');sound.unlock();},
 'royale-drop':()=>inventoryAction('drop'),
 'royale-drop-one':()=>inventoryAction('drop-one'),
 'royale-split':()=>inventoryAction('split'),

  chat: () => chat.open(),
  'chat-controls':()=>{dialog.close();dialogType='';chat.showControls();},
  'save-room-name':()=>{
    const raw=$('#room-name').value;const checked=moderateText(raw,{name:true});
    if(!checked.ok||!raw.trim()){toast('Choose another player name.');return;}
    profile=safeProfile({...profile,name:raw});save('yolk-profile',profile);
    if(net){const button=dialog.querySelector('[data-action="save-room-name"]');button.disabled=true;button.textContent='CHECKING NAME…';}
    if(net)net.submitName(profile);else if(sim?.setProfile(localId,profile)!==false){dialog.close();dialogType='';void resume();}else renamePrompt();
  },
  'royale-inspect':()=>{royaleUI.inspect=!royaleUI.inspect;royaleUI.updateInventory(state.players.find(p=>p.id===localId));},
  updates: () => modal("Update history", RELEASES.map(r =>
    `<article class="release-note"><div class="eyebrow">UPDATE ${esc(r.number)}</div><h3>${esc(r.title)}</h3><ul>${r.changes.map(c => `<li>${esc(c)}</li>`).join("")}</ul></article>`).join("")+`<article class="release-note"><h3>Music credits</h3><p>“The Complex” by <a href="https://incompetech.com/" target="_blank" rel="noopener">Kevin MacLeod (incompetech.com)</a>. Licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">Creative Commons Attribution 4.0</a>. Re-encoded and faded for lobby playback.</p></article>`),
  "team-entry-0": () => playerAction("team-entry-0"),
  "team-entry-1": () => playerAction("team-entry-1"),
  "enter-yard": () => playerAction(state?.players.find(p => p.id === localId)?.awaitingEntry ? "rejoin" : "respawn"),
  setup: () => setupMenu(false),
  "match-settings": () => setupMenu(true),
  "save-match-settings": () => saveMatchSettings(),
  "apply-rematch": () => saveMatchSettings(true),
  "create-room":()=>queueParty(true),
  "join-room": joinRoom,
  join: () => joinMenu(),
  loadout: loadoutMenu,
  customize: customizeMenu,
  "shuffle-egg": () => {
    const pick = (items) => Math.floor(Math.random() * items.length);
    Object.assign(profile, {color: COLORS[pick(COLORS)], accent: COLORS[pick(COLORS)], hat: pick(HATS), pattern: pick(PATTERNS), finish: pick(FINISHES), eyewear: pick(EYEWEAR)});
    remember(); customizeMenu();
  },
  "reset-egg": () => {
    profile = safeProfile({name: profile.name, weapon: profile.weapon, eyewear: NO_EYEWEAR});
    remember(); customizeMenu();
  },
  settings: settingsMenu,
  help: helpMenu,
  close: closeDialog,
  pause: pauseMenu,
  resume: () => resume(),
  "respawn-player": () => playerAction(state?.players.find(p => p.id === localId)?.spectating ? "rejoin" : "respawn"),
  spectate: () => playerAction("spectate"),
  rejoin: () => playerAction("rejoin"),
  "spectate-prev": () => switchSpectator(-1),
  "spectate-next": () => switchSpectator(1),
  leave: () => leave(),
  "leave-confirm": () => leave(true),
  scores: () => {
    scoreHeld = !scoreHeld;
  },
  "cancel-connect": () => leave(),
  "start-match": () => {
    launchRound();
  },
  rematch: () => setupMenu(true),
  "public-rooms": () => publicRooms(),
  "refresh-rooms": () => publicRooms(),
  "toggle-visibility": () => {
    if (!net?.isHost) return;
    net.setVisibility(net.visibility === "public" ? "private" : "public");
  },
  "copy-code": () => copy(formatCode(net.code)),
  "copy-link": () => {
    const u = new URL(location.href);
    u.search = "";
    u.hash = "";
    u.searchParams.set("room", net.code);
    copy(u.href);
  },
  about: () =>
    modal(
      "Welcome to the frontier",
      `<p>Ravelfront is an original, independent combat arena shooter. Its maps, characters, weapons, UI, and sounds were created for this game.</p><p style="margin-top:14px">3D rendering: Three.js (MIT). Multiplayer: secure WebSocket relay, with PeerJS (MIT) for optional direct connections. Ravel Coast was abandoned after the relay network failed. Rival crews return for its technology, fighting through storm fronts and improvised fortifications.</p><p style="margin-top:14px">Settings and match totals stay in this browser. Social uses a browser identity saved on this device. Public Friend Codes allow lookup, while a separate private credential reconnects your identity. Friendships, requests and blocks are saved by the social server. Clearing site data loses access to this identity; there are no cross-device accounts. Server relationships require durable hosting storage to survive a server replacement. Presence uses live connections with timeouts. Parties hold up to four players, invitations expire after one minute, and disconnected memberships expire after a 30-second grace period. Rooms share your chosen name and game state with other players. Public rooms also share their room code and details in the directory. Filtered text chat is shared only within your room or team. Displayed chat clears when you leave. The game server briefly buffers messages for delivery; undelivered messages expire after 30 seconds. Reports notify the room host. Anonymous visit analytics record session start, end, duration and game mode for the owner; they do not record IP addresses or chat. History is retained for at most 30 days when the host provides persistent storage. No camera or microphone.</p><p class="hint">Version 4.0.0 · All gameplay code is included in the project.</p>`,
      "about",
    ),
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("button,[data-action]");
  if (!b) return;
  if(b.dataset.socialTab){socialTab=b.dataset.socialTab;void socialMenu();}
  if(b.dataset.socialPage!==undefined){socialOffset=Number(b.dataset.socialPage);void socialMenu();}
  if(b.dataset.spectateFriend){if(state){toast('Return to the lobby before spectating a friend.');return;}b.disabled=true;void partyRequest('spectate-friend',{id:b.dataset.spectateFriend}).then(()=>{b.disabled=false;});}
  if(b.dataset.socialAction){b.disabled=true;void partyRequest(b.dataset.socialAction,{id:b.dataset.playerId}).then(ok=>{b.disabled=false;if(ok){toast(b.dataset.socialAction==='friend-send'?(ok.status==='friends'?'Friend request accepted.':'Friend request sent.'):'Social list updated.');void socialMenu();}});}
  if(b.dataset.experience)void selectExperience(b.dataset.experience);
  for(const [key,type]of [['partyInvite','invite'],['partyAccept','accept'],['partyDecline','decline'],['partyKick','kick'],['partyJoin','join']])if(b.dataset[key]){
    void partyRequest(type,{id:b.dataset[key]}).then(ok=>{if(ok){if(type==='accept'||type==='decline'){document.querySelector(`[data-invitation-id="${b.dataset[key]}"]`)?.remove();b.closest('.party-invitation')?.remove();}if(type==='invite')toast('Invitation sent.');if(dialogType==='social')void socialMenu();}});
  }
  if (b.dataset.action) {
    sound.unlock();
    actions[b.dataset.action]?.();
  }
  if (b.dataset.weapon) {
    profile.weapon = b.dataset.weapon;
    remember();
    if (dialogType === "loadout") loadoutMenu();
    renderMenu();
  }
  if (b.dataset.customTab) { customTab = b.dataset.customTab; customizeMenu(); }
  if (b.dataset.cosmetic) {
    const key = b.dataset.cosmetic;
    if (["color", "accent", "hat", "pattern", "finish", "eyewear"].includes(key)) {
      profile = safeProfile({...profile, [key]: b.dataset.value});
      remember(); customizeMenu();
      document.querySelector(`[data-cosmetic="${key}"][data-value="${b.dataset.value}"]`)?.focus();
    }
  }
  if (b.dataset.color) {
    profile.color = b.dataset.color;
    remember();
    customizeMenu();
  }
  if (b.dataset.hat) {
    profile.hat = Number(b.dataset.hat);
    remember();
    customizeMenu();
  }
  if (b.dataset.kick) net?.kick(b.dataset.kick);
  if (b.dataset.joinRoom) joinRoom(b.dataset.joinRoom);
});
dialog.addEventListener('submit',e=>{
  if(e.target.id!=='owner-form')return;
  e.preventDefault();const code=e.target.querySelector('#owner-code').value;
  const button=e.target.querySelector('button[type="submit"]');button.disabled=true;
  void ownerConsole.unlock(code).finally(()=>{if(button.isConnected)button.disabled=false;});
  e.target.querySelector('#owner-code').value='';
});
document.addEventListener("input", (e) => {
  const name = e.target.dataset.setting;
  if (!name) return;
  settings[name] =
    e.target.type === "checkbox"
      ? e.target.checked
      : e.target.type === "range"
        ? Number(e.target.value)
        : e.target.value;
  const out = $("#out-" + name);
  if (out) out.textContent = settings[name];
  save("yolk-settings", settings);
  sound.setVolumes(settings);
  view.setQuality();
});
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  if (dialogType === "connecting") {
    leave();
    return;
  }
  if (dialogType === "results" || dialogType === "rename") return;
  if (dialogType === "pause" || dialogType === "ready") resume();
  else closeDialog();
});
document.addEventListener("pointerlockchange", () => {
  if (
    !document.pointerLockElement &&
    screen === "game" &&
    !paused &&
    !buildControls.editing &&
    !chat.opened &&
    state?.players.find(p => p.id === localId)?.health > 0 &&
    !matchMedia("(pointer:coarse)").matches
  )
    pauseMenu();
});
function pressControl(code) {
  if(code.startsWith('Wheel')&&state?.royale){
    const p=state.players.find(p=>p.id===localId),pose=predicted?{...p,...predicted}:p;
    const eligible=!!p&&p.health>0&&p.flight==='ground'&&buildUI.eligible(state,pose,view.buildMap);
    const intent=wheelIntent(settings.keybinds,code,{royale:true,editing:!!buildUI.edit,eligible});
    if(intent!=='scroll'){
      if(intent==='reset-confirm'){
        buildUI.resetWithWheel(state,pose,view.buildMap);
      }else if(intent==='edit')buildUI.beginEdit(state,pose,view.buildMap);
      else if(intent!=='consume')buildUI.action(intent);
      return;
    }
  }
  if(buildUI.edit){
    if(settings.keybinds.buildEdit.includes(code)){buildUI.action('confirm');return;}
    if(settings.keybinds.buildReset.includes(code)){buildUI.action('reset');return;}
    if(settings.keybinds.fire.includes(code)){keys.add(code);return;}
  }

  if(settings.keybinds.chat.includes(code)&&net?.ready&&screen!=="menu"){chat.open();return;}
  keys.add(code);
  if(settings.keybinds.marker.includes(code))sendMarker('normal');
  if(settings.keybinds.danger.includes(code))sendMarker('danger');
  for (const action of ['jump', 'fire', 'reload', 'popper', 'interact']) {
    if (settings.keybinds[action].includes(code)) queuedActions.add(action);
  }
  if (settings.keybinds.primary.includes(code)) input.slot = state?.royale ? 1 : 0;
  if (settings.keybinds.sidearm.includes(code)) input.slot = state?.royale ? 2 : 1;
  if (settings.keybinds.swap.includes(code)) {input.slot = state?.royale ? (input.slot+1)%6 : 1-input.slot;buildControls.buildMode=false;}
  for(const [action,step] of [['nextSlot',1],['previousSlot',-1]])if(settings.keybinds[action].includes(code)){const count=state?.royale?6:2;input.slot=(input.slot+step+count)%count;buildControls.buildMode=false;}
  if(state?.royale){
    if(settings.keybinds.dismissFlight.includes(code)){royaleUI.dismissFlight();return;}
    if(settings.keybinds.pickaxe.includes(code)){input.slot=0;buildControls.buildMode=false;buildUI.cancel();}
    for(const [key,piece] of [['buildWall','wall'],['buildFloor','floor'],['buildStairs','stairs'],['buildRoof','roof']])if(settings.keybinds[key].includes(code)){buildUI.choose(piece);}
    for(const [key,action] of [['buildToggle','toggle'],['buildRotate','rotate'],['buildMaterial','material']])if(settings.keybinds[key].includes(code))buildUI.action(action);
    if(settings.keybinds.buildEdit.includes(code)){if(buildUI.edit)buildUI.action('confirm');else{const p=state.players.find(p=>p.id===localId);buildUI.beginEdit(state,predicted?{...p,...predicted}:p,view.buildMap);}}
    if(settings.keybinds.buildRepair.includes(code)){if(sim)sim.playerAction(localId,'build-repair');else net?.send({type:'player-action',action:'build-repair'});}
    if(['primary','sidearm','slot3','slot4','slot5'].some(k=>settings.keybinds[k].includes(code))){buildControls.buildMode=false;buildUI.cancel();}
    for(let i=3;i<=5;i++)if(settings.keybinds['slot'+i].includes(code))input.slot=i;
    if(settings.keybinds.map.includes(code))royaleMap();
    if(settings.keybinds.inventory.includes(code))royaleInventory();
    if(settings.keybinds.drop.includes(code))inventoryAction('drop');
  }
  scoreHeld = actionDown('scores');
}
dialog.addEventListener('click', e => {
  const reset = e.target.closest('[data-reset-slider]');
  if (reset) {
    resetSliders(settings, reset.dataset.resetSlider);
    for (const [id] of SLIDERS) { $('#'+id).value=settings[id]; $('#out-'+id).value=settings[id]; }
    save('yolk-settings', settings); sound.setVolumes(settings); view.setQuality();
  }
  if(dialogType==='settings')bindingEditor?.click(e.target);
});
dialog.addEventListener('input',e=>{if(e.target.matches('[data-bind-search]'))bindingEditor?.filter(e.target.value);});
let suppressBindingClick=false;
function captureBinding(e) {
  if (!bindingEditor?.capture || !dialog.open || dialogType!=='settings') return;
  e.preventDefault(); e.stopImmediatePropagation();
  if(e.repeat)return;
  if(e.type==='mousedown'&&e.button===0)suppressBindingClick=true;
  const code=e.type==='mousedown'?`Mouse${e.button}`:e.type==='wheel'?(e.deltaY>0?'WheelDown':'WheelUp'):e.code;
  bindingEditor.input(code);
}
document.addEventListener('visibilitychange',()=>sound.updateLobby(screen!=='game',0,document.hidden));
document.addEventListener('pointerdown',()=>sound.unlock(),{passive:true});
document.addEventListener('keydown',()=>sound.unlock());
document.addEventListener('click',e=>{if(suppressBindingClick){suppressBindingClick=false;e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener('keydown',captureBinding,true);
document.addEventListener('mousedown',captureBinding,true);
document.addEventListener('wheel',captureBinding,{capture:true,passive:false});
// Panel toggles also work when assigned to mouse buttons or the wheel.
function pointerPanelToggle(e){
 if(screen!=='game'||!state?.royale||!['royale-map','royale-inventory'].includes(dialogType)||e.target.closest('button,input,select,textarea'))return;
 const code=e.type==='wheel'?(e.deltaY>0?'WheelDown':'WheelUp'):`Mouse${e.button}`;
 const panel=royalePanelAction(code,settings.keybinds,dialogType);
 if(panel){e.preventDefault();e.stopImmediatePropagation();if(panel==='close')resume();else if(panel==='royale-map')royaleMap();else royaleInventory();}
}
document.addEventListener('mousedown',pointerPanelToggle,true);
document.addEventListener('wheel',pointerPanelToggle,{capture:true,passive:false});
document.addEventListener("keydown", (e) => {
  if (chat.opened || e.target.matches("input,select,textarea,[contenteditable=true]")) return;
  const panel = screen==='game' && state?.royale && (!paused || ['royale-map','royale-inventory'].includes(dialogType))
    ? royalePanelAction(e.code, settings.keybinds, dialog.open ? dialogType : '') : null;
  if (panel) {
    e.preventDefault(); if (e.repeat) return;
    if (panel==='close') resume(); else if (panel==='royale-map') royaleMap(); else royaleInventory();
    return;
  }
  if (dialog.open) return;
  if (settings.keybinds.chat.includes(e.code) && net?.ready && screen!=="menu") {
    e.preventDefault();if(!e.repeat)chat.open();return;
  }
  if (screen !== 'game') return;
  if (e.code === 'Escape') {
    e.preventDefault();
    if (!e.repeat){if(buildUI.edit)buildUI.action('cancel');else pauseMenu();}
    return;
  }
  if (paused) return;
  if (Object.values(settings.keybinds).some(codes => codes.includes(e.code))) e.preventDefault();
  if (!e.repeat) pressControl(e.code);
});
document.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  scoreHeld = actionDown('scores');
});
window.addEventListener("blur", () => {
  keys.clear();
  scoreHeld = false;
  queuedActions.clear();
  input.fire = false;
  input.aim = false;
  touch.fire = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keys.clear();
    scoreHeld = false;
    queuedActions.clear();
    input.fire = false;
    if (screen === "game" && !net && !paused) pauseMenu();
  }
});
$("#world").addEventListener("mousedown", (e) => {
  if (screen !== "game" || paused || dialog.open || chat.opened) return;
  e.preventDefault();
  pressControl(`Mouse${e.button}`);
});
document.addEventListener("mouseup", (e) => {
  keys.delete(`Mouse${e.button}`);
  scoreHeld = actionDown('scores');
});
function aimSensitivity() {
  const p=state?.players.find(p=>p.id===localId);
  const aiming = !buildControls.editing && (actionDown("aim") || touch.aim)&&(!p?.inventory||!!p.inventory[p.slot]?.weapon);
  return aiming ? settings.scopeSensitivity*(gun(p).ads?.sensitivity||1) : 1;
}
document.addEventListener("mousemove", (e) => {
  if (
    screen !== "game" ||
    paused ||
    !document.pointerLockElement || chat.opened
  )
    return;
  if(e.movementX||e.movementY)lastEarnAction=performance.now();
  input.yaw -=
    e.movementX * 0.002 * settings.sensitivity * aimSensitivity();
  input.pitch = clamp(
    input.pitch -
      e.movementY *
        0.002 *
        settings.sensitivity *
        (settings.invert ? -1 : 1) *
        aimSensitivity(),
    -1.48,
    1.48,
  );
});
document.addEventListener('click',e=>{
 const slot=e.target.closest('[data-royale-slot]'),swap=e.target.closest('[data-royale-swap]');
 if(slot)inventoryAction('slot',Number(slot.dataset.royaleSlot));
 if(swap)inventoryAction('swap',Number(swap.dataset.royaleSwap));
 if(e.target.id==='royale-fullmap'){
  const rect=e.target.getBoundingClientRect(),size=getMap(state.options.map).size;sendMarker('map',{x:(e.clientX-rect.left)/rect.width*size*2-size,z:(e.clientY-rect.top)/rect.height*size*2-size});
 }
 if(e.target.closest('[data-build-control="repair"]')){if(sim)sim.playerAction(localId,'build-repair');else net?.send({type:'player-action',action:'build-repair'});}
 if(e.target.closest('[data-build-control="edit"]')){const p=state?.players.find(p=>p.id===localId);if(p)buildUI.beginEdit(state,predicted?{...p,...predicted}:p,view.buildMap);}
 if(e.target.closest('button')){sound.unlock();sound.cue('ui-select',null,.45);}
});
// Native desktop dragging, touch dragging, and keyboard reordering share one action.
let touchDrag=null;
dialog.addEventListener('change',e=>{if(e.target.matches('[data-training-weapon]')&&sim?.options.training)sim.playerAction(localId,'training-weapon-'+e.target.value);});
dialog.addEventListener('click',e=>{const drop=e.target.closest('[data-supply-drop]');if(drop){const action='inventory-supply-'+drop.dataset.supplyDrop;if(sim)sim.playerAction(localId,action);else net?.send({type:'player-action',action});}});
let inventoryDragSlot=null;
const applyInventoryDrag=(x,y)=>{const target=inventoryDropTarget(dialog,x,y),from=inventoryDragSlot;if(!Number.isInteger(from)||from<1||from>5)return;if(target?.kind==='drop')inventoryAction('drop',from);else if(target?.kind==='swap'&&target.slot>0&&target.slot!==from)inventoryAction('swap',target.slot,from);};
dialog.addEventListener('dragstart',e=>{const slot=e.target.closest('[data-royale-slot]');if(!slot||Number(slot.dataset.royaleSlot)===0)return;inventoryDragSlot=Number(slot.dataset.royaleSlot);royaleUI.dragging=true;e.dataTransfer.setData('text/plain',String(inventoryDragSlot));e.dataTransfer.effectAllowed='move';slot.classList.add('dragging');});
document.addEventListener('dragover',e=>{if(royaleUI.dragging&&dialogType==='royale-inventory'&&inventoryDropTarget(dialog,e.clientX,e.clientY)){e.preventDefault();e.dataTransfer.dropEffect='move';}});
document.addEventListener('drop',e=>{if(!royaleUI.dragging||dialogType!=='royale-inventory')return;e.preventDefault();applyInventoryDrag(e.clientX,e.clientY);royaleUI.dragging=false;inventoryDragSlot=null;});
dialog.addEventListener('dragend',()=>{royaleUI.dragging=false;inventoryDragSlot=null;royaleUI.inventoryKey='';royaleUI.updateInventory(state?.players.find(p=>p.id===localId));});
dialog.addEventListener('pointerdown',e=>{const slot=e.target.closest('[data-royale-slot]');if(slot&&Number(slot.dataset.royaleSlot)>0&&e.pointerType==='touch'){touchDrag={from:Number(slot.dataset.royaleSlot),x:e.clientX,y:e.clientY};inventoryDragSlot=touchDrag.from;slot.setPointerCapture(e.pointerId);}});
dialog.addEventListener('pointermove',e=>{if(touchDrag&&Math.hypot(e.clientX-touchDrag.x,e.clientY-touchDrag.y)>8){royaleUI.dragging=true;e.preventDefault();}},{passive:false});
dialog.addEventListener('pointerup',e=>{if(!touchDrag)return;const dragged=royaleUI.dragging;touchDrag=null;if(dragged)applyInventoryDrag(e.clientX,e.clientY);royaleUI.dragging=false;inventoryDragSlot=null;royaleUI.inventoryKey='';});
dialog.addEventListener('pointercancel',()=>{touchDrag=null;royaleUI.dragging=false;inventoryDragSlot=null;});
dialog.addEventListener('keydown',e=>{if(dialogType!=='royale-inventory')return;const slot=e.target.closest('[data-royale-slot]');if(slot&&e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const from=Number(slot.dataset.royaleSlot),to=1+((from-1+(e.key==='ArrowRight'?1:4))%5);inventoryAction('swap',to,from);dialog.querySelector(`[data-royale-slot="${to}"]`)?.focus();}});
document.addEventListener('wheel',e=>{if(screen==='game'&&!paused&&!dialog.open&&!chat.opened&&e.deltaY){e.preventDefault();const code=e.deltaY>0?'WheelDown':'WheelUp';pressControl(code);keys.delete(code);}},{passive:false});
document.addEventListener("contextmenu", (e) => {
  if (screen === "game" || (dialog.open&&dialogType==='settings'&&!e.target.matches('input,textarea'))) e.preventDefault();
});
const stick = $("#touch-stick");
stick.addEventListener("pointerdown", (e) => {
  stick.setPointerCapture(e.pointerId);
  updateStick(e);
});
stick.addEventListener("pointermove", (e) => {
  if (stick.hasPointerCapture(e.pointerId)) updateStick(e);
});
function updateStick(e) {
  const r = stick.getBoundingClientRect();
  touch.x = clamp((e.clientX - r.left - r.width / 2) / 40, -1, 1);
  touch.y = clamp((r.top + r.height / 2 - e.clientY) / 40, -1, 1);
  stick.firstChild.style.transform = `translate(${touch.x * 32}px,${-touch.y * 32}px)`;
}
for (const type of ["pointerup", "pointercancel"])
  stick.addEventListener(type, () => {
    touch.x = touch.y = 0;
    stick.firstChild.style.transform = "";
  });
let lookPosition = null;
const look = $("#touch-look");
look.addEventListener("pointerdown", (e) => {
  look.setPointerCapture(e.pointerId);
  lookPosition = { x: e.clientX, y: e.clientY };
});
look.addEventListener("pointermove", (e) => {
  if (!lookPosition) return;
  input.yaw -= (e.clientX - lookPosition.x) * 0.006 * settings.sensitivity * aimSensitivity();
  input.pitch = clamp(
    input.pitch - (e.clientY - lookPosition.y) * 0.006 * settings.sensitivity * aimSensitivity(),
    -1.48,
    1.48,
  );
  lookPosition = { x: e.clientX, y: e.clientY };
});
for (const t of ["pointerup", "pointercancel"])
  look.addEventListener(t, () => (lookPosition = null));
for (const button of document.querySelectorAll("[data-touch]")) {
  button.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    touch[button.dataset.touch] = true;
    if (!paused && !dialog.open) queuedActions.add(button.dataset.touch);
  });
  for (const t of ["pointerup", "pointercancel"])
    button.addEventListener(t, () => (touch[button.dataset.touch] = false));
}
document.addEventListener("graphics-lost", () => {
  paused = true;
  modal(
    "Graphics paused",
    `<p>The browser lost its graphics connection. Reload this page to restore the arena. Try Low graphics in Settings if it happens again.</p>`,
    "error",
  );
});
function frameInput() {
  const active = !document.hidden && !net?.migrating && screen === "game" && !paused && !dialog.open && !chat.opened && state?.players.find(p => p.id === localId)?.health > 0;
  const combat=active&&canFight(state?.players.find(p=>p.id===localId));
  if(active&&!combat){buildControls.buildMode=false;buildUI.cancel();}
  buildControls.yaw=input.yaw;buildControls.pitch=input.pitch;
  buildControls.buildFacing=snappedFacing(input.yaw,buildControls.buildMode?buildControls.buildFacing:undefined);
  if(!actionDown('fire')&&!touch.fire)buildControls.suppressBuildFire=false;
  if(buildUI.edit&&active){const me=predicted||state.players.find(p=>p.id===localId);if(me)buildUI.sample({...me,yaw:input.yaw,pitch:input.pitch},actionDown('fire')||touch.fire,!!settings.confirmEditOnRelease);}
  if(buildUI.edit&&!active)buildUI.down=false;

  const nextInput = {
    seq: ++seq,
    shotTime:sim?state?.time:guestPresentation.poses.targetTime(guestPresentation.time),
    yaw: input.yaw,
    pitch: input.pitch,
    forward: active
      ? Number(actionDown("forward")) -
        Number(actionDown("back")) +
        touch.y
      : 0,
    strafe: active
      ? Number(actionDown("right")) -
        Number(actionDown("left")) +
        touch.x
      : 0,
    jump:
      active && (actionDown("jump") || touch.jump || queuedActions.has("jump")),
    fire: combat && !buildControls.editing && !buildControls.suppressBuildFire && (actionDown("fire") || touch.fire || queuedActions.has("fire")),
    aim: combat && !buildControls.editing && (actionDown("aim") || touch.aim),
    reload:
      active &&
      (actionDown("reload") || touch.reload || queuedActions.has("reload")),
    popper:
      active && !buildControls.editing &&
      (actionDown("popper") ||
        touch.popper ||
        queuedActions.has("popper")),
    buildMode:combat&&buildControls.buildMode,buildType:buildControls.buildType,buildMaterial:buildControls.buildMaterial,buildRotation:buildControls.buildRotation,buildAnchor:buildControls.buildAnchor,editing:buildControls.editing,
    slot: input.slot,
    crouch:active&&(actionDown('crouch')||touch.crouch),
    sprint:active&&(actionDown('sprint')||touch.sprint),
    interact:active&&(actionDown('interact')||touch.interact||queuedActions.has('interact')),
    drop:active&&queuedActions.has('drop'),swapSlot:active?swapSlot:-1,
  };
  swapSlot=-1;
  queuedActions.clear();
  if(active&&(nextInput.forward||nextInput.strafe||nextInput.jump||nextInput.fire||nextInput.interact))lastEarnAction=performance.now();
  return state?.royale?gateBuildFire(triggerGuard,nextInput):nextInput;
}
let lastTime = performance.now(),
  accumulator = 0,
  broadcastClock = 0,
  hudClock = 0,
  lobbyClock = 0;
const inputClock=new InputClock();
function pumpNetworkInput(now=performance.now()) {
  if(!net?.ready||net.migrating||state?.phase!=="playing"||document.hidden||(sim&&!sim.remote&&!net.serverAuthority)){inputClock.reset(now);return;}
  const commands=[];
  for(let step=0,count=inputClock.take(now);step<count;step++){
    const i=frameInput();
      commands.push(i);
      connectionReport.network.sent(i.seq,now);
      const me = state.players.find((p) => p.id === localId);
      if (me?.health > 0) {
        if (!predicted) predicted = { ...me,traversal:me.traversal?{...me.traversal}:null,fall:me.fall?{...me.fall}:null,launchVelocity:me.launchVelocity?{...me.launchVelocity}:null };
        const beforeMove={x:predicted.x,z:predicted.z};
        predictMovement(predicted, i, getMap(state.options.map), 1 / 60, state.royale);
        predicted.vx=(predicted.x-beforeMove.x)*60;predicted.vz=(predicted.z-beforeMove.z)*60;
        predicted.moving = Math.abs(i.forward) + Math.abs(i.strafe) > 0.1;
        {
          const shot=guestFire.step(predicted,i,Math.max(state.time,guestPresentation.time),now/1000,state.round);
          if(shot){view.event(shot,localId);sound.shot(shot.weapon,0,shot.origin);}
        }
        pendingInputs.push(i);
        if (pendingInputs.length > 180) pendingInputs.shift();
      }
  }
  net.inputBatch(commands);
}
const soundVisuals=new SoundVisuals(document.getElementById('hud'));
const triggerGuard={};
const performanceHUD=new PerformanceHUD(document.body);
const lobbyStatus=new LobbyStatus();
const snapshotTimes=new WeakMap();
function loop(now) {
  lobbyStatus.update(now,now-lastTime,net,screen);
  performanceHUD.update(now,now-lastTime,net,settings,screen==='game'&&!document.hidden);
  pumpNetworkInput(now);
  if(state?.royale){view.buildMap=getMap(state.options.map);applyBuildState(view.buildMap,state.royale);}
  if(screen==='game'&&!document.hidden)connectionReport.performance.frame(now-lastTime,net?.isHost?'host':net?'guest':'local',state?.options.mode||'unknown');
  const elapsedFrame=Math.max(0,(now-lastTime)/1000),dt=Math.min(0.1,elapsedFrame);
  const simulate=!(paused&&!net&&screen==='game'&&!['royale-inventory','royale-map'].includes(dialogType));
  if(simulate)sim?.advanceWarmupClock?.(elapsedFrame-dt);
  lastTime = now;
  accumulator += dt;
  broadcastClock += dt;
  hudClock += dt;
  lobbyClock += dt;
  while (accumulator >= 1 / 60) {
    accumulator -= 1 / 60;
    if (sim && !sim.remote && !net?.serverAuthority) {
      const i = frameInput();
      if (simulate) {
        sim.setInput(localId, i);
        sim.tick(1 / 60);
      }
    }
  }
  if (sim && !sim.remote && !net?.serverAuthority && (now-(snapshotTimes.get(sim)||0)>=(net?1000/60:1000/30)||!state)) {
    snapshotTimes.set(sim,now);state = sim.snapshot();handleState();
    if(autoQueue&&screen==='lobby'&&sim.queueEnds&&dialogType!=='setup'){
      const humans=[...sim.players.values()].filter(p=>!p.bot).length;
      if(sim.time>=sim.queueEnds||humans>=sim.options.capacity)launchRound();
    }
    if (net?.isHost && broadcastClock >= .05) {
      net.broadcast(state); broadcastClock = 0;
    }

    if (state.phase === "results" && lastPhase !== "results") {
      lastPhase = "results";
      roundIntro();
    }
  }
  if (lobbyClock > 0.5 && screen === "lobby") {
    renderLobby();
    lobbyClock = 0;
  }
  processEvents();if(screen!=='game'){const afk=document.querySelector('#afk-warning');if(afk)afk.hidden=true;}
  const me = state?.players.find((p) => p.id === localId);
  const currentProgress=(state?.royale?.matchId||net?.code||'local')+':'+state?.round;
  if(currentProgress!==progressMatch){progressMatch=currentProgress;matchEarnings.total=0;matchEarnings.status=me?.friendSpectator?'Spectating · No Marks':net?.serverAuthority?'Match verification pending':net?'Private custom · No Marks':'Practice · No currency rewards';}

  if (me?.spectating && !state.players.some(p => p.id === spectateTarget && p.health > 0 && !p.spectating))
    switchSpectator(1);
  view.spectateTarget = me?.spectating ? spectateTarget : null;
  updateSpectatorStatus(me,now);
  soundVisuals.update(state,me?.spectating?state?.players.find(p=>p.id===spectateTarget):me,{enabled:settings.visualSoundEffects,playing:screen==='game'&&!paused&&!document.hidden},now);
  sound.updateLobby(screen!=='game',dt,document.hidden);
  sound.update(state,me?.spectating?state.players.find(p=>p.id===spectateTarget)||me:me,dt,screen==='game'&&!(!net&&paused));
  let renderPlayer = predicted;
  if (sim && !sim.remote && me) {
    renderPlayer = {
      ...me,
      yaw: input.yaw,
      pitch: input.pitch,
      moving: me.moving,
    };
  } else if (renderPlayer) {
    renderPlayer.yaw = input.yaw;
    renderPlayer.pitch = input.pitch;
  }
  const presentation=(!sim||sim.remote)&&state?guestPresentation.frame(state,renderPlayer,now,dt):{state,player:renderPlayer};
  view.update(
    presentation.state,
    (!sim||sim.remote)&&presentation.player?.health>0?presentation.player:me,
    presentation.player,
    dt,
    screen === "game",
    !paused && !chat.opened && !buildControls.editing && (actionDown("aim") || touch.aim),
    profile,
  );
  // Keep the screen through map construction and asynchronous shader preparation.
  if(!busy&&!view.mapCompile)hideLoading();
  if (hudClock > 0.06) {
    chat.update();
    hud();
    hudClock = 0;
  }
  if(resultAt&&now>=resultAt){resultAt=0;$('#round-banner').hidden=true;if(state?.phase==='results')resultsMenu();}
  const current=state?.players.find(p=>p.id===localId);
  while(damageSources[0]?.until<now)damageSources.shift();
  $('#damage-directions').innerHTML=current?damageSources.map(source=>{
    const dx=source.x-current.x,dz=source.z-current.z,yaw=input.yaw;
    const angle=Math.atan2(dx*Math.cos(yaw)-dz*Math.sin(yaw),-dx*Math.sin(yaw)-dz*Math.cos(yaw))*180/Math.PI;
    return `<i class="damage-direction" style="transform:rotate(${angle}deg);opacity:${Math.min(1,(source.until-now)/500)}"></i>`;
  }).join(''):'';
  $('#hud').classList.toggle('low-health',!!current&&current.health>0&&current.health<25);
  damageFlash = Math.max(0, damageFlash - dt * 1.5);
  $("#damage").style.opacity = damageFlash;
  $("#notice").style.opacity = now < noticeUntil ? 1 : 0;
  $("#toast").style.opacity = now < toastUntil ? 1 : 0;
  for (const row of $("#feed").children)
    if (Number(row.dataset.expire) < now) row.remove();
  requestAnimationFrame(loop);
}
try {
  view = new View($("#world"), settings);
  view.buildControls=buildControls;view.buildMap=getMap('sunnybreak');
  renderMenu();
  initializeParty();
  setInterval(pumpNetworkInput,1000/60);
  requestAnimationFrame(loop);
  const invite = new URL(location.href).searchParams.get("room");
  void waitUntilLoadingHidden().then(()=>showWelcomeBack()).then(()=>{if (invite) joinMenu(formatCode(cleanCode(invite)));});
} catch (e) {
  hideLoading(true);
  console.error(e);
  $("#menu").innerHTML =
    `<section class="panel lobby-panel"><h2>3D graphics unavailable</h2><p style="margin-top:15px">This game needs WebGL 2. Try a current Chrome or Safari with graphics acceleration enabled.</p><p class="hint">${esc(e.message)}</p></section>`;
}
// Development-only diagnostics. Vite removes this branch from the published bundle.
if (import.meta.env.DEV && new URL(location.href).searchParams.has("qa"))
  window.__yolkTest = {
    party:()=>({id:party?.id,party:party?.party,ready:party?.ready}),
    partyMembers:()=>view?.partyEggs?.length||0,
    chatRead: () => ({rows:chat.inbox.rows,open:chat.opened,muted:[...chat.inbox.muted],chatEnabled:net?.chatEnabled}),
    chatPacket: packet => net?.send(packet),
    chatInject: message => {for(const conn of net?.connections.values()||[])conn.send({type:"chat-message",message});},
    checkUpdate: () => updates.check(),
    read: () => ({
      state,
      localId,
      host:!!net?.isHost,
      migrating:!!net?.migrating,
      screen,
      paused,
      connection:connectionReport.text(__BUILD_ID__),
      predicted,
      input: { ...input },
      building: {...buildControls},
      stormVisual: view?.royaleView ? {radius:view.royaleView.wall.scale.x,x:view.royaleView.wall.position.x,z:view.royaleView.wall.position.z,visible:view.royaleView.wall.visible,outside:view.royaleView.wall.material.uniforms.outside.value} : null,
      camera: view?.camera.rotation.toArray(),
      drawCalls: view?.renderer.info.render.calls,
      scope: {
        active: view?.scopeActive,
        aimBlend: view?.aimBlend,
        lens: !!view?.opticLens,
        fov: view?.camera.fov,
      },
      triangles: view?.renderer.info.render.triangles,
      presentation: view?.diagnostics(),
    }),
    network: () =>
      Object.values(net?.peer?.connections || {})
        .flat()
        .map((c) => ({
          open: c.open,
          ice: c.peerConnection?.iceConnectionState,
          gathering: c.peerConnection?.iceGatheringState,
          signaling: c.peerConnection?.signalingState,
          localCandidates: (
            c.peerConnection?.localDescription?.sdp?.match(/a=candidate:/g) ||
            []
          ).length,
          remoteCandidates: (
            c.peerConnection?.remoteDescription?.sdp?.match(/a=candidate:/g) ||
            []
          ).length,
        })),
    finish: () => sim?.finish(),
    fixture: (fn) => fn(sim),
    look: (yaw,pitch) => {input.yaw=yaw;input.pitch=Math.max(-1.48,Math.min(1.48,pitch));},
    pose: (pose) => {
      const p = sim?.players.get(localId);
      if (!p) return;
      Object.assign(p, pose);
      input.yaw = pose.yaw ?? p.yaw;
      input.pitch = pose.pitch ?? p.pitch;
      input.slot = pose.slot ?? p.slot;
      predicted = null;
    },
    setTime: (t) => {
      if (sim) sim.remaining = t;
    },
  };


// Retire the old blocking update latch, including sessions saved before this fix.
try{sessionStorage.removeItem('ravelfront-update-pending');}catch{}
// Each deployment emits its build identifier next to index.html.
const updates = new UpdateWatcher({
  build: __BUILD_ID__,
  isInMatch: () => screen === "game" || state?.phase === "playing",
  fetchVersion: async () => {
    const url = new URL("version.json", location.href);
    url.searchParams.set("t", Date.now());
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Version check unavailable");
    return response.json();
  },
  refresh: (build) => {
    // Preserve saved settings; a unique document URL bypasses an old cached index.
    net?.destroy();
    const url = new URL(location.href);
    url.searchParams.set("build", build);
    url.searchParams.set("refresh", Date.now());
    location.replace(url.href);
  },
});
setInterval(() => void updates.check(), 20000);
setInterval(refreshPublicMatch,1000);
window.addEventListener("focus", () => void updates.check());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void updates.check();
});
void updates.check();
