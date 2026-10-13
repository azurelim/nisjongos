import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFile, rm } from 'node:fs/promises'
import { PAYLOAD_LOG_FILE } from './config'
import { recordIncomingPayload } from './payload-logger'

describe('recordIncomingPayload', () => {
  const testFile = PAYLOAD_LOG_FILE

  beforeEach(async () => {
    try {
      await rm(testFile, { force: true })
    } catch {
      // ignore
    }
  })

  afterEach(async () => {
    try {
      await rm(testFile, { force: true })
    } catch {
      // ignore
    }
  })

  test('should append valid JSON message to jsonl file', async () => {
    const subject = 'events.customer.wo-nusaselecta'
    const samplePayload = JSON.stringify({
      orderId: 'WO-99881',
      provisioningData: {
        ontUsername: 'user_test',
        ontPassword: 'pwd',
        paymentStatus: 'PAID',
      },
      extraFieldFromProducer: 'custom-data-123',
    })

    await recordIncomingPayload(subject, samplePayload)

    const content = await readFile(testFile, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines.length).toBe(1)

    const firstLine = lines[0] ?? ''
    const entry = JSON.parse(firstLine)
    expect(entry.subject).toBe(subject)
    expect(entry.payload.orderId).toBe('WO-99881')
    expect(entry.payload.extraFieldFromProducer).toBe('custom-data-123')
    expect(entry.timestamp).toBeDefined()
  })

  test('should handle non-JSON string gracefully', async () => {
    const subject = 'events.unknown'
    const rawText = 'plain-text-payload-not-json'

    await recordIncomingPayload(subject, rawText)

    const content = await readFile(testFile, 'utf-8')
    const lines = content.trim().split('\n')
    const firstLine = lines[0] ?? ''
    const entry = JSON.parse(firstLine)

    expect(entry.subject).toBe(subject)
    expect(entry.payload).toBe(rawText)
  })

  test('should append multiple entries sequentially', async () => {
    await recordIncomingPayload('events.one', JSON.stringify({ msg: 1 }))
    await recordIncomingPayload('events.two', JSON.stringify({ msg: 2 }))

    const content = await readFile(testFile, 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines.length).toBe(2)

    const line1 = lines[0] ?? ''
    const line2 = lines[1] ?? ''
    const entry1 = JSON.parse(line1)
    const entry2 = JSON.parse(line2)
    expect(entry1.payload.msg).toBe(1)
    expect(entry2.payload.msg).toBe(2)
  })
})
