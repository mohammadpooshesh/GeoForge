import type { FeatureCollection } from "geojson"

export type Predicate = (props: Record<string, unknown>, id?: string) => boolean

const COMPARATORS = ["==", "!=", ">=", "<=", ">", "<"] as const

function parseValue(raw: string): string | number | boolean {
	const t = raw.trim()
	if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
		return t.slice(1, -1)
	}
	if (t === "true") return true
	if (t === "false") return false
	const n = Number(t)
	if (t !== "" && Number.isFinite(n)) return n
	return t
}

function looseEquals(a: unknown, b: unknown): boolean {
	if (typeof a === "number" && typeof b === "number") return a === b
	return String(a ?? "").toLowerCase() === String(b ?? "").toLowerCase()
}

function compare(left: unknown, op: string, right: string | number | boolean): boolean {
	if (op === "==") return looseEquals(left, right)
	if (op === "!=") return !looseEquals(left, right)
	const l = Number(left)
	const r = Number(right)
	if (!Number.isFinite(l) || !Number.isFinite(r)) return false
	switch (op) {
		case ">":
			return l > r
		case "<":
			return l < r
		case ">=":
			return l >= r
		case "<=":
			return l <= r
		default:
			return false
	}
}

/**
 * Parse a simple filter expression into a predicate.
 * Supported: `key == value`, `key != value`, `key > n`, `key >= n`, `key < n`,
 * `key <= n`, `key contains value`, or a bare term matched against ids,
 * property keys, and property values.
 */
export function parseFilter(expr: string): Predicate | null {
	const trimmed = expr.trim()
	if (!trimmed) return null

	const containsMatch = trimmed.match(/^(.+?)\s+contains\s+(.+)$/i)
	if (containsMatch) {
		const key = containsMatch[1].trim()
		const value = String(parseValue(containsMatch[2])).toLowerCase()
		return (props) =>
			String(props[key] ?? "")
				.toLowerCase()
				.includes(value)
	}

	for (const op of COMPARATORS) {
		const idx = trimmed.indexOf(op)
		if (idx <= 0) continue
		const key = trimmed.slice(0, idx).trim()
		const value = parseValue(trimmed.slice(idx + op.length))
		if (!key) continue
		return (props) => compare(props[key], op, value)
	}

	const needle = trimmed.toLowerCase()
	return (props, id) =>
		(id ?? "").toLowerCase().includes(needle) ||
		Object.entries(props).some(
			([k, v]) => k.toLowerCase().includes(needle) || String(v).toLowerCase().includes(needle),
		)
}

/**
 * Apply a filter expression to a FeatureCollection.
 * Returns matching feature ids, or null when the expression is empty.
 */
export function applyFilter(fc: FeatureCollection, expr: string): string[] | null {
	const pred = parseFilter(expr)
	if (!pred) return null
	return fc.features
		.filter((f) =>
			pred((f.properties ?? {}) as Record<string, unknown>, f.id != null ? String(f.id) : undefined),
		)
		.map((f) => String(f.id))
}
