/// <reference types="vitest" />
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [react()],
	base: "./",
	build: {
		chunkSizeWarningLimit: 2000,
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
})
