/**
 * Checks if an error is a connectivity/network error
 * @param errorLike - The error to check
 * @returns true if the error appears to be network-related
 */
export function isConnectivityError(errorLike) {
    const message = String(errorLike?.message || errorLike || '').toLowerCase();
    return (message.includes('failed to fetch')
        || message.includes('networkerror')
        || message.includes('network request failed')
        || message.includes('fetch failed')
        || message.includes('load failed')
        || message.includes('network')
        || message.includes('sin conexión')
        || message.includes('sin conexion'));
}
//# sourceMappingURL=connectivity.js.map