import { TelnetT } from './src'

async function run() {
    const client = new TelnetT({
        host: '127.0.0.1'
    })

    await client.connect()

    await client.auth({
        login: 'admin',
        password: 'admin',
    })

    /**
     * Example for Cisco and SNR
     */
    // try {
    //     await client.exec('terminal length 0')
    //     const resultCmd = await client.exec('show log')
    //     // eslint-disable-next-line no-console
    //     console.log(resultCmd)
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
    //     console.log(resultCmd)
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
        const resultCmd = await client.exec('show log')
        // eslint-disable-next-line no-console
        console.log(resultCmd)
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log(e)
    } finally {
        void client.disconnect()
    }
}

void run()
