#!/usr/bin/env node
/* sm_model.js —— 一个只干一件事的 node 脚本：
 *               把 §7.1 那几份 C 源码**当数据读进来**，检查其中的
 *               转移表和状态树是否自洽，并顺手抓两类编译器看不见的死代码。
 *
 * ── 先说清楚这个脚本**不是**什么 ──────────────────────────────
 * 它不执行 C。手边没有主机编译器也没有 qemu，那几份文件的运行时行为
 * 在本机从未被跑过（正文里一律标"未实测"）。
 *
 * 它能做的是两类事，两类都是真证据，但性质不同：
 *
 *  ① 静态检查（强）：表/树是**数据**。数据的自洽性可以直接从源码里读出来判定 ——
 *     "每个复合状态都有 initial"、"没有不可达状态"、"没有环"这类命题，
 *     不需要把程序跑起来就能证伪。这一类的结论和 C 编译器看到的是同一份东西。
 *
 *  ② 影子实现（弱）：浅/深历史的落点差异，需要**跑**才有序列。
 *     这里的做法是把 C 里那几个函数（build_entry_stack / hsm_exit_below /
 *     hsm_transition 与四个 ev_*）照抄成 JS 再跑。所以它证明的是
 *     "结论取决于哪几个量"，**不是**"C 里那几行写对了" ——
 *     照抄是会漂移的，漂移的是算法而不是数据（数据是解析出来的）。
 *     要让两者真正对上，只有在有主机的机器上把 C 编出来跑一遍。
 *     正文会把这条明确写成待办，不假装已经做过。
 *
 * 用法：node tools/sm_model.js        退出码 0 = 全部检查通过
 */
'use strict';

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..');                 // embed-c-course/
const F_SM  = path.join(HERE, 'src', 'sm_event.c');
const F_HSM = path.join(HERE, 'src', 'hsm_history.c');
const F_BASE_FSM = path.join(ROOT, 'verify', 'src', '176__fsm_table.c');
const F_BASE_HSM = path.join(ROOT, 'verify', 'src', '177__hsm.c');

let failed = 0;
const out = [];
function say(s) { out.push(s); }
function ok(s)   { say('  ✓ ' + s); }
function bad(s)  { say('  ✗ ' + s); failed++; }
function check(cond, good, ugly) { if (cond) ok(good); else bad(ugly); }
/* finding 和 bad 的区别很重要：bad 是"检查没通过"，finding 是"检查通过了，
   并且查出了下面这些东西"。把查出来的问题当成脚本失败是很常见的误用 ——
   那样一来"脚本红着"到底是被查的对象有问题、还是脚本自己坏了，就分不清了。
   所以：**发现的问题用 · 列出来，然后用 check() 断言"该发现的我发现了"，**
   脚本的退出码只反映"我这份检查本身是否可信"。 */
function finding(s) { say('  · ' + s); }
function head(s) { say(''); say(s); }

/* ============================================================
   预处理：去注释
   ------------------------------------------------------------
   这一步不是可选项。这些 C 文件的注释里**整段整段地写着 C 代码**
   （"使用与自检"那几段就是），不剥掉注释，正则会把注释里的示例
   当成真代码解析进去，于是"检查通过"变成"检查了一堆不存在的代码"。
   这是所有源码解析脚本的第一道坑，也是唯一一道会让人误信结果的坑。
   ============================================================ */
function stripComments(src) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  s = s.replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
  return s;
}

/* 找到与 idx 处的 '{' 匹配的 '}' 的下标 */
function matchBrace(s, idx) {
  let d = 0;
  for (let i = idx; i < s.length; i++) {
    if (s[i] === '{') d++;
    else if (s[i] === '}') { d--; if (d === 0) return i; }
  }
  return -1;
}

