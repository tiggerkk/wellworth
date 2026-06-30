// Build the Literature module's static corpus from the source SQLite database.
//
// The Literature corpus is immutable, shared, non-private reference data, so it ships as a versioned
// STATIC ASSET (not a Postgres table): fully offline, zero DB cost, updates by redeploying files.
// This build step reads the source `poems.db` (from the standalone github.com/tiggerkk/chinese-
// literature app) and emits the asset tree under public/literature/. Run it locally whenever the
// corpus changes, then commit public/literature/** (that tree is the deployable source of truth —
// no DB or better-sqlite3 is needed at deploy/CI time). See docs/OWNER_RUNBOOK.md.
//
//   Input  : scripts/literature/poems.db   (GITIGNORED — owner drops it here; never committed)
//   Output : public/literature/{meta,index}.json + poem/<id>.json + writer/<id>.json
//
// Source schema (HK-Traditional text already applied via OpenCC — copied verbatim, no conversion):
//   writers(id, name, dynasty, simpleIntro, detailIntro, headImageUrl)
//   guwen(id, title, dynasty, writer_id, content, remark, translation, shangxi, audioUrl)
//   types(id, name)                              — flat category names
//   guwen_to_types(guwen_id, type_id)            — poem↔type junction
//
// Usage: npm run build:literature   (needs the better-sqlite3 devDependency installed)

import Database from 'better-sqlite3'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DB_PATH = join(ROOT, 'scripts', 'literature', 'poems.db')
const OUT_DIR = join(ROOT, 'public', 'literature')

// Bump when the asset shape (not just content) changes, so the runtime cache name can be invalidated.
const CORPUS_VERSION = 1
const EXCERPT_LEN = 40

// The curated filter vocabulary: which `types.name` values appear under each FilterPanel group, in
// display order. A type not in any list is kept (kind 'other') so its poem links still resolve, but
// it isn't surfaced as a filter. Keep these in sync with docs/11_literature.md.
// These are matched against the actual `types.name` values in poems.db (curated subset shown as
// filters; everything else stays kind 'other'). Tag names follow this corpus's spelling — seasons are
// 春天/…, school anthologies split into 古詩/文言文, and 親友/孤苦 map to the data's 友情/孤獨.
const TYPE_GROUPS = {
  theme: [
    '愛國',
    '邊塞',
    '懷古',
    '羈旅',
    '貶謫',
    '哲理',
    '景物',
    '友情',
    '愛情',
    '孤獨',
    '抒情',
    '思念',
  ],
  season: ['春天', '夏天', '秋天', '冬天', '節日'],
  anthology: [
    '唐詩三百首',
    '宋詞三百首',
    '古詩三百首',
    '古詩十九首',
    '詩經',
    '楚辭',
    '古文觀止',
    '小學古詩',
    '小學文言文',
    '初中古詩',
    '初中文言文',
    '高中古詩',
    '高中文言文',
  ],
  // 風格/體裁 — high-frequency poetic styles/forms (a different axis from 主題), surfaced as their own
  // filter group because they tag a large share of the corpus.
  style: ['婉約', '豪放', '樂府'],
}

