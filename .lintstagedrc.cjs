// lint-staged config (moved out of package.json so it can FILTER files with a function).
//
// The Literature corpus is ~10,000 generated minified JSON files under public/literature/. The old
// `*.{json,...}` glob matched all of them, so a commit touching the corpus made lint-staged spawn
// Prettier over ~10k files (in 151 chunks) and ran the machine out of memory ("VirtualAlloc failed").
// Those files are generated + Prettier-ignored, so they must never reach lint-staged. We drop any
// staged path under public/literature/ before building the command. (`*.{ts,tsx}` can't match them —
// they're .json — so that entry stays a plain array that auto-appends its matched files.)

const isCorpus = (file) => file.replace(/\\/g, '/').includes('/public/literature/')
const quote = (file) => JSON.stringify(file)

module.exports = {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,css,md,html}': (files) => {
    const keep = files.filter((f) => !isCorpus(f))
    return keep.length ? [`prettier --write ${keep.map(quote).join(' ')}`] : []
  },
}