/* 把 'a, b, {c, d}, e' 按**顶层**逗号切开（花括号里的逗号不算） */
function splitTop(s) {
  const parts = [];
  let d = 0, cur = '';
  for (const ch of s) {
    if (ch === '{') d++;
    if (ch === '}') d--;
    if (ch === ',' && d === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.map(p => p.trim()).filter(p => p.length);
}

/* 解析带指定初始化器的聚合体：[K] = { ... } 的嵌套结构 → Map<K, 内容> */
function parseDesignated(body) {
  const map = new Map();
  let i = 0;
  while (i < body.length) {
    const m = /^\[\s*([A-Za-z_]\w*)\s*\]\s*=\s*\{/.exec(body.slice(i));
    if (!m) { i++; continue; }
    const open = i + m[0].length - 1;
    const close = matchBrace(body, open);
    if (close < 0) break;
    map.set(m[1], body.slice(open + 1, close));
    i = close + 1;
  }
  return map;
}

/* 解析 typedef enum 的成员与取值
   ⚠ 千万别写成 /typedef\s+enum\s*\{([\s\S]*?)\}\s*TAG\s*;/ ——
   那个非贪婪量词会从**前一个** typedef enum 的 { 开始一路吃到 TAG 的 }，
   于是 state_t 的定义被算进 event_t 里：一个 9 项的枚举解析出 14 项，
   而检查脚本照样兴高采烈地"全部通过"。这里改成先找到 }
   TAG ;，再回头做花括号配对，取到的一定是紧邻的那个枚举体。 */
function parseEnum(src, tag) {
  const tail = new RegExp('\\}\\s*' + tag + '\\s*;', 'g');
  let m;
  while ((m = tail.exec(src))) {
    const open = src.lastIndexOf('{', m.index);
    const head = src.slice(Math.max(0, open - 40), open);
    if (!/typedef\s+enum\s*$/.test(head)) continue;
    const body = src.slice(open + 1, m.index);
    if (body.includes('{')) continue;                   /* 里面还有一层，不是平枚举 */
    const members = new Map();
    let next = 0;
    for (const raw of splitTop(body)) {
      const mm = /^([A-Za-z_]\w*)\s*(?:=\s*(-?\d+))?$/.exec(raw);
      if (!mm) continue;
      if (mm[2] !== undefined) next = parseInt(mm[2], 10);
      members.set(mm[1], next);
      next++;
    }
    return members;
  }
  return null;
}

/* ============================================================
   A. 7.1.3 的转移表：自洽性
   ============================================================ */
function partA() {
  head('=== A  转移表自洽性 · tools/src/sm_event.c ===');
  const src = stripComments(fs.readFileSync(F_SM, 'utf8'));

  const st  = parseEnum(src, 'state_t');
  const ev  = parseEnum(src, 'event_t');
  const trk = parseEnum(src, 'tr_kind_t');
  if (!st || !ev || !trk) { bad('枚举解析失败：state_t / event_t / tr_kind_t 至少有一个没找到'); return; }
  ok(`解析到 state_t ${st.size} 项、event_t ${ev.size} 项、tr_kind_t ${trk.size} 项`);

  /* 哨兵：0 必须是"无效值"，否则零初始化的空单元格会撞上真状态 */
  const zeroOf = mm => [...mm.entries()].filter(([, v]) => v === 0).map(([k]) => k);
  check(zeroOf(st).length === 1 && zeroOf(st)[0] === 'ST_NONE',
        'state_t 里取值为 0 的只有 ST_NONE 一个 —— 哨兵没有被别人抢走',
        `state_t 里取值为 0 的是 ${JSON.stringify(zeroOf(st))}，哨兵 ST_NONE 不再独占 0`);
  check(zeroOf(ev).length === 1 && zeroOf(ev)[0] === 'EV_NONE',
        'event_t 里取值为 0 的只有 EV_NONE 一个',
        `event_t 里取值为 0 的是 ${JSON.stringify(zeroOf(ev))}`);
  check(zeroOf(trk).length === 1 && zeroOf(trk)[0] === 'TR_NONE',
        'tr_kind_t 里取值为 0 的只有 TR_NONE 一个 —— 空单元格天然是"未定义"',
        `tr_kind_t 里取值为 0 的是 ${JSON.stringify(zeroOf(trk))}`);

  /* 取转移表本体 */
  const gm = /static\s+const\s+transition_t\s+g_sm\s*\[[^\]]*\]\[[^\]]*\]\s*=\s*\{/.exec(src);
  if (!gm) { bad('没找到 g_sm 的定义'); return; }
  const tblBody = src.slice(gm.index + gm[0].length - 1);
  const rows = parseDesignated(tblBody.slice(1, matchBrace(tblBody, 0)));

  /* 状态描述表（要里面的 timeout_ms） */
  const sd = /static\s+const\s+state_desc_t\s+g_states\s*\[[^\]]*\]\s*=\s*\{/.exec(src);
  const descs = sd ? parseDesignated(src.slice(sd.index + sd[0].length - 1, matchBrace(src, sd.index + sd[0].length - 1))) : new Map();

  const cells = [];
  for (const [sname, body] of rows) {
    for (const [ename, ent] of parseDesignated(body)) {
      const f = splitTop(ent);
      cells.push({ s: sname, e: ename, kind: f[0], next: f[1], guard: f[2], action: f[3] });
    }
  }
  /* 哨兵不参与统计：ST_NONE 那一行和 EV_NONE 那一列是给"无效值"留的，
     它们在表里确实各占一行/一列，但没人会往里写转移。 */
  const states = [...st.keys()].filter(k => k !== 'ST_NONE' && !/^ST_COUNT$/.test(k));
  const events = [...ev.keys()].filter(k => k !== 'EV_NONE' && !/^EV_COUNT$/.test(k));
  const nCell = states.length * events.length;
  const by = k => cells.filter(c => c.kind === k).length;
  say(`  状态 ${states.length} 个 · 事件 ${events.length} 个 · 格位 ${nCell} 个 · 已填 ${cells.length} 个`);
  say(`  已填中：外部转移 ${by('TR_EXTERNAL')} · 内部转移 ${by('TR_INTERNAL')} · 外部自转移 ${by('TR_SELF')}`);

  check(by('TR_INTERNAL') >= 1, `表里有 ${by('TR_INTERNAL')} 条内部转移 —— "不跑 exit/enter"这件事表达得出来`,
        '表里一条内部转移都没有：那 7.1.3 说的"内部 vs 外部自转移"就只是句空话');
  check(by('TR_SELF') >= 1, `表里有 ${by('TR_SELF')} 条外部自转移 —— 和内部转移形成了对照`,
        '表里没有外部自转移，读者看不到"目标是自己但 exit/enter 照跑"的例子');

  /* 逐格检查：kind 决定 next 该不该有值 */
  const bad1 = cells.filter(c => c.kind === 'TR_NONE');
  check(bad1.length === 0, '没有一格显式写成 TR_NONE（留空就是留空，不必画蛇添足）',
        `有 ${bad1.length} 格把 kind 写成了 TR_NONE`);
  const bad2 = cells.filter(c => c.kind === 'TR_INTERNAL' && c.next !== 'ST_NONE');
  check(bad2.length === 0, '内部转移的 next 一律写成 ST_NONE —— 状态不动，就不留一个会被误读的目标',
        `有 ${bad2.length} 格是内部转移却填了真目标：${bad2.map(c => `${c.s}/${c.e}→${c.next}`).join(', ')}`);
  const bad3 = cells.filter(c => (c.kind === 'TR_EXTERNAL' || c.kind === 'TR_SELF') && st.get(c.next) === undefined);
  check(bad3.length === 0, '所有外部转移的目标都在 state_t 里存在',
        `有 ${bad3.length} 格指向了不存在的状态：${bad3.map(c => `${c.s}/${c.e}→${c.next}`).join(', ')}`);
  const bad4 = cells.filter(c => (c.kind === 'TR_EXTERNAL' || c.kind === 'TR_SELF') && c.next === 'ST_NONE');
  check(bad4.length === 0, '所有外部转移都有真目标 —— 没有一个"转出去了但不知道去哪"',
        `有 ${bad4.length} 格是外部转移却指向哨兵 ST_NONE：${bad4.map(c => `${c.s}/${c.e}`).join(', ')}`);

  /* 守卫：必须读事件载荷，否则"事件带参数"这条改动就白做了 */
  const guards = cells.filter(c => c.guard && c.guard !== 'NULL');
  check(guards.length >= 1, `${guards.length} 格带守卫：${guards.map(c => c.guard).join(', ')}`,
        '没有一个格带守卫条件 —— "收到 DATA 但缓冲区得有空位"这类规则无处可写');

  /* 可达性：从 ST_INIT 出发 */
  const reach = new Set(['ST_INIT']);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of cells) {
      if (!reach.has(c.s)) continue;
      if (c.kind === 'TR_EXTERNAL' || c.kind === 'TR_SELF') {
        if (!reach.has(c.next)) { reach.add(c.next); grew = true; }
      }
    }
  }
  const unreach = states.filter(s => !reach.has(s));
  check(unreach.length === 0, `全部 ${states.length} 个状态都能从 ST_INIT 走到`,
        `有 ${unreach.length} 个状态从 ST_INIT 走不到：${unreach.join(', ')}`);

  /* 超时派生：声明了 timeout_ms 的状态，表里得真有 EV_TIMEOUT 的边 */
  const withTo = [...descs.entries()].filter(([, b]) => /\.timeout_ms\s*=\s*(\d+)/.exec(b) && parseInt(RegExp.$1, 10) > 0);
  check(withTo.length >= 1, `有 ${withTo.length} 个状态声明了超时：` +
        withTo.map(([n, b]) => `${n}=${/\.timeout_ms\s*=\s*(\d+)/.exec(b)[1]}ms`).join(' · '),
        '没有任何状态声明 timeout_ms —— 超时派生那条路径就是死代码');
  const toNoEdge = withTo.filter(([n]) => !cells.some(c => c.s === n && c.e === 'EV_TIMEOUT'));
  check(toNoEdge.length === 0, '每个声明了超时的状态，表里都有 EV_TIMEOUT 的可走边',
        `这些状态声明了超时却没有 EV_TIMEOUT 边：${toNoEdge.map(x => x[0]).join(', ')} —— 到点了没处可去`);

  say('');
  say('  变异测试（用来证明上面那些 ✓ 不是摆设）：');

  /* 变异一：把一条外部转移的目标改成哨兵 → 必有一条检查变红 */
  const mut1 = cells.map(c => c.s === 'ST_ONLINE' && c.e === 'EV_RESET' ? { ...c, next: 'ST_NONE' } : c);
  const mut1bad = mut1.filter(c => (c.kind === 'TR_EXTERNAL' || c.kind === 'TR_SELF') && c.next === 'ST_NONE');
  check(mut1bad.length > 0, '把 [ST_ONLINE][EV_RESET] 的目标改成 ST_NONE → "外部转移必须有真目标"立刻报错',
        '把一条外部转移的目标改成哨兵，检查居然没反应 —— 那条检查是空的');

  /* 变异二：断掉进入某状态的唯一一条边 → 该状态必变不可达 */
  const mut2 = cells.filter(c => !(c.s === 'ST_ERROR' && c.e === 'EV_RESET') && !(c.next === 'ST_ERROR'));
  const r2 = new Set(['ST_INIT']); let g2 = true;
  while (g2) { g2 = false; for (const c of mut2) { if (!r2.has(c.s)) continue;
    if (c.kind === 'TR_EXTERNAL' || c.kind === 'TR_SELF') if (!r2.has(c.next)) { r2.add(c.next); g2 = true; } } }
  check(!r2.has('ST_ERROR'), '把指向 ST_ERROR 的边全删掉 → "全部可达"立刻报错',
        '把 ST_ERROR 的入边全删了还是判定可达 —— 可达性检查是空的');

  if (failed === 0) say('  A 全部通过');
}