// Alias layer: map the high-frequency fine-grained ("other") tags onto a curated tag, so a poem
// tagged only e.g. 寫景 / 中秋節 still surfaces under the 景物 / 節日 filter. The 28 pills are unchanged
// — these ~hundred tags just FEED them (a poem keeps its own tags AND gains the curated parent's id).
// Keyed by curated target → its alias tags. Targets must be one of the TYPE_GROUPS names above.
// The long tail (styles like 婉約/豪放, forms like 樂府, misc like 女子/生活) is intentionally left
// unmapped — those poems still appear unfiltered, in search, and under their dynasty.
const TYPE_ALIAS_GROUPS = {
  景物: [
    '寫景',
    '詠物',
    '山水',
    '寫花',
    '梅花',
    '月亮',
    '月夜',
    '寫雨',
    '田園',
    '寫雪',
    '寫鳥',
    '寫風',
    '寫水',
    '寫山',
    '柳樹',
    '荷花',
    '菊花',
    '桃花',
    '西湖',
    '長江',
    '黃河',
    '江南',
    '賞花',
    '惜花',
  ],
  愛情: ['相思', '閨怨', '宮怨', '棄婦', '悼亡', '分手', '春愁'],
  友情: ['離別', '送別', '惜別', '贈別', '友人'],
  羈旅: ['思鄉', '思歸', '紀遊', '遊子', '遊歷', '遊記'],
  愛國: ['憂國憂民'],
  邊塞: ['戰爭', '軍旅', '將士'],
  懷古: ['詠史懷古', '詠史', '弔古傷今', '歷史'],
  哲理: ['寓理', '人生', '寓言', '惜時'],
  孤獨: ['感傷', '傷懷', '孤寂', '愁苦', '悲秋', '失意', '憂傷', '憤懣'],
  貶謫: ['懷才不遇', '壯志難酬', '壯志未酬'],
  抒情: ['抒懷', '感慨', '感嘆'],
  思念: ['懷人', '懷念', '回憶', '追憶'],
  春天: ['傷春', '惜春', '春遊'],
  節日: ['中秋節', '重陽節', '春節', '清明節', '元宵節', '端午節', '七夕節', '寒食節'],
  樂府: ['民歌', '民謠'],
}

// The curated 名家 (famous poets) roster shown on the Poets tab — NOT every writer in the corpus.
// Ported verbatim from the source app's `scripts/migrate-writers.cjs` `famousNames` array
// (github.com/tiggerkk/chinese-literature), where it sets the `isFamous` flag the writers API filters
// on. Only writers whose name is in this set (and have ≥1 poem) are emitted into meta.writers; every
// other writer's writer/<id>.json is still written so poem→poet links resolve for non-famous authors.
// Names follow THIS corpus's HK-Traditional (OpenCC) spelling: the source's 高啟 is stored here as
// 高啓 (the 啓 variant) — see docs/11_literature.md. A name with no matching writer warns at build time.
const FAMOUS_WRITERS = new Set([
  '屈原',
  '曹操',
  '曹植',
  '陶淵明',
  '謝靈運',
  '鮑照',
  '謝朓',
  '庾信',
  '王勃',
  '賀知章',
  '王之渙',
  '孟浩然',
  '王昌齡',
  '王維',
  '李白',
  '高適',
  '杜甫',
  '岑參',
  '韋應物',
  '孟郊',
  '韓愈',
  '劉禹錫',
  '白居易',
  '柳宗元',
  '元稹',
  '賈島',
  '李賀',
  '杜牧',
  '李商隱',
  '李煜',
  '柳永',
  '梅堯臣',
  '歐陽修',
  '蘇舜欽',
  '王安石',
  '蘇軾',
  '黃庭堅',
  '秦觀',
  '賀鑄',
  '周邦彥',
  '李清照',
  '陸游',
  '范成大',
  '楊萬里',
  '辛棄疾',
  '文天祥',
  '元好問',
  '高啓',
  '納蘭性德',
  '龔自珍',
])

// Canonical dynasty order (oldest→newest) for sorting the distinct poem dynasties into filter order.
// Tolerant of both '唐' and '唐代' style values; lists every dynasty value this corpus actually emits
// (incl. '隋代'/'金朝'/'當代' and the catch-all '未知', sorted last). A value not listed sorts last (stable).
const DYNASTY_ORDER = [
  '先秦',
  '秦',
  '漢',
  '兩漢',
  '魏晉',
  '南北朝',
  '隋',
  '隋代',
  '唐',
  '唐代',
  '五代',
  '宋',
  '宋代',
  '遼',
  '金',
  '金朝',
  '元',
  '元代',
  '明',
  '明代',
  '清',
  '清代',
  '近代',
  '現代',
  '當代',
  '未知',
]

