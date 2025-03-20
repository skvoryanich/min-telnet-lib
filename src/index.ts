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

    private readonly DEFAULT_REGEXP_END = new RegExp('.*>|.*#')
    private readonly DEFAULT_REGEXP_LOGIN = new RegExp('(.*username*|.*login*|)', 'i')
    private readonly DEFAULT_REGEXP_PASSWORD = new RegExp('.*password*', 'i')
    private readonly DEFAULT_REGEXP_INCORRECT_LOGIN = new RegExp('(.*incorrect*|.*fail*)', 'i')

    private readonly port: number
    private readonly host: string
    private readonly timeout: number
    private client: Socket

    constructor(connectParams: ConnectParams) {
        const params = this.sanitizeInitConnectParams(connectParams)
        this.host = params.host
        this.port = params.port!
        this.timeout = params.timeout!
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
     * @returns string
     */
    async exec(cmd: string, end = this.DEFAULT_REGEXP_END, timeout = this.DEFAULT_TELNET_TIMEOUT_EXEC): Promise<string> {
        const connection = await this.getConnect()
        await this.write(connection, cmd + '\n')
        return this.read(connection, end, timeout)
    }

    private async initLogin(authParams: AuthParams): Promise<boolean> {
        const connection = await this.getConnect()
        const loginBuff = await this.read(connection, authParams.regExpLogin!, Math.round(authParams.timeoutAuth! / 2))

        if (authParams.regExpLogin!.test(loginBuff)) {
            await this.write(connection, authParams.login + '\n')

            const passwordBuff = await this.read(connection, authParams.regExpPassword!, Math.round(authParams.timeoutAuth! / 2))
            if (authParams.regExpPassword!.test(passwordBuff)) {
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
                resolve(connection.write(data))
            } catch (e) {
                reject(e)
            }
        })
    }

    private async read(connection: Socket, match: RegExp, timeout: number): Promise<string> {
        return new Promise(resolve => {
            let bufferLong = ''

            const timeoutTimer = setTimeout(() => {
                resolve(bufferLong)
                connection.removeListener('data', onData)
                clearTimeout(timeoutTimer)
            }, timeout)

            const onData = (data: string) => {
                bufferLong = bufferLong + data
                if (match.test(bufferLong)) {
                    clearTimeout(timeoutTimer)
                    resolve(bufferLong)
                    connection.removeListener('data', onData)
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
}
