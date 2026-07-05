// Dependency-free smoke tests for GeoForge's pure logic modules.
// Runs directly with Node >= 22.18 (native TypeScript type stripping):
//   node scripts/smoke.node.mjs
// Node's type stripping does not resolve extensionless relative imports,
// so the needed sources are copied to a temp dir with ".ts" extensions
// appended before importing.
// The full Vitest suite (src/**/*.test.ts) covers these plus the Turf-based
// geometry ops; this script exists so core logic can be verified even
// without installing dependencies.
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

const utilsDir = new URL("../src/utils/", import.meta.url)
const workDir = mkdtempSync(join(tmpdir(), "gfsmoke-"))
for (const name of ["geo.ts", "validation.ts", "filter.ts", "stats.ts", "editorRange.ts"]) {
	const source = readFileSync(new URL(name, utilsDir), "utf8")
	const patched = source.replace(/ from "(\.\.?\/[^"]+)"/g, (match, spec) =>
		spec.endsWith(".ts") ? match : ` from "${spec}.ts"`,
	)
	writeFileSync(join(workDir, name), patched)
}
const load = (name) => import(pathToFileURL(join(workDir, name)).href)

const { validateGeoJSON, hasErrors } = await load("validation.ts")
const { applyFilter } = await load("filter.ts")
const { computeStats } = await load("stats.ts")
const { findFeatureRanges, featureIndexAtOffset } = await load("editorRange.ts")
const { SAMPLE_DATA, serializePretty, ensureIds } = await load("geo.ts")

let passed = 0
let failed = 0
function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  PASS ${name}`)
	} catch (err) {
		failed++
		console.error(`  FAIL ${name}\n    ${err.message}`)
	}
}

console.log("validation")
test("accepts sample data", () => {
	const { data, issues } = validateGeoJSON(serializePretty(SAMPLE_DATA))
	assert.ok(data)
	assert.equal(hasErrors(issues), false)
})
test("reports invalid JSON", () => {
	const { data, issues } = validateGeoJSON('{"type": "FeatureCollection",')
	assert.equal(data, null)
	assert.ok(issues.some((i) => i.severity === "error"))
})
test("rejects non-FeatureCollection root", () => {
	const { issues } = validateGeoJSON(JSON.stringify({ type: "Feature" }))
	assert.ok(hasErrors(issues))
})
test("flags unclosed polygon ring", () => {
	const fc = { type: "FeatureCollection", features: [{ type: "Feature", id: "p", properties: {}, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] } }] }
	const { issues } = validateGeoJSON(JSON.stringify(fc))
	assert.ok(issues.some((i) => /not closed/i.test(i.message)))
})
test("detects duplicate ids", () => {
	const f = (id) => ({ type: "Feature", id, properties: {}, geometry: { type: "Point", coordinates: [0, 0] } })
	const { issues } = validateGeoJSON(JSON.stringify({ type: "FeatureCollection", features: [f("a"), f("a")] }))
	assert.ok(issues.some((i) => /duplicate/i.test(i.message)))
})
test("warns on out-of-range coordinates", () => {
	const fc = { type: "FeatureCollection", features: [{ type: "Feature", id: "x", properties: {}, geometry: { type: "Point", coordinates: [999, 0] } }] }
	const { issues } = validateGeoJSON(JSON.stringify(fc))
	assert.ok(issues.some((i) => /range/i.test(i.message)))
})

console.log("filter")
const filterFc = {
	type: "FeatureCollection",
	features: [
		{ type: "Feature", id: "a", properties: { name: "Central Park", type: "park", population: 0 }, geometry: { type: "Point", coordinates: [0, 0] } },
		{ type: "Feature", id: "b", properties: { name: "Downtown", type: "district", population: 25000 }, geometry: { type: "Point", coordinates: [1, 1] } },
		{ type: "Feature", id: "c", properties: { name: "Harbor", type: "district", population: 1200 }, geometry: { type: "Point", coordinates: [2, 2] } },
	],
}
test("population > 10000", () => assert.deepEqual(applyFilter(filterFc, "population > 10000"), ["b"]))
test("type == park", () => assert.deepEqual(applyFilter(filterFc, "type == park"), ["a"]))
test("type != park", () => assert.deepEqual(applyFilter(filterFc, "type != park"), ["b", "c"]))
test("contains", () => assert.deepEqual(applyFilter(filterFc, "name contains park"), ["a"]))
test("bare term", () => assert.deepEqual(applyFilter(filterFc, "harbor"), ["c"]))

console.log("stats")
test("counts + vertices + bounds", () => {
	const s = computeStats(filterFc)
	assert.equal(s.features, 3)
	assert.equal(s.points, 3)
	assert.equal(s.vertices, 3)
	assert.deepEqual(s.bounds, [0, 0, 2, 2])
	assert.deepEqual(s.center, [1, 1])
})

console.log("editorRange")
test("ranges match features and parse", () => {
	const text = serializePretty(ensureIds(SAMPLE_DATA))
	const ranges = findFeatureRanges(text)
	assert.equal(ranges.length, SAMPLE_DATA.features.length)
	for (const r of ranges) {
		const parsed = JSON.parse(text.slice(r.start, r.end))
		assert.equal(parsed.type, "Feature")
	}
	const mid = Math.floor((ranges[1].start + ranges[1].end) / 2)
	assert.equal(featureIndexAtOffset(text, mid), 1)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
