import fs from 'node:fs'
const BASE = process.env.DSH_WEB_URL ?? process.env.DSH_GUI ?? 'http://127.0.0.1:50210'
const ROOT = process.env.COWRITE_TEST_ROOT ?? '/tmp/cowrite-test-workspace'
const NAME = '.cowrite-r19-probe.md'
const post = async (url, payload) => {
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'dsh-auth-probe=1' },
    body: JSON.stringify({ root: ROOT, ...payload }),
  })
  return res.json()
}
// 1x1 PNG
const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001', 'hex')
const w = await post('/api/dsh-cowrite', { action: 'write', path: NAME, content: '正文\n', baseMtimeMs: 0 })
if (!w.ok) throw new Error(JSON.stringify(w))
const rel = 'assets/e2e-r19.png'
const up = await post('/api/dsh-cowrite/upload', { path: rel, data: png.toString('base64') })
console.log('upload:', up.ok, up.data && up.data.path, up.data && up.data.size, up.data && up.data.type)
const onDisk = fs.readFileSync(`${ROOT}/${rel}`)
console.log('bytes match:', Buffer.compare(onDisk, png) === 0, 'size', onDisk.length)
// the reference can read it back through the raw route
const rawRes = await fetch(`${BASE}/api/dsh-cowrite/raw?root=${encodeURIComponent(ROOT)}&path=${encodeURIComponent(rel)}`, { headers: { cookie: 'dsh-auth-probe=1' } })
console.log('raw route:', rawRes.status, rawRes.headers.get('content-type'))
const served = Buffer.from(await rawRes.arrayBuffer())
console.log('served bytes match:', Buffer.compare(served, png) === 0)
// rejections
const badType = await post('/api/dsh-cowrite/upload', { path: 'assets/x.txt', data: png.toString('base64') })
console.log('non-image rejected:', badType.ok === false && badType.code === 'not-an-image')
const escape = await post('/api/dsh-cowrite/upload', { path: '../x.png', data: png.toString('base64') })
console.log('escape rejected:', escape.ok === false && escape.code === 'outside-root')
const empty = await post('/api/dsh-cowrite/upload', { path: 'assets/y.png', data: '' })
console.log('empty data rejected:', empty.ok === false && empty.code === 'bad-data')
fs.rmSync(`${ROOT}/${rel}`)
fs.rmSync(`${ROOT}/${NAME}`)
try { fs.rmdirSync(`${ROOT}/assets`) } catch {}
console.log('probe removed')
