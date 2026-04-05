#!/usr/bin/env node
/**
 * upload-to-railway.mjs
 * Seeds local server/data/ recordings onto the Railway volume via the admin upload endpoint.
 *
 * Usage:
 *   node scripts/upload-to-railway.mjs <BASE_URL> <USERNAME> <PASSWORD>
 *
 * Example:
 *   node scripts/upload-to-railway.mjs https://prayerflow.up.railway.app damionsteen mypassword
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const [,, BASE_URL, USERNAME, PASSWORD] = process.argv
if (!BASE_URL || !USERNAME || !PASSWORD) {
  console.error('Usage: node upload-to-railway.mjs <BASE_URL> <USERNAME> <PASSWORD>')
  process.exit(1)
}

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')

// 1. Login to get JWT token
console.log(`Logging in as ${USERNAME}...`)
const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
})
const loginData = await loginRes.json()
if (!loginData.token) {
  console.error('Login failed:', loginData)
  process.exit(1)
}
const token = loginData.token
console.log('Logged in OK\n')

// 2. Walk data dir and upload each file
let uploaded = 0
let skipped = 0

function walkDir(dir, username) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(fullPath, entry.name)
    } else if (entry.name !== 'users.json') {
      const ext = path.extname(entry.name).toLowerCase()
      if (['.webm', '.mp3', '.wav', '.json'].includes(ext)) {
        uploadFile(fullPath, username, entry.name)
      } else {
        skipped++
      }
    }
  }
}

async function uploadFile(filePath, username, filename) {
  const buf = fs.readFileSync(filePath)
  const url = `${BASE_URL}/api/admin/upload?username=${encodeURIComponent(username)}&filename=${encodeURIComponent(filename)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: buf,
  })
  const data = await res.json()
  if (data.ok) {
    console.log(`✓ ${username}/${filename} (${data.bytes} bytes)`)
    uploaded++
  } else {
    console.error(`✗ ${username}/${filename}:`, data)
  }
}

// Walk root-level files (no subfolder = root user files)
const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true })
for (const entry of entries) {
  const fullPath = path.join(DATA_DIR, entry.name)
  if (entry.isDirectory()) {
    walkDir(fullPath, entry.name)
  } else if (entry.name !== 'users.json') {
    const ext = path.extname(entry.name).toLowerCase()
    if (['.webm', '.mp3', '.wav', '.json'].includes(ext)) {
      await uploadFile(fullPath, USERNAME, entry.name)
    }
  }
}

console.log(`\nDone. Uploaded: ${uploaded}, Skipped: ${skipped}`)
