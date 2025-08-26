import { createConnection, Socket } from 'net'
import { CustomError } from 'ts-custom-error'

class ServiceError extends CustomError {
    constructor(message: string, public readonly code: string) {
        super(message)
    }
}

export interface ConnectParams {
    host: string
    port?: number
    timeout?: number
}

export interface AuthParams {
    login: string
    password: string
    timeoutAuth?: number
    regExpLogin?: RegExp
    regExpPassword?: RegExp
    regExpFailedLogin?: RegExp
    regExpConnected?: RegExp
}


export class TelnetT {
    private readonly DEFAULT_TELNET_PORT = 23
    private readonly DEFAULT_TELNET_TIMEOUT_CONNECT = 7500
    private readonly DEFAULT_TELNET_TIMEOUT_AUTH = 7500
    private readonly DEFAULT_TELNET_TIMEOUT_EXEC = 7500
    
    private readonly DEFAULT_TERMINAL_WIDTH = 80
    private readonly DEFAULT_TERMINAL_HEIGHT = 24

    private readonly DEFAULT_REGEXP_END = new RegExp('.*[>#]\\s*$')
    private readonly DEFAULT_REGEXP_LOGIN = new RegExp('(.*username*|.*login*|)', 'i')
    private readonly DEFAULT_REGEXP_PASSWORD = new RegExp('.*password*', 'i')
    private readonly DEFAULT_REGEXP_INCORRECT_LOGIN = new RegExp('(.*incorrect*|.*fail*)', 'i')

    private debug: boolean
    private readonly port: number
    private readonly host: string
    private readonly timeout: number
    private client: Socket

    constructor(connectParams: ConnectParams, debug = false) {
        const params = this.sanitizeInitConnectParams(connectParams)
        this.host = params.host
        this.port = params.port!
        this.timeout = params.timeout!
        this.debug = debug
    }

        /**
     * @deprecated The method should not be used. It is used only for compatibility purpose.
     * Use function {@link connect()} instead
     * Deprecated function for checking and init connection to the device
     * @returns boolean
     */
    async isConnected(): Promise<boolean> {
        return !!await this.getConnect()
    }

    /**
     * Function for init connection to the device
     * @returns boolean
     */
    async connect(): Promise<void> {
        await this.getConnect()
        return
    }

    /**
     * Function for disconnecting from device
     * @returns void
     */
    async disconnect(): Promise<void> {
        try {
            this.client?.removeAllListeners()
            this.client?.end()
            this.client?.destroy()
            return
        } catch (_e) {
            return
        }
    }

    /**
     * Function for authorization on device
     * @param authData - {@link AuthParams}
     * @returns boolean
     */
    async auth(authData: AuthParams): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            const authParams = this.sanitizeAuthParams(authData)

            const customTimeoute = setTimeout(() => {
                reject(new ServiceError('Timeout auth', 'ERR_TIMEOUT_AUTH'))
            }, authParams.timeoutAuth)