/* ============================================================
   B. 状态树：自洽性
   ============================================================ */
function parseTree(src) {
  const re = /g_tree\s*\[\s*([A-Za-z_]\w*)\s*\]\s*=\s*\(\s*hsm_state_t\s*\)\s*\{([^}]*)\}/g;
  const tree = new Map();
  let m;
  while ((m = re.exec(src))) {
    const f = splitTop(m[2]);
    const deref = v => {
      const mm = /&\s*g_tree\s*\[\s*([A-Za-z_]\w*)\s*\]/.exec(v);
      return mm ? mm[1] : (/^NULL$/.test(v.trim()) ? null : v.trim());
    };
    tree.set(m[1], { name: f[0].replace(/"/g, ''), parent: deref(f[1]), initial: deref(f[2]), history: f[3], ev: f[4] });
  }
  return tree;
}

function partB() {
  head('=== B  状态树自洽性 · tools/src/hsm_history.c ===');
  const src = stripComments(fs.readFileSync(F_HSM, 'utf8'));
  /* 同样不能写 /enum\s*\{([^}]*)\}/ —— 文件里第一个匿名 enum 是 hist_cfg_t，
     名字全带 CFG_ 前缀，于是"S_ 开头的状态"会解析出 0 个，
     而"0 个全部对上"这种话看起来还挺像通过的。锚定到含 S_TOP 的那个。 */
  const en = /enum\s*\{([^}]*\bS_TOP\b[^}]*)\}/.exec(src);
  const declared = en ? splitTop(en[1]).map(s => s.split('=')[0].trim()).filter(s => /^S_/.test(s) && s !== 'S_COUNT') : [];
  const tree = parseTree(src);
  ok(`解析到 ${tree.size} 个状态节点（源码里声明了 ${declared.length} 个）`);
  check(tree.size === declared.length && declared.every(d => tree.has(d)),
        '声明的状态和定义的状态一一对上，没有"声明了没写"或"写了没声明"',
        `声明 ${declared.length} 个、定义 ${tree.size} 个，对不上：缺 ${declared.filter(d => !tree.has(d)).join(', ') || '无'}`);

  const roots = [...tree.entries()].filter(([, v]) => v.parent === null).map(([k]) => k);
  check(roots.length === 1, `只有一个顶层状态：${roots[0]}`,
        `顶层状态有 ${roots.length} 个：${roots.join(', ')} —— 森林当成树用，"从根可达"就无从谈起`);
  if (roots.length !== 1) return;

  /* 父指针必须都指得到、且不能成环 */
  const dangling = [...tree.entries()].filter(([, v]) => v.parent && !tree.has(v.parent));
  check(dangling.length === 0, '所有 parent 指针都指得到真实状态',
        `悬空的 parent：${dangling.map(([k, v]) => `${k}→${v.parent}`).join(', ')}`);
  const badInit = [...tree.entries()].filter(([, v]) => v.initial && !tree.has(v.initial));
  check(badInit.length === 0, '所有 initial 指针都指得到真实状态',
        `悬空的 initial：${badInit.map(([k, v]) => `${k}→${v.initial}`).join(', ')}`);

  let cyc = [];
  for (const k of tree.keys()) {
    const seen = new Set(); let p = k;
    while (p && tree.has(p)) { if (seen.has(p)) { cyc.push(k); break; } seen.add(p); p = tree.get(p).parent; }
  }
  check(cyc.length === 0, '沿父链往上走能走到根，没有环',
        `这些状态沿父链走不出环：${[...new Set(cyc)].join(', ')}`);

  /* initial 必须是 owner 的亲儿子 —— 指到孙子上去，"进复合状态"就会直接跳级 */
  const notChild = [...tree.entries()].filter(([, v]) => v.initial && tree.get(v.initial).parent !== undefined)
    .filter(([k, v]) => tree.get(v.initial).parent !== k);
  check(notChild.length === 0, '每个 initial 都是它主人的**直接**子状态（不是孙辈）',
        `这些 initial 指的不是直接子状态，进复合状态会直接跳级：` +
        notChild.map(([k, v]) => `${k}.initial=${v.initial}(父为${tree.get(v.initial).parent})`).join(', '));

  /* 深度与复合状态数，必须装得下 HSM_MAX_DEPTH / HSM_MAX_COMPOSITE */
  const maxDepth = parseInt((/#define\s+HSM_MAX_DEPTH\s+(\d+)/.exec(src) || [])[1], 10);
  const maxComp  = parseInt((/#define\s+HSM_MAX_COMPOSITE\s+(\d+)/.exec(src) || [])[1], 10);
  let deepest = 0, deepestAt = '';
  for (const k of tree.keys()) { let n = 1, p = tree.get(k).parent; while (p) { n++; p = tree.get(p).parent; } if (n > deepest) { deepest = n; deepestAt = k; } }
  const composites = [...tree.entries()].filter(([, v]) => v.initial !== null).map(([k]) => k);
  const withHist  = [...tree.entries()].filter(([, v]) => v.history && v.history !== 'HIST_NONE').map(([k, v]) => [k, v.history]);
  say(`  最深的一条父子链：${deepestAt} 往下数 ${deepest} 层（HSM_MAX_DEPTH=${maxDepth}）`);
  say(`  复合状态（有 initial）${composites.length} 个：${composites.join(', ')}`);
  say(`  树里写死的带历史状态 ${withHist.length} 个：${withHist.map(([k, h]) => `${k}=${h}`).join(' · ') || '（无）'}`);
  say(`  另有 hist_cfg_t 的三种配置在运行期改写它（hsm_set_config），本脚本在后面照做：`);
  say(`    CFG_SHALLOW_ONLY → RUN=HIST_SHALLOW WORKING=HIST_NONE`);
  say(`    CFG_NESTED_SHALLOW → RUN=HIST_SHALLOW WORKING=HIST_SHALLOW`);
  say(`    CFG_DEEP → RUN=HIST_DEEP WORKING=HIST_NONE`);
  check(deepest <= maxDepth, `树深 ${deepest} ≤ HSM_MAX_DEPTH ${maxDepth} —— 路径数组装得下`,
        `树深 ${deepest} 超过 HSM_MAX_DEPTH ${maxDepth} —— path_to_root 会被截断，LCA 算错`);
  check(composites.length <= maxComp, `复合状态 ${composites.length} 个 ≤ HSM_MAX_COMPOSITE ${maxComp}`,
        `复合状态 ${composites.length} 个超过 HSM_MAX_COMPOSITE ${maxComp} —— hist_slot 会返回 -1，历史静默失效`);

  /* 深历史与非叶子的关系：深历史记的是"往下到叶子的路"，所以那棵子树得有层次 */
  const nested = withHist.filter(([k]) => tree.get(k).initial && tree.get(tree.get(k).initial).initial);
  say(`  其中带历史、且子树本身还有层次的：${nested.map(x => x[0]).join(', ') || '无'}`);

  say('');
  say('  变异测试：');
  const mutTree = new Map([...tree.entries()].map(([k, v]) => [k, { ...v }]));
  mutTree.get('S_RUN').initial = 'S_SPINUP';                   /* 指到孙辈 */
  const mutNotChild = [...mutTree.entries()].filter(([k, v]) => v.initial && mutTree.get(v.initial).parent !== k && v.initial !== null);
  check(mutNotChild.length > 0, '把 Run.initial 改成孙辈 SpinUp → "initial 必须是直接子状态"立刻报错',
        '把 initial 指到孙辈，检查居然没反应 —— 那条检查是空的');
  mutTree.get('S_WORKING').parent = 'S_SPINUP';                /* 制造环 */
  let mc = []; for (const k of mutTree.keys()) { const seen = new Set(); let p = k;
    while (p && mutTree.has(p)) { if (seen.has(p)) { mc.push(k); break; } seen.add(p); p = mutTree.get(p).parent; } }
  check(mc.length > 0, '把 Working.parent 改成 SpinUp → "没有环"立刻报错',
        '造了个环却判定无环 —— 环检测是空的');

  if (failed === 0) say('  B 全部通过');
}

/* ============================================================
   C. 浅/深历史的落点 —— ⚠ 影子实现，不是跑 C
   ------------------------------------------------------------
   下面这段是**照抄**：算法抄自 hsm_history.c 的 build_entry_stack /
   hsm_exit_below / hsm_transition 与四个 ev_*。数据（树、历史标志）是解析出来的。
   照抄会漂移，所以它只用来回答"落点由哪几个量决定"，不用来宣布"C 写对了"。
   ============================================================ */
const SCENARIO = ['EV_GO', 'EV_JOIN_WORK', 'EV_WORK_DONE', 'EV_STOP', 'EV_GO'];

function simulate(tree, cfg, limits) {
  const { maxDepth } = limits;
  const run = tree.get('S_RUN'), work = tree.get('S_WORKING');
  run.history = (cfg === 'CFG_DEEP') ? 'HIST_DEEP' : 'HIST_SHALLOW';
  work.history = (cfg === 'CFG_NESTED_SHALLOW') ? 'HIST_SHALLOW' : 'HIST_NONE';

  const slots = [];                       /* 登记表：只记槽位，不记数据 */
  const shallow = [];
  const deep = [], deepLen = [];
  const slotOf = s => {
    if (!s || s.history === 'HIST_NONE') return -1;
    let i = slots.indexOf(s);
    if (i >= 0) return i;
    if (slots.length >= limits.maxComp) return -1;
    slots.push(s); shallow.push(null); deep.push([]); deepLen.push(0);   /* 新槽位 = 没有记忆 */
    return slots.length - 1;
  };
  const pathToRoot = s => { const a = []; while (s && a.length < maxDepth) { a.push(s); s = tree.get(s).parent; } return a; };
  const exitBelow = (path, ic) => {
    const exited = [];
    for (let k = 0; k < ic; k++) {
      const s = path[k], parent = path[k + 1], slot = slotOf(parent);
      if (slot >= 0) {
        shallow[slot] = s;
        const d = []; for (let j = k; j >= 0 && d.length < maxDepth; j--) d.push(path[j]);
        deep[slot] = d; deepLen[slot] = d.length;
      }
      exited.push(s);
    }
    return exited;
  };
  const buildEntry = start => {
    const stack = []; let s = start;
    while (s && stack.length < maxDepth) {
      stack.push(s);
      if (!tree.get(s).initial) break;
      let next = null; const slot = slotOf(s);
      if (slot >= 0) {
        if (tree.get(s).history === 'HIST_DEEP' && deepLen[slot] > 0) {
          for (const q of deep[slot]) if (stack.length < maxDepth) stack.push(q);
          break;
        }
        if (tree.get(s).history === 'HIST_SHALLOW') next = shallow[slot];
      }
      if (!next) next = tree.get(s).initial;
      s = next;
    }
    return stack;
  };
  const transition = target => {
    const cur = pathToRoot(cur0.current), tgt = pathToRoot(target);
    let best = -1, ic = 0, it = 0;
    for (let i = 0; i < cur.length; i++) for (let j = 0; j < tgt.length; j++) {
      if (cur[i] !== tgt[j]) continue;
      const d = cur.length - 1 - i;
      if (d > best) { best = d; ic = i; it = j; }
    }
    if (best < 0) return;
    exitBelow(cur, ic);
    const entry = it === 0 ? buildEntry(tgt[0]) : buildEntry(tgt[it - 1]);
    for (const e of entry) cur0.current = e;
    cur0.transitions++;
  };
  const handlers = {
    ev_top: (ev) => { if (ev === 'EV_GO') { transition('S_RUN'); return 'HS_TRANS'; } return 'HS_IGNORED'; },
    ev_idle: (ev) => { if (ev === 'EV_JOIN_WORK') { transition('S_WORKING'); return 'HS_TRANS'; } return 'HS_IGNORED'; },
    ev_run: (ev) => { if (ev === 'EV_STOP') { transition('S_OFF'); return 'HS_TRANS'; }
                      if (ev === 'EV_FAULT') { transition('S_FAULT'); return 'HS_TRANS'; } return 'HS_IGNORED'; },
    ev_working_child: (ev) => { if (ev === 'EV_WORK_DONE') { transition('S_STEADY'); return 'HS_TRANS'; }
                                if (ev === 'EV_STOP_WORK') { transition('S_SPINDOWN'); return 'HS_TRANS'; } return 'HS_IGNORED'; },
  };
  const cur0 = { current: 'S_TOP', transitions: 0 };
  const process = (ev, budget) => {
    let s = cur0.current;
    while (s) {
      const h = handlers[tree.get(s).ev];                 /* NULL → 这个状态没有自己的处理函数 */
      const r = h ? h(ev) : 'HS_IGNORED';
      if (r === 'HS_TRANS') { if (budget > 0) return process(ev, budget - 1); return r; }
      if (r === 'HS_HANDLED') return r;
      s = tree.get(s).parent;
    }
    return 'HS_IGNORED';
  };
  for (const e of buildEntry('S_TOP')) cur0.current = e;      /* hsm_enter_initial */
  const trace = [cur0.current];
  for (const ev of SCENARIO) { process(ev, 1); trace.push(`${ev}→${cur0.current}`); }
  return { landing: cur0.current, name: tree.get(cur0.current).name, trace };
}

function partC(tree, limits) {
  head('=== C  浅历史 / 深历史的落点 · 影子实现（算法照抄 C，数据解析自 C）===');
  say('  场景（都从冷启动开始，与 hsm_history.c 文件末尾那段一致）：');
  say('    GO → RUN/Idle，JOIN_WORK → RUN/WORKING/SpinUp，WORK_DONE → RUN/WORKING/Steady，');
  say('    STOP 退出 RUN（此时记下 RUN 的历史），再 GO 重新进 RUN。');
  const expect = {
    CFG_SHALLOW_ONLY:  'S_SPINUP',
    CFG_NESTED_SHALLOW:'S_STEADY',
    CFG_DEEP:          'S_STEADY',
  };
  const res = {};
  for (const cfg of Object.keys(expect)) {
    const r = simulate(tree, cfg, limits);
    res[cfg] = r;
    say(`    ${cfg.padEnd(18)} 落点 ${r.name.padEnd(9)} ${r.landing === expect[cfg] ? '（与预期一致）' : '（★与预期不符）'}`);
    if (r.landing !== expect[cfg]) bad(`${cfg} 落点是 ${r.name}，预期 ${tree.get(expect[cfg]).name}`);
  }
  check(res.CFG_SHALLOW_ONLY.landing !== res.CFG_DEEP.landing,
        '浅历史（只在外层生效）与深历史落点**不同** —— 内层停在哪，浅历史丢了，深历史记得住',
        '三种配置落点全一样 —— 那这个例子根本没演示出浅/深的差别，得把状态树再套一层');
  check(res.CFG_NESTED_SHALLOW.landing === res.CFG_DEEP.landing,
        '逐层都开浅历史 与 只在外层开深历史 落点**相同** —— 两条路殊途同归，代价却不同（见下）',
        '两层的浅历史和外层的深历史落点不一样，那"深历史=整条路径的记忆"这个说法就站不住');
  say(`    重放轨迹：${res.CFG_DEEP.trace.join('  →  ')}`);
  say('  ⚠ 这段的算法是照抄 C 的，只有数据（状态树、历史标志）是解析出来的。');
  say('    它能说明落点由哪几个量决定，不能说明 C 里那几行写对了 —— 见文件头。');
  if (failed === 0) say('  C 全部通过');
}

/* ============================================================
   D. 编译器看不见的死代码
   ------------------------------------------------------------
   编译器（含 -fanalyzer）能报的死代码就三类：未使用的静态变量、未使用的静态
   函数、隐式函数声明。§7.1.1 的三条正好都落在这一类里，闸门直接抓编译告警。
   但 §7.1.2 的两条它一声不吭：**结构体字段被写但没人读**、**枚举成员与另一个
   成员永远同进同出**。这两类只能自己读源码。下面的检查就是为它们写的。
   ============================================================ */
function partD() {
  head('=== D  编译器看不见的死代码 · verify/src/177__hsm.c ===');
  const raw = fs.readFileSync(F_BASE_HSM, 'utf8');
  const src = stripComments(raw);
  const lines = src.split('\n');

  /* D1：结构体字段被写、从不被读 */
  const structM = /struct\s+hsm\s*\{([\s\S]*?)\n\};/.exec(src);
  if (!structM) { bad('没找到 struct hsm 的定义'); return; }
  const fields = [...structM[1].matchAll(/(?:^|\n)\s*(?:const\s+)?[A-Za-z_]\w*\s*\*?\s*([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*;/g)]
    .map(m => m[1]);
  say(`  struct hsm 有 ${fields.length} 个字段：${fields.join(', ')}`);
  const deadFields = [];
  for (const f of fields) {
    const uses = [...src.matchAll(new RegExp('->\\s*' + f + '\\b', 'g'))];
    const reads = uses.filter(m => {
      const after = src.slice(m.index + m[0].length);
      return !/^\s*=(?!=)/.test(after);                 /* '=' 是写，'==' 是读 */
    });
    if (uses.length > 0 && reads.length === 0) deadFields.push({ f, n: uses.length });
  }
  for (const d of deadFields) {
    const ln = lines.findIndex(l => new RegExp('->\\s*' + d.f + '\\b').test(l)) + 1;
    finding(`177__hsm.c:${ln}  字段 ${d.f}：出现 ${d.n} 次，全部是写，0 次读`);
  }
  if (deadFields.length === 0) ok('struct hsm 里没有被写却从不被读的字段');
  check(deadFields.some(d => d.f === 'depth'),
        '抓到 depth：它只在 hsm_init 里被赋 0，之后再没人看过 —— "当前嵌套深度"是个摆设',
        '没能抓到 depth —— 检查逻辑失效了（这条本身就是要证明检查有效）');

  /* D2：枚举成员与另一个成员永远同进同出 → 没有独立语义 */
  const enumM = /typedef\s+enum\s*\{([\s\S]*?)\}\s*hsm_result_t\s*;/.exec(src);
  if (!enumM) { bad('没找到 hsm_result_t'); return; }
  const members = splitTop(enumM[1]).map(s => s.split('=')[0].trim()).filter(s => /^[A-Z_]+$/.test(s));
  const defStart = src.slice(0, enumM.index).split('\n').length;
  const defEnd   = defStart + enumM[0].split('\n').length;
  say(`  hsm_result_t 有 ${members.length} 个成员：${members.join(', ')}`);
  const entangled = [], independent = [];
  for (const m of members) {
    const hits = [];
    lines.forEach((l, i) => {
      if (i + 1 >= defStart && i + 1 <= defEnd) return;   /* 定义那几行不算 */
      if (new RegExp('\\b' + m + '\\b').test(l)) hits.push(i);
    });
    if (hits.length === 0) { bad(`${m} 定义之后再没出现过 —— 定义即死`); continue; }
    const shared = hits.every(i => members.some(o => o !== m && new RegExp('\\b' + o + '\\b').test(lines[i])));
    (shared ? entangled : independent).push({ m, n: hits.length });
  }
  for (const e of entangled) {
    const ln = lines.findIndex(l => new RegExp('\\b' + e.m + '\\b').test(l) &&
      members.some(o => o !== e.m && new RegExp('\\b' + o + '\\b').test(l))) + 1;
    finding(`177__hsm.c:${ln}  枚举成员 ${e.m}：定义之外只出现 ${e.n} 次，` +
            `且每次都和另一个成员写在同一个条件里 —— 它对结果没有独立影响`);
  }
  for (const i of independent) ok(`枚举成员 ${i.m}：出现 ${i.n} 次，有独立语义`);
  check(entangled.some(e => e.m === 'HANDLED'),
        '抓到 HANDLED：它和 TRANSITION 永远出现在同一个 || 里 —— 两个名字，一套行为',
        '没能抓到 HANDLED —— 检查逻辑失效了');
  check(independent.some(i => i.m === 'IGNORED'),
        '非空性对照：IGNORED 被正确判为"有独立语义"，没有被误伤',
        'IGNORED 被误判成死成员了 —— 检查太宽，会把真代码也划进去');

  say('');
  say('  这三条编译器和 -fanalyzer 都一声不吭（实测：177__hsm.c 在');
  say('  -Wall -Wextra -Wpedantic -fanalyzer 下 0 告警）。');
  say('  而 176__fsm_table.c 的三条死代码编译器自己就会报，不必用这个脚本：');
  say('    g_event_names / g_fsm_safe  → -Wunused-const-variable');
  say('    act_start_connect           → -Wunused-function');
  say('  分工是清楚的：**编译器能报的不重复造轮子，编译器报不了的才写脚本。**');

  if (failed === 0) say('  D 全部通过');
}

/* ============================================================
   入口
   ============================================================ */
say('sm_model.js —— 只读 C 源码的静态检查 + 影子实现（不执行 C）');
say(`  读入：${path.relative(ROOT, F_SM)}`);
say(`        ${path.relative(ROOT, F_HSM)}`);
say(`        ${path.relative(ROOT, F_BASE_HSM)}`);

partA();
const bSrc = stripComments(fs.readFileSync(F_HSM, 'utf8'));
const bTree = parseTree(bSrc);
partB();
const limits = {
  maxDepth: parseInt((/#define\s+HSM_MAX_DEPTH\s+(\d+)/.exec(bSrc) || [])[1], 10),
  maxComp:  parseInt((/#define\s+HSM_MAX_COMPOSITE\s+(\d+)/.exec(bSrc) || [])[1], 10),
};
partC(parseTree(bSrc), limits);
partD();

head('=== 汇总 ===');
for (const l of out) {}                        /* out 只在内存里，末尾统一打印 */
process.stdout.write(out.join('\n') + '\n');
if (failed === 0) { console.log('\n全部检查通过（0 处不合格）'); process.exit(0); }
console.log(`\n有 ${failed} 处不合格`);
process.exit(1);
