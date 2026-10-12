import { type JsMsg, StringCodec } from 'nats'
import logger from './logger'
import { provisionAccount } from './provisioning'

export async function handleProvisPaid(msg: JsMsg) {
  const sc = StringCodec()

  let payload: any
  try {
    payload = JSON.parse(sc.decode(msg.data))
  } catch (error: any) {
    // Malformed JSON can never succeed on retry, so drop it.
    logger.error('Invalid JSON in provis-paid message, terminating', {
      error: error.message,
    })
    msg.term()
    return
  }

  const {
    ontUsername: account,
    ontPassword: password,
    bandwidth,
  } = payload ?? {}
  if (typeof account !== 'string' || account.trim() === '') {
    logger.error('provis-paid message missing ontUsername, terminating')
    msg.term()
    return
  }
  if (password !== undefined && typeof password !== 'string') {
    logger.error(
      `provis-paid message has non-string ontPassword for ${account}, terminating`,
    )
    msg.term()
    return
  }

  try {
    logger.info(`Processing provis-paid for account: ${account}`)

    await provisionAccount({
      account,
      password,
      bandwidth,
    })

    logger.info(`Successfully processed provis-paid for ${account}`)
    msg.ack()
  } catch (error: any) {
    logger.error('Error processing provis-paid message', {
      error: error.message,
    })

    if (error.message.includes('CRITICAL: No available IP')) {
      // Clear the blocking message if pool is full to prevent infinite loop
      msg.ack()
      return
    }

    // Nak to retry transient errors (DB, SSH connection)
    msg.nak()
  }
}
