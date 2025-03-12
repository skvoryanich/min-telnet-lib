import { TelnetT } from './src/'

async function run() {
    const client = new TelnetT({
        host: 'IP'
    })

    await client.isConnected()

    await client.auth({
        login: 'LOGIN',
        password: 'PASSWORD',
    })

    /**
     * Example for Cisco and SNR
     */
    // try {
    //     await client.exec('terminal length 0')
    //     const resultCmd = await client.exec('show log')
    //     // eslint-disable-next-line no-console
    //     console.log(resultCmd) // Результат для вывода пользователю
    // } catch (e) {
    //     // eslint-disable-next-line no-console
    //     console.log(e)
    // } finally {
    //     void client.disconnect()
    // }

    /**
     * Example for Huawei
     */
    // try {
    //     const resultCmd = await client.exec('display version')
    //     // eslint-disable-next-line no-console
    //     console.log(resultCmd) // Результат для вывода пользователю
    // } catch (e) {
    //     // eslint-disable-next-line no-console
    //     console.log(e)
    // } finally {
    //     void client.disconnect()
    // }

    /**
     * Example for D-Link
     */
    try {
        const resultCmd = await client.exec('show log\nn\nn\nn\nn')
        // eslint-disable-next-line no-console
        console.log(resultCmd) // Результат для вывода пользователю
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(e)
    } finally {
        void client.disconnect()
    }
}

void run()
