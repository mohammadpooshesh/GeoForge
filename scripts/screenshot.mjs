// Takes a REAL screenshot of the built app (dist/) using headless Chrome.
//
// Usage:
//   npm run build
//   node scripts/screenshot.mjs
//
// It starts a tiny static server for dist/, opens the app in headless
// Chrome/Chromium, waits for it to render (map tiles, Monaco, fonts), and
// writes docs/screenshot.png. Works locally and in GitHub Actions.

import { spawn, spawnSync } from "node:child_process"
import { createServer } from "node:http"
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs"
import { extname, join, normalize, resolve } from "node:path"

const DIST = resolve("dist")
const OUT = resolve("docs/screenshot.png")
const PORT = Number(process.env.SCREENSHOT_PORT || 4173)
const WIDTH = Number(process.env.SCREENSHOT_WIDTH || 1440)
const HEIGHT = Number(process.env.SCREENSHOT_HEIGHT || 900)

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json",
	".map": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".wasm": "application/wasm",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".webmanifest": "application/manifest+json",
}

function findChrome() {
	const candidates = [
		process.env.CHROME_BIN,
		"google-chrome",
		"google-chrome-stable",
		"chromium",
		"chromium-browser",
	].filter(Boolean)
	for (const bin of candidates) {
		const probe = spawnSync(bin, ["--version"], { stdio: "ignore" })
		if (probe.status === 0) return bin
	}
	return null
}

if (!existsSync(join(DIST, "index.html"))) {
	console.error("dist/index.html not found. Run `npm run build` first.")
	process.exit(1)
}

const chrome = findChrome()
if (!chrome) {
	console.error("No Chrome/Chromium binary found. Set CHROME_BIN or install Chrome.")
	process.exit(1)
}
console.log(`Using browser: ${chrome}`)

const server = createServer((req, res) => {
	try {
		const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
		let filePath = normalize(join(DIST, urlPath))
		if (!filePath.startsWith(DIST)) {
			res.writeHead(403)
			res.end()
			return
		}
		if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
			filePath = join(DIST, "index.html")
		}
		const body = readFileSync(filePath)
		res.writeHead(200, {
			"content-type": MIME[extname(filePath)] || "application/octet-stream",
			"cache-control": "no-store",
		})
		res.end(body)
	} catch (error) {
		res.writeHead(500)
		res.end(String(error))
	}
})

await new Promise((done) => server.listen(PORT, "127.0.0.1", done))
console.log(`Serving dist/ at http://127.0.0.1:${PORT}/`)

mkdirSync("docs", { recursive: true })

const args = [
	"--headless=new",
	"--no-sandbox",
	"--disable-dev-shm-usage",
	"--disable-gpu",
	"--use-angle=swiftshader",
	"--enable-unsafe-swiftshader",
	"--hide-scrollbars",
	"--force-device-scale-factor=1",
	`--window-size=${WIDTH},${HEIGHT}`,
	"--virtual-time-budget=25000",
	"--timeout=60000",
	`--screenshot=${OUT}`,
	`http://127.0.0.1:${PORT}/`,
]

console.log("Taking screenshot...")
const child = spawn(chrome, args, { stdio: "inherit" })
const code = await new Promise((done) => child.on("close", done))
server.close()

if (code !== 0) {
	console.error(`Chrome exited with code ${code}`)
	process.exit(1)
}
if (!existsSync(OUT) || statSync(OUT).size < 10000) {
	console.error("Screenshot missing or suspiciously small.")
	process.exit(1)
}
console.log(`Saved ${OUT} (${statSync(OUT).size} bytes)`)
