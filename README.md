# Min Telnet Library

[![npm version](https://badge.fury.io/js/min-telnet-lib.svg)](https://badge.fury.io/js/min-telnet-lib)
[![npm downloads](https://img.shields.io/npm/dt/min-telnet-lib.svg)](https://www.npmjs.com/package/min-telnet-lib)
[![License](https://img.shields.io/npm/l/min-telnet-lib.svg)](https://github.com/skvoryanich/min-telnet-lib/blob/main/LICENSE)
[![Node.js Version](https://img.shields.io/node/v/min-telnet-lib.svg)](https://nodejs.org/)

A minimal, universal telnet client library for Node.js with robust pagination handling and terminal size negotiation.

Originally designed for creating high-volume telnet connections to network switches within enterprise APIs, this library has no usage restrictions and can be adapted for any telnet-based communication needs.

## Features

- 🚀 **Universal compatibility** - Works with all telnet devices (Cisco, D-Link, Huawei, SNR, etc.)
- 📄 **Smart pagination handling** - Automatic detection and handling of paginated output using BEL signals
- 🖥️ **Terminal size negotiation** - NAWS (RFC 1073) support for controlling terminal dimensions
- 🔍 **Advanced debugging** - Comprehensive debug logging with hex dumps and control character analysis
- ⚡ **Promise-based API** - Modern async/await support
- 🛡️ **Memory leak prevention** - Proper cleanup of event listeners and connections
- 🎯 **Robust prompt detection** - Enhanced regex patterns for reliable command completion

## Installation

```bash
npm install min-telnet-lib
```

## Quick Start

```javascript
import { TelnetT } from 'min-telnet-lib'

const client = new TelnetT({
    host: '192.168.1.1',
    port: 23,
    timeout: 10000
})

// Enable debug mode (optional)
// const client = new TelnetT({ host: '192.168.1.1' }, true)

try {
    // Connect to device
    await client.connect()
    
    // Authenticate
    await client.auth({
        login: 'admin',
        password: 'admin'
    })
    
    // Execute commands
    const result = await client.exec('show version')
    console.log(result)
    
} catch (error) {
    console.error('Error:', error.message)
} finally {
    // Always disconnect when done
    await client.disconnect()
}
```

## API Reference

### Constructor

```typescript
new TelnetT(connectParams: ConnectParams, debug?: boolean)
```

**ConnectParams:**
- `host: string` - Target host address
- `port?: number` - Port number (default: 23)  
- `timeout?: number` - Connection timeout in ms (default: 7500)

**debug:** Enable detailed logging (default: false)

### Methods

#### `connect(): Promise<void>`
Establishes connection to the telnet server.

#### `disconnect(): Promise<void>`
Closes the connection and cleans up resources.

#### `auth(authData: AuthParams): Promise<boolean>`
Performs authentication on the device.

**AuthParams:**
- `login: string` - Username
- `password: string` - Password
- `timeoutAuth?: number` - Authentication timeout in ms (default: 7500)
- `regExpLogin?: RegExp` - Custom login prompt regex (default: `/(.*username*|.*login*|)/i`)
- `regExpPassword?: RegExp` - Custom password prompt regex (default: `/.*password*/i`)
- `regExpFailedLogin?: RegExp` - Failed login detection regex (default: `/(.*incorrect*|.*fail*)/i`)
- `regExpConnected?: RegExp` - Success prompt regex (default: `/.*[>#]\\s*$/`)

#### `exec(cmd: string, end?: RegExp, timeout?: number, pageHeight?: number): Promise<string>`
Executes a command on the device.

**Parameters:**
- `cmd: string` - Command to execute
- `end?: RegExp` - Command completion regex (default: `/.*[>#]\\s*$/`)
- `timeout?: number` - Command timeout in ms (default: 7500)
- `pageHeight?: number` - Temporary terminal height for this command

**Returns:** Command output as string

## Advanced Usage

### Custom Terminal Height

Control terminal height for specific commands to handle pagination:

```javascript
// Execute command with custom terminal height
const result = await client.exec('show log', undefined, undefined, 50)

// Library automatically:
// 1. Sets terminal height to 50 lines
// 2. Executes the command  
// 3. Handles any pagination prompts
// 4. Restores default 80x24 terminal size
// 5. Returns complete output
```

### Custom Authentication Patterns

For devices with non-standard prompts:

```javascript
await client.auth({
    login: 'admin',
    password: 'secret',
    regExpLogin: /Username:/i,
    regExpPassword: /Password:/i,
    regExpConnected: /Router>/,
    regExpFailedLogin: /Access denied/i
})
```

### Debug Mode

Enable debug mode to troubleshoot connection issues:

```javascript
const client = new TelnetT({ host: '192.168.1.1' }, true)

// Debug output includes:
// - Raw hex dumps of data
// - Control character detection
// - ANSI escape sequence analysis
// - Regex matching details
// - Pagination handling steps
```

## Device Examples

### Cisco/SNR Devices

```javascript
try {
    await client.connect()
    await client.auth({ login: 'admin', password: 'admin' })
    
    // Disable paging first
    await client.exec('terminal length 0')
    
    // Execute commands
    const version = await client.exec('show version')
    const logs = await client.exec('show log')
    
} finally {
    await client.disconnect()
}
```

### Huawei Devices

```javascript
try {
    await client.connect()
    await client.auth({ login: 'admin', password: 'admin' })
    
    const version = await client.exec('display version')
    const config = await client.exec('display current-configuration')
    
} finally {
    await client.disconnect()
}
```

### D-Link Devices

```javascript
try {
    await client.connect()
    await client.auth({ login: 'admin', password: 'admin' })
    
    // Use custom terminal height for long outputs
    const logs = await client.exec('show log', undefined, undefined, 100)
    
} finally {
    await client.disconnect()
}
```

## Pagination Handling

The library automatically handles paginated output through multiple mechanisms:

### BEL Signal Detection
Detects BEL (`\x07`) characters that indicate the system is waiting for user input and automatically sends Ctrl+C to continue.

### Text Pattern Recognition  
Recognizes common pagination prompts like:
- `CTRL+C ESC Quit`
- `--More--`
- `Press any key to continue`

### Universal Compatibility
Works across all device types without device-specific configuration.

## Error Handling

The library provides detailed error information:

```javascript
try {
    await client.connect()
} catch (error) {
    switch (error.code) {
        case 'ERR_TIMEOUT_CONNECT':
            console.error('Connection timeout')
            break
        case 'ERR_TIMEOUT_AUTH':
            console.error('Authentication timeout')
            break
        case 'FAIL_LOGIN_OR_PASSWORD':
            console.error('Invalid credentials')
            break
        default:
            console.error('Unexpected error:', error.message)
    }
}
```

## Error Codes

- `ERR_LOGIN_PASSWORD_REQUIRED` - Login and password are required
- `ERR_TIMEOUT_CONNECT` - Connection timeout
- `ERR_HOST_REQUIRED` - Host is required
- `ERR_AUTH` - Authentication failed (reason in message)
- `ERR_TIMEOUT_AUTH` - Authentication timeout
- `FAIL_VALID_CONNECT` - Failed to validate connection (prompt not found)
- `FAIL_LOGIN_OR_PASSWORD` - Login or password is incorrect

## Terminal Size Negotiation (NAWS)

The library implements RFC 1073 NAWS (Negotiate About Window Size) protocol:

- **Default size:** 80 columns × 24 rows
- **Automatic negotiation:** Sent during connection establishment
- **Dynamic resizing:** Temporary changes for specific commands
- **Fallback support:** Works even if device doesn't support NAWS

## Best Practices

1. **Always disconnect:** Use try/finally blocks to ensure cleanup
2. **Handle timeouts:** Set appropriate timeout values for your network
3. **Use debug mode:** Enable debugging when troubleshooting
4. **Custom patterns:** Provide device-specific regex patterns when needed
5. **Page height:** Use pageHeight parameter for commands with long output

## Migration from v1.x

The library maintains backward compatibility. New features:

- `pageHeight` parameter in `exec()` method
- Enhanced pagination handling
- Improved regex patterns for prompt detection
- Better memory management

## Requirements

- Node.js 12 or higher
- TypeScript support included

## License

BSD-3-Clause

## Contributing

Issues and pull requests are welcome on GitHub.
