export interface CharRange {
	start: number
	end: number
}

/**
 * Scan the raw JSON text and return character ranges (start inclusive, end
 * exclusive) of each element of the top-level "features" array, in order.
 * Tolerant of any formatting; string contents and escapes are handled.
 */
export function findFeatureRanges(text: string): CharRange[] {
	const keyIndex = text.indexOf('"features"')
	if (keyIndex < 0) return []
	const arrStart = text.indexOf("[", keyIndex)
	if (arrStart < 0) return []

	const ranges: CharRange[] = []
	let inString = false
	let escaped = false
	let objDepth = 0
	let arrDepth = 0
	let objStart = -1

	for (let i = arrStart; i < text.length; i++) {
		const ch = text[i]
		if (inString) {
			if (escaped) escaped = false
			else if (ch === "\\") escaped = true
			else if (ch === '"') inString = false
			continue
		}
		if (ch === '"') {
			inString = true
			continue
		}
		if (ch === "[") {
			arrDepth++
			continue
		}
		if (ch === "]") {
			arrDepth--
			if (arrDepth === 0 && objDepth === 0) break
			continue
		}
		if (ch === "{") {
			if (objDepth === 0 && arrDepth === 1) objStart = i
			objDepth++
			continue
		}
		if (ch === "}") {
			objDepth--
			if (objDepth === 0 && arrDepth === 1 && objStart >= 0) {
				ranges.push({ start: objStart, end: i + 1 })
				objStart = -1
			}
		}
	}
	return ranges
}

/** Index of the feature containing the given character offset, or -1. */
export function featureIndexAtOffset(text: string, offset: number): number {
	const ranges = findFeatureRanges(text)
	return ranges.findIndex((r) => offset >= r.start && offset < r.end)
}