/** Strip HTML tags + collapse whitespace (poem content can carry markup). */
function stripHtml(s) {
  return (s ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function dynastyRank(d) {
  const i = DYNASTY_ORDER.indexOf(d ?? '')
  return i === -1 ? DYNASTY_ORDER.length : i
}

function writeJson(relPath, value) {
  const full = join(OUT_DIR, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, JSON.stringify(value))
}

function main() {
  if (!existsSync(DB_PATH)) {
    console.error(
      `\n  poems.db not found at: ${DB_PATH}\n` +
        `  Drop the source database there (it is gitignored) and re-run.\n` +
        `  See docs/OWNER_RUNBOOK.md → Loading the Literature corpus.\n`,
    )
    process.exit(1)
  }

  const db = new Database(DB_PATH, { readonly: true })

  // --- types → kind/sortOrder ------------------------------------------------------------------
  const typeRows = db.prepare('select id, name from types').all()
  const kindOf = new Map() // name → { kind, sortOrder }
  for (const [kind, names] of Object.entries(TYPE_GROUPS)) {
    names.forEach((name, i) => kindOf.set(name, { kind, sortOrder: i }))
  }
  const types = typeRows.map((t) => {
    const hit = kindOf.get(t.name)
    return {
      id: t.id,
      name: t.name,
      kind: hit?.kind ?? 'other',
      sortOrder: hit?.sortOrder ?? 999,
    }
  })
  const otherCount = types.filter((t) => t.kind === 'other').length

  // --- alias resolution (granular tag name → curated parent id) --------------------------------
  const idByName = new Map(typeRows.map((t) => [t.name, t.id]))
  const nameById = new Map(typeRows.map((t) => [t.id, t.name]))
  const curatedIds = new Set(types.filter((t) => t.kind !== 'other').map((t) => t.id))
  const aliasToTargetId = new Map() // alias tag NAME → curated target id
  const missingAlias = []
  for (const [target, aliases] of Object.entries(TYPE_ALIAS_GROUPS)) {
    const targetId = idByName.get(target)
    if (targetId === undefined) {
      console.warn(`  alias target not in data (skipped group): ${target}`)
      continue
    }
    for (const a of aliases) {
      if (!idByName.has(a)) missingAlias.push(a)
      else aliasToTargetId.set(a, targetId)
    }
  }
  if (missingAlias.length) {
    console.warn(`  alias tags not found in data (skipped): ${missingAlias.join(' ')}`)
  }

  // --- poem→types ------------------------------------------------------------------------------
  const typeLinks = db.prepare('select guwen_id, type_id from guwen_to_types').all()
  const typeIdsByPoem = new Map()
  for (const { guwen_id, type_id } of typeLinks) {
    const arr = typeIdsByPoem.get(guwen_id) ?? []
    arr.push(type_id)
    typeIdsByPoem.set(guwen_id, arr)
  }

  // --- writers ---------------------------------------------------------------------------------
  const writerRows = db
    .prepare(
      'select id, name, dynasty, simpleIntro, detailIntro, headImageUrl from writers',
    )
    .all()
  const writerName = new Map(writerRows.map((w) => [w.id, w.name]))
  const poemIdsByWriter = new Map()

  // --- poems -----------------------------------------------------------------------------------
  const poemRows = db
    .prepare(
      'select id, title, dynasty, writer_id, content, remark, translation, shangxi, audioUrl from guwen order by id',
    )
    .all()

  const index = []
  const dynastySet = new Set()
  let withFilterTag = 0
  for (const p of poemRows) {
    const writer = writerName.get(p.writer_id) ?? '佚名'
    // A poem keeps its own tag ids AND gains the curated parent id of any aliased tag it carries,
    // so the 28 filter pills reach the long tail of granular tags.
    const linkedIds = typeIdsByPoem.get(p.id) ?? []
    const expanded = new Set(linkedIds)
    for (const tid of linkedIds) {
      const target = aliasToTargetId.get(nameById.get(tid))
      if (target !== undefined) expanded.add(target)
    }
    const typeIds = [...expanded]
    if (typeIds.some((id) => curatedIds.has(id))) withFilterTag++
    if (p.dynasty) dynastySet.add(p.dynasty)
    const ids = poemIdsByWriter.get(p.writer_id) ?? []
    ids.push(p.id)
    poemIdsByWriter.set(p.writer_id, ids)

    // Index entry: enough to render + search/filter a list card with no body fetch.
    index.push({
      id: p.id,
      title: p.title,
      writerId: p.writer_id,
      writer,
      dynasty: p.dynasty ?? null,
      typeIds,
      excerpt: stripHtml(p.content).slice(0, EXCERPT_LEN),
    })

    // Full body — runtime-cached on open / on favourite.
    writeJson(`poem/${p.id}.json`, {
      id: p.id,
      title: p.title,
      writer,
      writerId: p.writer_id,
      dynasty: p.dynasty ?? null,
      content: p.content,
      translation: p.translation ?? null,
      remark: p.remark ?? null,
      shangxi: p.shangxi ?? null,
      typeIds,
    })
  }

  // --- writer detail files + meta writers-lite -------------------------------------------------
  // meta.writers is the curated 名家 list (FAMOUS_WRITERS only); writer/<id>.json is written for EVERY
  // writer with poems, so a poem by a non-famous author still links to a working poet-detail page.
  const writersLite = []
  const seenFamous = new Set()
  for (const w of writerRows) {
    const poemIds = poemIdsByWriter.get(w.id) ?? []
    if (poemIds.length === 0) continue // skip writers with no poems in the corpus
    if (FAMOUS_WRITERS.has(w.name)) {
      writersLite.push({ id: w.id, name: w.name, dynasty: w.dynasty ?? null })
      seenFamous.add(w.name)
    }
    writeJson(`writer/${w.id}.json`, {
      id: w.id,
      name: w.name,
      dynasty: w.dynasty ?? null,
      simpleIntro: w.simpleIntro ?? null,
      detailIntro: w.detailIntro ?? null,
      headImageUrl: w.headImageUrl ?? null,
      poemIds,
    })
  }
  const writersWithPoems = [...poemIdsByWriter.values()].filter(
    (ids) => ids.length,
  ).length
  const missingFamous = [...FAMOUS_WRITERS].filter((n) => !seenFamous.has(n))
  if (missingFamous.length) {
    console.warn(
      `  famous poets not found in corpus (dropped from 名家 — check OpenCC spelling): ${missingFamous.join(' ')}`,
    )
  }

  const dynasties = [...dynastySet].sort(
    (a, b) => dynastyRank(a) - dynastyRank(b) || a.localeCompare(b),
  )

  writeJson('index.json', index)
  writeJson('meta.json', {
    version: CORPUS_VERSION,
    types,
    writers: writersLite,
    dynasties,
  })

  db.close()

  console.log(
    `Literature corpus built → public/literature/\n` +
      `  poems   : ${index.length}\n` +
      `  writers : ${writersLite.length} famous (of ${writersWithPoems} with poems)\n` +
      `  types   : ${types.length} (${otherCount} unclassified → kind 'other', not shown as filters)\n` +
      `  aliased : ${aliasToTargetId.size} granular tags feed the 28 filters\n` +
      `  coverage: ${withFilterTag}/${index.length} poems carry ≥1 filter tag\n` +
      `  dynasties: ${dynasties.join(' · ')}\n` +
      `  version : ${CORPUS_VERSION}`,
  )
}

// Clear stale output so a regenerated corpus never leaves orphaned poem/writer files. We remove the
// CONTENTS (not OUT_DIR itself) so a watcher/dev-server/Explorer handle on the folder — common on
// Windows — doesn't EPERM the whole build; with retries, and overwrite-in-place as the last resort.
function clearOutDir() {
  if (!existsSync(OUT_DIR)) return
  for (const child of ['index.json', 'meta.json', 'poem', 'writer']) {
    const target = join(OUT_DIR, child)
    if (!existsSync(target)) continue
    try {
      rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch (e) {
      console.warn(
        `  could not clear ${child} (${e.code}) — overwriting in place. ` +
          `If a poem/writer was REMOVED from the corpus, close anything watching ` +
          `public/literature (dev server / Explorer) and delete it manually first.`,
      )
    }
  }
}

clearOutDir()
main()
