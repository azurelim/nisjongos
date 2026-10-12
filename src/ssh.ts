import { Client } from 'ssh2'
import logger from './logger'

export interface SshConfig {
  host: string
  username: string
  privateKey?: string
  password?: string
  port?: number
  /** Max time to establish the SSH connection (ms). */
  readyTimeout?: number
  /** Max time for the command to finish once connected (ms). */
  commandTimeout?: number
}

// Must stay well under the NATS ack wait (30s) so the handler can still nak.
const DEFAULT_READY_TIMEOUT_MS = 10_000
const DEFAULT_COMMAND_TIMEOUT_MS = 15_000

export function executeRemoteCommand(
  config: SshConfig,
  command: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    const {
      host,
      username,
      privateKey,
      password,
      port = 22,
      readyTimeout = DEFAULT_READY_TIMEOUT_MS,
      commandTimeout = DEFAULT_COMMAND_TIMEOUT_MS,
    } = config

    let commandTimer: ReturnType<typeof setTimeout> | undefined
    const clearTimer = () => {
      if (commandTimer) clearTimeout(commandTimer)
    }

    conn
      .on('ready', () => {
        logger.info(`SSH connection established to ${host}`)
        commandTimer = setTimeout(() => {
          conn.destroy()
          reject(
            new Error(
              `SSH command on ${host} timed out after ${commandTimeout}ms`,
            ),
          )
        }, commandTimeout)
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimer()
            conn.end()
            return reject(err)
          }

          let stdout = ''
          let stderr = ''

          stream
            .on('close', (code: number, signal: string) => {
              logger.info(
                `SSH command closed with code ${code} and signal ${signal}`,
              )
              clearTimer()
              conn.end()
              if (code !== 0) {
                reject(
                  new Error(
                    `Command failed with code ${code}. Stderr: ${stderr}`,
                  ),
                )
              } else {
                resolve(stdout)
              }
            })
            .on('data', (data: Buffer) => {
              stdout += data.toString()
            })
            .stderr.on('data', (data: Buffer) => {
              stderr += data.toString()
            })
        })
      })
      .on('error', (err) => {
        clearTimer()
        logger.error(`SSH connection error: ${err.message}`)
        reject(err)
      })
      .connect({
        host,
        port,
        username,
        privateKey,
        password,
        readyTimeout,
      })
  })
}
