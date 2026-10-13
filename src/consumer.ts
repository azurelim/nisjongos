import { type JsMsg, StringCodec } from 'nats'
import logger from './logger'
import { recordIncomingPayload } from './payload-logger'
import { handleProvisPaid } from './provis-paid'
import { handleServiceClosed } from './service-closed'
import { handleTicketSolved } from './ticket-solved'
import { handleTtsCreated } from './tts-created'
import { handleWONusaselecta } from './wo-nusaselecta'

const sc = StringCodec()

export async function processMessage(msg: JsMsg): Promise<void> {
  const rawData = sc.decode(msg.data)
  await recordIncomingPayload(msg.subject, rawData)

  const subjects = msg.subject.split('.')
  switch (subjects[2]) {
    case 'service-closed':
      await handleServiceClosed(msg)
      break
    case 'tts-created':
      await handleTtsCreated(msg)
      break
    case 'ticket-solved':
      await handleTicketSolved(msg)
      break
    case 'wo-nusaselecta':
      await handleWONusaselecta(msg)
      break
    case 'provis-paid':
    case 'provis-free':
      await handleProvisPaid(msg)
      break
    default:
      logger.warn('Unhandled message subject', { subject: msg.subject })
      msg.ack()
      break
  }
}
