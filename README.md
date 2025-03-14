# simple-telnet-lib

Typescript lib for simple telnet connection with NodeJS

Example use:
```typescript
import { TelnetT } from 'min-telnet-lib'

async function run() {
    const client = new TelnetT({
        host: '127.0.0.1'
    })

    const connectState = await client.сonnect()
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

# Custom Exceptions
- ERR_LOGIN_PASSWORD_REQUIRED - login and password are required
- ERR_TIMEOUT_CONNECT - timeout connection
- ERR_HOST_REQUIRED - host is required
- ERR_AUTH - auth failed (reason in message)
- ERR_TIMEOUT_AUTH - timeout auth
- FAIL_VALID_CONNECT - failed validate connection (not found prompt)
- FAIL_LOGIN_OR_PASSWORD - login or password is incorrect
