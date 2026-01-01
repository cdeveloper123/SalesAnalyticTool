import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read version from package.json
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8')
)

// Auto-generate build timestamp
const buildTimestamp = new Date().toISOString()

// Optional: Get git commit hash (if available)
let gitCommitHash = 'unknown'
try {
  gitCommitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
} catch (e) {
  // Git not available, use 'unknown'
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    '__APP_VERSION__': JSON.stringify(packageJson.version),
    '__BUILD_TIMESTAMP__': JSON.stringify(buildTimestamp),
    '__GIT_COMMIT__': JSON.stringify(gitCommitHash),
  },
})

