# simple-telnet-lib

Typescript lib for simple telnet connection with NodeJS

Example use:
```typescript
import { TelnetT } from 'min-telnet-lib'

async function run() {
    const client = new TelnetT({
        host: '127.0.0.1'
    })

    const connectState = await client.isConnected()
    if (!connectState) {
        console.log('Connection failed')
        return
    }

    await client.auth({
        login: 'admin',
        password: 'admin',
    })

    const resultCmd = await client.exec('show vesion')
    console.log(resultCmd)
    await client.disconnect()
}

run().then()
```
