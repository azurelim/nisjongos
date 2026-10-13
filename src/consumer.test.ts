import { afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { type JsMsg, StringCodec } from 'nats'
import { PAYLOAD_LOG_FILE } from './config'
import { processMessage } from './consumer'

describe('processMessage', () => {
  const sc = StringCodec()

  afterEach(async () => {
    try {
      await rm(PAYLOAD_LOG_FILE, { force: true })
    } catch {
      // ignore
    }
  })

  test('should ack unhandled message subject in default case', async () => {
    let ackCalled = false

    const mockMsg = {
      subject: 'events.test.unknown-topic',
      data: sc.encode(JSON.stringify({ hello: 'world' })),
      ack: () => {
        ackCalled = true
      },
    } as unknown as JsMsg

    await processMessage(mockMsg)

    expect(ackCalled).toBe(true)
  })
})