            try {
                if (await this.initLogin(authParams)) {
                    clearTimeout(customTimeoute)
                    return resolve(true)
                }

                clearTimeout(customTimeoute)
            } catch (e) {
                clearTimeout(customTimeoute)
                reject(e)
            }
        })
    }

    /**
     * Function for sending commands to the device
     * @param cmd - string
     * @param end - regexp
     * ```js
     * default:
     * new RegExp('.*>|.*#')
     * ```
     * @param timeout - number
     * @param pageHeight - optional number to temporarily set terminal height for this command
     * @returns string
     */
    async exec(cmd: string, end = this.DEFAULT_REGEXP_END, timeout = this.DEFAULT_TELNET_TIMEOUT_EXEC, pageHeight?: number): Promise<string> {
        const connection = await this.getConnect()
        
        // If pageHeight is specified, temporarily change terminal height
        if (pageHeight !== undefined) {
            await this.setWindowSize(this.DEFAULT_TERMINAL_WIDTH, pageHeight)
        }
        
        try {
            await this.write(connection, cmd + '\n')
            const result = await this.read(connection, end, timeout)

            await this.setWindowSize(this.DEFAULT_TERMINAL_WIDTH, this.DEFAULT_TERMINAL_HEIGHT)

            return this.trimEmptyLines(result)
        } catch (error) {
            // Restore default height even if command failed
            if (pageHeight !== undefined) {
                await this.setWindowSize(this.DEFAULT_TERMINAL_WIDTH, this.DEFAULT_TERMINAL_HEIGHT)
            }
            throw error
        }
    }

    private async initLogin(authParams: AuthParams): Promise<boolean> {
        const connection = await this.getConnect()
        const loginBuff = await this.read(connection, authParams.regExpLogin!, Math.round(authParams.timeoutAuth! / 2))

        if (authParams.regExpLogin!.test(loginBuff)) {
            await this.delayMS(50)
            await this.write(connection, authParams.login + '\n')

            const passwordBuff = await this.read(connection, authParams.regExpPassword!, Math.round(authParams.timeoutAuth! / 2))
            if (authParams.regExpPassword!.test(passwordBuff)) {
                await this.delayMS(50)
                await this.write(connection, authParams.password + '\n')
                const endBuff = await this.read(connection, authParams.regExpConnected!, Math.round(authParams.timeoutAuth! / 2))

                if (authParams.regExpFailedLogin!.test(endBuff)) {
                    throw new ServiceError('Incorrect login or password', 'FAIL_LOGIN_OR_PASSWORD')
                }

                if (!authParams.regExpConnected!.test(endBuff)) {
                    throw new ServiceError('Could not find any regexp for valid connect on response', 'FAIL_VALID_CONNECT')
                }

                return true
            }

            throw new ServiceError('Could not find regexp password', 'ERR_AUTH')
        }

        throw new ServiceError('Could not find regexp login', 'ERR_AUTH')
    }

    private async write(connection: Socket, data: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            try {
                if (this.debug) {
                    const hex = Buffer.from(data, 'ascii').toString('hex').match(/.{1,2}/g)?.join(' ') || ''
                    console.log(`[${new Date().toISOString()}] WRITING HEX: ${hex}`)
                    console.log(`[${new Date().toISOString()}] WRITING JSON: ${JSON.stringify(data)}`)
                }
                resolve(connection.write(data))
            } catch (e) {
                if (this.debug) {
                    console.log(`[${new Date().toISOString()}] WRITE ERROR: ${e}`)
                }
                reject(e)
            }
        })
    }

    private async read(connection: Socket, match: RegExp, timeout: number): Promise<string> {
        return new Promise(resolve => {
            let bufferLong = ''
            let isResolved = false
            let quitSent = false

            const cleanup = () => {
                if (!isResolved) {
                    connection.removeListener('data', onData)
                    clearTimeout(timeoutTimer)
                    isResolved = true
                }
            }

            const timeoutTimer = setTimeout(() => {
                if (this.debug) {
                    console.log(`[${new Date().toISOString()}] TIMEOUT REACHED! Buffer length: ${bufferLong.length}`)
                    console.log(`[${new Date().toISOString()}] TIMEOUT BUFFER TAIL: ${JSON.stringify(bufferLong.slice(-200))}`)
                }
                cleanup()
                resolve(bufferLong)
            }, timeout)

            const onData = (data: string) => {
                try {
                    if (this.debug) {
                        // Hex dump for analyzing raw bytes
                        const hex = Buffer.from(data, 'ascii').toString('hex').match(/.{1,2}/g)?.join(' ') || ''
                        console.log(`[${new Date().toISOString()}] RAW HEX: ${hex}`)
                        console.log(`[${new Date().toISOString()}] RAW JSON: ${JSON.stringify(data)}`)
                        console.log(`[${new Date().toISOString()}] BUFFER LENGTH: ${bufferLong.length} -> ${bufferLong.length + data.length}`)
                        
                        // Check for telnet IAC sequences
                        if (data.includes('\xFF')) {
                            console.log(`[${new Date().toISOString()}] TELNET IAC DETECTED!`)
                        }
                        
                        // Check for ANSI sequences
                        if (data.includes('\x1B')) {
                            const ansiMatches = data.match(/\x1B\[[0-9;]*[A-Za-z]/g) || []
                            console.log(`[${new Date().toISOString()}] ANSI SEQUENCES: ${JSON.stringify(ansiMatches)}`)
                        }
                        
                        // Check for control chars
                        const controlChars = data.match(/[\x00-\x1F\x7F]/g) || []
                        console.log(`[${new Date().toISOString()}] CONTROL CHARS: ${controlChars.map(c => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(' ')}`)
                    }

                    bufferLong = bufferLong + data
                    
                    // Check for BEL - system waiting for user input
                    if (data.includes('\x07') && !quitSent) {
                        if (this.debug) {
                            console.log(`[${new Date().toISOString()}] BEL DETECTED! System waiting for input, sending Ctrl+C to quit...`)
                        }
                        quitSent = true
                        connection.write('\x03') // Send Ctrl+C to quit pagination
                        setTimeout(() => {
                            cleanup()
                            resolve(bufferLong)
                        }, 1000) // Give device time to process Ctrl+C and return to prompt
                        return
                    }
                    
                    if (this.debug) {
                        console.log(`[${new Date().toISOString()}] TESTING REGEX AGAINST BUFFER (length: ${bufferLong.length})`)
                        console.log(`[${new Date().toISOString()}] REGEX PATTERN: ${match.source}`)
                        console.log(`[${new Date().toISOString()}] REGEX MATCH: ${match.test(bufferLong)}`)
                    }

                    // Check if this looks like a pagination prompt and no normal prompt found
                    if (bufferLong.includes('CTRL+C') && bufferLong.includes('ESC') && bufferLong.includes('Quit') && !quitSent) {
                        if (this.debug) {
                            console.log(`[${new Date().toISOString()}] PAGINATION PROMPT DETECTED! Sending Ctrl+C to quit...`)
                        }
                        quitSent = true
                        connection.write('\x03')
                        // Continue reading for actual command prompt
                        return
                    }

                    if (match.test(bufferLong)) {
                        if (this.debug) {
                            console.log(`[${new Date().toISOString()}] REGEX MATCHED! RESOLVING...`)
                        }
                        cleanup()
                        resolve(bufferLong)
                    }
                } catch (_e) {
                    if (this.debug) {
                        console.log(`[${new Date().toISOString()}] ERROR IN onData: ${_e}`)
                    }
                    cleanup()
                    resolve(bufferLong)
                }
            }

            connection.on('data', onData)
        })
    }

    private async getConnect(): Promise<Socket> {
        if (!this.host) {
            throw new ServiceError('Host is required', 'ERR_HOST_REQUIRED')
        }

        return new Promise((resolve, reject) => {
            if (!this.client) {
                void this.initConnect()
            }

            if (this.client && !this.client.connecting) {
                resolve(this.client)
                return
            }

            this.client.once('timeout', () => {
                reject(new ServiceError(`${this.host} Could not connect in time`, 'ERR_TIMEOUT_CONNECT'))
            })

            this.client.once('error', (err: ServiceError) => {
                reject(new ServiceError(`${this.host} TELNET ERROR: ${err.message}`, err.code))
            })

            this.client.once('connect', () => {
                resolve(this.client)
            })
        })

    }

    private async initConnect(): Promise<void> {
        return new Promise(resolve => {
            this.client = createConnection({
                host: this.host,
                port: this.port,
                timeout: this.timeout
            })

            this.client.setEncoding('ascii')
            
            // Set default terminal window size (80x24)
            this.client.on('connect', () => {
                this.setWindowSize(this.DEFAULT_TERMINAL_WIDTH, this.DEFAULT_TERMINAL_HEIGHT)
            })
            
            resolve()
        })
    }

    private sanitizeInitConnectParams(connectParams: ConnectParams): ConnectParams {
        return {
            port: this.DEFAULT_TELNET_PORT,
            timeout: this.DEFAULT_TELNET_TIMEOUT_CONNECT,
            ...connectParams
        }

    }

    private sanitizeAuthParams(data: AuthParams): AuthParams {
        if (!data.login || !data.password) {
            throw new ServiceError('Login and password must not be empty', 'ERR_LOGIN_PASSWORD_REQUIRED')
        }

        return {
            timeoutAuth: this.DEFAULT_TELNET_TIMEOUT_AUTH,
            regExpLogin: this.DEFAULT_REGEXP_LOGIN,
            regExpPassword: this.DEFAULT_REGEXP_PASSWORD,
            regExpFailedLogin: this.DEFAULT_REGEXP_INCORRECT_LOGIN,
            regExpConnected: this.DEFAULT_REGEXP_END,
            ...data
        }
    }

    private async setWindowSize(width: number, height: number): Promise<void> {
        const naws = Buffer.from([
            255, 250, 31,  // IAC SB NAWS
            Math.floor(width / 256), width % 256,   // width high/low
            Math.floor(height / 256), height % 256, // height high/low  
            255, 240       // IAC SE
        ])
        this.client.write(naws)
    }

    private trimEmptyLines(text: string): string {
        return text.replace(/\n\s*$/g, '')
    }

    private async delayMS(n: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, n)
        })
    }
}
